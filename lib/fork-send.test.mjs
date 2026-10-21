import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test, { after, before } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

// Layers: the OpenAI-compatible server below is a local fixture (no model is called); the
// sessions, the fork file copy, the wrappers and the prompt path are the real Pi SDK through
// lib/rpc-manager.ts. Cases marked "(injected)" replace one dependency of forkAndSend to
// force a failure that cannot be caused from outside.
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalOffline = process.env.PI_OFFLINE;
const agentDir = await mkdtemp(join(tmpdir(), "pi-web-fork-send-agent-"));
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_OFFLINE = "1";

const jiti = createJiti(import.meta.url, { interopDefault: true, moduleCache: false, alias: { "@": process.cwd() } });
const { startRpcSession, getRpcSession } = await jiti.import("./rpc-manager.ts");
const forkSendModule = await jiti.import("./fork-send.ts");
const { forkAndSend, createRpcForkSendDeps, ForkSendError } = forkSendModule;
const { POST } = await jiti.import("../app/api/agent/[id]/fork-send/route.ts");

const MODEL = "fixture-model";
const nextTurn = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

// ---------------------------------------------------------------------------------------
// Fixture server: counts every chat completion request and streams a canned reply. A request
// whose last user message contains SLOW streams one part, then waits for release().
// ---------------------------------------------------------------------------------------
const fixture = { server: null, requests: [], slowStarted: null, release: null, port: 0 };

function resetFixture() {
  fixture.requests.length = 0;
  fixture.slowStarted = new Promise((resolve) => { fixture.signalSlow = resolve; });
  fixture.gate = new Promise((resolve) => { fixture.release = resolve; });
}

function chunk(delta, finish = null, extra = {}) {
  return `data: ${JSON.stringify({
    id: "chatcmpl-fixture",
    object: "chat.completion.chunk",
    created: 0,
    model: MODEL,
    choices: [{ index: 0, delta, finish_reason: finish }],
    ...extra,
  })}\n\n`;
}

function lastUserText(body) {
  const user = [...(body.messages ?? [])].reverse().find((message) => message.role === "user");
  if (!user) return "";
  return typeof user.content === "string"
    ? user.content
    : (user.content ?? []).map((part) => part.text ?? "").join("");
}

before(async () => {
  fixture.server = createServer((req, res) => {
    let raw = "";
    req.on("data", (part) => { raw += part; });
    req.on("end", async () => {
      if (!req.url?.includes("/chat/completions")) {
        res.writeHead(404).end();
        return;
      }
      const body = JSON.parse(raw || "{}");
      fixture.requests.push(body);
      const slow = lastUserText(body).includes("SLOW");
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache" });
      res.write(chunk({ role: "assistant", content: "" }));
      res.write(chunk({ content: slow ? "part-one " : "fixture reply" }));
      if (slow) {
        fixture.signalSlow();
        await fixture.gate;
        res.write(chunk({ content: "part-two SLOW-DONE" }));
      }
      res.write(chunk({}, "stop", { usage: { prompt_tokens: 3, completion_tokens: 2, total_tokens: 5 } }));
      res.end("data: [DONE]\n\n");
    });
  });
  await new Promise((resolve) => fixture.server.listen(0, "127.0.0.1", resolve));
  fixture.port = fixture.server.address().port;
  await writeFile(join(agentDir, "models.json"), JSON.stringify({
    providers: {
      fixture: {
        baseUrl: `http://127.0.0.1:${fixture.port}/v1`,
        api: "openai-completions",
        apiKey: "fixture-key",
        models: [{
          id: MODEL,
          name: "Fixture model",
          reasoning: true,
          input: ["text"],
          contextWindow: 32000,
          maxTokens: 512,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        }],
      },
    },
  }));
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ defaultProvider: "fixture", defaultModel: MODEL }));
  resetFixture();
});

after(async () => {
  fixture.release?.();
  await new Promise((resolve) => fixture.server?.close(resolve));
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  if (originalOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = originalOffline;
  for (const session of globalThis.__piSessions?.values() ?? []) session.destroy();
  await rm(agentDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------
const usage = { input: 1, output: 1, cacheRead: 0, cacheWrite: 0, totalTokens: 2, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };

function assistant(text, extra = {}) {
  return {
    role: "assistant",
    content: [{ type: "text", text }],
    api: "openai-completions",
    provider: "fixture",
    model: MODEL,
    usage,
    stopReason: "stop",
    timestamp: Date.now(),
    ...extra,
  };
}

/** A persisted session file of `turns` user/assistant pairs, written before any wrapper exists. */
async function makeSourceFile(t, { turns = 2, tail = [] } = {}) {
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-fork-send-cwd-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const manager = SessionManager.create(cwd);
  manager.appendModelChange("fixture", MODEL);
  for (let i = 1; i <= turns; i += 1) {
    manager.appendMessage({ role: "user", content: `question ${i}`, timestamp: Date.now() });
    manager.appendMessage(assistant(`answer ${i}`));
  }
  for (const message of tail) manager.appendMessage(message);
  const file = manager.getSessionFile();
  assert.ok(file && existsSync(file), "the source file is on disk");
  return { cwd, sessionId: manager.getSessionId(), file };
}

function readJsonl(file) {
  return readFileSync(file, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

function messageText(entry) {
  const content = entry.message?.content;
  return typeof content === "string"
    ? content
    : (content ?? []).map((part) => part.text ?? "").join("");
}

/** Session files in the source's directory whose header names `sourceFile` as parent. */
function childFiles(sourceFile) {
  const dir = join(sourceFile, "..");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".jsonl"))
    .map((name) => join(dir, name))
    .filter((file) => file !== sourceFile && readJsonl(file)[0]?.parentSession === sourceFile);
}

async function startSource(t, source, options = {}) {
  const { session } = await startRpcSession(source.sessionId, source.file, undefined, options);
  t.after(() => session.destroy());
  return session;
}

async function waitFor(predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await nextTurn(20);
  }
  assert.fail(`timed out waiting for ${label}`);
}

async function waitIdle(sessionId) {
  await waitFor(() => {
    const session = getRpcSession(sessionId);
    return session && !session.isRunning();
  }, `session ${sessionId} to go idle`);
}

let keyCounter = 0;
const nextKey = () => `key-${++keyCounter}`;

function sendRequest(source, overrides = {}) {
  return { sourceId: source.sessionId, requestKey: nextKey(), message: "draft text", ...overrides };
}

const realDeps = () => createRpcForkSendDeps();

// ---------------------------------------------------------------------------------------
// A1 main path through the HTTP route
// ---------------------------------------------------------------------------------------
test("A1: POST fork-send forks the idle source at its leaf and sends the draft in the child", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const before = readJsonl(source.file);

  const response = await POST(
    new Request(`http://localhost/api/agent/${source.sessionId}/fork-send`, {
      method: "POST",
      body: JSON.stringify({ requestKey: nextKey(), message: "forked question" }),
    }),
    { params: Promise.resolve({ id: source.sessionId }) },
  );
  const body = await response.json();
  assert.equal(response.status, 200, JSON.stringify(body));
  assert.equal(body.success, true);
  assert.equal(body.data.promptSent, true);
  assert.notEqual(body.data.newSessionId, source.sessionId);
  t.after(() => getRpcSession(body.data.newSessionId)?.destroy());
  t.after(() => getRpcSession(source.sessionId)?.destroy());

  await waitIdle(body.data.newSessionId);
  const children = childFiles(source.file);
  assert.equal(children.length, 1, "exactly one child file");
  const child = readJsonl(children[0]);
  assert.equal(child[0].id, body.data.newSessionId);
  assert.equal(child[0].parentSession, source.file, "parentSession points at the source");
  assert.equal(child[0].cwd, before[0].cwd, "same project cwd");

  const sourceIds = before.slice(1).map((entry) => entry.id);
  assert.deepEqual(child.slice(1, 1 + sourceIds.length).map((entry) => entry.id), sourceIds, "all source entries come first");
  const added = child.slice(1 + sourceIds.length);
  // Pi itself records the child's system prompt as a system message when its first run starts.
  const addedMessages = added.filter((entry) => entry.type === "message" && entry.message.role !== "system");
  assert.equal(addedMessages[0].message.role, "user");
  assert.equal(messageText(addedMessages[0]), "forked question", "the next entry is exactly the draft");
  assert.equal(addedMessages.filter((entry) => entry.message.role === "user").length, 1, "one user message added");
  assert.equal(addedMessages[1]?.message.role, "assistant", "the reply comes from the child's own run");

  assert.equal(readJsonl(source.file).length, before.length, "the source file gained no entries");
  assert.equal(fixture.requests.length, 1, "one model request, from the child");
  assert.equal(lastUserText(fixture.requests[0]), "forked question");
  const sent = fixture.requests[0].messages.filter((message) => message.role !== "system" && message.role !== "developer");
  assert.deepEqual(sent.map((message) => message.role), ["user", "assistant", "user", "assistant", "user"]);
});

test("A1: the route rejects malformed bodies with invalid_request", async () => {
  resetFixture();
  for (const body of [{ message: "x" }, { requestKey: "k" }, { requestKey: "k", message: "x", images: "no" }, { requestKey: "k", message: "   " }]) {
    const response = await POST(
      new Request("http://localhost/api/agent/none/fork-send", { method: "POST", body: JSON.stringify(body) }),
      { params: Promise.resolve({ id: "none" }) },
    );
    const json = await response.json();
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(json.code, "invalid_request");
    assert.equal(json.promptSent, false);
  }
  assert.equal(fixture.requests.length, 0);
});

// The tests below use `source`, a wrapper-independent helper that also records the file.
async function makeSource(t, options) {
  return makeSourceFile(t, options);
}

// ---------------------------------------------------------------------------------------
// A2 source running
// ---------------------------------------------------------------------------------------
test("A2: forking a source that is streaming leaves its run intact and copies finished entries only", async (t) => {
  resetFixture();
  const source = await makeSource(t, { turns: 1 });
  const wrapper = await startSource(t, source);
  const events = [];
  wrapper.onEvent((event) => events.push(event.type));

  await wrapper.send({ type: "prompt", message: "SLOW question" });
  await fixture.slowStarted;
  assert.equal(wrapper.isRunning(), true, "the source is mid-run");
  const requestsBefore = fixture.requests.length;
  const fileBefore = readJsonl(source.file);

  const result = await forkAndSend(sendRequest(source, { message: "side question" }), realDeps());
  t.after(() => getRpcSession(result.newSessionId)?.destroy());
  assert.equal(result.promptSent, true);
  assert.equal(wrapper.isRunning(), true, "the source is still running after the fork");
  assert.ok(!events.includes("agent_end"), "no end event was produced by the fork");

  await waitIdle(result.newSessionId);
  const childPath = childFiles(source.file)[0];
  const child = readJsonl(childPath);
  const childTexts = child.filter((entry) => entry.type === "message").map(messageText);
  assert.ok(!childTexts.some((text) => text.includes("part-one") || text.includes("SLOW-DONE")), "no unfinished assistant content");
  assert.ok(childTexts.includes("side question"));
  assert.equal(child.filter((e) => e.type === "message" && e.message.role === "user" && messageText(e) === "side question").length, 1);
  // The source's own user message was already finished when the fork happened.
  assert.deepEqual(
    child.slice(1, 1 + fileBefore.length - 1).map((entry) => entry.id),
    fileBefore.slice(1).map((entry) => entry.id),
  );
  assert.equal(fixture.requests.length, requestsBefore + 1, "the child made one request of its own");

  fixture.release();
  await waitIdle(source.sessionId);
  assert.ok(events.includes("agent_end"), "the source run ended normally");
  const sourceEntries = readJsonl(source.file).filter((entry) => entry.type === "message");
  const last = sourceEntries.at(-1);
  assert.equal(last.message.role, "assistant");
  assert.equal(messageText(last), "part-one part-two SLOW-DONE", "the source's reply is complete");
  assert.equal(last.message.stopReason, "stop");
  assert.ok(!sourceEntries.some((entry) => messageText(entry) === "side question"), "the draft never entered the source");
});

// ---------------------------------------------------------------------------------------
// A3 failures
// ---------------------------------------------------------------------------------------
async function rejection(promise) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof ForkSendError, `unexpected error: ${error}`);
    return error;
  }
  return assert.fail("expected forkAndSend to reject");
}

test("A3: a source without a saved file is refused as source_not_persisted before anything is sent", async (t) => {
  resetFixture();
  const cwd = await mkdtemp(join(tmpdir(), "pi-web-fork-send-fresh-"));
  t.after(() => rm(cwd, { recursive: true, force: true }));
  const { session, realSessionId } = await startRpcSession(`__fresh__${keyCounter}`, "", cwd, { toolNames: [] });
  t.after(() => session.destroy());

  const error = await rejection(forkAndSend(
    { sourceId: realSessionId, requestKey: nextKey(), message: "draft" },
    realDeps(),
  ));
  assert.equal(error.code, "source_not_persisted");
  assert.equal(error.promptSent, false);
  assert.equal(error.newSessionId, undefined);
  assert.equal(fixture.requests.length, 0);
  assert.ok(!existsSync(session.sessionFile), "the source still has no file, and no fork was written next to it");
});

test("A3: an unknown source is source_not_found", async () => {
  const error = await rejection(forkAndSend(
    { sourceId: "does-not-exist", requestKey: nextKey(), message: "draft" },
    realDeps(),
  ));
  assert.equal(error.code, "source_not_found");
  assert.equal(error.status, 404);
});

test("A3: a running shell command refuses the fork with shell_running and creates no file", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const wrapper = await startSource(t, source);
  Object.defineProperty(wrapper.inner, "isBashRunning", { get: () => true, configurable: true }); // injected flag on the real wrapper

  const error = await rejection(forkAndSend(sendRequest(source), realDeps()));
  assert.equal(error.code, "shell_running");
  assert.equal(error.promptSent, false);
  assert.equal(childFiles(source.file).length, 0);
  assert.equal(fixture.requests.length, 0);
});

test("A3: a failing fork write reports fork_write_failed with no prompt and no session (injected)", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const wrapper = await startSource(t, source);
  const entriesBefore = readJsonl(source.file).length;
  const deps = { ...realDeps(), writeFork: () => { throw new Error("EACCES: disk is read-only"); } };

  const error = await rejection(forkAndSend(sendRequest(source), deps));
  assert.equal(error.code, "fork_write_failed");
  assert.equal(error.newSessionId, undefined);
  assert.equal(error.promptSent, false);
  assert.equal(childFiles(source.file).length, 0);
  assert.equal(fixture.requests.length, 0, "no request reached the model");
  assert.equal(readJsonl(source.file).length, entriesBefore);
  assert.equal(wrapper.isAlive(), true);
});

test("A3: a child that cannot start reports session_start_failed with the kept fork (injected)", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  await startSource(t, source);
  const deps = { ...realDeps(), startSession: async () => { throw new Error("cannot start child"); } };

  const error = await rejection(forkAndSend(sendRequest(source), deps));
  assert.equal(error.code, "session_start_failed");
  assert.equal(error.promptSent, false);
  assert.ok(error.newSessionId, "the fork id is reported");
  assert.equal(childFiles(source.file).length, 1, "the fork is kept");
  assert.equal(readJsonl(childFiles(source.file)[0])[0].id, error.newSessionId);
  assert.equal(fixture.requests.length, 0);
});

test("A3: a rejected prompt reports prompt_rejected, keeps the fork and leaves the source unchanged", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const wrapper = await startSource(t, source);
  const entriesBefore = readJsonl(source.file).length;
  const base = realDeps();
  const deps = {
    ...base,
    // The child is a real wrapper; a running shell command makes its real prompt path refuse.
    async startSession(id, file) {
      const started = await base.startSession(id, file);
      const child = getRpcSession(id);
      t.after(() => child.destroy());
      Object.defineProperty(child.inner, "isBashRunning", { get: () => true, configurable: true });
      return started;
    },
  };

  const error = await rejection(forkAndSend(sendRequest(source, { message: "unsent draft" }), deps));
  assert.equal(error.code, "prompt_rejected");
  assert.equal(error.promptSent, false);
  assert.ok(error.newSessionId);
  assert.equal(childFiles(source.file).length, 1, "the fork is not deleted");
  const child = readJsonl(childFiles(source.file)[0]);
  assert.ok(!child.some((entry) => entry.type === "message" && messageText(entry) === "unsent draft"), "the draft was not consumed");
  assert.equal(fixture.requests.length, 0);
  assert.equal(readJsonl(source.file).length, entriesBefore, "the source is unchanged");
  assert.equal(wrapper.isAlive(), true);
});

// ---------------------------------------------------------------------------------------
// A4 cancellation and idempotency
// ---------------------------------------------------------------------------------------
test("A4: aborting before the fork exists creates nothing", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const controller = new AbortController();
  controller.abort();
  const error = await rejection(forkAndSend(sendRequest(source, { signal: controller.signal }), realDeps()));
  assert.equal(error.code, "aborted");
  assert.equal(error.newSessionId, undefined);
  assert.equal(childFiles(source.file).length, 0);
  assert.equal(fixture.requests.length, 0);
});

test("A4: aborting before the prompt is sent withdraws it, keeps the fork, and a retry reuses it", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  await startSource(t, source);
  const controller = new AbortController();
  const base = realDeps();
  const abortingDeps = {
    ...base,
    async startSession(id, file) {
      const started = await base.startSession(id, file);
      controller.abort(); // the client goes away while the child starts
      return started;
    },
  };
  const key = nextKey();

  const error = await rejection(forkAndSend(
    { sourceId: source.sessionId, requestKey: key, message: "withdrawn draft", signal: controller.signal },
    abortingDeps,
  ));
  assert.equal(error.code, "aborted");
  assert.ok(error.newSessionId, "the kept fork is reported");
  assert.equal(childFiles(source.file).length, 1);
  assert.equal(fixture.requests.length, 0, "no prompt was sent");

  const retried = await forkAndSend(
    { sourceId: source.sessionId, requestKey: key, message: "withdrawn draft" },
    realDeps(),
  );
  t.after(() => getRpcSession(retried.newSessionId)?.destroy());
  assert.equal(retried.newSessionId, error.newSessionId, "the retry reuses the kept fork");
  await waitIdle(retried.newSessionId);
  assert.equal(childFiles(source.file).length, 1, "still one fork");
  assert.equal(fixture.requests.length, 1);
});

test("A4: the same key twice at once yields one fork and one prompt; an accepted prompt is not resent", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  await startSource(t, source);
  const key = nextKey();
  const request = { sourceId: source.sessionId, requestKey: key, message: "double press" };

  const [first, second] = await Promise.all([forkAndSend(request, realDeps()), forkAndSend(request, realDeps())]);
  t.after(() => getRpcSession(first.newSessionId)?.destroy());
  assert.equal(first.newSessionId, second.newSessionId);
  await waitIdle(first.newSessionId);
  assert.equal(childFiles(source.file).length, 1, "one fork file");
  assert.equal(fixture.requests.length, 1, "one prompt request");

  const retried = await forkAndSend(request, realDeps());
  assert.equal(retried.newSessionId, first.newSessionId);
  await nextTurn(100);
  assert.equal(childFiles(source.file).length, 1, "a retry after acceptance forks nothing");
  assert.equal(fixture.requests.length, 1, "and sends nothing");
});

test("A4: different keys each get their own fork and prompt", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  await startSource(t, source);

  const [first, second] = await Promise.all([
    forkAndSend(sendRequest(source, { message: "first draft" }), realDeps()),
    forkAndSend(sendRequest(source, { message: "second draft" }), realDeps()),
  ]);
  for (const result of [first, second]) t.after(() => getRpcSession(result.newSessionId)?.destroy());
  assert.notEqual(first.newSessionId, second.newSessionId);
  await Promise.all([waitIdle(first.newSessionId), waitIdle(second.newSessionId)]);
  assert.equal(childFiles(source.file).length, 2);
  assert.equal(fixture.requests.length, 2);
  assert.deepEqual(fixture.requests.map(lastUserText).sort(), ["first draft", "second draft"]);
});

// ---------------------------------------------------------------------------------------
// A5 authorization and inheritance
// ---------------------------------------------------------------------------------------
test("A5: the child keeps cwd, model, thinking level and tools; pending approvals stay with the source", async (t) => {
  resetFixture();
  // The source ends on an assistant tool call that has no result: a tool request that is pending.
  const pendingCall = assistant("", {
    content: [{ type: "toolCall", id: "call-pending", name: "read", arguments: { path: "secret.txt" } }],
    stopReason: "toolUse",
  });
  const source = await makeSource(t, { tail: [{ role: "user", content: "read the file", timestamp: Date.now() }, pendingCall] });
  const wrapper = await startSource(t, source, { toolNames: ["read", "grep"] });
  wrapper.inner.setThinkingLevel("high");
  // A pending approval as the wrapper holds it: the request the browser shows and the
  // resolver that only a user's answer may call.
  const approvalAnswers = [];
  wrapper.pendingUiRequests.set("pending-1", { type: "extension_ui_request", id: "pending-1", method: "confirm", title: "Allow read?" });
  wrapper.pendingUiResponses.set("pending-1", {
    resolve: (response) => approvalAnswers.push(["resolve", response]),
    cancel: () => approvalAnswers.push(["cancel"]),
  });
  assert.equal(wrapper.hasPendingExtensionUi(), true);
  const sourceTools = [...wrapper.inner.getActiveToolNames()].sort();
  assert.ok(sourceTools.includes("read") && sourceTools.includes("grep"), "the pinned tools are active");
  for (const withheld of ["bash", "edit", "write"]) assert.ok(!sourceTools.includes(withheld), `${withheld} stays off`);
  const sourceEntries = readJsonl(source.file).length;

  const result = await forkAndSend(sendRequest(source, { message: "continue elsewhere" }), realDeps());
  const child = getRpcSession(result.newSessionId);
  t.after(() => child?.destroy());
  assert.ok(child, "the child is a live wrapper");
  await waitIdle(result.newSessionId);

  assert.equal(child.cwd, wrapper.cwd, "same project cwd");
  assert.equal(child.inner.model.provider, wrapper.inner.model.provider);
  assert.equal(child.inner.model.id, wrapper.inner.model.id);
  assert.equal(child.inner.agent.state.thinkingLevel, "high", "same thinking level");
  assert.deepEqual([...child.inner.getActiveToolNames()].sort(), sourceTools, "same tool set, not wider");

  assert.equal(wrapper.hasPendingExtensionUi(), true, "the source's request is still pending");
  assert.equal(wrapper.pendingUiRequests.size, 1);
  assert.deepEqual(approvalAnswers, [], "the draft did not approve or cancel the source's request");
  assert.equal(child.hasPendingExtensionUi(), false, "nothing pending was carried over");
  assert.equal(child.pendingUiRequests.size, 0);
  assert.equal(child.pendingUiResponses.size, 0);
  assert.equal(readJsonl(source.file).length, sourceEntries, "the source file did not change");

  const childEntries = readJsonl(childFiles(source.file)[0]);
  const childMessages = childEntries.filter((entry) => entry.type === "message");
  // The unanswered call is a finished assistant entry, so it is part of the copied history,
  // but nothing ran or approved it in the child: no tool result was written, secret.txt was not read.
  assert.ok(
    childMessages.some((entry) => Array.isArray(entry.message.content) && entry.message.content.some((part) => part.type === "toolCall" && part.id === "call-pending")),
    "the finished assistant entry is copied",
  );
  assert.ok(!childMessages.some((entry) => entry.message.role === "toolResult"), "the call was not executed or approved");
  assert.equal(fixture.requests.length, 1);
});

test("A5: the draft is validated against the same limits as any request (images pass through)", async (t) => {
  resetFixture();
  const source = await makeSource(t);
  const sent = [];
  const deps = {
    ...realDeps(),
    startSession: async () => ({ send: async (command) => { sent.push(command); return null; } }),
  };
  const image = { type: "image", data: "AAAA", mimeType: "image/png" };
  const result = await forkAndSend(sendRequest(source, { message: "", images: [image] }), deps);
  assert.equal(result.promptSent, true);
  assert.deepEqual(sent, [{ type: "prompt", message: "", images: [image] }]);
  assert.equal(childFiles(source.file).length, 1);
});
