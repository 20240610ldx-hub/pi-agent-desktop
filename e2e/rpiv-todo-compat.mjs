import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Explicitly opt-in compatibility check for the reviewed npm sources. Never
// downloads, installs, runs package scripts, loads accounts, or calls a model.
// node e2e/rpiv-todo-compat.mjs /reviewed/rpiv-todo/package /reviewed/rpiv-config/package
const project = fileURLToPath(new URL("../", import.meta.url));
const sourcePins = {
  todo: { name: "@juicesharp/rpiv-todo", version: "2.13.9", sha256: "2407cdcc45ba3160501a6b76901d57d21fde757ccceb6209e9d0f0c088d9acb4" },
  config: { name: "@juicesharp/rpiv-config", version: "2.13.9", sha256: "5db98cb2f12a8ad7b988b2f85e8a051785f6cf328b0ac77bb0917e2330f91c54" },
};

function auditSource(root, pin) {
  const files = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      assert.equal(entry.isSymbolicLink(), false, "Reviewed source cannot contain symlinks");
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolute);
      else if (entry.name.endsWith(".ts") || entry.name === "package.json") files.push(absolute);
      else assert.ok(!/\.(?:js|mjs|cjs|json5|node|wasm)$/i.test(entry.name), `Unreviewed executable file: ${entry.name}`);
    }
  }
  visit(root);
  const hash = createHash("sha256");
  files.sort((a, b) => {
    const x = path.relative(root, a).replaceAll(path.sep, "/");
    const y = path.relative(root, b).replaceAll(path.sep, "/");
    return x < y ? -1 : x > y ? 1 : 0;
  });
  for (const file of files) {
    hash.update(path.relative(root, file).replaceAll(path.sep, "/"));
    hash.update("\0");
    hash.update(readFileSync(file));
    hash.update("\0");
  }
  assert.equal(hash.digest("hex"), pin.sha256, `Source differs from the reviewed ${pin.name}@${pin.version}`);
  const manifest = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
  assert.equal(manifest.name, pin.name);
  assert.equal(manifest.version, pin.version);
  for (const hook of ["preinstall", "install", "postinstall", "prepare"]) assert.equal(manifest.scripts?.[hook], undefined);
}

if (process.argv[2] !== "--isolated-child") {
  const [todoSource, configSource] = process.argv.slice(2).map(value => path.resolve(value));
  assert.ok(todoSource && configSource, "Pass the separately extracted, reviewed todo and config package directories");
  auditSource(todoSource, sourcePins.todo);
  auditSource(configSource, sourcePins.config);
  const root = mkdtempSync(path.join(tmpdir(), "pilaude-todo-compat-"));
  try {
    const todo = path.join(root, "todo");
    const config = path.join(todo, "node_modules", "@juicesharp", "rpiv-config");
    cpSync(todoSource, todo, { recursive: true, errorOnExist: true });
    cpSync(configSource, config, { recursive: true, errorOnExist: true });
    for (const dir of ["home", "xdg", "agent", "sessions", "project", "cache"]) mkdirSync(path.join(root, dir));
    const environment = {};
    for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "COMSPEC", "PATHEXT"]) {
      if (process.env[key]) environment[key] = process.env[key];
    }
    Object.assign(environment, {
      HOME: path.join(root, "home"), USERPROFILE: path.join(root, "home"),
      APPDATA: path.join(root, "home"), LOCALAPPDATA: path.join(root, "home"),
      XDG_CONFIG_HOME: path.join(root, "xdg"), PI_CODING_AGENT_DIR: path.join(root, "agent"),
      TMP: root, TEMP: root, TMPDIR: root, JITI_FS_CACHE: "0", JITI_MODULE_CACHE: "0", NODE_ENV: "test",
    });
    // Native permissions bound filesystem writes and prohibit child processes /
    // workers. The child also disables network entry points before imports.
    const result = spawnSync(process.execPath, [
      "--permission", `--allow-fs-read=${project}`, `--allow-fs-read=${root}`,
      `--allow-fs-read=${path.dirname(process.execPath)}`, `--allow-fs-write=${root}`,
      fileURLToPath(import.meta.url), "--isolated-child", root,
    ], { cwd: root, env: environment, encoding: "utf8", timeout: 90000, maxBuffer: 2_000_000 });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, "Isolated todo compatibility check failed");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
} else {
  const root = path.resolve(process.argv[3]);
  const attempts = [];
  const forbidden = kind => () => {
    attempts.push(kind);
    throw new Error(`Compatibility check prohibits ${kind}`);
  };
  globalThis.fetch = forbidden("fetch");
  for (const [name, methods] of [
    ["node:net", ["connect", "createConnection", "createServer"]],
    ["node:tls", ["connect", "createServer"]],
    ["node:http", ["request", "get", "createServer"]],
    ["node:https", ["request", "get", "createServer"]],
    ["node:dgram", ["createSocket"]],
    ["node:dns", ["lookup", "resolve", "resolve4", "resolve6"]],
    ["node:dns/promises", ["lookup", "resolve", "resolve4", "resolve6"]],
    ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
  ]) {
    const builtin = (await import(name)).default;
    for (const method of methods) builtin[method] = forbidden(`${name}.${method}`);
  }
  const { syncBuiltinESMExports } = await import("node:module");
  syncBuiltinESMExports();
  assert.equal(process.permission.has("child"), false);
  assert.equal(process.permission.has("worker"), false);
  assert.equal(process.permission.has("fs.write", project), false);
  assert.ok(process.env.PI_CODING_AGENT_DIR.startsWith(root));
  const sdkDist = path.join(project, "node_modules", "@earendil-works", "pi-coding-agent", "dist");
  const { SessionManager } = await import(pathToFileURL(path.join(sdkDist, "core/session-manager.js")).href);
  const { loadExtensions, createExtensionRuntime } = await import(pathToFileURL(path.join(sdkDist, "core/extensions/loader.js")).href);
  const { createJiti } = await import(pathToFileURL(path.join(project, "node_modules/jiti/lib/jiti.mjs")).href);
  const jiti = createJiti(import.meta.url, { tsconfigPaths: true, moduleCache: false, fsCache: false });
  const { AgentSessionWrapper } = await jiti.import(path.join(project, "lib/rpc-manager.ts"));
  for (const name of ["pi-agent-core", "pi-ai", "pi-coding-agent", "pi-tui"]) {
    const manifest = JSON.parse(readFileSync(path.join(project, "node_modules/@earendil-works", name, "package.json"), "utf8"));
    assert.equal(manifest.version, "1.3.0");
  }
  const checks = [];
  const active = [];
  const cwd = path.join(root, "project");
  function manager(name) {
    const sm = SessionManager.create(cwd, path.join(root, "sessions", name));
    sm.appendMessage({ role: "user", content: [{ type: "text", text: "Local compatibility fixture; never submitted to a model." }], timestamp: Date.now() });
    return sm;
  }
  async function load(sm, hasUI = true) {
    const runtime = createExtensionRuntime();
    let appends = 0;
    runtime.appendEntry = (type, data) => { appends++; sm.appendCustomEntry(type, structuredClone(data)); };
    const loaded = await loadExtensions([path.join(root, "todo/index.ts")], cwd, undefined, runtime);
    assert.deepEqual(loaded.errors, []);
    assert.equal(loaded.extensions.length, 1);
    const extension = loaded.extensions[0];
    assert.deepEqual([...extension.tools.keys()], ["todo"]);
    assert.ok(extension.commands.has("todos"));
    const wrapper = new AgentSessionWrapper({
      sessionId: sm.getSessionId(), sessionFile: sm.getSessionFile(), sessionManager: sm,
      isStreaming: false, isCompacting: false, isBashRunning: false, isIdle: true,
      agent: { state: {} }, dispose() {},
    });
    const events = [];
    wrapper.onEvent(event => events.push(event));
    const ctx = { sessionManager: sm, cwd, mode: "rpc", hasUI, ui: wrapper.createExtensionUiContext() };
    const fire = async (type, extra = {}) => {
      for (const handler of extension.handlers.get(type) ?? []) await handler({ type, ...extra }, ctx);
    };
    const tool = extension.tools.get("todo").definition;
    let sequence = 0;
    const call = async (params, parentToolCallId) => {
      const toolCallId = `fake-${++sequence}`;
      const result = await tool.execute(toolCallId, params, new AbortController().signal, undefined, ctx);
      await fire("tool_execution_end", { toolName: "todo", toolCallId, result, isError: false, ...(parentToolCallId ? { parentToolCallId } : {}) });
      return result;
    };
    const handle = {
      sm, wrapper, events, ctx, call, fire,
      todos: () => extension.commands.get("todos").handler("", ctx),
      get appends() { return appends; },
    };
    active.push(handle);
    await fire("session_start");
    return handle;
  }
  const state = async handle => (await handle.call({ action: "list", includeDeleted: true })).details;
  const widgets = handle => handle.events.filter(event => event.method === "setWidget" && event.widgetKey === "rpiv-todos");
  const widgetText = handle => (widgets(handle).at(-1)?.widgetLines ?? []).join("\n");
  async function close(handle) {
    if (!active.includes(handle)) return;
    await handle.fire("session_shutdown");
    handle.wrapper.destroy();
    active.splice(active.indexOf(handle), 1);
  }
  try {
    const a = await load(manager("a"));
    assert.equal(widgets(a).length, 0);
    const created = await a.call({ action: "create", subject: "Alpha 中文 task", description: "Preserve journal state", metadata: { source: "fixture" } });
    assert.equal(created.details.tasks[0].id, 1);
    assert.equal(a.appends, 1);
    const firstLeaf = a.sm.getLeafId();
    assert.equal(a.sm.getLeafEntry().customType, "rpiv-todo-state");
    assert.match(widgetText(a), /Alpha 中文 task/);
    assert.equal(widgets(a).at(-1).widgetPlacement, "aboveEditor");
    checks.push("real SDK loader registers tool/command; real desktop widget factory emits aboveEditor lines");
    const updateCount = widgets(a).length;
    await a.call({ action: "update", id: 1, status: "in_progress", activeForm: "checking persistence" });
    assert.ok(widgets(a).length > updateCount);
    assert.match(widgetText(a), /checking persistence/);
    const beforeReads = a.appends;
    await state(a);
    const invalid = await a.call({ action: "update", id: 999, status: "completed" });
    assert.match(invalid.details.error, /not found/);
    assert.equal(a.appends, beforeReads);
    checks.push("widget requestRender refreshes; reads and rejected mutations append no snapshot");
    await a.call({ action: "create", subject: "Nested task", blockedBy: [1] }, "codemode-parent");
    assert.equal(a.sm.getBranch().filter(entry => entry.type === "message" && entry.message.role === "toolResult").length, 0);
    const latest = structuredClone(await state(a));
    a.sm.appendCompaction("Synthetic summary, no model called", a.sm.getLeafId(), 100);
    await a.fire("session_compact");
    assert.deepEqual(await state(a), latest);
    checks.push("nested-call-shaped execution persists without toolResult; real compaction entry retains custom snapshots");
    const b = await load(manager("b"));
    assert.equal((await state(b)).tasks.length, 0);
    await b.call({ action: "create", subject: "Beta isolated task" });
    assert.match(widgetText(b), /Beta isolated task/);
    assert.doesNotMatch(widgetText(a), /Beta isolated task/);
    assert.equal((await state(a)).tasks.length, 2);
    checks.push("two fresh SDK loaders isolate task ids, snapshots, and visible desktop widgets");
    const aFile = a.sm.getSessionFile();
    await close(a);
    const reloaded = await load(SessionManager.open(aFile));
    assert.deepEqual(await state(reloaded), latest);
    assert.match(widgetText(reloaded), /Nested task/);
    checks.push("disk JSONL reopen plus fresh extension loader restores tasks and widget");
    const forkManager = SessionManager.open(aFile);
    const forkFile = forkManager.createBranchedSession(firstLeaf);
    assert.ok(forkFile);
    const fork = await load(forkManager);
    assert.equal((await state(fork)).tasks.length, 1);
    assert.equal((await state(fork)).tasks[0].status, "pending");
    await fork.call({ action: "create", subject: "Fork-only task" });
    assert.equal((await state(reloaded)).tasks[1].subject, "Nested task");
    assert.equal((await state(fork)).tasks[1].subject, "Fork-only task");
    reloaded.sm.branch(firstLeaf);
    await reloaded.fire("session_tree");
    assert.equal((await state(reloaded)).tasks.length, 1);
    assert.match(widgetText(reloaded), /Alpha 中文 task/);
    assert.doesNotMatch(widgetText(reloaded), /Nested task/);
    checks.push("real createBranchedSession clones selected history only; session_tree restores branch and siblings stay isolated");
    await reloaded.call({ action: "update", id: 1, status: "completed" });
    assert.match(widgetText(reloaded), /Alpha 中文 task/);
    await reloaded.fire("agent_start");
    assert.equal(widgetText(reloaded), "");
    await reloaded.fire("session_compact");
    assert.match(widgetText(reloaded), /Alpha 中文 task/);
    await reloaded.call({ action: "delete", id: 1 });
    assert.equal(widgetText(reloaded), "");
    assert.equal((await state(reloaded)).tasks[0].status, "deleted");
    checks.push("completed tasks hide next turn then replay resets display; delete hides widget and preserves tombstone");
    await b.todos();
    assert.ok(b.events.some(event => event.method === "notify" && /Beta isolated task/.test(event.message)));
    checks.push("actual /todos handler reaches desktop notify wire with current session task text");
    const headless = await load(manager("headless"), false);
    await headless.call({ action: "create", subject: "No UI task" });
    assert.equal(widgets(headless).length, 0);
    assert.equal((await state(headless)).tasks.length, 1);
    checks.push("headless session retains tool state without widget");
    assert.deepEqual(attempts, []);
    process.stdout.write(`${JSON.stringify({
      status: "PASS", sdk: "1.3.0", package: "@juicesharp/rpiv-todo@2.13.9", sourcePins, checks,
      provenance: {
        todo: { tarball: "https://registry.npmjs.org/@juicesharp/rpiv-todo/-/rpiv-todo-2.13.9.tgz", integrity: "sha512-fXuUVU2HlxiUMeDeRTXbSVDPftP+CMGe47nAA5H0BX4YYl7chl1M2fSL1fFQqq5FCcpk5+ZBiQ43tiKvUu97gQ==" },
        config: { tarball: "https://registry.npmjs.org/@juicesharp/rpiv-config/-/rpiv-config-2.13.9.tgz", integrity: "sha512-wCy7w4PNi+9pVD5gsbsIxq6ysdoFKXGPIQfOICyITW/+Jg6OGlFZa/tG99J9OZvTHDM8ZwUvqXNrFRsU6Z8NTQ==" },
      },
      prohibitedAttempts: attempts,
      scripts: { installExecuted: false, packageScriptsExecuted: false, reviewedPackagesHaveLifecycleHooks: false, existingSdkInstallerSuppressesScripts: false, note: "SDK managed npm install uses --legacy-peer-deps without --ignore-scripts. Top-level todo pin leaves its ^2.13.9 config dependency floating." },
      isolation: { childProcess: true, nativeFilesystemPermissions: true, networkEntryPointsDisabled: true, homeAndUserProfile: "temporary", xdgConfigHome: "temporary", agentDir: "temporary", credentialsLoaded: false, modelsCalled: 0, browserStarted: false, realUserSettingsChanged: false },
      configCaveat: "rpiv-config reads XDG_CONFIG_HOME with legacy ~/.config fallback; PI_CODING_AGENT_DIR alone does not isolate it.",
      bundled: false,
      boundary: "Real SDK loader/SessionManager and desktop widget wrapper; fake tool invocations, no model or browser; no full AgentSession/codemode dispatch, packaged desktop runtime, or browser rendering claimed",
    }, null, 2)}\n`);
  } finally {
    for (const handle of [...active].reverse()) await close(handle);
  }
}
