import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { syncBuiltinESMExports } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, getCurrentSystemPrompt, getCurrentTools } from "@earendil-works/pi-ai";
import { createAgentSessionFromServices, createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { createBuiltinTodoExtension } = await jiti.import("./builtin-todo-extension.ts");

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pilaude-builtin-todo-"));
  const agentDir = join(root, "agent");
  const cwd = join(root, "project");
  await mkdir(agentDir); await mkdir(cwd);
  const faux = fauxProvider({ models: [{ id: "todo-test" }] });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  modelRuntime.registerNativeProvider(faux.provider);
  const widgets = new Map();
  const theme = { fg: (_color, text) => text, bold: (text) => text, strikethrough: (text) => text };
  const open = async (manager = SessionManager.create(cwd, join(root, "sessions")), directory = agentDir) => {
    const services = await createAgentSessionServices({ cwd, agentDir: directory, modelRuntime, settingsManager: SettingsManager.inMemory(), resourceLoaderOptions: {
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createBuiltinTodoExtension({ agentDir: directory })],
    } });
    const { session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("todo-test") });
    await session.bindExtensions({ mode: "rpc", uiContext: { theme, notify() {}, setWidget(key, content) {
      if (content === undefined) widgets.delete(manager.getSessionId());
      else widgets.set(manager.getSessionId(), typeof content === "function" ? content({ requestRender() {} }, theme) : { render: () => content });
    }, setStatus() {} } });
    return { session, manager };
  };
  const render = (manager) => widgets.get(manager.getSessionId())?.render(100).join("\n") ?? "";
  return { root, agentDir, cwd, faux, open, render, cleanup: () => rm(root, { recursive: true, force: true }) };
}

async function ask(faux, session, calls) {
  let declared; let systemPrompt;
  faux.setResponses([
    (context) => {
      declared = getCurrentTools(context.messages).find((tool) => tool.name === "todo");
      systemPrompt = getCurrentSystemPrompt(context.messages);
      return fauxAssistantMessage(calls, { stopReason: "toolUse" });
    },
    fauxAssistantMessage([fauxText("Generated Todo work finished.")]),
  ]);
  await session.prompt("Perform the generated local Todo fixture.");
  return { declared, systemPrompt };
}

const stored = (manager) => manager.getBranch().filter((entry) => entry.type === "custom" && entry.customType === "rpiv-todo-state");

test("the installed real Todo factory mutates, persists, compacts and reloads through the actual SDK", async () => {
  const f = await fixture(); const opened = [];
  try {
    const first = await f.open(); opened.push(first.session);
    const { declared } = await ask(f.faux, first.session, [fauxToolCall("todo", { action: "create", subject: "Verify real package replay" }, { id: "todo-create" })]);
    assert.ok(declared, "the actual provider request declares the installed Todo tool");
    assert.equal(stored(first.manager).length, 1);
    const snapshot = stored(first.manager).at(-1).data;
    assert.equal(snapshot.tasks[0].subject, "Verify real package replay");
    assert.equal(snapshot.tasks[0].status, "pending");
    await ask(f.faux, first.session, [fauxToolCall("todo", { action: "update", id: 1, status: "in_progress", activeForm: "verifying persistence" }, { id: "todo-update" })]);
    assert.equal(stored(first.manager).at(-1).data.tasks[0].status, "in_progress");
    first.manager.appendCompaction("Generated compacted context; no model compaction.", first.manager.getLeafId(), 100);
    const file = first.manager.getSessionFile();
    first.session.dispose(); opened.splice(opened.indexOf(first.session), 1);
    const second = await f.open(SessionManager.open(file)); opened.push(second.session);
    await ask(f.faux, second.session, [fauxToolCall("todo", { action: "update", id: 1, status: "completed" }, { id: "todo-reloaded-update" })]);
    assert.equal(stored(second.manager).at(-1).data.tasks[0].status, "completed", "fresh factory replays the real package snapshot after compaction/disk reopen");
    const persisted = await readFile(file, "utf8");
    assert.match(persisted, /rpiv-todo-state/);
  } finally { for (const session of opened) session.dispose(); await f.cleanup(); }
});

test("each factory graph uses only its agentDir configuration and keeps simultaneous sessions isolated", async () => {
  const f = await fixture(); const opened = [];
  const envBefore = { XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE };
  const intercepted = [];
  const originals = Object.fromEntries(["existsSync", "readFileSync", "writeFileSync", "mkdirSync", "chmodSync"].map((name) => [name, fs[name]]));
  for (const [name, original] of Object.entries(originals)) fs[name] = (path, ...args) => {
    if (typeof path === "string" && /[\\/]rpiv-todo[\\/]config\.json$/.test(path)) {
      intercepted.push({ operation: name, path });
      assert.equal(path, join(f.agentDir, "extensions", "rpiv-todo", "config.json"), "Todo configuration never falls through to host HOME/XDG");
    }
    return original(path, ...args);
  };
  syncBuiltinESMExports();
  try {
    await mkdir(join(f.agentDir, "extensions", "rpiv-todo"), { recursive: true });
    await writeFile(join(f.agentDir, "extensions", "rpiv-todo", "config.json"), JSON.stringify({ guidance: { promptSnippet: "Owned Pilaude Todo configuration" }, collapseKey: "off" }));
    const first = await f.open(); opened.push(first.session);
    const second = await f.open(); opened.push(second.session);
    const { declared, systemPrompt } = await ask(f.faux, first.session, [fauxToolCall("todo", { action: "create", subject: "First session task" }, { id: "first-create" })]);
    assert.ok(declared);
    assert.match(systemPrompt, /Owned Pilaude Todo configuration/);
    await ask(f.faux, second.session, [fauxToolCall("todo", { action: "create", subject: "Second session task" }, { id: "second-create" })]);
    assert.equal(stored(first.manager).at(-1).data.tasks.length, 1);
    assert.equal(stored(second.manager).at(-1).data.tasks.length, 1);
    assert.equal(stored(first.manager).at(-1).data.tasks[0].subject, "First session task");
    assert.equal(stored(second.manager).at(-1).data.tasks[0].subject, "Second session task");
    assert.match(f.render(first.manager), /First session task/);
    assert.doesNotMatch(f.render(first.manager), /Second session task/);
    assert.match(f.render(second.manager), /Second session task/, "lazy overlay and tool share their own package state graph");
    assert.doesNotMatch(f.render(second.manager), /First session task/);
    await rm(join(f.agentDir, "extensions", "rpiv-todo", "config.json"));
    const missing = await f.open(); opened.push(missing.session);
    const defaults = await ask(f.faux, missing.session, [fauxToolCall("todo", { action: "list" }, { id: "missing-config" })]);
    assert.doesNotMatch(defaults.systemPrompt, /Owned Pilaude Todo configuration/);
    assert.ok(intercepted.some((entry) => entry.operation === "readFileSync"));
    assert.ok(intercepted.every((entry) => entry.operation === "existsSync" || entry.operation === "readFileSync"), "factory and mutations do not write any configuration");
    assert.deepEqual({ XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE }, envBefore);
  } finally {
    for (const session of opened) session.dispose();
    Object.assign(fs, originals); syncBuiltinESMExports();
    await f.cleanup();
  }
});
