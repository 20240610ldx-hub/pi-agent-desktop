import { normalizeToolCalls } from "./normalize";
import type { AgentMessage } from "./types";

export interface ToolEntryState {
  scope: number;
  grants: ReadonlyMap<string, number>;
}

interface ActivityEntryLedger extends ToolEntryState {
  seen: ReadonlySet<string>;
  nextSequence: number;
  restoring: boolean;
}

type ActivityEntryAction =
  | { type: "toolcall_start"; id: string }
  | { type: "baseline"; messages: readonly AgentMessage[] }
  | { type: "connected"; hasStreamingSnapshot?: boolean }
  | { type: "agent_start" }
  | { type: "reset_scope" }
  | { type: "message_start"; message: AgentMessage }
  | { type: "consume"; scope: number; ids: readonly string[] };

export const INITIAL_ACTIVITY_ENTRY_LEDGER: ActivityEntryLedger = {
  scope: 0,
  grants: new Map(),
  seen: new Set(),
  nextSequence: 0,
  restoring: false,
};

export function activityEntryReducer(state: ActivityEntryLedger, action: ActivityEntryAction): ActivityEntryLedger {
  switch (action.type) {
    case "toolcall_start": {
      if (!action.id.trim() || state.seen.has(action.id)) return state;
      return {
        ...state,
        seen: new Set([...state.seen, action.id]),
        grants: state.restoring ? state.grants : new Map([...state.grants, [action.id, state.nextSequence]]),
        nextSequence: state.restoring ? state.nextSequence : state.nextSequence + 1,
      };
    }
    case "baseline": {
      let seen: Set<string> | null = null;
      for (const message of action.messages) {
        const normalized = normalizeToolCalls(message);
        if (normalized.role !== "assistant") continue;
        for (const block of normalized.content) {
          if (block.type !== "toolCall" || !block.toolCallId.trim() || state.seen.has(block.toolCallId)) continue;
          seen ??= new Set(state.seen);
          seen.add(block.toolCallId);
        }
      }
      return seen ? { ...state, seen } : state;
    }
    case "reset_scope":
      return { ...INITIAL_ACTIVITY_ENTRY_LEDGER, scope: state.scope + 1 };
    case "connected":
      // Run-wide isStreaming can stay true between messages with no snapshot.
      // Missing legacy provenance stays conservative until a fresh agent start.
      return { ...state, grants: state.grants.size ? new Map() : state.grants, restoring: action.hasStreamingSnapshot !== false };
    case "agent_start":
      return state.restoring ? { ...state, restoring: false } : state;
    case "message_start":
      return state.restoring && action.message.role === "assistant"
        ? { ...activityEntryReducer(state, { type: "baseline", messages: [action.message] }), restoring: false }
        : state;
    case "consume": {
      if (action.scope !== state.scope || !action.ids.some((id) => state.grants.has(id))) return state;
      const grants = new Map(state.grants);
      for (const id of action.ids) grants.delete(id);
      return { ...state, grants };
    }
  }
}
