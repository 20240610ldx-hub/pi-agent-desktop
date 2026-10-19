import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

const jitiSource = async (url) => (await readFile(url, "utf8")).replace(/\r\n/g, "\n");
const source = await jitiSource(new URL("./useAgentSession.ts", import.meta.url));
const chatWindowSource = await jitiSource(new URL("../components/ChatWindow.tsx", import.meta.url));
const phaseLabelSource = await jitiSource(new URL("../lib/chat-phase-label.ts", import.meta.url));
const chatInputSource = await jitiSource(new URL("../components/ChatInput.tsx", import.meta.url));
const messageViewSource = await jitiSource(new URL("../components/MessageView.tsx", import.meta.url));
const appShellSource = await jitiSource(new URL("../components/AppShell.tsx", import.meta.url));

// The same VM seam as the existing callback tests, expanded to observe the
// hook's returned state and real render-phase session resets. React state,
// effects and the transport are controlled; application helpers stay real.
const hookModules = new Map();
async function compileHookModule(file) {
  if (hookModules.has(file)) return hookModules.get(file);
  const text = await jitiSource(new URL(file, import.meta.url));
  const compiled = ts.transpileModule(text, {
    compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const dependencies = new Map();
  for (const [, name] of compiled.matchAll(/require\("([^"]+)"\)/g)) {
    if (name === "react" || name === "@/hooks/useI18n") continue;
    if (name.startsWith("@/hooks/")) {
      dependencies.set(name, await compileHookModule(`./${name.slice("@/hooks/".length)}.ts`));
    } else {
      const path = name.startsWith("@/") ? `../${name.slice(2)}.ts` : name;
      dependencies.set(name, await jiti.import(path));
    }
  }
  const result = { compiled, dependencies };
  hookModules.set(file, result);
  return result;
}
const hookModule = await compileHookModule("./useAgentSession.ts");

function activityHookHarness({ sessionFixtures = {}, strictEffects = false } = {}) {
  const slots = [];
  const effects = [];
  const timers = new Map();
  const commands = [];
  let branchChange;
  let cursor = 0;
  let dirty = false;
  let timerId = 0;
  let opts = { session: { id: "session-a" }, newSessionCwd: null, newSessionDraftKey: null,
    onBranchDataChange: (_tree, _leafId, change) => { branchChange = change; },
  };
  let current;
  const stateResponse = { running: false, state: {} };
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        const slot = { value: typeof initial === "function" ? initial() : initial };
        slot.set = (update) => {
          const value = typeof update === "function" ? update(slot.value) : update;
          if (!Object.is(slot.value, value)) { slot.value = value; dirty = true; }
        };
        slots[index] = slot;
      }
      return [slots[index].value, slots[index].set];
    },
    useReducer(reducer, initial) {
      const [value, set] = react.useState(initial);
      return [value, (action) => set((previous) => reducer(previous, action))];
    },
    useRef(initial) {
      const index = cursor++;
      return slots[index] ??= { current: initial };
    },
    useMemo(factory, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
        slots[index] = { value: factory(), deps };
      }
      return slots[index].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const index = cursor++;
      const old = slots[index];
      if (!old || deps.some((dep, i) => !Object.is(dep, old.deps[i]))) {
        const slot = { deps, cleanup: old?.cleanup };
        slots[index] = slot;
        effects.push(() => {
          slot.cleanup?.();
          slot.cleanup = effect();
          if (strictEffects && !old) { slot.cleanup?.(); slot.cleanup = effect(); }
        });
      }
    },
    useLayoutEffect(effect, deps) { react.useEffect(effect, deps); },
  };
  const listenerTarget = { addEventListener() {}, removeEventListener() {} };
  const response = async (url) => {
    const path = String(url);
    const sid = /\/sessions\/([^/?]+)/.exec(path)?.[1] ?? "session-a";
    const body = path.includes("/api/models") ? { models: {}, modelList: [] }
      : path.includes("/lease") ? { renewed: 1 }
      : path.includes("/api/agent/") || path.endsWith("/state") ? stateResponse
      : sessionFixtures[sid] ?? { sessionId: sid, tree: [], leafId: null, context: {
        messages: [], entryIds: [], hasMore: false, oldestEntryId: null, thinkingLevel: "off", model: null,
      } };
    return { ok: true, status: 200, json: async () => body };
  };
  const globals = {
    console, Set, Map, Date, URLSearchParams, AbortController, DOMException, encodeURIComponent,
    fetch: response, performance: { now: () => 0 },
    window: listenerTarget, document: { ...listenerTarget, visibilityState: "visible" },
    queueMicrotask,
    setTimeout(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms }); return id; },
    setInterval(callback, ms) { const id = ++timerId; timers.set(id, { callback, ms, interval: true }); return id; },
    clearTimeout: (id) => timers.delete(id), clearInterval: (id) => timers.delete(id),
    requestAnimationFrame: () => ++timerId, cancelAnimationFrame() {},
  };
  const loaded = new Map();
  function load(module) {
    if (loaded.has(module)) return loaded.get(module);
    const exports = {};
    loaded.set(module, exports);
    new Script(`(function(require, exports) { ${module.compiled}\n})`).runInNewContext(globals)((name) => {
      if (name === "react") return react;
      if (name === "@/hooks/useI18n") return { useI18n: () => ({ t: (key) => key }) };
      if (name === "@/lib/agent-event-connection") return {
        AgentEventConnection: class { maintain() {} close() {} ensureConnected() { return Promise.resolve(); } },
      };
      const dependency = module.dependencies.get(name);
      if (name === "@/lib/agent-client") return {
        ...dependency,
        sendAgentCommand: async (sid, command) => { commands.push([sid, command]); return {}; },
      };
      if (name === "@/lib/fetch-timeout") return { ...dependency, fetchWithRetry: response };
      return dependency?.compiled ? load(dependency) : dependency;
    }, exports);
    return exports;
  }
  const { useAgentSession } = load(hookModule);
  function render() {
    let passes = 0;
    do {
      assert.ok(++passes < 20, "hook should reach a stable render");
      cursor = 0;
      dirty = false;
      // This VM drives React's state/effect boundary synchronously for tests.
      // eslint-disable-next-line react-hooks/rules-of-hooks
      current = useAgentSession(opts);
    } while (dirty);
    return current;
  }
  render();
  return {
    get current() { return current; }, commands, stateResponse,
    changeBranch: (...args) => branchChange(...args),
    emit(event) { current.handleAgentEventRef.current(event); return render(); },
    switchSession(id) { opts = { ...opts, session: { id } }; return render(); },
    render,
    async flush() {
      for (let i = 0; i < 15; i++) {
        effects.splice(0).forEach((effect) => effect());
        await Promise.resolve();
        render();
      }
      return current;
    },
    async reconcile() {
      for (const timer of [...timers.values()]) if (timer.interval && timer.ms === 15_000) timer.callback();
      await this.flush();
    },
  };
}

test("running tool membership survives messages and partial results until each execution ends", () => {
  const h = activityHookHarness();
  h.emit({ type: "agent_start" });
  h.emit({ type: "tool_execution_start", toolCallId: "call-a", toolName: "bash" });
  assert.deepEqual([...h.current.runningToolCallIds], ["call-a"]);
  h.emit({ type: "tool_execution_start", toolCallId: "call-b", toolName: "read" });
  const active = h.current.runningToolCallIds;
  h.emit({ type: "tool_execution_update", toolCallId: "call-a", toolName: "bash", partialResult: { content: [{ type: "text", text: "partial" }] } });
  assert.strictEqual(h.current.runningToolCallIds, active, "progress does not reorder or replace membership");
  assert.equal(h.current.activeToolResults.has("call-a"), true);
  h.emit({ type: "message_end", message: { role: "toolResult", toolCallId: "call-a", toolName: "bash", content: [] } });
  assert.strictEqual(h.current.runningToolCallIds, active, "message lifecycle does not complete tools");
  h.emit({ type: "tool_execution_end", toolCallId: "call-a", toolName: "bash" });
  assert.deepEqual([...h.current.runningToolCallIds], ["call-b"]);
  h.emit({ type: "tool_execution_end", toolCallId: "call-b", toolName: "read", isError: true });
  assert.deepEqual([...h.current.runningToolCallIds], []);
});

test("agent end clears all running tool activity while the logical prompt can continue", () => {
  const h = activityHookHarness();
  h.current.sessionIdRef.current = null; // No transport refresh is needed for this event boundary.
  h.emit({ type: "agent_start" });
  h.emit({ type: "tool_execution_start", toolCallId: "call-a", toolName: "read" });
  h.emit({ type: "agent_end" });
  assert.deepEqual([...h.current.runningToolCallIds], []);
  assert.equal(h.current.agentRunning, true);
});

test("settlement and idle reconciliation clear execution activity when end events were missed", async () => {
  for (const terminal of ["agent_settled", "prompt_done", "idle_reconcile"]) {
    const h = activityHookHarness();
    await h.flush();
    if (terminal === "prompt_done") {
      h.current.setAgentRunning(true);
      h.render();
      await h.flush();
    } else h.emit({ type: "agent_start" });
    h.emit({ type: "tool_execution_start", toolCallId: "call-a", toolName: "read" });
    if (terminal === "idle_reconcile") {
      await h.flush();
      await h.reconcile();
    } else {
      h.emit({ type: terminal });
    }
    assert.deepEqual([...h.current.runningToolCallIds], [], terminal);
  }
});

test("switching sessions clears activity and reconnect replay restores only live top-level calls", () => {
  const h = activityHookHarness();
  h.emit({ type: "agent_start" });
  h.emit({ type: "tool_execution_start", toolCallId: "call-a", toolName: "read" });
  h.switchSession("session-b");
  assert.deepEqual([...h.current.runningToolCallIds], [], "session switch drops the old membership");
  h.emit({ type: "connected", isStreaming: true });
  h.emit({ type: "tool_execution_update", toolCallId: "call-b", toolName: "read" });
  assert.deepEqual([...h.current.runningToolCallIds], ["call-b"], "an update can replay a missed start");
  const replayed = h.current.runningToolCallIds;
  for (const type of ["tool_execution_start", "tool_execution_update", "tool_execution_end"]) {
    h.emit({ type, toolCallId: "call-b/1", parentToolCallId: "call-b", toolName: "read" });
    assert.strictEqual(h.current.runningToolCallIds, replayed, "nested executions never change top-level membership");
  }
  h.emit({ type: "connected", isStreaming: true });
  assert.deepEqual([...h.current.runningToolCallIds], [], "a new connection drops stale membership before replay");
  h.emit({ type: "tool_execution_start", toolCallId: "call-c", toolName: "write" });
  assert.deepEqual([...h.current.runningToolCallIds], ["call-c"]);
});

test("prompt errors and explicit aborts clear live activity without inventing tool results", async () => {
  for (const terminal of ["prompt_error", "abort"]) {
    const h = activityHookHarness();
    h.emit({ type: "agent_start" });
    h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
    h.emit({ type: "message_update", assistantMessageEvent: { type: "thinking_start", contentIndex: 0 } });
    h.emit({ type: "tool_execution_start", toolCallId: "call-a", toolName: "bash" });
    h.emit({ type: "tool_execution_update", toolCallId: "call-a", toolName: "bash", partialResult: { content: [{ type: "text", text: "unfinished output" }] } });
    if (terminal === "abort") {
      await h.current.handleAbort();
      h.render();
      assert.equal(h.commands[0][1].type, "abort");
    } else h.emit({ type: "prompt_error", errorMessage: "execution failed" });
    assert.deepEqual([...h.current.runningToolCallIds], [], terminal);
    assert.equal(h.current.streamState.activeThinkingIndex, null, terminal);
    assert.equal(h.current.activeToolResults.has("call-a"), true, "partial output remains a cache, never a completed result");
    assert.equal(h.current.messages.some((message) => message.role === "toolResult"), false);
  }
});

test("a new agent run resets stale execution membership", () => {
  const h = activityHookHarness();
  h.emit({ type: "agent_start" });
  h.emit({ type: "tool_execution_start", toolCallId: "old-call", toolName: "read" });
  h.emit({ type: "agent_start" });
  assert.deepEqual([...h.current.runningToolCallIds], []);
});

test("periodic reconciliation preserves event-proven activity but reconnect snapshots do not", async () => {
  for (const kind of ["thinking", "text"]) {
    const h = activityHookHarness();
    await h.flush();
    h.emit({ type: "agent_start" });
    const message = { role: "assistant", content: [], timestamp: 123, provider: "anthropic", model: "test-model", stopReason: "pending" };
    h.emit({ type: "message_start", message });
    h.emit({ type: "message_update", assistantMessageEvent: { type: `${kind}_start`, contentIndex: 0 } });
    h.emit({ type: "message_update", assistantMessageEvent: { type: `${kind}_delta`, contentIndex: 0, delta: "In progress" } });
    h.stateResponse.running = true;
    h.stateResponse.state = { isStreaming: true, streamingMessage: { ...message, content: [{ type: kind, [kind]: "In progress still" }] } };
    await h.flush();
    await h.reconcile();
    const field = kind === "thinking" ? "activeThinkingIndex" : "activeTextIndex";
    assert.equal(h.current.streamState[field], 0, "a poll keeps existing evidence for its matching tail");
    h.emit({ type: "connected", isStreaming: true });
    h.emit({ type: "message_start", message: h.stateResponse.state.streamingMessage });
    assert.equal(h.current.streamState[field], null, "reconnect snapshots alone never establish activity");
  }
});

test("duplicate mount loads cannot cache an empty transcript or blank a session round trip", async () => {
  const cache = hookModule.dependencies.get("@/lib/session-view-cache");
  cache.clearSessionViewCache();
  const fixture = (id) => ({
    sessionId: id, tree: [], treeFormat: "summary", snapshotRevision: `unique-${id}-revision`, leafId: `${id}-answer`,
    context: {
      messages: [{ role: "user", content: `Question ${id}` }, { role: "assistant", content: [{ type: "text", text: `Answer ${id}` }] }],
      entryIds: [`${id}-user`, `${id}-answer`], oldestEntryId: `${id}-user`, hasMore: false, thinkingLevel: "off", model: null,
    },
  });
  const sessionFixtures = { "session-a": fixture("session-a"), "session-b": fixture("session-b") };
  try {
    const h = activityHookHarness({ sessionFixtures, strictEffects: true });
    await h.flush();
    assert.equal(h.current.messages.length, 2);
    assert.equal(cache.getSessionViewSnapshot("session-a").messages.length, 2, "parallel same-revision loads retain the canonical messages");
    h.switchSession("session-b");
    await h.flush();
    assert.equal(h.current.messages[1].content[0].text, "Answer session-b");
    h.switchSession("session-a");
    await h.flush();
    assert.equal(h.current.messages[1]?.content[0].text, "Answer session-a", "returning to the cached session restores its transcript");
    assert.equal(h.current.data.context.messages.length, 2);
    h.current.setMessages((messages) => [...messages, { role: "user", content: "New pending message" }]);
    h.render();
    const liveMessages = h.current.messages;
    h.current.retryLoad();
    await h.flush();
    assert.strictEqual(h.current.messages, liveMessages, "same-revision refresh preserves current live message references");
    assert.equal(h.current.messages.at(-1).content, "New pending message");
  } finally { cache.clearSessionViewCache(); }
});

test("only genuine tool-call starts grant one-time entries across message handoff", () => {
  const h = activityHookHarness();
  h.emit({ type: "agent_start" });
  const call = { type: "toolCall", toolCallId: "live-entry", toolName: "read", input: {} };
  // The shared live snapshot can already contain the block before its start.
  h.emit({ type: "message_start", message: { role: "assistant", content: [call] } });
  assert.equal(h.current.toolEntryState.grants.size, 0);
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "live-entry", toolName: "read" } });
  assert.deepEqual([...h.current.toolEntryState.grants], [["live-entry", 0]]);
  const granted = h.current.toolEntryState;
  const consume = h.current.consumeToolEntries;
  h.emit({ type: "message_end", message: { role: "assistant", content: [call] } });
  assert.strictEqual(h.current.toolEntryState, granted, "message completion preserves the pending grant");
  h.emit({ type: "tool_execution_start", toolCallId: "live-entry", toolName: "read" });
  assert.strictEqual(h.current.toolEntryState, granted, "execution starts do not grant entries");
  consume(granted.scope, ["live-entry"]);
  h.render();
  assert.equal(h.current.toolEntryState.grants.size, 0);
  assert.strictEqual(h.current.consumeToolEntries, consume);
  h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "live-entry", toolName: "read" } });
  assert.equal(h.current.toolEntryState.grants.size, 0, "duplicates never replay a consumed entry");
});

test("loaded history and polled snapshots cannot grant or revoke live tool entries", async () => {
  const h = activityHookHarness({ sessionFixtures: { "session-a": {
    sessionId: "session-a", tree: [], leafId: "stored-leaf", context: {
      messages: [{ role: "assistant", content: [{ type: "toolCall", id: "stored-call", name: "read", arguments: {} }] }],
      entryIds: ["stored-entry"], oldestEntryId: "stored-entry", hasMore: false, thinkingLevel: "off", model: null,
    },
  } } });
  await h.flush();
  h.emit({ type: "agent_start" });
  h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "stored-call", toolName: "read" } });
  assert.equal(h.current.toolEntryState.grants.size, 0, "history is a baseline, not a new entry");
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, id: "live-call", toolName: "read" } });
  h.stateResponse.running = true;
  h.stateResponse.state = { isStreaming: true, streamingMessage: { role: "assistant", content: [
    { type: "toolCall", id: "polled-call", name: "read", arguments: {} },
    { type: "toolCall", id: "live-call", name: "read", arguments: {} },
  ] } };
  await h.flush();
  await h.reconcile();
  assert.deepEqual([...h.current.toolEntryState.grants], [["live-call", 0]], "polling does not revoke an existing live grant");
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "polled-call", toolName: "read" } });
  assert.deepEqual([...h.current.toolEntryState.grants], [["live-call", 0]], "poll snapshots mark their restored IDs seen");
});

test("reconnect replay never grants an entry but a later fresh tool start does", () => {
  const h = activityHookHarness();
  h.emit({ type: "agent_start" });
  h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "before-reconnect", toolName: "read" } });
  h.emit({ type: "connected", isStreaming: true, hasStreamingSnapshot: true });
  assert.equal(h.current.toolEntryState.grants.size, 0, "reconnect drops pending entry animations");
  h.emit({ type: "tool_execution_start", toolCallId: "replayed", toolName: "read" });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "buffered", toolName: "read" } });
  assert.equal(h.current.toolEntryState.grants.size, 0);
  h.emit({ type: "message_start", message: { role: "assistant", content: [{ type: "toolCall", id: "replayed", name: "read", arguments: {} }] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "replayed", toolName: "read" } });
  assert.equal(h.current.toolEntryState.grants.size, 0);
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, id: "fresh-entry", toolName: "write" } });
  assert.deepEqual([...h.current.toolEntryState.grants], [["fresh-entry", 1]]);
});

test("reconnecting between tool execution and the next assistant still grants genuine shared-message starts", () => {
  const h = activityHookHarness();
  h.emit({ type: "connected", isStreaming: true, hasStreamingSnapshot: false });
  h.emit({ type: "tool_execution_start", toolCallId: "running-on-reconnect", toolName: "read" });
  assert.equal(h.current.toolEntryState.grants.size, 0, "execution replay alone is never a new entry");
  h.emit({ type: "tool_execution_end", toolCallId: "running-on-reconnect", toolName: "read" });
  const call = { type: "toolCall", id: "next-turn-call", name: "write", arguments: {} };
  h.emit({ type: "message_start", message: { role: "assistant", content: [call] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "next-turn-call", toolName: "write" } });
  assert.deepEqual([...h.current.toolEntryState.grants], [["next-turn-call", 0]]);
});

test("entry scopes reset on session or explicit branch changes, not routine leaf advancement", async () => {
  const h = activityHookHarness();
  await h.flush();
  h.emit({ type: "agent_start" });
  h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "scoped-call", toolName: "read" } });
  const first = h.current.toolEntryState;
  h.current.setActiveLeafId("newly-persisted-leaf");
  h.render();
  assert.strictEqual(h.current.toolEntryState, first, "normal persisted leaf movement is not a navigation");
  h.switchSession("session-b");
  assert.notEqual(h.current.toolEntryState.scope, first.scope);
  assert.equal(h.current.toolEntryState.grants.size, 0);
  await h.flush();
  const sessionScope = h.current.toolEntryState.scope;
  await h.current.handleNavigate("branch-entry");
  h.render();
  assert.notEqual(h.current.toolEntryState.scope, sessionScope, "accepted in-session navigation starts an entry scope");
  const branchScope = h.current.toolEntryState.scope;
  h.emit({ type: "agent_start" });
  h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
  h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: "scoped-call", toolName: "read" } });
  h.current.consumeToolEntries(first.scope, ["scoped-call"]);
  h.render();
  assert.equal(h.current.toolEntryState.grants.has("scoped-call"), true, "a stale session consumer cannot acknowledge this branch");
  h.current.consumeToolEntries(branchScope, ["scoped-call"]);
  h.render();
  assert.equal(h.current.toolEntryState.grants.size, 0);
});

test("branch-picker navigation starts an entry scope for plain and summarized changes", async () => {
  for (const options of [undefined, { summarize: true }]) {
    const h = activityHookHarness();
    await h.flush();
    const before = h.current.toolEntryState.scope;
    await h.changeBranch("selected-branch", options);
    h.render();
    assert.notEqual(h.current.toolEntryState.scope, before);
  }
});

test("entry grants survive terminal handoff until claimed, and empty IDs or execution replay never grant", async () => {
  for (const terminal of ["prompt_error", "abort", "agent_settled"]) {
    const h = activityHookHarness();
    h.current.sessionIdRef.current = null;
    h.emit({ type: "agent_start" });
    h.emit({ type: "message_start", message: { role: "assistant", content: [] } });
    for (const id of [undefined, "", " "]) h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id, toolName: "read" } });
    h.emit({ type: "tool_execution_start", toolCallId: "execution-only", toolName: "read" });
    assert.equal(h.current.toolEntryState.grants.size, 0);
    h.emit({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, id: "terminal-entry", toolName: "read" } });
    const grant = h.current.toolEntryState;
    if (terminal === "abort") {
      h.current.sessionIdRef.current = "session-a";
      await h.current.handleAbort();
      h.render();
    } else h.emit({ type: terminal, errorMessage: "generated failure" });
    assert.strictEqual(h.current.toolEntryState, grant, "a committed row can still claim the event after terminal handoff");
    h.current.consumeToolEntries(grant.scope, ["terminal-entry"]);
    h.render();
    assert.equal(h.current.toolEntryState.grants.size, 0, "hidden/reduced consumers can acknowledge without replay later");
  }
});

test("keeps the session event stream open through the idle grace window", () => {
  const finishSource = source.slice(
    source.indexOf("const finishPromptWithoutStream"),
    source.indexOf("const waitForPromptSettlement"),
  );
  const graceSource = source.slice(
    source.indexOf("const scheduleEventStreamClose"),
    source.indexOf("const finishPromptWithoutStream"),
  );
  const agentEndSource = source.slice(
    source.indexOf('case "agent_end"'),
    source.indexOf('case "agent_settled"'),
  );
  const agentStartSource = source.slice(
    source.indexOf('case "agent_start"'),
    source.indexOf('case "agent_end"'),
  );
  const agentSettledSource = source.slice(
    source.indexOf('case "agent_settled"'),
    source.indexOf('case "prompt_done"'),
  );
  const promptDoneSource = source.slice(
    source.indexOf('case "prompt_done"'),
    source.indexOf('case "prompt_error"'),
  );
  const sendSource = source.slice(
    source.indexOf("  const handleSend = useCallback"),
    source.indexOf("  const executeBash = useCallback"),
  );

  assert.match(source, /const EVENT_STREAM_IDLE_GRACE_MS = 30_000/);
  assert.match(graceSource, /setTimeout\(\(\) => void checkServerIdle\(\), EVENT_STREAM_IDLE_GRACE_MS\)/);
  assert.match(graceSource, /fetch\(`\/api\/agent\/\$\{encodeURIComponent\(sid\)\}`\)/);
  assert.match(graceSource, /closeEvents\(\)/);
  assert.match(finishSource, /scheduleEventStreamClose\(sid\)/);
  assert.doesNotMatch(finishSource, /closeEvents\(\)/);
  assert.doesNotMatch(agentEndSource, /closeEvents\(\)/);
  assert.match(agentStartSource, /cancelEventStreamGrace\(\)/);
  assert.match(agentSettledSource, /scheduleEventStreamClose\(sid\)/);
  assert.match(agentSettledSource, /onAgentEnd\?\.\(\)/);
  assert.match(promptDoneSource, /notifyPromptStage\(runId\)/);
  assert.match(promptDoneSource, /scheduleEventStreamClose\(sid\)/);
  assert.match(sendSource, /const definitivelyRejected = !promptRequestStarted/);
  assert.match(sendSource, /if \(!definitivelyRejected && sentSessionId\) \{[\s\S]*?waitForPromptSettlement/);
  assert.match(sendSource, /restoreSubmission\(message, images, composerDraftKey\);[\s\S]*?if \(sentSessionId\) \{[\s\S]*?reconcileAgentState\(sentSessionId\);[\s\S]*?return;[\s\S]*?\}[\s\S]*?closeEvents\(\)/);
  assert.doesNotMatch(
    sendSource,
    /rpcPromptPendingRef\.current = false;\s*agentRunningRef\.current = false;\s*closeEvents\(\)/,
  );
});

test("a rejected submission preserves a different run reported by the server", () => {
  const reconcileSource = source.slice(
    source.indexOf("  const reconcileAgentState = useCallback"),
    source.indexOf("  // Recovery net for missed SSE events"),
  );

  assert.match(reconcileSource, /sessionIdRef\.current !== sid/);
  assert.match(reconcileSource, /if \(busy\) \{[\s\S]*?sdkAgentActiveRef\.current = Boolean\(state\.isStreaming\)/);
  assert.match(reconcileSource, /rpcPromptPendingRef\.current = Boolean\(state\.isPromptRunning\)/);
  assert.match(reconcileSource, /if \(!agentRunningRef\.current\) return;[\s\S]*?finishPromptWithoutStream/);
});

test("opening System or Tools lazily starts a dormant session without sending a prompt", () => {
  const loadSystemInfoSource = source.slice(
    source.indexOf("  const loadSystemInfo = useCallback"),
    source.indexOf("  const loadSlashCommands = useCallback"),
  );
  const loaderEffectSource = source.slice(
    source.indexOf("  useEffect(() => {\n    onSystemInfoLoaderChange"),
    source.indexOf("  useEffect(() => {\n    if (!onBranchDataChange) return;"),
  );

  assert.match(loadSystemInfoSource, /sessionIdRef\.current \?\? await ensureNewSession\(\)/);
  assert.doesNotMatch(loadSystemInfoSource, /promoteNewSession\(\)/);
  assert.match(loadSystemInfoSource, /sendAgentCommand<AgentStateResponse>\(sid, \{ type: "get_state" \}\)/);
  assert.match(loadSystemInfoSource, /loadTools\(sid\)/);
  assert.doesNotMatch(loadSystemInfoSource, /type: "prompt"/);
  assert.match(loadSystemInfoSource, /setSystemPrompt\(state\.systemPrompt \?\? ""\)/);
  assert.match(loaderEffectSource, /onSystemInfoLoaderChange\?\.\(loadSystemInfoFor\)/);
  assert.match(loaderEffectSource, /onSystemInfoLoaderChange\?\.\(null\)/);
  // System/Tools now live in the topbar More menu (the duplicate desktop
  // toolbar was folded away); entries keep the lazy-loading toggle.
  assert.match(appShellSource, /onClick=\{\(\) => handleSystemInfoToggle\("system"\)\}/);
  assert.match(appShellSource, /onClick=\{\(\) => handleSystemInfoToggle\("tools"\)\}/);
  assert.match(appShellSource, /systemInfoLoaderRef\.current/);
  assert.doesNotMatch(appShellSource, /systemPrompt !== null \|\| systemInfoLoading/);
  assert.match(appShellSource, /const loadId = \+\+systemInfoLoadIdRef\.current/);
  assert.match(appShellSource, /systemInfoLoadIdRef\.current === loadId/);
  assert.match(
    appShellSource,
    /handleSystemInfoLoaderChange[\s\S]*?systemInfoLoadIdRef\.current \+= 1;[\s\S]*?setSystemInfoLoading\(false\)/,
  );
});

test("new-session promotion rekeys drafts before publishing the real session", () => {
  const promoteSource = source.slice(
    source.indexOf("  const promoteNewSession = useCallback"),
    source.indexOf("  const ensureNewSession = useCallback"),
  );

  assert.match(promoteSource, /draftKeyAliasesRef\.current\.set\(provisionalDraftKey, sid\)/);
  assert.match(promoteSource, /input\.rekeyDraft\(provisionalDraftKey, sid\)/);
  assert.ok(
    promoteSource.indexOf("input.rekeyDraft(provisionalDraftKey, sid)")
      < promoteSource.indexOf("onSessionCreated?.({"),
  );
  assert.match(promoteSource, /}, provisionalDraftKey\)/);
  assert.match(chatWindowSource, /draftKey=\{session\?\.id \?\? newSessionDraftKey \?\? undefined\}/);
});

test("fresh sessions use the preference while persisted and live sessions restore their selection", () => {
  const preferenceSource = source.slice(
    source.indexOf("  const setToolPresetState"),
    source.indexOf("  const scrollToBottom"),
  );
  const loadToolsSource = source.slice(
    source.indexOf("  const loadTools = useCallback"),
    source.indexOf("  const promoteNewSession"),
  );
  const changeSource = source.slice(
    source.indexOf("  const handleToolPresetChange = useCallback"),
    source.indexOf("  const scrollUserMsgToTop"),
  );

  assert.match(
    preferenceSource,
    /const existingSessionId = session\?\.id;[\s\S]*?useLayoutEffect\(\(\) => \{\s*if \(!existingSessionId && \(!isNew \|\| sessionIdRef\.current\)\) return;\s*setToolPresetState\(getPreferredToolPreset\(\)\)/,
  );
  assert.match(source, /if \(agentState\?\.running\) \{\s*loadTools\(session\.id\)/);
  assert.match(source, /d\.toolNames !== undefined \? getPresetFromToolNames\(d\.toolNames\) : CONFIGURED_TOOL_PRESET/);
  assert.match(changeSource, /setPreferredToolPreset\(preset\)/);
  assert.match(changeSource, /type: "set_tools",\s*\.\.\.\(toolNames !== undefined \? \{ toolNames \} : \{\}\),/);
  assert.match(changeSource, /activeSessionId !== sid \|\| result\?\.recreated/);
  assert.match(changeSource, /result\?\.recreated[\s\S]*?maintainEventsConnected\(activeSessionId\)/);
  assert.match(changeSource, /sessionIdRef\.current = activeSessionId/);
  assert.doesNotMatch(loadToolsSource, /setPreferredToolPreset/);
});

test("sessions the user never overrode follow pi's configured defaultTools (#700)", () => {
  const ensureSource = source.slice(
    source.indexOf("  const ensureNewSession = useCallback"),
    source.indexOf("  const loadSystemInfo = useCallback"),
  );
  const loadToolsSource = source.slice(
    source.indexOf("  const loadTools = useCallback"),
    source.indexOf("  const promoteNewSession"),
  );

  // A new session must omit toolNames entirely rather than pin pi-web's own preset.
  assert.match(ensureSource, /\.\.\.\(toolNames !== undefined \? \{ toolNames \} : \{\}\),/);
  assert.doesNotMatch(ensureSource, /^ +toolNames,$/m);
  assert.match(ensureSource, /sessionToolsPinnedRef\.current = toolNames !== undefined/);

  // An unpinned session keeps saying "configured" instead of borrowing whichever
  // preset its resolved tools happen to match.
  assert.match(
    loadToolsSource,
    /setToolPresetState\(sessionToolsPinnedRef\.current \? getPresetFromTools\(tools\) : CONFIGURED_TOOL_PRESET\)/,
  );
});

test("only the session-mount load probes disk for external appends", () => {
  const loadSessionSource = source.slice(
    source.indexOf("  const loadSession = useCallback"),
    source.indexOf("  const loadContext = useCallback"),
  );
  const mountSource = source.slice(
    source.indexOf("// Load session on mount"),
    source.indexOf("sessionHookMountedRef.current = false"),
  );
  assert.match(loadSessionSource, /options\?: \{ force\?: boolean \}/);
  assert.match(loadSessionSource, /if \(options\?\.force\) params\.set\("force", "1"\)/);
  assert.match(loadSessionSource, /d\.wrapperRebuilt[\s\S]*?eventConnectionRef\.current\?\.close\(\)[\s\S]*?maintain\(sid\)/);
  assert.match(mountSource, /loadSession\(session\.id, !cached && !promoted, true, \{ force: true \}\)/);
  assert.match(source, /await loadSession\(sid\)/);
  assert.equal([...source.matchAll(/\{ force: true \}/g)].length, 1);
});

test("forking stays available during a run while in-session branch switches wait for it", () => {
  const forkSource = source.slice(
    source.indexOf("  const handleFork = useCallback"),
    source.indexOf("  const handleNavigate = useCallback"),
  );
  const leafChangeSource = source.slice(
    source.indexOf("  const handleLeafChange = useCallback"),
    source.indexOf("  const handleModelChange = useCallback"),
  );

  // Fork copies into a new file, so only a shell command blocks it; the
  // in-session edit still waits because pi refuses navigate_tree mid-run.
  assert.match(chatWindowSource, /onFork=\{bashRunning \|\| isNew \? undefined : handleFork\}/);
  assert.match(chatWindowSource, /onEditContent=\{sessionBusy \? undefined : handleEditContent\}/);
  assert.match(chatWindowSource, /onAskInNewChat && quotedSelection\.sourceEntryId && !bashRunning &&/);
  assert.match(forkSource, /addNotice\(\{ type: "error", message:/);

  // A branch summary being generated holds the leaf too, like compaction.
  assert.match(leafChangeSource, /if \(bashRunningRef\.current \|\| agentRunningRef\.current \|\| isCompacting \|\| branchSummaryHolds\(branchSummarySessionIdRef\.current, sessionIdRef\.current\)\) return;/);
  assert.match(source, /const branchSwitchLocked = agentRunning \|\| bashRunning \|\| isCompacting \|\| branchSummaryPending;/);
  assert.match(source, /onBranchDataChange\(data\?\.tree \?\? \[\], activeLeafId, handleLeafChange, branchSwitchLocked\)/);
  assert.match(appShellSource, /setBranchSwitchLocked\(locked\)/);
  // The fork's top bar mounts one BranchNavigator (upstream has a second in
  // its mobile toolbar, which the fork's More menu replaces).
  assert.equal((appShellSource.match(/locked=\{branchSwitchLocked\}/g) ?? []).length, 1);
});

test("first user messages expose both branch actions and edit before their own entry", () => {
  const navigateSource = source.slice(
    source.indexOf("  const handleNavigate = useCallback"),
    source.indexOf("  const handleLeafChange = useCallback"),
  );

  assert.match(chatWindowSource, /onFork=\{bashRunning \|\| isNew \? undefined : handleFork\}/);
  assert.doesNotMatch(chatWindowSource, /idx === 0 && msg\.role === "user"/);
  assert.doesNotMatch(chatWindowSource, /prevAssistantEntryId/);
  assert.match(navigateSource, /type: "navigate_tree",\s*targetId: entryId/);
  assert.match(navigateSource, /await loadSession\(sid\)/);
});

test("history edits move the branch only when sent, so cancel or reload keeps it", () => {
  const sendSource = source.slice(
    source.indexOf("  const handleSend = useCallback"),
    source.indexOf("  const executeBash = useCallback"),
  );

  assert.doesNotMatch(chatWindowSource, /onNavigate=/);
  assert.match(source, /opts\.chatInputRef\?\.current\?\.replaceMessage\(message\);\s*setEdit\(entryId\)/);
  assert.match(messageViewSource, /onClick=\{onCancelEdit\}/);
  assert.match(source, /const cancelEdit = useCallback\(\(\) => setEdit\(null\)/);
  assert.match(sendSource, /setEdit\(null\);\s*if \(!\(await handleNavigateRef\.current\?\.\(entryId\)\)\) \{\s*setEdit\(entryId\);\s*restoreSubmission\(/);
});

test("an empty persisted session displays the model it will use on first send", () => {
  assert.match(
    source,
    /currentModel \?\? \(data\?\.context\.messages\.length === 0 \? newSessionDefaultModel : null\)/,
  );
  assert.match(source, /setNewSessionDefaultModel\(displayDefaultModel/);
});

test("the selector prefers the live wrapper model over persisted response metadata", () => {
  assert.match(source, /model\?: \{ provider: string; id: string \}/);
  assert.match(source, /const currentModel = currentModelOverride \?\? liveModel \?\? data\?\.context\.model \?\? pendingModel \?\? null/);
  assert.match(source, /syncLiveModel\(liveState\)/);
  assert.match(source, /syncLiveModel\(state\);[\s\S]*?const busy = data\.running/);
});

test("existing-session prompts rely on the persisted tool selection", () => {
  const sendSource = source.slice(
    source.indexOf("  const handleSend = useCallback"),
    source.indexOf("  const executeBash = useCallback"),
  );
  const existingSessionPrompt = sendSource.slice(sendSource.indexOf("} else if (session)"));

  assert.match(existingSessionPrompt, /type: "prompt",\s*message,/);
  assert.doesNotMatch(existingSessionPrompt, /toolNames:/);
  assert.doesNotMatch(sendSource, /restoreSubmission, toolPreset\]\);/);
});

test("submission recovery updates live refs before a possible session rekey", () => {
  const restoreMethod = chatInputSource.slice(
    chatInputSource.indexOf("    restoreSubmission(text:"),
    chatInputSource.indexOf("    insertText(text:"),
  );

  assert.ok(
    restoreMethod.indexOf("valueRef.current = restoredDraft.value")
      < restoreMethod.indexOf("setValue((current) =>"),
  );
  assert.ok(
    restoreMethod.indexOf("attachedImagesRef.current = restoredImages")
      < restoreMethod.indexOf("setAttachedImages((current) =>"),
  );
});

test("stale fresh-session completion cannot replace the active composer", () => {
  const cwdChangeSource = appShellSource.slice(
    appShellSource.indexOf("  const handleCwdChange = useCallback"),
    appShellSource.indexOf("  const handleSelectSession = useCallback"),
  );
  const newSessionSource = appShellSource.slice(
    appShellSource.indexOf("  const handleNewSession = useCallback"),
    appShellSource.indexOf("  // Global keyboard shortcuts"),
  );
  const createdSource = appShellSource.slice(
    appShellSource.indexOf("  const handleSessionCreated = useCallback"),
    appShellSource.indexOf("  const handleAgentEnd = useCallback"),
  );

  assert.match(newSessionSource, /const draftKey = `new:\$\{sessionId\}:\$\{cwd\}`/);
  assert.match(newSessionSource, /activeNewSessionDraftKeyRef\.current = draftKey/);
  assert.match(createdSource, /activeNewSessionDraftKeyRef\.current !== sourceDraftKey/);
  assert.match(cwdChangeSource, /const currentFreshCwd = newSessionCwd \?\? activeCwd/);
  assert.match(
    cwdChangeSource,
    /currentProject === newProject\s*&& \(selectedSession !== null \|\| currentFreshCwd === cwd\)/,
  );
  assert.match(cwdChangeSource, /if \(currentProject !== newProject\) \{[\s\S]*?setFileTabs\(\[\]\)/);
  assert.match(
    appShellSource,
    /useLayoutEffect\(\(\) => \{\s*activeNewSessionDraftKeyRef\.current = newSessionDraftKey;/,
  );
  assert.ok(
    createdSource.indexOf("activeNewSessionDraftKeyRef.current !== sourceDraftKey")
      < createdSource.indexOf("setSelectedSession(session)"),
  );
});

test("abandoned fresh-session drafts are cleared and cannot be recreated by late rejection", () => {
  const restoreSource = source.slice(
    source.indexOf("  const restoreSubmission = useCallback"),
    source.indexOf("  const sessionStats = useMemo"),
  );
  const mountSource = source.slice(
    source.indexOf("  // Load session on mount"),
    source.indexOf("  useEffect(() => {\n    onSystemPromptChange"),
  );

  assert.match(restoreSource, /!sessionHookMountedRef\.current[\s\S]*?!newSessionPromotedRef\.current/);
  assert.match(mountSource, /const abandonedDraftKey = isNew \? newSessionDraftKey : null/);
  assert.match(mountSource, /clearDraft\(abandonedDraftKey\)/);
});

test("streaming submissions cannot be stranded in an idle direct queue", () => {
  const queueSource = source.slice(
    source.indexOf("  // Let AgentSession.prompt decide atomically"),
    source.indexOf("  const handleAbortCompaction"),
  );

  assert.match(queueSource, /type: "prompt"/);
  assert.match(queueSource, /streamingBehavior: behavior/);
  assert.match(queueSource, /if \(isPromptRejectedError\(e\)\) restore\(\)/);
  assert.doesNotMatch(queueSource, /type: "steer"/);
  assert.doesNotMatch(queueSource, /type: "follow_up"/);
});

function streamingPromptCallback(context) {
  const parsed = ts.createSourceFile("useAgentSession.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  function find(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(parsed) === "sendStreamingPrompt") return node.initializer.arguments[0];
    return ts.forEachChild(node, find);
  }
  return new Script(ts.transpileModule(find(parsed).getText(parsed), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText).runInNewContext(context);
}

function deferredSubmission() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function streamingPromptHarness(request) {
  const sent = [];
  const restored = [];
  const notices = [];
  const context = {
    streamingSessionId: "session-a", streamingSessionGeneration: 3,
    sessionIdRef: { current: "session-a" }, sessionGenerationRef: { current: 3 },
    sessionHookMountedRef: { current: true }, composerDraftKey: "session-a", editEntryId: null,
    restoreSubmission: (...args) => restored.push(args),
    addNotice: (notice) => notices.push(notice),
    isPromptRejectedError: (error) => error.rejected === true,
    console: { error() {} },
    sendAgentCommand: (id, command) => { sent.push([id, command]); return request.promise; },
  };
  return { context, sent, restored, notices, send: streamingPromptCallback(context) };
}

test("stale queue callbacks never dispatch to the newly selected session, including A-B-A", async () => {
  for (const id of ["session-b", "session-a"]) {
    const harness = streamingPromptHarness(deferredSubmission());
    harness.context.sessionIdRef.current = id;
    harness.context.sessionGenerationRef.current += 1;
    await harness.send("late queued message", "steer");
    assert.deepEqual(harness.sent, []);
    assert.deepEqual(harness.restored, [["late queued message", undefined, "session-a"]]);
  }
  const unmounted = streamingPromptHarness(deferredSubmission());
  unmounted.context.sessionHookMountedRef.current = false;
  await unmounted.send("late queued message", "followUp");
  assert.deepEqual(unmounted.sent, []);
  assert.equal(unmounted.restored[0][2], "session-a");
});

test("accepted queued prompts retain their dispatch target and never restore after navigation", async () => {
  const request = deferredSubmission();
  const harness = streamingPromptHarness(request);
  const pending = harness.send("queued once", "followUp");
  assert.equal(harness.sent[0][0], "session-a");
  assert.equal(harness.sent[0][1].streamingBehavior, "followUp");
  harness.context.sessionIdRef.current = "session-b";
  harness.context.sessionGenerationRef.current += 1;
  request.resolve({ success: true });
  await pending;
  assert.equal(harness.sent.length, 1);
  assert.deepEqual(harness.restored, []);
});

test("delayed queued rejections restore only the originating draft; ambiguous failures do not replay", async () => {
  for (const rejected of [true, false]) {
    const request = deferredSubmission();
    const harness = streamingPromptHarness(request);
    const image = { data: "AQID", mimeType: "image/png", previewUrl: "blob:submitted" };
    const pending = harness.send("queued with image", "steer", [image]);
    harness.context.sessionIdRef.current = "session-b";
    harness.context.sessionGenerationRef.current += 1;
    request.reject(Object.assign(new Error("late failure"), { rejected }));
    await pending;
    assert.equal(harness.sent.length, 1);
    assert.equal(harness.sent[0][0], "session-a");
    assert.equal(harness.sent[0][1].images[0].data, image.data);
    assert.equal(harness.restored.length, rejected ? 1 : 0);
    if (rejected) {
      assert.equal(harness.restored[0][0], "queued with image");
      assert.equal(harness.restored[0][2], "session-a");
    }
  }
});

test("built-in clone switches to the independent child session", () => {
  const builtinSource = source.slice(
    source.indexOf("  const handleBuiltinSlashCommand"),
    source.indexOf("  // Let AgentSession.prompt decide atomically"),
  );

  assert.match(builtinSource, /case "clone"/);
  assert.match(builtinSource, /type: "clone",\s+leafId: activeLeafId/);
  assert.match(builtinSource, /agentRunningRef\.current \|\| bashRunningRef\.current/);
  assert.match(builtinSource, /onSessionForked\?\.\(result\.newSessionId\)/);
});

test("post-accept prompt errors do not duplicate the user submission", () => {
  const promptErrorSource = source.slice(
    source.indexOf('case "prompt_error"'),
    source.indexOf('case "extension_error"'),
  );

  assert.match(promptErrorSource, /addNotice/);
  assert.doesNotMatch(promptErrorSource, /restoreSubmission/);
});

test("delegates event stream readiness and hides an empty agent phase", () => {
  const ensureSource = source.slice(
    source.indexOf("const ensureEventsConnected"),
    source.indexOf("const respondToExtensionUi"),
  );

  assert.match(source, /new AgentEventConnection\(\{/);
  assert.match(source, /shouldMaintain: \(sid\)[\s\S]*?sessionIdRef\.current === sid/);
  assert.match(ensureSource, /eventConnectionRef\.current!\.ensureConnected\(sid\)/);
  assert.match(ensureSource, /eventConnectionRef\.current!\.maintain\(sid\)/);
  assert.match(chatWindowSource, /const hasStreamingContent = Boolean\(streamState\.streamingMessage\?\.content\.length\)/);
  assert.match(chatWindowSource, /const transcriptMessages = useMemo\(\(\) => streamState\.isStreaming && streamState\.streamingMessage\s*\? \[\.\.\.messages, streamState\.streamingMessage\]/);
  assert.match(chatWindowSource, /agentRunning && !hasStreamingContent && activeThinkingIndex === null && activeToolCallId === null && \(agentPhase \|\| isCompacting\)/);
  // Compaction is what the user needs to know while a turn is being compacted, so it is
  // forwarded to the label instead of letting the stream phase read as a hang.
  assert.match(chatWindowSource, /phaseLabel\(agentPhase, t, isCompacting\)/);
  assert.match(phaseLabelSource, /return null;/);
});

test("uses one absolute agent-readiness deadline instead of a five-second transport deadline", () => {
  assert.match(source, /EVENT_STREAM_READY_TIMEOUT_MS = 60_000/);
  assert.doesNotMatch(source, /EVENT_STREAM_OPEN_TIMEOUT_MS/);
});

test("uses server pagination state instead of guessing from rendered rows", () => {
  const loadContextSource = source.slice(
    source.indexOf("const loadContext = useCallback"),
    source.indexOf("const loadTools = useCallback"),
  );
  assert.match(source, /const \[hasEarlierMessages, setHasEarlierMessages\] = useState\(false\)/);
  assert.match(source, /setHasEarlierMessages\(d\.context\.hasMore\)/);
  assert.match(source, /setHistoryCursor\(d\.context\.oldestEntryId\)/);
  assert.match(loadContextSource, /setData\(\(prev\) => \{[\s\S]*messages: \[\.\.\.d\.context\.messages, \.\.\.prev\.context\.messages\]/);
  assert.match(chatWindowSource, /const oldestId = historyCursor/);
  assert.doesNotMatch(chatWindowSource, /const oldestId = entryIds\[0\]/);
  assert.match(chatWindowSource, /if \(!hasEarlierMessages\) return/);
  assert.match(chatWindowSource, /const hasMore = startIndex > 0 \|\| hasEarlierMessages/);
  assert.doesNotMatch(chatWindowSource, /rendered\.length >= visibleCount/);
});

test("keeps the selected session warm while idle and renews its lease", () => {
  assert.match(source, /sessionRunning\?: boolean/);
  assert.match(
    source,
    /const sid = session\?\.id;[\s\S]*?if \(!sid\) return;[\s\S]*?maintainEventsConnected\(sid\)/,
  );
  assert.match(source, /sessionPropIdRef\.current === sid/);
  assert.match(source, /SESSION_LEASE_RENEW_INTERVAL_MS = 30_000/);
  assert.match(source, /fetch\(`\/api\/agent\/\$\{encodeURIComponent\(sid\)\}\/lease`/);
  assert.match(source, /setInterval\(\(\) => void renewLease\(\), SESSION_LEASE_RENEW_INTERVAL_MS\)/);
  assert.match(source, /result\.renewed === 0[\s\S]*?closeEvents\(\)[\s\S]*?maintainEventsConnected\(sid\)/);
  assert.match(source, /if \(sessionPropIdRef\.current === sid\) \{[\s\S]*?cancelEventStreamGrace\(\);[\s\S]*?return;/);
  assert.match(source, /maintainEventsConnected\(sid\)/);
  assert.doesNotMatch(source, /void connectEvents\(/);
  assert.match(chatWindowSource, /sessionRunning\?: boolean/);
  assert.match(chatWindowSource, /session, sessionRunning, newSessionCwd/);
  assert.match(appShellSource, /runningSessionIds\.has\(selectedSession\.id\)/);
  assert.match(appShellSource, /onRunningSessionIdsChange=\{handleRunningSessionIdsChange\}/);
});

test("opens the selected session's event stream even when Strict Mode re-runs effects", () => {
  // Strict Mode re-runs effects in declaration order after a simulated
  // unmount. The mount-only effect's cleanup flips sessionHookMountedRef to
  // false and only restores it when it re-runs, which happens after the
  // warm-session effect. That effect must therefore re-assert the ref itself
  // or shouldMaintain() refuses to open the stream on mount and on every
  // switch back to a running session.
  const warmSource = source.slice(
    source.indexOf("  // Keep the selected session warm even while its agent is idle."),
    source.indexOf("    const renewLease = async () => {"),
  );
  assert.match(warmSource, /sessionHookMountedRef\.current = true;\s*maintainEventsConnected\(sid\);/);
  assert.ok(
    warmSource.indexOf("sessionHookMountedRef.current = true;")
      < warmSource.indexOf("maintainEventsConnected(sid);"),
  );
  const mountSource = source.slice(
    source.indexOf("  useEffect(() => {\n    sessionHookMountedRef.current = true;"),
    source.indexOf("  useEffect(() => {\n    onSystemPromptChange?.(systemPrompt);"),
  );
  assert.match(mountSource, /return \(\) => \{\s*sessionHookMountedRef\.current = false;/);
  // The fork triggers the load effect per session identity (AppShell keeps the
  // hook mounted across switches); upstream's mount-only [] deps would never
  // reload here. Strict Mode still works because the warm-session effect,
  // declared earlier, re-asserts the ref before this effect re-runs.
  assert.match(mountSource, /closeEvents\(\);\s*\};/);
  assert.match(mountSource, /\/\/ eslint-disable-next-line react-hooks\/exhaustive-deps\s*\}, \[sessionIdentity\]\);/);
});

test("keeps one reducer-owned assistant partial and consumes Pi JSON deltas", () => {
  const connectedSource = source.slice(
    source.indexOf('case "connected"'),
    source.indexOf('case "agent_start"'),
  );
  const streamSource = source.slice(
    source.indexOf('case "message_start"'),
    source.indexOf('case "message_end"'),
  );
  const messageEndSource = source.slice(
    source.indexOf('case "message_end"'),
    source.indexOf('case "tool_execution_start"'),
  );

  assert.match(source, /streamReducer,[\s\S]*type ClientAssistantMessageEvent/);
  assert.doesNotMatch(source, /streamingMessageRef/);
  assert.match(connectedSource, /dispatch\(\{ type: "end" \}\)/);
  assert.match(connectedSource, /event\.isStreaming === true/);
  assert.match(connectedSource, /agentRunningRef\.current = true/);
  assert.match(streamSource, /msg\?\.role === "assistant"[\s\S]*dispatch\(\{ type: "snapshot", message: msg \}\)/);
  assert.match(streamSource, /event\.assistantMessageEvent as ClientAssistantMessageEvent/);
  assert.match(streamSource, /dispatch\(\{ type: "delta", event: delta \}\)/);
  assert.match(streamSource, /delta\.type !== "toolcall_start" && delta\.type !== "toolcall_delta"/);
  assert.doesNotMatch(streamSource, /case "message_delta"/);
  assert.match(messageEndSource, /const completed = event\.message as AgentMessage/);
  // Transcript system messages (Pi >= 0.86 prompt and tool loadout) never enter the chat.
  assert.match(streamSource, /if \(isSystemMessageEvent\(event\)\) break;/);
  assert.match(messageEndSource, /if \(isSystemMessageEvent\(event\)\) break;/);
  assert.match(messageEndSource, /normalizeToolCalls\(completed\)/);
  assert.match(messageEndSource, /dispatch\(\{ type: "end" \}\)/);
  assert.doesNotMatch(messageEndSource, /streamState\.streamingMessage/);
});

test("restoring a running session does not clear an SSE snapshot", () => {
  const mountSource = source.slice(
    source.indexOf("// Load session on mount"),
    source.indexOf("useEffect(() => {\n    onSystemPromptChange"),
  );

  assert.match(mountSource, /dispatch\(\{ type: "resume" \}\)/);
  assert.doesNotMatch(mountSource, /dispatch\(\{ type: "start" \}\)/);
});

test("shows the latest streamed tool execution progress in the running phase", () => {
  const updateSource = source.slice(
    source.indexOf('case "tool_execution_update"'),
    source.indexOf('case "tool_execution_end"'),
  );

  assert.match(updateSource, /getToolExecutionProgress\(event\.partialResult\)/);
  assert.match(updateSource, /tools: \[\.\.\.tools\.filter\([\s\S]*?, updated\]/);
  assert.match(phaseLabelSource, /if \(latest\?\.progress\)/);
  assert.match(phaseLabelSource, /chat\.runningNamedTool[\s\S]*latest\.progress/);
});

test("reconnects active shell output to its streaming tool call", () => {
  const updateSource = source.slice(
    source.indexOf('case "tool_execution_update"'),
    source.indexOf('case "tool_execution_end"'),
  );
  const endSource = source.slice(
    source.indexOf('case "tool_execution_end"'),
    source.indexOf('case "queue_update"'),
  );

  assert.match(updateSource, /name === "bash" \|\| name === "powershell" \|\| name === CODEMODE_TOOL_NAME/);
  assert.match(updateSource, /setActiveToolResults/);
  assert.match(updateSource, /content,/);
  assert.match(endSource, /setActiveToolResults[\s\S]*next\.delete\(id\)/);
  assert.match(chatWindowSource, /const map = new Map\(activeToolResults\)/);
  assert.match(chatWindowSource, /const streamingIdx = streamState\.isStreaming && streamState\.streamingMessage \? messages\.length - 1 : -1/);
  assert.match(chatWindowSource, /<MessageView\s+key=\{[^\n]+\}\s+message=\{msg\}\s+isStreaming=\{isStreaming\}[\s\S]*?toolResults=\{toolResultsMap\}/);
});

test("reports a running script's newest call as its progress", () => {
  const updateSource = source.slice(
    source.indexOf('case "tool_execution_update"'),
    source.indexOf('case "tool_execution_end"'),
  );
  // A codemode snapshot has no text content, so the generic progress would stay empty.
  assert.match(
    updateSource,
    /name === CODEMODE_TOOL_NAME\s*\? getCodemodeProgress\(event\.partialResult\)\s*: getToolExecutionProgress\(event\.partialResult\)/,
  );
});

test("keeps calls a tool made itself out of the running tools", () => {
  // A codemode script's nested calls would otherwise show as top-level running
  // tools beside the script that made them.
  for (const [from, to] of [
    ['case "tool_execution_start"', 'case "tool_execution_update"'],
    ['case "tool_execution_update"', 'case "tool_execution_end"'],
    ['case "tool_execution_end"', 'case "queue_update"'],
  ]) {
    const caseSource = source.slice(source.indexOf(from), source.indexOf(to));
    const guard = caseSource.indexOf("if (isNestedToolExecutionEvent(event)) break;");
    assert.notEqual(guard, -1, `${from} must skip nested tool events`);
    assert.ok(guard < caseSource.indexOf("const id = event.toolCallId"), `${from} must skip them before using the id`);
  }
  assert.match(source, /import \{ isNestedToolExecutionEvent, isSystemMessageEvent \} from "@\/lib\/agent-event-wire";/);
});

test("plays the enabled sound once when an extension dialog appears over an empty slot", () => {
  const soundSource = chatWindowSource.slice(
    chatWindowSource.indexOf("const surfaced = "),
    chatWindowSource.indexOf("}, [completionNotificationsEnabled, extensionDialog]);"),
  );
  assert.match(chatWindowSource, /extensionDialogShownRef = useRef\(false\)/);
  // A dialog queued behind another surfaces right after the user answers that one,
  // so only the transition from no dialog to a dialog sounds.
  assert.match(soundSource, /const surfaced = Boolean\(extensionDialog\) && !extensionDialogShownRef\.current;/);
  assert.match(soundSource, /extensionDialogShownRef\.current = Boolean\(extensionDialog\);\s+if \(!completionNotificationsEnabled \|\| !surfaced\) return;/);
  assert.match(soundSource, /playDoneSoundRef\.current\(\)/);
});

test("queues extension dialogs and custom panels by request id instead of sharing one slot", () => {
  const extensionRequestSource = source.slice(
    source.indexOf("  const handleExtensionUiRequest = useCallback"),
    source.indexOf("  const settleUiStage = useCallback"),
  );
  const respondSource = source.slice(
    source.indexOf("  const respondToExtensionUi = useCallback"),
    source.indexOf("  const sendExtensionCustomInput = useCallback"),
  );
  const closedSource = source.slice(
    source.indexOf('      case "extension_ui_closed":'),
    source.indexOf("  handleAgentEventRef.current = handleAgentEvent;"),
  );

  assert.match(
    source,
    /import \{\s+enqueueExtensionUiRequest,\s+removeExtensionUiRequest,\s+retainExtensionUiRequests,\s+upsertExtensionUiRequest,\s+\} from "@\/lib\/extension-ui-queue"/,
  );
  // A (re)connect drops what the server no longer holds; its replay follows.
  const connectedSource = source.slice(source.indexOf('      case "connected": {'), source.indexOf('      case "agent_start":'));
  assert.match(connectedSource, /const pending = new Set\(event\.pendingExtensionUiIds as string\[\]\);/);
  assert.match(connectedSource, /setExtensionDialogs\(\(queue\) => retainExtensionUiRequests\(queue, pending\)\);/);
  assert.match(connectedSource, /setExtensionCustomUis\(\(queue\) => retainExtensionUiRequests\(queue, pending\)\);/);
  assert.match(source, /const \[extensionDialogs, setExtensionDialogs\] = useState<ExtensionUiDialogRequest\[\]>\(\[\]\)/);
  assert.match(source, /const \[extensionCustomUis, setExtensionCustomUis\] = useState<ExtensionUiCustomRequest\[\]>\(\[\]\)/);
  assert.doesNotMatch(source, /setExtensionDialog\(|setExtensionCustomUi\(/);
  assert.match(
    extensionRequestSource,
    /case "editor":\s+setExtensionDialogs\(\(queue\) => enqueueExtensionUiRequest\(queue, request\)\)/,
  );
  // A custom panel re-renders under its id: replace it where it stands, drop it on close.
  assert.match(
    extensionRequestSource,
    /case "custom":\s+setExtensionCustomUis\(\(queue\) => request\.closed\s+\? removeExtensionUiRequest\(queue, request\.id\)\s+: upsertExtensionUiRequest\(queue, request\)\)/,
  );
  assert.match(respondSource, /setExtensionDialogs\(\(queue\) => removeExtensionUiRequest\(queue, request\.id\)\)/);
  assert.match(closedSource, /setExtensionDialogs\(\(queue\) => removeExtensionUiRequest\(queue, event\.id as string\)\)/);
  // The hook keeps exposing what is on screen under the old names, plus how many wait behind it.
  assert.match(source, /const extensionDialog = extensionDialogs\[0\] \?\? null;/);
  assert.match(source, /const waitingExtensionDialogCount = Math\.max\(0, extensionDialogs\.length - 1\);/);
  assert.match(source, /const extensionCustomUi = extensionCustomUis\[0\] \?\? null;/);
  assert.match(source, /const waitingExtensionCustomUiCount = Math\.max\(0, extensionCustomUis\.length - 1\);/);
  assert.match(source, /notices: noticeState\.visible, addNotice, extensionDialog, waitingExtensionDialogCount, extensionCustomUi, waitingExtensionCustomUiCount,/);
  assert.match(chatWindowSource, /notices, extensionDialog, waitingExtensionDialogCount, extensionCustomUi, waitingExtensionCustomUiCount,/);
});

test("drops queued extension UI when a tool change rebuilds the wrapper", () => {
  const setToolsSource = source.slice(
    source.indexOf("  const handleToolPresetChange = useCallback"),
    source.indexOf("  const scrollToMessage = useCallback"),
  );
  // The old wrapper closes its event stream before cancelling its pending requests,
  // so their extension_ui_closed events never reach this hook.
  assert.match(
    setToolsSource,
    /if \(activeSessionId !== sid \|\| result\?\.recreated\) \{[\s\S]*?closeEvents\(\);[\s\S]*?setExtensionDialogs\(\[\]\);\s+setExtensionCustomUis\(\[\]\);[\s\S]*?maintainEventsConnected\(activeSessionId\)/,
  );
  // A tool change that keeps the wrapper keeps its pending requests on screen.
  const unconditional = setToolsSource.slice(setToolsSource.indexOf("      setSlashCommands([]);"));
  assert.doesNotMatch(unconditional, /setExtensionDialogs|setExtensionCustomUis/);
});

test("suppresses sounds and browser attention for the active subagent session", () => {
  const completionSource = appShellSource.slice(
    appShellSource.indexOf("  const handleAgentEnd = useCallback"),
    appShellSource.indexOf("  const handleAttentionNeeded = useCallback"),
  );
  const attentionSource = appShellSource.slice(
    appShellSource.indexOf("  const handleAttentionNeeded = useCallback"),
    appShellSource.indexOf("  const handleAutoName = useCallback"),
  );

  assert.match(chatWindowSource, /completionNotificationsEnabled = session\?\.relation\?\.kind !== "subagent"/);
  assert.match(chatWindowSource, /completionNotificationsEnabled && soundEnabledRef\.current/);
  assert.match(chatWindowSource, /!completionNotificationsEnabled \|\| !surfaced/);
  assert.match(completionSource, /selectedSession\?\.relation\?\.kind === "subagent"\) return/);
  assert.match(attentionSource, /selectedSession\?\.relation\?\.kind === "subagent"\) return/);
});

test("routes blocking extension requests through deduplicated browser attention notifications", () => {
  const completionSource = appShellSource.slice(
    appShellSource.indexOf("  const handleAgentEnd = useCallback"),
    appShellSource.indexOf("  const handleAttentionNeeded = useCallback"),
  );
  const extensionRequestSource = source.slice(
    source.indexOf("  const handleExtensionUiRequest = useCallback"),
    source.indexOf("  const settleUiStage = useCallback"),
  );
  const attentionSource = appShellSource.slice(
    appShellSource.indexOf("  const handleAttentionNeeded = useCallback"),
    appShellSource.indexOf("  const handleAutoName = useCallback"),
  );

  assert.match(
    extensionRequestSource,
    /isBlockingExtensionUiRequest\(request\)[\s\S]*?onAttentionNeeded\?\.\(request\)/,
  );
  assert.match(chatWindowSource, /onAttentionNeeded, onSessionCreated/);
  assert.match(completionSource, /if \(!shouldShowBrowserNotification\(\)\) return/);
  assert.doesNotMatch(completionSource, /pushActive/);
  assert.match(completionSource, /tag: targetSession \? `pi-session-complete:\$\{targetSession\.id\}`/);
  assert.doesNotMatch(completionSource, /document\.visibilityState === "visible"/);
  assert.match(attentionSource, /shouldShowBrowserNotification\(\)/);
  assert.match(attentionSource, /claimExtensionAttentionNotification\(request, notifiedAttentionRequestIdsRef\.current\)/);
  assert.match(attentionSource, /tag: `pi-extension-ui:\$\{request\.id\}`/);
  assert.match(appShellSource, /onAttentionNeeded=\{handleAttentionNeeded\}/);
});

test("keeps live following cancellable when the user scrolls away from the tail", () => {
  const streamUpdateSource = source.slice(
    source.indexOf('case "message_start"'),
    source.indexOf('case "message_end"'),
  );
  const scrollHandlerSource = source.slice(
    source.indexOf("const handleScrollPositionChange"),
    source.indexOf("// Load session on mount"),
  );
  const scrollToBottomSource = source.slice(
    source.indexOf("const scrollToBottom"),
    source.indexOf("const currentModel"),
  );

  assert.match(source, /const liveFollowFrameRef = useRef<number \| null>\(null\)/);
  assert.match(source, /const previousScrollTopRef = useRef\(0\)/);
  assert.match(source, /const wasAttached = isNearBottomRef\.current;[\s\S]*?const isAttached = getLiveFollowAttached\([\s\S]*?wasAttached,[\s\S]*?previousScrollTopRef\.current,[\s\S]*?scrollTop,[\s\S]*?clientHeight,[\s\S]*?scrollHeight/);
  assert.match(scrollHandlerSource, /const isAgentRunning = agentRunningRef\.current;[\s\S]*?isAgentRunning\s*\? CHAT_SCROLL_REATTACH_TOLERANCE\s*:\s*CHAT_SCROLL_TAIL_TOLERANCE/);
  assert.match(source, /previousScrollTopRef\.current = scrollTop/);
  assert.match(scrollToBottomSource, /const container = scrollContainerRef\.current;\s*if \(!container\) return;/);
  assert.match(scrollToBottomSource, /container\.scrollTo\(\{ top: container\.scrollHeight, behavior \}\);\s*previousScrollTopRef\.current = container\.scrollTop;/);
  assert.doesNotMatch(scrollToBottomSource, /scrollIntoView/);
  assert.match(streamUpdateSource, /liveFollowFrameRef\.current === null/);
  assert.match(streamUpdateSource, /requestAnimationFrame\(\(\) => \{[\s\S]*?liveFollowFrameRef\.current = null;[\s\S]*?if \(isNearBottomRef\.current && canFollowStream\(lastUserScrollInputAtRef\.current, performance\.now\(\)\)\) scrollToBottom\("auto"\)/);
  assert.match(scrollHandlerSource, /!wasAttached && isAttached && isAgentRunning[\s\S]*?scrollToBottom\("auto"\)/);
  assert.match(scrollHandlerSource, /cancelAnimationFrame\(liveFollowFrameRef\.current\)/);
  assert.match(source, /previousScrollTopRef\.current = container\.scrollTop;[\s\S]*?container\.addEventListener\("scroll", handleScrollPositionChange/);
  assert.match(source, /for \(const type of \["wheel", "touchstart", "keydown"\]\) container\.addEventListener\(type, markUserInput/);
  assert.doesNotMatch(source, /SCROLL_BOTTOM_THRESHOLD|completionScrollAllowedRef|ignoreProgrammaticScrollUntilRef/);
});

test("restores an in-page session viewport without the default tail jump", () => {
  assert.match(source, /const initialScrollDoneRef = useRef\(Boolean\(opts\.deferInitialScroll\)\)/);
  assert.match(source, /const scrollToMessage = useCallback\(\(element: HTMLElement, viewportOffset = 16\)/);
  assert.match(source, /container\.scrollTop\s+- viewportOffset/);
  assert.match(chatWindowSource, /deferInitialScroll: Boolean\(pendingScrollRestore\)/);
  assert.match(chatWindowSource, /isScrollAtTail\(container\.scrollTop, container\.clientHeight, container\.scrollHeight\)/);
  assert.match(chatWindowSource, /findChatScrollAnchor\(/);
  assert.match(chatWindowSource, /while \(hasMore && before && !controller\.signal\.aborted\)/);
  assert.match(chatWindowSource, /context\.oldestEntryId === position\.oldestEntryId/);
  assert.match(chatWindowSource, /if \(!context\) \{\s*scrollToBottom\("instant"\);\s*setPendingScrollRestore\(null\);/);
  assert.match(chatWindowSource, /scrollToMessage\(element, position\.anchorOffset\)/);
  assert.match(chatWindowSource, /visibility: pendingScrollRestore && !loading \? "hidden" : undefined/);
});

test("keeps a newly sent user message at the top while its response starts", () => {
  const streamUpdateSource = source.slice(
    source.indexOf('case "message_start"'),
    source.indexOf('case "message_end"'),
  );
  const userScrollSource = source.slice(
    source.indexOf("const scrollUserMsgToTop"),
    source.indexOf("const handleScrollPositionChange"),
  );
  const scrollEffectSource = source.slice(
    source.indexOf("useLayoutEffect(() => {\n    if (messages.length > 0)"),
    source.indexOf("// Load model list"),
  );

  assert.match(streamUpdateSource, /!pendingScrollToUserRef\.current && isNearBottomRef\.current/);
  assert.match(source, /const \[promptAnchorActive, setPromptAnchorActive\] = useState\(false\)/);
  assert.match(source, /pendingScrollToUserRef\.current = true;\s*setPromptAnchorActive\(true\)/);
  assert.match(userScrollSource, /const targetTop = Math\.min\(Math\.max\(0, elAbsTop - 16\), maxScrollTop\)/);
  assert.match(userScrollSource, /cancelAnimationFrame\(liveFollowFrameRef\.current\)/);
  assert.match(userScrollSource, /isNearBottomRef\.current = true/);
  assert.match(userScrollSource, /previousScrollTopRef\.current = targetTop/);
  assert.match(userScrollSource, /container\.scrollTo\(\{ top: targetTop, behavior: "auto" \}\)/);
  assert.match(scrollEffectSource, /pendingScrollToUserRef\.current = false;[\s\S]*?scrollUserMsgToTop\(\)/);
  assert.match(chatWindowSource, /const contentEnd = spacer\.getBoundingClientRect\(\)\.top[\s\S]*?getPromptAnchorSpacerHeight\([\s\S]*?targetTop,[\s\S]*?contentEnd,[\s\S]*?container\.clientHeight/);
  assert.match(chatWindowSource, /<div ref=\{promptAnchorSpacerRef\} aria-hidden="true" \/>/);
  assert.match(chatWindowSource, /const promptAnchorAdjustmentDoneRef = useRef\(false\)/);
  assert.match(chatWindowSource, /promptAnchorAdjustmentDoneRef\.current = false/);
  assert.match(chatWindowSource, /const isInitialMeasurement = !promptAnchorAdjustmentDoneRef\.current;[\s\S]*?promptAnchorAdjustmentDoneRef\.current = true;[\s\S]*?if \(needsInitialAdjustment\) scrollUserMsgToTop\(\)/);
});

test("keeps prompt anchor measurement outside the React update cycle", () => {
  const anchorEffectStart = chatWindowSource.indexOf(
    "useLayoutEffect(() => {\n    const spacer = promptAnchorSpacerRef.current;",
  );
  assert.notEqual(anchorEffectStart, -1);
  const syncEffectStart = chatWindowSource.indexOf(
    "useLayoutEffect(() => {\n    promptAnchorUpdateRef.current?.();",
    anchorEffectStart,
  );
  assert.notEqual(syncEffectStart, -1);
  const anchorLifecycleEffectSource = chatWindowSource.slice(
    anchorEffectStart,
    syncEffectStart,
  );
  const anchorSyncEffectSource = chatWindowSource.slice(
    syncEffectStart,
    chatWindowSource.indexOf("const availableThinkingLevels"),
  );

  assert.doesNotMatch(anchorLifecycleEffectSource, /\bset[A-Z][A-Za-z0-9]*\s*\(/);
  assert.doesNotMatch(anchorSyncEffectSource, /\bset[A-Z][A-Za-z0-9]*\s*\(/);
  assert.doesNotMatch(chatWindowSource, /setPromptAnchorSpacer|useState[^\n]*promptAnchorSpacer/);
  assert.doesNotMatch(anchorLifecycleEffectSource, /streamState\.streamingMessage/);
  assert.match(anchorLifecycleEffectSource, /spacer\.style\.height = nextPromptAnchorSpacerHeight > 0/);
  assert.match(anchorLifecycleEffectSource, /promptAnchorUpdateRef\.current = updatePromptAnchorSpacer/);
  assert.match(anchorLifecycleEffectSource, /new ResizeObserver\(schedulePromptAnchorMeasure\)/);
  assert.match(anchorLifecycleEffectSource, /observer\?\.observe\(messageContent\)/);
  assert.match(anchorLifecycleEffectSource, /if \(disposed \|\| promptAnchorMeasureFrameRef\.current !== null\) return/);
  assert.match(anchorLifecycleEffectSource, /promptAnchorMeasureFrameRef\.current = requestAnimationFrame\(\(\) => \{\s*promptAnchorMeasureFrameRef\.current = null;\s*updatePromptAnchorSpacer\(\)/);
  assert.match(anchorLifecycleEffectSource, /disposed = true;[\s\S]*?promptAnchorUpdateRef\.current === updatePromptAnchorSpacer[\s\S]*?cancelAnimationFrame\(promptAnchorMeasureFrameRef\.current\)/);
  assert.match(anchorSyncEffectSource, /promptAnchorUpdateRef\.current\?\.\(\);\s*\}, \[streamState\.streamingMessage\]\)/);
  assert.match(chatWindowSource, /<div\b(?=[^>]*\bref=\{messageContentRef\})(?=[^>]*\bstyle=\{\{)[^>]*>/);
});

test("sizes the floating-composer spacer without a React render", () => {
  assert.match(chatWindowSource, /<div ref=\{promptAnchorSpacerRef\} aria-hidden="true" \/>\s*<div ref=\{composerOverlaySpacerRef\} aria-hidden="true" \/>/);
  // Upstream's state-driven spacer (bottomComposerHeight) made streaming
  // scroll-follow jitter; the overlay spacer is written from the observer.
  assert.doesNotMatch(chatWindowSource, /bottomComposer(?:Ref|Height|ScrollFrameRef)/);
  assert.match(chatWindowSource, /spacer\.style\.height = `\$\{next\}px`/);
  assert.match(chatWindowSource, /if \(atBottom\) container\.scrollTop = container\.scrollHeight/);
  assert.match(chatWindowSource, /className=\{isEmptyNew \? "relative shrink-0" : "absolute inset-x-0 z-20"\}/);
});

test("keeps a detached viewport in place when streaming completes", () => {
  const scrollEffectSource = source.slice(
    source.indexOf("useLayoutEffect(() => {\n    if (messages.length > 0)"),
    source.indexOf("// Load model list"),
  );

  assert.match(scrollEffectSource, /!agentRunningRef\.current && isNearBottomRef\.current[\s\S]*?scrollToBottom\("auto"\)/);
  assert.doesNotMatch(scrollEffectSource, /\|\|/);
  assert.match(source, /addEventListener\("scroll", handleScrollPositionChange/);
});

test("auto-compact slash command toggles session auto-compaction", async () => {
  const commandSource = source.slice(
    source.indexOf('case "auto-compact"'),
    source.indexOf('case "reload"'),
  );
  assert.ok(commandSource.length > 0, "auto-compact case not found before reload case");
  assert.match(commandSource, /sendAgentCommand<AgentStateResponse>\(sid, \{\s*type: "get_state"\s*\}\)/);
  assert.match(commandSource, /!\(liveState\?\.autoCompactionEnabled \?\? true\)/);
  assert.match(commandSource, /sendAgentCommand\(sid, \{\s*type: "set_auto_compaction",\s*enabled: nextEnabled,\s*\}\)/);
  // The result lands in `automation`, the same state the composer gear reads;
  // get_state paths keep it mirrored through syncLiveModel().
  assert.match(commandSource, /setAutomation\(\(prev\) => \(\{ \.\.\.prev, autoCompactionEnabled: nextEnabled \}\)\)/);
  assert.doesNotMatch(commandSource, /!autoCompactionEnabled/);
  assert.doesNotMatch(source, /setAutoCompactionEnabled/, "a second auto-compaction state drifts from the gear");
  assert.match(source, /syncAutomation\(state\);/);
  const automationSource = await jitiSource(new URL("./useSessionAutomation.ts", import.meta.url));
  assert.match(automationSource, /autoCompactionEnabled: state\?\.autoCompactionEnabled \?\? prev\.autoCompactionEnabled/);
});

test("keeps the compaction control reachable while a turn is auto-compacting", () => {
  // Auto-compaction starts mid-turn, so `isStreaming` (sessionBusy) is already true. Hiding
  // the control behind `!isStreaming` left only the generic stop button, which aborts the
  // whole prompt instead of the compaction.
  // Manual compaction moved into the composer's session (gear) menu; a running
  // compaction keeps its own row control, guarded only by isCompacting so it
  // shows whether or not a turn is streaming.
  const controlBlock = chatInputSource.slice(
    chatInputSource.indexOf("{onCompact && isCompacting && ("),
    chatInputSource.indexOf('aria-label={t("chat.stopCompaction")}'),
  );

  assert.ok(controlBlock.length > 0);
  assert.doesNotMatch(controlBlock, /!isStreaming/);
  assert.match(controlBlock, /onClick=\{onAbortCompaction\}/);
  assert.match(controlBlock, /cursor: "pointer"/);
  // Starting one is offered only when nothing is running.
  assert.match(chatInputSource, /const canCompactNow = Boolean\(onCompact && !isStreaming && !isCompacting\)/);
});
