import type { ClientAssistantMessageEvent } from "./agent-event-wire";
import { normalizeStreamingToolCalls } from "./normalize";
import type {
  AgentMessage,
  AssistantContentBlock,
  AssistantMessage,
} from "./types";

export type { ClientAssistantMessageEvent } from "./agent-event-wire";

export interface StreamingState {
  isStreaming: boolean;
  streamingMessage: AssistantMessage | null;
  activeThinkingIndex: number | null;
  activeTextIndex: number | null;
}

export type StreamAction =
  | { type: "start" }
  | { type: "resume" }
  | { type: "clear_activity" }
  | { type: "snapshot"; message: AgentMessage; preserveActivity?: boolean }
  | { type: "delta"; event: ClientAssistantMessageEvent }
  | { type: "end" };

export const INITIAL_STREAMING_STATE: StreamingState = {
  isStreaming: false,
  streamingMessage: null,
  activeThinkingIndex: null,
  activeTextIndex: null,
};

function updateContentBlock(
  state: StreamingState,
  contentIndex: number,
  update: (current: AssistantContentBlock | undefined) => AssistantContentBlock | null,
  activeThinkingIndex: number | null = state.activeThinkingIndex,
  activeTextIndex: number | null = state.activeTextIndex,
): StreamingState {
  const message = state.streamingMessage;
  if (!message || !Number.isInteger(contentIndex) || contentIndex < 0) return state;

  const content = [...message.content];
  const nextBlock = update(content[contentIndex]);
  if (!nextBlock) return state;
  content[contentIndex] = nextBlock;
  return {
    ...state,
    isStreaming: true,
    streamingMessage: { ...message, content },
    activeThinkingIndex,
    activeTextIndex,
  };
}

function applyDelta(
  state: StreamingState,
  event: ClientAssistantMessageEvent,
): StreamingState {
  switch (event.type) {
    case "text_start":
      // pi-ai documents `partial` as a shared live response-so-far helper, not
      // an event-time snapshot, and blocks as empty at their `*_start` and
      // grown only by `*_delta` until the authoritative `*_end`. By the time
      // this start is consumed the helper may already carry the block's first
      // delta, so a start must reset the block instead of keeping snapshot
      // text: otherwise that chunk renders twice until `text_end` arrives.
      return updateContentBlock(state, event.contentIndex, () => ({ type: "text", text: "" }), null, event.contentIndex);
    case "text_delta":
      return updateContentBlock(state, event.contentIndex, (current) => (
        current?.type === "text"
          ? { ...current, text: current.text + event.delta }
          : null
      ), null, event.contentIndex);
    case "text_end":
      return updateContentBlock(state, event.contentIndex, (current) => ({
        ...(current?.type === "text" ? current : {}),
        type: "text",
        text: event.content,
      }), state.activeThinkingIndex, state.activeTextIndex === event.contentIndex ? null : state.activeTextIndex);
    case "thinking_start":
      // Same snapshot leak as text_start: reset, or the first thinking chunk
      // renders twice until `thinking_end` replaces the block.
      return updateContentBlock(state, event.contentIndex, () => ({ type: "thinking", thinking: "" }), event.contentIndex, null);
    case "thinking_delta":
      return updateContentBlock(state, event.contentIndex, (current) => (
        current?.type === "thinking"
          ? { ...current, thinking: current.thinking + event.delta }
          : null
      ), event.contentIndex, null);
    case "thinking_end":
      return updateContentBlock(state, event.contentIndex, (current) => ({
        ...(current?.type === "thinking" ? current : {}),
        type: "thinking",
        thinking: event.content,
      }), state.activeThinkingIndex === event.contentIndex ? null : state.activeThinkingIndex);
    case "toolcall_start":
      return updateContentBlock(state, event.contentIndex, (current) => {
        if (current?.type === "toolCall") {
          return {
            ...current,
            toolCallId: event.id ?? current.toolCallId,
            toolName: event.toolName ?? current.toolName,
            // Same snapshot leak as text_start: the deltas rebuild rawInput.
            rawInput: "",
          };
        }
        if (typeof event.toolName !== "string") return null;
        return {
          type: "toolCall",
          toolCallId: event.id ?? "",
          toolName: event.toolName,
          input: {},
          rawInput: "",
        };
      }, null, null);
    case "toolcall_delta":
      return updateContentBlock(state, event.contentIndex, (current) => (
        current?.type === "toolCall"
          ? {
            ...current,
            toolCallId: event.id || current.toolCallId,
            toolName: event.toolName || current.toolName,
            rawInput: (current.rawInput ?? "") + event.delta,
          }
          : null
      ));
    case "toolcall_end":
      return updateContentBlock(state, event.contentIndex, () => ({
        type: "toolCall",
        toolCallId: event.toolCall.id,
        toolName: event.toolCall.name,
        input: event.toolCall.arguments,
      }));
    case "done":
    case "error":
      return state.activeThinkingIndex === null && state.activeTextIndex === null
        ? state
        : { ...state, activeThinkingIndex: null, activeTextIndex: null };
    default:
      return state;
  }
}

function retainedActivityIndex(
  state: StreamingState,
  message: AssistantMessage,
  index: number | null,
  kind: "thinking" | "text",
): number | null {
  const previous = state.streamingMessage;
  // Only a continuous poll may retain evidence, and only for the same message's
  // growing final block. Reconnects and changed/successor blocks establish none.
  if (!state.isStreaming || !previous || index === null
    || previous.timestamp === undefined || previous.timestamp !== message.timestamp
    || previous.provider !== message.provider || previous.model !== message.model
    || index !== previous.content.length - 1 || index !== message.content.length - 1
    || (message.stopReason !== undefined && message.stopReason !== "pending")) return null;
  const before = previous.content[index];
  const after = message.content[index];
  if (kind === "thinking" && before?.type === "thinking" && after?.type === "thinking") {
    return after.thinking.startsWith(before.thinking) ? index : null;
  }
  if (kind === "text" && before?.type === "text" && after?.type === "text") {
    return after.text.startsWith(before.text) ? index : null;
  }
  return null;
}

export function streamReducer(
  state: StreamingState,
  action: StreamAction,
): StreamingState {
  switch (action.type) {
    case "start":
      return { isStreaming: true, streamingMessage: null, activeThinkingIndex: null, activeTextIndex: null };
    case "resume":
      return { ...state, isStreaming: true };
    case "clear_activity":
      return state.activeThinkingIndex === null && state.activeTextIndex === null
        ? state
        : { ...state, activeThinkingIndex: null, activeTextIndex: null };
    case "snapshot": {
      const message = normalizeStreamingToolCalls(action.message);
      if (message.role !== "assistant") return state;
      return {
        isStreaming: true,
        streamingMessage: message,
        activeThinkingIndex: action.preserveActivity
          ? retainedActivityIndex(state, message, state.activeThinkingIndex, "thinking") : null,
        activeTextIndex: action.preserveActivity
          ? retainedActivityIndex(state, message, state.activeTextIndex, "text") : null,
      };
    }
    case "delta":
      return applyDelta(state, action.event);
    case "end":
      return INITIAL_STREAMING_STATE;
    default:
      return state;
  }
}
