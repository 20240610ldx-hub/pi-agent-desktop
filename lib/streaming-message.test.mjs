import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const {
  INITIAL_STREAMING_STATE,
  streamReducer,
} = await jiti.import("./streaming-message.ts");

function assistant(content = []) {
  return {
    role: "assistant",
    content,
    model: "claude-sonnet-4-6",
    provider: "anthropic",
    timestamp: 123,
  };
}

function snapshot(state, message) {
  return streamReducer(state, { type: "snapshot", message });
}

function delta(state, event) {
  return streamReducer(state, { type: "delta", event });
}

test("builds thinking and text blocks from official assistant deltas", () => {
  let state = streamReducer(INITIAL_STREAMING_STATE, { type: "start" });
  state = snapshot(state, assistant());
  state = delta(state, { type: "thinking_start", contentIndex: 0 });
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: "Plan" });
  state = delta(state, { type: "thinking_end", contentIndex: 0, content: "Plan." });
  state = delta(state, { type: "text_start", contentIndex: 1 });
  state = delta(state, { type: "text_delta", contentIndex: 1, delta: "Hel" });
  state = delta(state, { type: "text_delta", contentIndex: 1, delta: "lo" });
  state = delta(state, { type: "text_end", contentIndex: 1, content: "Hello" });

  assert.equal(state.isStreaming, true);
  assert.equal(state.streamingMessage.model, "claude-sonnet-4-6");
  assert.equal(state.streamingMessage.provider, "anthropic");
  assert.equal(state.streamingMessage.timestamp, 123);
  assert.deepEqual(state.streamingMessage.content, [
    { type: "thinking", thinking: "Plan." },
    { type: "text", text: "Hello" },
  ]);
});

test("only indexed thinking events mark the active thinking block", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "thinking", thinking: "Restored reasoning" },
  ]));
  assert.equal(state.activeThinkingIndex, null, "a snapshot alone does not prove activity");

  state = delta(state, { type: "thinking_start", contentIndex: 0 });
  assert.equal(state.activeThinkingIndex, 0);
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: "Live reasoning" });
  assert.equal(state.activeThinkingIndex, 0);
  state = delta(state, { type: "thinking_end", contentIndex: 0, content: "Finished reasoning" });
  assert.equal(state.activeThinkingIndex, null);
  assert.equal(state.streamingMessage.content[0].thinking, "Finished reasoning");
});

test("a successor block start ends thinking activity even without thinking_end", () => {
  for (const successor of [
    { type: "text_start", contentIndex: 1 },
    { type: "toolcall_start", contentIndex: 1, id: "tool-1", toolName: "read" },
    { type: "thinking_start", contentIndex: 1 },
  ]) {
    let state = snapshot(INITIAL_STREAMING_STATE, assistant());
    state = delta(state, { type: "thinking_start", contentIndex: 0 });
    state = delta(state, successor);
    assert.equal(state.activeThinkingIndex, successor.type === "thinking_start" ? 1 : null);
    assert.equal(state.streamingMessage.content[0].type, "thinking");
  }
});

test("assistant completion and error deltas stop thinking activity before message_end", () => {
  for (const event of [
    { type: "done", reason: "stop", message: assistant() },
    { type: "error", reason: "aborted", error: assistant() },
  ]) {
    let state = snapshot(INITIAL_STREAMING_STATE, assistant());
    state = delta(state, { type: "thinking_start", contentIndex: 0 });
    state = delta(state, event);
    assert.equal(state.activeThinkingIndex, null);
  }
});

test("clearing activity preserves the partial until an authoritative message end", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant());
  state = delta(state, { type: "thinking_start", contentIndex: 0 });
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: "Partial reasoning" });
  const message = state.streamingMessage;
  state = streamReducer(state, { type: "clear_activity" });
  assert.equal(state.activeThinkingIndex, null);
  assert.strictEqual(state.streamingMessage, message);
});

test("activity recovery uses known thinking deltas and ignores malformed or unrelated events", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "thinking", thinking: "Restored" },
    { type: "thinking", thinking: "Second" },
  ]));
  state = delta(state, { type: "thinking_delta", contentIndex: 1, delta: " resumed" });
  assert.equal(state.activeThinkingIndex, 1, "a delta restores activity without a repeated start");
  state = delta(state, { type: "thinking_end", contentIndex: 0, content: "First finished" });
  assert.equal(state.activeThinkingIndex, 1, "an unrelated end does not stop the active block");
  for (const event of [
    { type: "thinking_start", contentIndex: -1 },
    { type: "thinking_start", contentIndex: 0.5 },
    { type: "thinking_delta", contentIndex: 9, delta: "unknown block" },
    { type: "future_delta", contentIndex: 1 },
  ]) assert.strictEqual(delta(state, event), state);

  for (const action of [
    { type: "snapshot", message: assistant([{ type: "thinking", thinking: "Reconnected" }]) },
    { type: "start" },
    { type: "end" },
  ]) assert.equal(streamReducer(state, action).activeThinkingIndex, null);
  assert.equal(streamReducer(state, { type: "resume" }).activeThinkingIndex, 1);
});

test("indexed text activity stops the caret at text end and explicit cancellation", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([{ type: "text", text: "Restored" }]));
  assert.equal(state.activeTextIndex, null, "snapshot text is not evidence of active output");
  state = delta(state, { type: "text_start", contentIndex: 0 });
  assert.equal(state.activeTextIndex, 0);
  state = delta(state, { type: "text_delta", contentIndex: 0, delta: "Hello" });
  assert.equal(state.activeTextIndex, 0);
  state = delta(state, { type: "text_end", contentIndex: 0, content: "Hello" });
  assert.equal(state.activeTextIndex, null);
  state = delta(state, { type: "text_delta", contentIndex: 0, delta: " again" });
  assert.equal(state.activeTextIndex, 0, "an indexed delta can restore activity after reconnect");
  state = streamReducer(state, { type: "clear_activity" });
  assert.equal(state.activeTextIndex, null);
  assert.equal(state.streamingMessage.content[0].text, "Hello again");
});

test("text activity follows successor blocks and clears on terminal and reset paths", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([{ type: "text", text: "First" }, { type: "text", text: "Second" }]));
  state = delta(state, { type: "text_delta", contentIndex: 1, delta: " live" });
  state = delta(state, { type: "text_end", contentIndex: 0, content: "First done" });
  assert.equal(state.activeTextIndex, 1, "only matching text ends clear activity");
  for (const event of [
    { type: "thinking_start", contentIndex: 2 },
    { type: "toolcall_start", contentIndex: 2, id: "call", toolName: "read" },
    { type: "done", reason: "stop", message: assistant() },
    { type: "error", reason: "error", error: assistant() },
  ]) assert.equal(delta(state, event).activeTextIndex, null);
  for (const action of [
    { type: "start" }, { type: "end" }, { type: "clear_activity" },
    { type: "snapshot", message: assistant([{ type: "text", text: "Recovered" }]) },
  ]) assert.equal(streamReducer(state, action).activeTextIndex, null);
});

test("a reconciliation snapshot preserves proven activity on the same growing tail block", () => {
  for (const kind of ["thinking", "text"]) {
    let state = snapshot(INITIAL_STREAMING_STATE, assistant());
    state = delta(state, { type: `${kind}_start`, contentIndex: 0 });
    state = delta(state, { type: `${kind}_delta`, contentIndex: 0, delta: "Still working" });
    const message = assistant([{ type: kind, [kind]: "Still working through the task" }]);
    state = streamReducer(state, { type: "snapshot", message, preserveActivity: true });
    assert.equal(state[kind === "thinking" ? "activeThinkingIndex" : "activeTextIndex"], 0);
    assert.equal(state.streamingMessage.content[0][kind], "Still working through the task");
  }
});

test("reconciliation never invents activity for unknown, replaced, terminal or successor snapshots", () => {
  for (const kind of ["thinking", "text"]) {
    let state = snapshot(INITIAL_STREAMING_STATE, assistant());
    state = delta(state, { type: `${kind}_start`, contentIndex: 0 });
    state = delta(state, { type: `${kind}_delta`, contentIndex: 0, delta: "Live" });
    const block = { type: kind, [kind]: "Live" };
    for (const message of [
      { ...assistant([block]), timestamp: 456 },
      { ...assistant([block]), timestamp: undefined },
      { ...assistant([block]), model: "other-model" },
      { ...assistant([block]), stopReason: "stop" },
      assistant([block, { type: "toolCall", id: "next", name: "read", arguments: {} }]),
      assistant([{ type: kind, [kind]: "Replaced" }]),
      assistant([{ type: "toolCall", id: "replacement", name: "read", arguments: {} }]),
    ]) {
      const next = streamReducer(state, { type: "snapshot", message, preserveActivity: true });
      assert.equal(next.activeThinkingIndex, null);
      assert.equal(next.activeTextIndex, null);
    }
    const unknown = streamReducer(INITIAL_STREAMING_STATE, { type: "snapshot", message: assistant([block]), preserveActivity: true });
    assert.equal(unknown.activeThinkingIndex, null);
    assert.equal(unknown.activeTextIndex, null);
  }
});

test("a reconnect snapshot replaces the old partial before deltas continue", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "text", text: "stale" },
  ]));
  state = snapshot(state, assistant([
    { type: "text", text: "Hello wor" },
  ]));
  state = delta(state, { type: "text_delta", contentIndex: 0, delta: "ld" });

  assert.deepEqual(state.streamingMessage.content, [
    { type: "text", text: "Hello world" },
  ]);
});

test("resuming a running session preserves an already-received partial", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "text", text: "Hello" },
  ]));
  state = streamReducer(state, { type: "resume" });

  assert.equal(state.isStreaming, true);
  assert.deepEqual(state.streamingMessage.content, [
    { type: "text", text: "Hello" },
  ]);
});

test("a thinking start clears the first chunk leaked into the assistant snapshot", () => {
  // Pi's `start` event aliases the live partial message, so `message_start`
  // can already contain the first delta; the deltas deliver it again.
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "thinking", thinking: "The", thinkingSignature: "reasoning_content" },
  ]));
  state = delta(state, { type: "thinking_start", contentIndex: 0 });
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: "The" });
  state = delta(state, { type: "thinking_delta", contentIndex: 0, delta: " user" });

  assert.deepEqual(state.streamingMessage.content, [
    { type: "thinking", thinking: "The user" },
  ]);
});

test("a text start clears text leaked into the assistant snapshot", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "text", text: "The" },
  ]));
  state = delta(state, { type: "text_start", contentIndex: 0 });
  state = delta(state, { type: "text_delta", contentIndex: 0, delta: "The" });
  state = delta(state, { type: "text_delta", contentIndex: 0, delta: " command" });

  assert.deepEqual(state.streamingMessage.content, [
    { type: "text", text: "The command" },
  ]);
});

test("a tool call start clears streamed input leaked into the snapshot", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "toolCall", id: "call-1", name: "bash", arguments: {}, partialJson: '{"command":' },
  ]));
  state = delta(state, { type: "toolcall_start", contentIndex: 0, id: "call-1", toolName: "bash" });
  state = delta(state, { type: "toolcall_delta", contentIndex: 0, delta: '{"command":' });
  state = delta(state, { type: "toolcall_delta", contentIndex: 0, delta: '"pwd"}' });

  assert.equal(state.streamingMessage.content[0].rawInput, '{"command":"pwd"}');
  assert.deepEqual(state.streamingMessage.content[0].input, {});
});

test("text deltas update immutably so React observes each chunk", () => {
  const previous = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "text", text: "Hello" },
  ]));
  const next = delta(previous, { type: "text_delta", contentIndex: 0, delta: "!" });

  assert.notStrictEqual(next, previous);
  assert.notStrictEqual(next.streamingMessage, previous.streamingMessage);
  assert.notStrictEqual(next.streamingMessage.content, previous.streamingMessage.content);
  assert.equal(previous.streamingMessage.content[0].text, "Hello");
  assert.equal(next.streamingMessage.content[0].text, "Hello!");
});

test("shows and streams a tool call after thinking, then accepts the authoritative end", () => {
  let state = snapshot(INITIAL_STREAMING_STATE, assistant([
    { type: "thinking", thinking: "I will write the file." },
  ]));

  state = delta(state, {
    type: "toolcall_start",
    contentIndex: 1,
    id: "call-1",
    toolName: "write",
  });
  assert.deepEqual(state.streamingMessage.content, [
    { type: "thinking", thinking: "I will write the file." },
    {
      type: "toolCall",
      toolCallId: "call-1",
      toolName: "write",
      input: {},
      rawInput: "",
    },
  ]);

  const beforeDelta = state;
  state = delta(state, {
    type: "toolcall_delta",
    contentIndex: 1,
    delta: '{"path":',
    id: "call-1",
    toolName: "write",
  });
  state = delta(state, { type: "toolcall_delta", contentIndex: 1, delta: '"/tmp/file"' });
  assert.notStrictEqual(state, beforeDelta);
  assert.equal(state.streamingMessage.content[1].rawInput, '{"path":"/tmp/file"');

  state = delta(state, {
    type: "toolcall_end",
    contentIndex: 1,
    toolCall: {
      type: "toolCall",
      id: "call-1",
      name: "write",
      arguments: { path: "/tmp/file" },
    },
  });
  assert.deepEqual(state.streamingMessage.content, [
    { type: "thinking", thinking: "I will write the file." },
    {
      type: "toolCall",
      toolCallId: "call-1",
      toolName: "write",
      input: { path: "/tmp/file" },
    },
  ]);
  assert.equal(Object.hasOwn(state.streamingMessage.content[1], "rawInput"), false);
});

test("restores the raw tool input from a reconnect snapshot", () => {
  const state = snapshot(INITIAL_STREAMING_STATE, assistant([{
    type: "toolCall",
    id: "call-2",
    name: "write",
    arguments: { path: "/tmp/reconnected" },
    partialJson: '{"path":"/tmp/reconnected","content":"hel',
  }]));

  assert.deepEqual(state.streamingMessage.content, [{
    type: "toolCall",
    toolCallId: "call-2",
    toolName: "write",
    input: { path: "/tmp/reconnected" },
    rawInput: '{"path":"/tmp/reconnected","content":"hel',
  }]);
});

test("ignores deltas without a baseline and unknown future deltas", () => {
  const started = streamReducer(INITIAL_STREAMING_STATE, { type: "start" });
  assert.strictEqual(
    delta(started, { type: "text_delta", contentIndex: 0, delta: "lost" }),
    started,
  );

  const withMessage = snapshot(started, assistant());
  assert.strictEqual(
    delta(withMessage, { type: "future_delta", contentIndex: 0, delta: "ignored" }),
    withMessage,
  );
});

test("normalizes tool calls in snapshots and clears on end", () => {
  const state = snapshot(INITIAL_STREAMING_STATE, assistant([{
    type: "toolCall",
    id: "call-2",
    name: "bash",
    arguments: { command: "pwd" },
  }]));
  assert.deepEqual(state.streamingMessage.content, [{
    type: "toolCall",
    toolCallId: "call-2",
    toolName: "bash",
    input: { command: "pwd" },
  }]);
  assert.strictEqual(streamReducer(state, { type: "end" }), INITIAL_STREAMING_STATE);
});
