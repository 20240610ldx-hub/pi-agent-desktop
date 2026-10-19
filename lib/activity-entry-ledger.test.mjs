import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { INITIAL_ACTIVITY_ENTRY_LEDGER, activityEntryReducer } = await jiti.import("./activity-entry-ledger.ts");

test("a live start grants an ordered entry exactly once even after consumption", () => {
  let state = activityEntryReducer(INITIAL_ACTIVITY_ENTRY_LEDGER, { type: "toolcall_start", id: "first" });
  state = activityEntryReducer(state, { type: "toolcall_start", id: "second" });
  assert.deepEqual([...state.grants], [["first", 0], ["second", 1]]);
  state = activityEntryReducer(state, { type: "consume", scope: state.scope, ids: ["first"] });
  const consumed = state;
  assert.strictEqual(activityEntryReducer(state, { type: "toolcall_start", id: "first" }), consumed);
  assert.deepEqual([...state.grants], [["second", 1]]);
});

test("history baselines mark IDs seen without revoking already granted live entries", () => {
  let state = activityEntryReducer(INITIAL_ACTIVITY_ENTRY_LEDGER, { type: "toolcall_start", id: "live" });
  state = activityEntryReducer(state, { type: "baseline", messages: [{ role: "assistant", content: [
    { type: "toolCall", id: "stored", name: "read", arguments: {} },
    { type: "toolCall", toolCallId: "live", toolName: "read", input: {} },
  ] }] });
  state = activityEntryReducer(state, { type: "toolcall_start", id: "stored" });
  assert.deepEqual([...state.grants], [["live", 0]]);
});

test("reconnect discards pending grants and suppresses bootstrap starts until its snapshot", () => {
  let state = activityEntryReducer(INITIAL_ACTIVITY_ENTRY_LEDGER, { type: "toolcall_start", id: "before-drop" });
  state = activityEntryReducer(state, { type: "connected", hasStreamingSnapshot: true });
  assert.equal(state.grants.size, 0);
  state = activityEntryReducer(state, { type: "toolcall_start", id: "buffered-start" });
  assert.equal(state.grants.size, 0);
  state = activityEntryReducer(state, { type: "message_start", message: { role: "assistant", content: [
    { type: "toolCall", id: "restored-call", name: "read", arguments: {} },
  ] } });
  state = activityEntryReducer(state, { type: "toolcall_start", id: "restored-call" });
  assert.equal(state.grants.size, 0);
  state = activityEntryReducer(state, { type: "toolcall_start", id: "fresh-call" });
  assert.deepEqual([...state.grants], [["fresh-call", 1]]);
});

test("a running reconnect without a snapshot leaves the next shared live message eligible", () => {
  let state = activityEntryReducer(INITIAL_ACTIVITY_ENTRY_LEDGER, { type: "connected", hasStreamingSnapshot: false });
  state = activityEntryReducer(state, { type: "message_start", message: { role: "assistant", content: [
    { type: "toolCall", id: "next-turn-call", name: "read", arguments: {} },
  ] } });
  state = activityEntryReducer(state, { type: "toolcall_start", id: "next-turn-call" });
  assert.deepEqual([...state.grants], [["next-turn-call", 0]]);
});

test("scope resets isolate grants and ignore a stale consumer acknowledgement", () => {
  let state = activityEntryReducer(INITIAL_ACTIVITY_ENTRY_LEDGER, { type: "toolcall_start", id: "same-id" });
  const oldScope = state.scope;
  state = activityEntryReducer(state, { type: "reset_scope" });
  assert.notEqual(state.scope, oldScope);
  assert.equal(state.grants.size, 0);
  state = activityEntryReducer(state, { type: "toolcall_start", id: "same-id" });
  const nextScope = state;
  assert.strictEqual(activityEntryReducer(state, { type: "consume", scope: oldScope, ids: ["same-id"] }), nextScope);
  assert.deepEqual([...state.grants], [["same-id", 0]]);
});
