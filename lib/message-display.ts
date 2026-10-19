import type { AgentMessage, AssistantContentBlock, AssistantMessage, ThinkingContent, ToolCallContent, ToolResultMessage } from "./types";
import { isRecordedChapterToolCall, readConversationChapter } from "./conversation-chapters.ts";

interface DisplayOptions {
  isStreaming?: boolean;
  chapterIds?: ReadonlySet<string>;
  toolResults?: ReadonlyMap<string, ToolResultMessage>;
  runningToolCallIds?: ReadonlySet<string>;
  partialToolCallIds?: ReadonlySet<string>;
}

export function getThinkingPreview(thinking: string): string {
  return thinking.trimStart().match(/^[^\r\n]{0,240}/u)?.[0].trimEnd() ?? "";
}

export function isMessageRunAnchor(message: AgentMessage): boolean {
  return message.role === "user"
    || (message.role === "custom" && (
      message.customType === "compaction"
      || message.customType === "branch_summary"
      || message.customType === "pi-web:subagent-notification"
    ));
}

export function isMessageGroupAnchor(message: AgentMessage): boolean {
  // Chapters split displayed phases without ending their containing live run.
  return Boolean(readConversationChapter(message)) || isMessageRunAnchor(message);
}

export function isEmptyThinkingBlock(block: AssistantContentBlock, options: DisplayOptions = {}): block is ThinkingContent {
  return block.type === "thinking" && !block.deferred && !options.isStreaming && block.thinking.trim() === "";
}

export function isDisplayableAssistantBlock(block: AssistantContentBlock, options: DisplayOptions = {}): boolean {
  if (isEmptyThinkingBlock(block, options)) return false;
  if (!options.chapterIds || !isRecordedChapterToolCall(block, options.chapterIds) || block.type !== "toolCall") return true;
  const result = options.toolResults?.get(block.toolCallId);
  return !result || Boolean(result.isError) || Boolean(options.runningToolCallIds?.has(block.toolCallId)) || Boolean(options.partialToolCallIds?.has(block.toolCallId));
}

export function getDisplayableAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): AssistantContentBlock[] {
  return (message.content ?? []).filter((block) => isDisplayableAssistantBlock(block, options));
}

export function getAssistantErrorMessage(
  message: AssistantMessage,
  options: DisplayOptions = {},
): string | null {
  if (options.isStreaming || message.stopReason !== "error") return null;
  return message.errorMessage?.trim() || "Unknown provider error";
}

/**
 * A turn that ended on `stopReason: "length"` spent its whole output budget
 * (often on reasoning alone) and produced no final answer; without a notice it
 * looks like a hung session. The copy lives in i18n (`chat.truncatedByOutputLimit`).
 */
export function isAssistantTruncated(
  message: AssistantMessage,
  options: DisplayOptions = {},
): boolean {
  return !options.isStreaming && message.stopReason === "length";
}

/** Text, an image, or a tool call is an answer. Thinking alone is not. */
export function hasAssistantAnswer(message: AssistantMessage): boolean {
  return (message.content ?? []).some((block) => {
    if (block.type === "text") return block.text.trim().length > 0;
    return block.type === "image" || block.type === "toolCall";
  });
}

function isFinalAnswerBlock(block: AssistantContentBlock): boolean {
  return block.type === "text" || block.type === "image";
}

export function splitFinalAssistantBlocks(
  message: AssistantMessage,
  options: DisplayOptions = {},
): { answerBlocks: AssistantContentBlock[]; processBlocks: AssistantContentBlock[] } {
  const blocks = getDisplayableAssistantBlocks(message, options);
  const lastProcessIndex = blocks.findLastIndex((block) => !isFinalAnswerBlock(block));
  if (lastProcessIndex === -1) {
    return { answerBlocks: blocks, processBlocks: [] };
  }
  return {
    answerBlocks: blocks.slice(lastProcessIndex + 1),
    processBlocks: blocks.slice(0, lastProcessIndex + 1),
  };
}

export function countToolCallBlocks(blocks: AssistantContentBlock[]): number {
  return blocks.filter((block): block is ToolCallContent => block.type === "toolCall").length;
}
