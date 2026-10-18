import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const rpc = await jiti.import("./rpc-manager.ts");
const { AgentSessionWrapper, subscribeRunningSessions, getNeedsInputRpcSessionIds, getRunningRpcSessionIds, notifyRunningChange } = rpc;

/**
 * Mimics the pi ≥ 0.86 AgentSession event/ordering contract: `agent_end`
 * fires while the run is still active (post-run pipeline pending), and the
 * `prompt()` promise resolves only after `agent_settled` — where
 * `_isAgentRunActive` was already cleared.
 */
function makeInner() {
  const listeners = new Set();
  const state = { active: false };
  const inner = {
    sessionId: "sid-1",
    sessionFile: "/tmp/sid-1.jsonl",
    get isStreaming() { return state.active; },
    get isIdle() { return !state.active; },
    isCompacting: false,
    get isBashRunning() { return false; },
    sessionManager: { getCwd: () => "/tmp" },
    agent: { state: {} },
    settingsManager: { getDefaultTools: () => [] },
    subscribe(cb) { listeners.add(cb); return () => listeners.delete(cb); },
    dispose() { /* no-op */ },
    emit: (event) => { for (const l of listeners) l(event); },
    state,
    async prompt(_text, options) {
      state.active = true;
      inner.emit({ type: "agent_start" });
      if (options?.streamingBehavior) {
        // Steered/followUp submissions resolve at queue time; the run they
        // joined keeps going.
        return;
      }
      inner.emit({ type: "agent_end", messages: [] });
      state.active = false;
      inner.emit({ type: "agent_settled" });
    },
    abort: async () => {
      inner.emit({ type: "agent_end", messages: [] });
      state.active = false;
      inner.emit({ type: "agent_settled" });
    },
    /** Finishes the run a steered submission joined. */
    finishJoinedRun() {
      inner.emit({ type: "agent_end", messages: [] });
      state.active = false;
      inner.emit({ type: "agent_settled" });
    },
  };
  return inner;
}

function startWrapperInRegistry(inner) {
  const wrapper = new AgentSessionWrapper(inner);
  wrapper.start();
  const previous = globalThis.__piSessions;
  globalThis.__piSessions = new Map([[inner.sessionId, wrapper]]);
  return {
    wrapper,
    dispose() {
      wrapper.destroy();
      globalThis.__piSessions = previous;
    },
  };
}

async function settle() {
  await new Promise((r) => setTimeout(r, 20));
}

test("a completed prompt pushes a final running frame without the session id", async () => {
  const frames = [];
  const unsubscribe = subscribeRunningSessions((ids) => frames.push([...ids]));

  const guard = startWrapperInRegistry(makeInner());
  try {
    await guard.wrapper.send({ type: "prompt", message: "hi" });
    await settle();

    const lastFrame = frames[frames.length - 1] ?? [];
    assert.deepEqual(getRunningRpcSessionIds(), [], "server still reports the finished session as running");
    assert.deepEqual(
      lastFrame,
      [],
      `last SSE frame still contains the finished session — sidebar spinner would spin forever: ${JSON.stringify(frames)}`,
    );
    // The run must have been advertised while it was active, too.
    assert.ok(frames.some((ids) => ids.includes("sid-1")), `running phase was never broadcast: ${JSON.stringify(frames)}`);
  } finally {
    unsubscribe();
    guard.dispose();
  }
});

test("a steered submission stays running until the joined run settles", async () => {
  const frames = [];
  const unsubscribe = subscribeRunningSessions((ids) => frames.push([...ids]));

  const inner = makeInner();
  const guard = startWrapperInRegistry(inner);
  try {
    await guard.wrapper.send({ type: "prompt", message: "hi", streamingBehavior: "steer" });
    await settle();
    // Queue-time settle must NOT clear the run the message joined.
    assert.ok(getRunningRpcSessionIds().includes("sid-1"), "steered submission dropped the running id at queue time");

    inner.finishJoinedRun();
    await settle();
    assert.deepEqual(getRunningRpcSessionIds(), [], "joined run settle left the session in the running set");
    assert.deepEqual(frames[frames.length - 1], [], `no settle frame pushed: ${JSON.stringify(frames)}`);
  } finally {
    unsubscribe();
    guard.dispose();
  }
});

test("aborting a run pushes a final frame without the session id", async () => {
  const frames = [];
  const unsubscribe = subscribeRunningSessions((ids) => frames.push([...ids]));

  // A prompt whose promise never settles on its own; abort() must unblock it
  // exactly like the SDK's waitForIdle-gated abort does.
  const inner = makeInner();
  let resolvePrompt;
  inner.prompt = () => {
    inner.state.active = true;
    inner.emit({ type: "agent_start" });
    return new Promise((resolve) => { resolvePrompt = resolve; });
  };
  const realAbort = inner.abort;
  inner.abort = async () => {
    await realAbort.call(inner);
    resolvePrompt?.();
  };
  const guard = startWrapperInRegistry(inner);
  try {
    const sending = guard.wrapper.send({ type: "prompt", message: "hi" });
    await settle();
    assert.ok(getRunningRpcSessionIds().includes("sid-1"), "run was never advertised as running");

    await guard.wrapper.send({ type: "abort" });
    await sending;
    await settle();

    assert.deepEqual(getRunningRpcSessionIds(), [], "aborted session still reported as running");
    assert.deepEqual(frames[frames.length - 1], [], `no post-abort frame pushed: ${JSON.stringify(frames)}`);
  } finally {
    unsubscribe();
    guard.dispose();
  }
});

function pendingUiSessions(t, { running = false, count = 1 } = {}) {
  const previous = globalThis.__piSessions;
  const sessions = Array.from({ length: count }, (_, index) => {
    const inner = makeInner();
    inner.sessionId = `blocking-ui-${index}`;
    inner.state.active = running;
    inner.extensionRunner = {};
    const wrapper = new AgentSessionWrapper(inner, { suppressCompletionNotifications: index > 0 });
    return { inner, wrapper, ui: wrapper.createExtensionUiContext() };
  });
  globalThis.__piSessions = new Map(sessions.map(({ inner, wrapper }) => [inner.sessionId, wrapper]));
  const frames = [];
  const unsubscribe = subscribeRunningSessions((ids) => frames.push({
    running: [...ids], needsInput: getNeedsInputRpcSessionIds(),
  }));
  notifyRunningChange();
  t.after(() => {
    unsubscribe();
    sessions.forEach(({ wrapper }) => wrapper.destroy());
    globalThis.__piSessions = previous;
  });
  return { sessions, frames };
}

for (const method of ["select", "confirm", "input", "editor"]) {
  test(`${method} broadcasts needs-input creation and resolution while running ids stay unchanged`, async (t) => {
    const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t, { running: true });
    const pending = ui[method]("Choose", method === "select" ? ["A"] : "Details");
    const [id] = wrapper.pendingUiRequests.keys();
    assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
    assert.deepEqual(frames.at(-1), { running: [wrapper.sessionId], needsInput: [wrapper.sessionId] });
    const frameCount = frames.length;
    notifyRunningChange();
    assert.equal(frames.length, frameCount, "unchanged blocking state must not send duplicate frames");
    await wrapper.send({ type: "extension_ui_response", id, value: "A", confirmed: true });
    assert.equal(await pending, method === "confirm" ? true : "A");
    assert.deepEqual(getNeedsInputRpcSessionIds(), []);
    assert.deepEqual(frames.at(-1), { running: [wrapper.sessionId], needsInput: [] });
  });
}

test("needs-input includes idle background sessions and stays until their last blocking request settles", async (t) => {
  const { sessions: [selected, background], frames } = pendingUiSessions(t, { count: 2 });
  const first = selected.ui.input("First");
  const second = selected.ui.confirm("Second", "Continue?");
  const backgroundRequest = background.ui.select("Background", ["A"]);
  const selectedIds = [...selected.wrapper.pendingUiRequests.keys()];
  const [backgroundId] = background.wrapper.pendingUiRequests.keys();
  assert.deepEqual(getRunningRpcSessionIds(), []);
  assert.deepEqual(getNeedsInputRpcSessionIds().sort(), [selected.wrapper.sessionId, background.wrapper.sessionId].sort());
  await selected.wrapper.send({ type: "extension_ui_response", id: selectedIds[0], value: "A" });
  await first;
  assert.ok(getNeedsInputRpcSessionIds().includes(selected.wrapper.sessionId), "second pending dialog still blocks");
  await selected.wrapper.send({ type: "extension_ui_response", id: selectedIds[1], cancelled: true });
  assert.equal(await second, false);
  assert.deepEqual(getNeedsInputRpcSessionIds(), [background.wrapper.sessionId], "selected-session response must not hide background input");
  await background.wrapper.send({ type: "extension_ui_response", id: backgroundId, cancelled: true });
  await backgroundRequest;
  assert.deepEqual(frames.at(-1), { running: [], needsInput: [] });
});

test("caller abort and timeout clear blocking state without a UI response", async (t) => {
  const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t);
  const controller = new AbortController();
  const cancelled = ui.confirm("Continue?", "Details", { signal: controller.signal });
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  controller.abort();
  assert.equal(await cancelled, false);
  assert.deepEqual(frames.at(-1).needsInput, []);
  const expired = ui.input("Expires", undefined, { timeout: 20 });
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  assert.equal(await expired, undefined);
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  assert.deepEqual(frames.at(-1).needsInput, []);
  assert.equal(wrapper.pendingUiRequests.size, 0);
});

test("custom UI mount, completion and Stop broadcast only actual pending input", async (t) => {
  const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t);
  let done;
  const custom = ui.custom((_tui, _theme, _keys, finish) => {
    done = finish;
    return { render: () => ["Choose"], handleInput: (data) => finish(data) };
  });
  await new Promise((resolve) => setImmediate(resolve));
  const [id] = wrapper.activeCustomUis.keys();
  assert.ok(id);
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  await wrapper.send({ type: "extension_ui_input", id, data: "chosen" });
  assert.equal(await custom, "chosen");
  assert.deepEqual(frames.at(-1).needsInput, []);
  done("late");
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  const stopped = ui.custom(() => ({ render: () => ["Choose again"] }));
  const rejection = assert.rejects(stopped, { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  await wrapper.send({ type: "abort" });
  await rejection;
  assert.deepEqual(frames.at(-1).needsInput, []);
});

test("custom UI completed synchronously or before its factory mounts never advertises needs-input", async (t) => {
  const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t);
  const before = frames.length;
  let disposed = 0;
  const immediate = ui.custom((_tui, _theme, _keys, done) => {
    done("already done");
    return { render: () => ["Never mounted"], dispose: () => { disposed += 1; } };
  });
  assert.equal(await immediate, "already done");
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disposed, 1);
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  assert.equal(frames.length, before);
  let finishFactory;
  const mounting = ui.custom(() => new Promise((resolve) => { finishFactory = resolve; }));
  const rejection = assert.rejects(mounting, { name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  await wrapper.send({ type: "abort" });
  await rejection;
  finishFactory({ render: () => ["Late"], dispose: () => { disposed += 1; } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(disposed, 2);
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
});

for (const shutdownMethod of ["shutdown", "destroy"]) {
  test(`${shutdownMethod} clears a mounted custom UI from needs-input`, async (t) => {
    const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t);
    const pending = ui.custom(() => ({ render: () => ["Choose"] }));
    await new Promise((resolve) => setImmediate(resolve));
    assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
    await wrapper[shutdownMethod]();
    assert.equal(await pending, undefined);
    assert.deepEqual(getNeedsInputRpcSessionIds(), []);
    assert.deepEqual(frames.at(-1).needsInput, []);
    assert.equal(wrapper.activeCustomUis.size, 0);
  });
}

test("shutdown clears needs-input immediately while extension shutdown is still pending", async (t) => {
  const { sessions: [{ inner, wrapper, ui }], frames } = pendingUiSessions(t);
  let finishShutdown;
  inner.extensionRunner.emit = () => new Promise((resolve) => { finishShutdown = resolve; });
  const pending = ui.input("Waiting");
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  const closing = wrapper.shutdown();
  assert.equal(wrapper.isAlive(), false);
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  assert.deepEqual(frames.at(-1).needsInput, []);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(wrapper.pendingUiRequests.size, 1, "closing is excluded before final UI cleanup");
  finishShutdown();
  await closing;
  assert.equal(await pending, undefined);
  assert.equal(wrapper.pendingUiRequests.size, 0);
});

test("direct destroy clears pending input; notifications, status and widgets never request input", async (t) => {
  const { sessions: [{ wrapper, ui }], frames } = pendingUiSessions(t);
  const before = frames.length;
  ui.notify("Please check this", "warning");
  ui.setStatus("needs-input", "Waiting for operator");
  ui.setWidget("notice", ["Attention"]);
  assert.deepEqual(getNeedsInputRpcSessionIds(), []);
  assert.equal(frames.length, before);
  const pending = ui.confirm("Real blocking request", "Continue?");
  assert.deepEqual(getNeedsInputRpcSessionIds(), [wrapper.sessionId]);
  wrapper.destroy();
  assert.equal(await pending, false);
  assert.deepEqual(frames.at(-1).needsInput, []);
});

test("running snapshot and SSE report pending input initially and after resolve without polling", async (t) => {
  const { sessions: [selected, background] } = pendingUiSessions(t, { count: 2 });
  const snapshotRoute = await jiti.import("../app/api/agent/running/route.ts");
  const eventsRoute = await jiti.import("../app/api/agent/running/events/route.ts");
  const first = selected.ui.input("Already waiting");
  const snapshot = await (await snapshotRoute.GET()).json();
  assert.deepEqual(snapshot.needsInputSessionIds, [selected.wrapper.sessionId]);
  const controller = new AbortController();
  const response = await eventsRoute.GET(new Request("http://localhost/api/agent/running/events", { signal: controller.signal }));
  const reader = response.body.getReader();
  t.after(() => controller.abort());
  const readFrame = async () => JSON.parse(new TextDecoder().decode((await reader.read()).value).trim().slice(6));
  assert.deepEqual((await readFrame()).needsInputSessionIds, [selected.wrapper.sessionId]);
  const second = background.ui.confirm("Background waiting", "Continue?");
  assert.deepEqual((await readFrame()).needsInputSessionIds.sort(), [selected.wrapper.sessionId, background.wrapper.sessionId].sort());
  const [firstId] = selected.wrapper.pendingUiRequests.keys();
  await selected.wrapper.send({ type: "extension_ui_response", id: firstId, cancelled: true });
  await first;
  assert.deepEqual((await readFrame()).needsInputSessionIds, [background.wrapper.sessionId]);
  const [secondId] = background.wrapper.pendingUiRequests.keys();
  await background.wrapper.send({ type: "extension_ui_response", id: secondId, confirmed: true });
  await second;
  assert.deepEqual((await readFrame()).needsInputSessionIds, []);
  controller.abort();
});
