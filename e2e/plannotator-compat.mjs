#!/usr/bin/env node
/**
 * Opt-in, offline contract checker for @plannotator/pi-extension@0.28.23.
 * Usage: node e2e/plannotator-compat.mjs --source-dir /absolute/path/to/package
 *
 * Supply an already inspected package directory. This does not download, install,
 * run package scripts, start HTTP servers, open browsers, or call a model.
 * Reviewed upstream TS is stripped in memory and linked through explicit
 * capabilities. The real Pi 1.3.0 loader/runner and desktop RPC UI bridge are used;
 * BrowserSessions and message delivery are controlled test doubles. This is not
 * a full desktop/HTTP/browser integration test. No product UI is reimplemented.
 */
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripTypeScriptTypes, syncBuiltinESMExports } from "node:module";
import { spawnSync } from "node:child_process";

const self = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(self), "..");
const registryIntegrity = "sha512-C59ZYaiv99U5cNCoISiHZdDgjEc8ZQ5ow1GCd40dymKFwmuw6ZX0QK4kfdP5qUVp9pRlCFLYrr7a0QNmIlyW9g==";
// SHA-256 of the exact registry source closure reviewed for this check. Refuse
// altered files or imports outside this set rather than executing arbitrary TS.
const reviewed = {
  "annotate-outcome.ts": "b49afd4e4764b2c87c63ec2a5b035a624128b0b1a3c802222905d3fddd065bcc",
  "assistant-message.ts": "09ca31f139c43cafdf3f6189e2332b2413b695b95d4be0c2ef4f6e2d0d895085",
  "browser-session-error.ts": "eacc80d377c3d61d59dc9771d9f5d0ee81f0dce45c884a7f148b7e70a5dc0850",
  "bundled-skill.ts": "a43279fc7708de56341bee5bfb75e888a3f8f58567838ad2f5303449b7dbb5cb",
  "config.ts": "a323df5a83d153e56d28076a3b2e5f5c1941904abb0b9bf8a46b2e1fcded5719",
  "current-pi-session.ts": "45facf23b25d55d4110b8e30131049a71f7ffd23b146bb024f10c8b97120ed37",
  "generated/agent-terminal.ts": "de56f479a8e6a63ba8aae3de328c865e7beb39ef37320ee17f0015473c28c918",
  "generated/annotatable.ts": "b7d5130886d94148453e40a977b84959524e9257da26da08b067f285b1cc635e",
  "generated/browser-intent.ts": "ef29fa7a8f26025e8dc49fd3aed47777741c3cbdfe07e6ea67b69d0cebbb3c7c",
  "generated/checklist.ts": "e867dafd321821def2b29254c598e7112bacf083559c2d64313c096f3097884f",
  "generated/code-file.ts": "70d6ec086f6b803c09dbb34741130fed38e8dcd673a14bf36a55303c6a0f4c57",
  "generated/config.ts": "3829e570a02d138338fcd57069f3f507349391f2fe4d74217361badda6f22dbd",
  "generated/data-dir.ts": "c2b8d42dd6cf65ff9dd1526fdcf808de5ce3cb44b300adcd9c09fb18f46dc438",
  "generated/favicon.ts": "ab007988145b9e0dd427bed907dbb773d703f0b52428bb704141d0addb6f5297",
  "generated/html-assets-node.ts": "7cafd4e6062fcf6fdb4f9beb6e80b63f2243d190d79cc03b20b6555ffefec2bb",
  "generated/html-assets.ts": "6514ee189b830b14c5636fed475655ace4a6376062800b6209473f3bfa179f15",
  "generated/improvement-hooks.ts": "09a091730f78af6d429fabb3934cd43254eed1cea9b3e2fce9da804d351b8bbb",
  "generated/inbox/agent-link.ts": "bc387f1ac6ccb0832e88225260f50eb5f7cf55ff676bfee4ed2ab391a16d34f9",
  "generated/inbox/connection.ts": "4260383c24c2c1e92b6a8734361493b00d034f861842640018638e2f884d8b36",
  "generated/markdown-extensions.ts": "c01a98cb8560a526ef8dfab6a875427619642a7307df8b72599f4e8a7ace2481",
  "generated/pfm-reminder.ts": "f1f0508f63c564be8095acca5c20ba87434cdefcb0ed1101c55920bdfee50ad7",
  "generated/plannotator-tool.ts": "f7bd5a45df3c3a69ca96c582c13aac0b2d98cbd0a75e4770dee9197ff8cfd933",
  "generated/port-range.ts": "1728308da12ef5d1848a513a383655fd9949e20139064e96f9aa79cb59b10c29",
  "generated/prompts.ts": "3f8f9e5981209c996073e422fcd1181f90133e6821163e659b690ca07c3716ff",
  "generated/resolve-file.ts": "026ffb9f26a8866e67a0a0a5653b0af2c0bc53d8847bb5ef4a8612b9df54d796",
  "generated/review-args.ts": "699c88e7b54b2647075c3890531ca332ee66fef1f5fe6d5dc251b9f1b15c7c3a",
  "generated/tailscale.ts": "bd290e592d7b1e9c9e2d20e7ef73155e995fe49e32f4fef36bb10d93cde8d1d8",
  "inbox.ts": "bdf8d6ce984d2b19358b3ca0b39e6af8e162bdd7192246afe199898cdc194692",
  "index.ts": "7ff19b056a2547e07e1363c1bb1122ceda72773de2ce251eef441d7da9c24c35",
  "package.json": "390b11c6ccce2a16f463ea8fdc1225b9fcc86523cdfbe163236908c3a8b06fb0",
  "pi-host.ts": "0b03fafa1c6331570602d657b9fcb2f82d507ce760a990bcd4a344e301383a2f",
  "pi-session-bridge.ts": "7fadb0444df12057474b81559e37e6fe050bf4e982c95de25e56fe036f1e98dd",
  "plannotator-browser-runtime.ts": "f4512df6c4a60451f074b8927039aed56fc7e929ae9d6c1d24947ebce94067db",
  "plannotator-events.ts": "4759c2e59d2a9e2208583301761e7ec14586aef6f30a5cb7ecb51a1718fb0ac0",
  "plannotator-tool-host.ts": "b348bcac8845c8d0e65d9db85111837a53c7827384305adac3d60a28ab70e924",
  "plannotator.json": "6646b8736e81cdfcd635445a7375c60089ce84f3a48de1527b1e49ceddbdd00a",
  "review-outcome.ts": "bb2f4327c2a35164d2ace4aa97462d0b78d70ffb8cfce322ae0475ab8fd427db",
  "server/network.ts": "c2bc1f509c2f92bf8d2233aadb319987fbeaa0752d7617e2064947ff7145abf6",
  "session-opened.ts": "0b86a1388f2f1a9e25b3a9bf2e60e35e23f23d95ab280d37493bd80e456b36a9",
  "todo-providers/index.ts": "501a09eae4400dda7b285f95ca11c881e3d3d2ae02472a97938b4a0d44ef3081",
  "todo-providers/pi-todos.ts": "69c61934f8862fcff8104539efdf2e2261f7a2f376cc7fbe85176ea556d2c8fb",
  "tool-scope.ts": "3b69742beeacf2f5857ad62d191554bc29de51f767f45e6bb840d3c6d708e564",
};
const json = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");
const inside = (root, file) => {
  const rel = path.relative(root, path.resolve(file));
  return rel === "" || (!rel.startsWith(`..${path.sep}`) && rel !== ".." && !path.isAbsolute(rel));
};
function verifySource(source) {
  for (const [name, digest] of Object.entries(reviewed)) {
    const file = path.join(source, name);
    assert.ok(inside(source, fs.realpathSync(file)), `Source escapes directory: ${name}`);
    assert.equal(fs.lstatSync(file).isSymbolicLink(), false, `Source symlink: ${name}`);
    assert.equal(sha256(fs.readFileSync(file)), digest, `Unreviewed source: ${name}`);
  }
  const pkg = json(path.join(source, "package.json"));
  assert.equal(pkg.name, "@plannotator/pi-extension");
  assert.equal(pkg.version, "0.28.23");
  assert.deepEqual(pkg.pi.extensions, ["./"]);
  return pkg;
}

async function child(source, runDir) {
  verifySource(source);
  assert.equal(path.resolve(os.homedir()), path.join(runDir, "home"));
  assert.equal(process.env.PI_CODING_AGENT_DIR, path.join(runDir, "agent"));
  const denied = [];
  const block = (label) => () => {
    denied.push(label);
    throw new Error(`Offline contract blocks ${label}`);
  };
  // Defense in depth for trusted SDK/bridge imports as well as the upstream VM.
  globalThis.fetch = block("fetch");
  for (const [mod, methods] of [
    ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
    ["node:http", ["request", "get"]], ["node:https", ["request", "get"]],
    ["node:tls", ["connect"]], ["node:dgram", ["createSocket"]],
    ["node:dns", ["lookup", "resolve"]],
  ]) {
    const imported = await import(mod);
    for (const method of methods) imported.default[method] = block(`${mod}.${method}`);
  }
  const net = (await import("node:net")).default;
  net.Socket.prototype.connect = block("net.connect");
  net.Server.prototype.listen = block("server.listen");
  syncBuiltinESMExports();
  const sdkRoot = path.join(repo, "node_modules/@earendil-works/pi-coding-agent");
  const lock = json(path.join(repo, "package-lock.json"));
  const sdkVersions = {};
  for (const name of ["pi-coding-agent", "pi-agent-core", "pi-ai", "pi-tui"]) {
    const key = `node_modules/@earendil-works/${name}`;
    const installed = json(path.join(repo, key, "package.json")).version;
    assert.equal(installed, "1.3.0", `Installed ${name} drift`);
    assert.equal(lock.packages[key].version, installed, `Lockfile ${name} drift`);
    sdkVersions[name] = installed;
  }
  const { createExtensionRuntime, loadExtensionFromFactory } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/extensions/loader.js")));
  const { ExtensionRunner } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/extensions/runner.js")));
  const { SessionManager } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/session-manager.js")));
  const { createEventBus } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/event-bus.js")));
  const { DefaultPackageManager } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/package-manager.js")));
  const { SettingsManager } = await import(pathToFileURL(path.join(sdkRoot, "dist/core/settings-manager.js")));
  // This is the alias used by Pi's real extension loader, not pi-ai's core entry.
  const { Type } = await import(pathToFileURL(path.join(repo, "node_modules/@earendil-works/pi-ai/dist/compat.js")));
  const { Key } = await import(pathToFileURL(path.join(repo, "node_modules/@earendil-works/pi-tui/dist/index.js")));
  const { createJiti } = await import("jiti");
  const jiti = createJiti(import.meta.url, { tsconfigPaths: true, fsCache: false });
  const { AgentSessionWrapper } = await jiti.import(path.join(repo, "lib/rpc-manager.ts"));
  const vm = await import("node:vm");
  const fsReads = new Set();
  const fsWrites = new Set();
  function checkPath(file, write = false) {
    if (file instanceof URL) file = fileURLToPath(file);
    assert.equal(typeof file, "string", "Only path-based source filesystem operations are allowed");
    const absolute = path.resolve(file);
    assert.ok(inside(runDir, absolute) || (!write && inside(source, absolute)), `Source filesystem escape: ${absolute}`);
    // Existing parents must also remain contained (no link traversal).
    let existing = absolute;
    while (!fs.existsSync(existing)) existing = path.dirname(existing);
    const real = fs.realpathSync(existing);
    assert.ok(inside(runDir, real) || (!write && inside(source, real)), `Source filesystem symlink escape: ${absolute}`);
    (write ? fsWrites : fsReads).add(absolute);
    return absolute;
  }
  const safeFs = {};
  for (const name of ["existsSync", "readFileSync", "statSync", "realpathSync", "readdirSync"]) {
    safeFs[name] = (file, ...args) => fs[name](checkPath(file), ...args);
  }
  for (const name of ["writeFileSync", "mkdirSync", "rmSync", "unlinkSync", "chmodSync"]) {
    safeFs[name] = (file, ...args) => fs[name](checkPath(file, true), ...args);
  }
  safeFs.renameSync = (from, to) => fs.renameSync(checkPath(from, true), checkPath(to, true));
  // Config's unused advisory-lock operations are imported eagerly. Do not grant
  // raw descriptors to downloaded code for this plan/review-only contract.
  for (const name of ["openSync", "writeSync", "closeSync"]) safeFs[name] = block(`source.fs.${name}`);
  const safePromises = {};
  for (const name of ["readdir", "readFile", "stat", "realpath"]) safePromises[name] = (file, ...args) => fs.promises[name](checkPath(file), ...args);
  for (const name of ["writeFile", "mkdir", "unlink", "rm"]) safePromises[name] = (file, ...args) => fs.promises[name](checkPath(file, true), ...args);
  safeFs.promises = safePromises;
  const sourceErrors = [];
  const sandbox = vm.createContext({
    console: { log() {}, warn: (...args) => sourceErrors.push(args.join(" ")), error: (...args) => sourceErrors.push(args.join(" ")) },
    process: Object.freeze({ env: Object.freeze({ ...process.env }), cwd: () => runDir, platform: process.platform, pid: process.pid,
      stderr: { write: (text) => sourceErrors.push(String(text)) } }),
    URL, URLSearchParams, Buffer, TextEncoder, TextDecoder, AbortController, AbortSignal, atob, btoa,
    setTimeout, clearTimeout, setInterval, clearInterval, queueMicrotask,
    fetch: block("source.fetch"),
  });
  const modules = new Map();
  const imports = new Set();
  function synthetic(key, values) {
    if (!modules.has(key)) modules.set(key, new vm.SyntheticModule(Object.keys(values), function () {
      for (const [name, value] of Object.entries(values)) this.setExport(name, value);
    }, { context: sandbox, identifier: key }));
    return modules.get(key);
  }
  const builtins = {
    fs: safeFs, "fs/promises": safePromises,
    path: (await import("node:path")).default,
    url: { fileURLToPath, pathToFileURL },
    os: { homedir: () => path.join(runDir, "home"), platform: os.platform, release: os.release },
    crypto: (await import("node:crypto")).default,
    child_process: Object.fromEntries(["spawn", "spawnSync", "execSync"].map((key) => [key, block(`source.child_process.${key}`)])),
  };
  async function resolveModule(specifier, parent = pathToFileURL(path.join(source, "index.ts")).href) {
    imports.add(specifier);
    const builtin = specifier.replace(/^node:/, "");
    if (builtins[builtin]) return synthetic(`builtin:${builtin}`, { ...builtins[builtin], default: builtins[builtin] });
    if (specifier === "@earendil-works/pi-ai") return synthetic(specifier, { Type });
    if (specifier === "@earendil-works/pi-tui") return synthetic(specifier, { Key });
    // parse5 is not installed in this desktop checkout. It is imported by the
    // inactive todo-provider HTML helper. Any use fails; no parser is recreated.
    if (specifier === "parse5") return synthetic(specifier, { parse: block("parse5.parse"), parseFragment: block("parse5.parseFragment"), serialize: block("parse5.serialize") });
    assert.ok(specifier.startsWith("."), `Unreviewed external import: ${specifier}`);
    const url = new URL(specifier, parent);
    const file = fileURLToPath(url);
    const relative = path.relative(source, file).split(path.sep).join("/");
    assert.ok(reviewed[relative] && relative.endsWith(".ts"), `Unreviewed module import: ${relative}`);
    if (!modules.has(url.href)) {
      const text = fs.readFileSync(file, "utf8");
      assert.equal(sha256(text), reviewed[relative]);
      const stripped = stripTypeScriptTypes(text, { mode: "transform", sourceUrl: url.href });
      modules.set(url.href, new vm.SourceTextModule(stripped, {
        context: sandbox, identifier: url.href,
        initializeImportMeta(meta) { meta.url = url.href; },
        importModuleDynamically: async (name, referencing) => {
          const loaded = await resolveModule(name, referencing.identifier);
          if (loaded.status === "unlinked") await loaded.link(linker);
          if (loaded.status === "linked") await loaded.evaluate();
          return loaded;
        },
      }));
    }
    return modules.get(url.href);
  }
  const linker = (specifier, referencing) => resolveModule(specifier, referencing.identifier);
  async function upstream(name) {
    const loaded = await resolveModule(`./${name}`);
    if (loaded.status === "unlinked") await loaded.link(linker);
    if (loaded.status === "linked") await loaded.evaluate();
    return loaded.namespace;
  }
  const extensionModule = await upstream("index.ts");
  const eventModule = await upstream("plannotator-events.ts");
  const browserRuntime = await upstream("plannotator-browser-runtime.ts");
  const registry = (await upstream("plannotator-tool-host.ts")).getProcessPiReviewRegistry();
  assert.equal(browserRuntime.hasPlanBrowserHtml(), true, "Published plan HTML must exist");
  assert.equal(browserRuntime.hasReviewBrowserHtml(), true, "Published review HTML must exist");
  const checks = [];
  const evidence = {};
  async function check(name, fn) { await fn(); checks.push({ name, passed: true }); }
  const tick = () => new Promise((resolve) => setImmediate(resolve));
  async function until(predicate) {
    for (let i = 0; i < 50; i++) { if (predicate()) return; await tick(); }
    assert.ok(predicate(), "Expected background continuation did not settle");
  }
  let browserCount = 0;
  function browser(plan = "") {
    let resolveDecision;
    const listeners = new Set();
    const decision = new Promise((resolve) => { resolveDecision = resolve; });
    const value = {
      reviewId: `compat-review-${++browserCount}`, url: "http://127.0.0.1:1/compat-no-server",
      plan, version: 1, settled: false, stops: 0, closes: 0,
      waitForDecision: () => decision,
      onDecision: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
      updatePlan(text) {
        if (value.settled) return null;
        const unchanged = text === value.plan;
        value.plan = text;
        if (!unchanged) value.version++;
        return { version: value.version, unchanged };
      },
      closeKeepingDraft() { value.closes++; },
      stop() { value.stops++; value.settled = true; },
      decide(result) {
        value.settled = true;
        const full = { plan: value.plan, ...result };
        for (const listener of listeners) listener(full);
        resolveDecision(full);
      },
    };
    return value;
  }
  const harnesses = [];
  async function harness(name, factory, start = true) {
    const cwd = path.join(runDir, name);
    fs.mkdirSync(cwd);
    const sm = SessionManager.inMemory(cwd);
    const runtime = createExtensionRuntime();
    const bus = createEventBus();
    const extension = await loadExtensionFromFactory(factory, cwd, bus, runtime, path.join(source, "index.ts"));
    const runner = new ExtensionRunner([extension], runtime, cwd, sm, { find: () => undefined });
    const messages = [], uiEvents = [], errors = [];
    let activeTools = ["read", "write", "edit", "bash"];
    let thinking = "off";
    const forbiddenModel = block("model operation");
    runner.bindCore({
      sendUserMessage: (content, options) => messages.push({ sessionId: sm.getSessionId(), content, options }),
      sendMessage: (message, options) => messages.push({ sessionId: sm.getSessionId(), message, options }),
      appendEntry: (type, data) => sm.appendCustomEntry(type, data),
      setSessionName: () => {}, getSessionName: () => undefined, setLabel: () => {},
      getActiveTools: () => [...activeTools], getAllTools: () => [], getSettings: () => ({}),
      setActiveTools: (names) => { activeTools = [...names]; }, refreshTools: () => {},
      getCommands: () => [...extension.commands.values()], setModel: forbiddenModel,
      getThinkingLevel: () => thinking, setThinkingLevel: (level) => { thinking = level; },
    }, {
      getModel: () => undefined, getScopedModels: () => [], isIdle: () => true,
      isProjectTrusted: () => false, getSignal: () => undefined, abort: () => {},
      hasPendingMessages: () => false, shutdown: () => {}, getContextUsage: () => undefined,
      compact: forbiddenModel, getSystemPrompt: () => "",
    });
    runner.onError((error) => errors.push(error));
    let disposed = false;
    const inner = {
      sessionId: sm.getSessionId(), sessionManager: sm, extensionRunner: runner,
      isStreaming: false, isCompacting: false, isBashRunning: false, isIdle: true,
      agent: { state: {}, abort() {} }, abortRetry() {}, abortCompaction() {}, abortBranchSummary() {},
      dispose() { disposed = true; runner.invalidate(); },
    };
    const wrapper = new AgentSessionWrapper(inner);
    wrapper.onEvent((event) => uiEvents.push(event));
    wrapper.beginExtensionBinding();
    await wrapper.waitUntilReady();
    const h = { name, cwd, sm, bus, runner, extension, wrapper, messages, uiEvents, errors,
      get disposed() { return disposed; },
      tool: (tool) => extension.tools.get(tool).definition,
      command: (command, args = "") => runner.getCommand(command).handler(args, runner.createCommandContext()),
      ctx: () => runner.createContext(),
    };
    harnesses.push(h);
    if (start) await runner.emit({ type: "session_start" });
    return h;
  }
  const request = (h, action, payload) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`No response to ${action}`)), 1500);
    h.bus.emit("plannotator:request", { requestId: randomUUID(), action, payload,
      respond: (response) => { clearTimeout(timer); resolve(response); } });
  });
  const plain = (value) => JSON.parse(JSON.stringify(value));
  try {
    await check("Existing Plugins package resolver consumes upstream pi.extensions manifest offline", async () => {
      const settings = SettingsManager.inMemory({ packages: [source] }, { projectTrusted: false });
      const manager = new DefaultPackageManager({ cwd: runDir, agentDir: process.env.PI_CODING_AGENT_DIR, settingsManager: settings });
      const resolved = await manager.resolve();
      const extension = resolved.extensions.find((entry) => entry.enabled && path.resolve(entry.path) === source);
      assert.ok(extension, "Configured local package must resolve its pi.extensions entry");
      assert.equal(resolved.skills.length, 0, "Bundled skill is offered later by resources_discover");
      const pinned = manager.parseSource("npm:@plannotator/pi-extension@0.28.23");
      assert.equal(pinned.type, "npm");
      assert.equal(pinned.name, "@plannotator/pi-extension");
      assert.equal(pinned.pinned, true);
      evidence.packageResolver = { extension, pinnedSource: pinned, settingsStorage: "in-memory only", installPerformed: false };
    });
    await check("Event API request/respond: pending reviewId, decision event, persisted completed status", async () => {
      const sessions = [];
      const h = await harness("event-api", (pi) => eventModule.registerPlannotatorEventListeners(pi, {
        reviewStatusPath: path.join(runDir, "event-status.json"),
        startPlanReviewSession: async (_ctx, plan) => { const b = browser(plan); sessions.push(b); return b; },
      }), false);
      assert.equal((await request(h, "plan-review", { planContent: "Test" })).status, "unavailable");
      await h.runner.emit({ type: "session_start" });
      const results = [];
      h.bus.on("plannotator:review-result", (result) => results.push(result));
      const started = await request(h, "plan-review", { planContent: "# Contract\n- [ ] Check" });
      assert.equal(started.status, "handled");
      assert.equal(started.result.status, "pending");
      assert.equal(started.result.reviewId, sessions[0].reviewId);
      assert.equal((await request(h, "review-status", { reviewId: sessions[0].reviewId })).result.status, "pending");
      sessions[0].decide({ approved: false, feedback: "Add rollback verification" });
      await until(() => results.length === 1);
      const completed = await request(h, "review-status", { reviewId: sessions[0].reviewId });
      assert.equal(completed.result.status, "completed");
      assert.equal(completed.result.feedback, "Add rollback verification");
      assert.equal(results[0].reviewId, started.result.reviewId);
      assert.equal((await request(h, "review-status", { reviewId: "unknown" })).result.status, "missing");
      assert.equal((await request(h, "plan-review", { planContent: " " })).status, "error");
      await request(h, "plan-review", { planContent: "Late event review" });
      await h.wrapper.shutdown();
      sessions[1].decide({ approved: true });
      await tick();
      assert.equal(results.length, 1, "Closed source bus must not receive a late result");
      assert.equal(json(path.join(runDir, "event-status.json"))[sessions[1].reviewId].status, "completed");
      assert.equal(sessions[1].stops, 0, "Event API reviews intentionally outlive session shutdown");
      evidence.eventApi = { started, completed, results, lateDecisionPersisted: true,
        eventApiReviewSurvivesShutdown: true };
    });
    const planSessions = [], codeSessions = [];
    const deps = {
      hasPlanBrowserHtml: browserRuntime.hasPlanBrowserHtml,
      hasReviewBrowserHtml: browserRuntime.hasReviewBrowserHtml,
      startPlanReview: async (ctx, plan) => { const b = browser(plan); b.sourceSessionId = ctx.sessionManager.getSessionId(); planSessions.push(b); return b; },
      startCodeReview: async (ctx, options) => {
        assert.equal(options.prUrl, undefined); assert.equal(options.gitRemoteCheck, false);
        const b = browser(); b.sourceSessionId = ctx.sessionManager.getSessionId(); codeSessions.push(b); return b;
      },
      startAnnotation: block("unexercised annotation starter"),
      startLastMessageAnnotation: block("unexercised last-message starter"),
    };
    const a = await harness("source-session", (pi) => extensionModule.default(pi, deps));
    let b;
    const planPath = path.join(a.cwd, "plan.md");
    const planText = "# Compatibility\n- [ ] Validate local contract\n";
    fs.writeFileSync(planPath, planText);
    await check("Real SDK registration and current desktop RPC mode expose review commands and plan tool", async () => {
      assert.equal(a.ctx().mode, "rpc"); assert.equal(a.ctx().hasUI, true);
      assert.equal(a.tool("plannotator_submit_plan").executionMode, "sequential");
      for (const name of ["plannotator-plan-mode", "plannotator-review", "plannotator-annotate", "plannotator-last"]) assert.ok(a.runner.getCommand(name));
      assert.equal(a.extension.tools.has("plannotator"), false, "General review tool is off by default on Pi");
      const deniedTool = await a.tool("plannotator_submit_plan").execute("outside-phase", { filePath: "plan.md" }, undefined, undefined, a.ctx());
      assert.equal(deniedTool.details.approved, false);
      assert.equal(planSessions.length, 0);
    });
    await check("Plan tool returns pending; revision reuses review; approval reaches originating session", async () => {
      await a.command("plannotator-plan-mode");
      const submit = () => a.tool("plannotator_submit_plan").execute("submit", { filePath: "plan.md" }, undefined, undefined, a.ctx());
      const pending = await submit();
      assert.equal(pending.details.pending, true); assert.equal(pending.details.approved, false);
      assert.equal(pending.terminate, true); assert.equal(pending.details.reviewId, planSessions[0].reviewId);
      assert.equal(a.messages.length, 0);
      const revised = `${planText}- [ ] Verify cleanup\n`;
      fs.writeFileSync(planPath, revised);
      const revision = await submit();
      assert.equal(revision.details.revised, true); assert.equal(revision.details.version, 2);
      assert.equal(planSessions.length, 1);
      b = await harness("other-session", (pi) => extensionModule.default(pi, deps));
      planSessions[0].decide({ approved: true, feedback: "Keep the checks local" });
      await until(() => a.messages.length === 1);
      assert.match(a.messages[0].content, /Plan approved/);
      assert.ok(a.messages[0].content.includes(revised.trim()));
      assert.equal(a.messages[0].sessionId, a.sm.getSessionId());
      assert.equal(a.messages[0].options.deliverAs, "followUp");
      assert.equal(b.messages.length, 0, "Approval must not route to the other current session");
      assert.ok(a.uiEvents.some((event) => event.method === "notify" && event.message.includes(planSessions[0].url)));
      evidence.plan = { pending, revision, delivered: a.messages[0], otherSessionMessages: b.messages.length };
    });
    await check("Actual RPC UI response resolves only its originating wrapper", async () => {
      let resolved = false;
      const confirmation = a.ctx().ui.confirm("Compatibility confirmation", "Resolve through RPC").then((value) => { resolved = true; return value; });
      const event = a.uiEvents.findLast((value) => value.method === "confirm");
      assert.equal(event.type, "extension_ui_request");
      await b.wrapper.send({ type: "extension_ui_response", id: event.id, confirmed: true });
      await tick(); assert.equal(resolved, false);
      await a.wrapper.send({ type: "extension_ui_response", id: event.id, confirmed: true });
      assert.equal(await confirmation, true);
      assert.equal(a.wrapper.hasPendingExtensionUi(), false);
      evidence.rpc = { request: event, response: { type: "extension_ui_response", id: event.id, confirmed: true }, wrongSessionIgnored: true };
    });
    await check("Denied plan delivers revision feedback and stays in planning", async () => {
      await a.command("plannotator-plan-mode"); // executing -> idle
      await a.command("plannotator-plan-mode"); // idle -> planning
      await a.tool("plannotator_submit_plan").execute("reject", { filePath: "plan.md" }, undefined, undefined, a.ctx());
      const before = a.messages.length;
      planSessions.at(-1).decide({ approved: false, feedback: "Add a local rollback check" });
      await until(() => a.messages.length === before + 1);
      assert.match(a.messages.at(-1).content, /YOUR PLAN WAS NOT APPROVED/);
      assert.match(a.messages.at(-1).content, /Add a local rollback check/);
      assert.equal(a.sm.getBranch().findLast((entry) => entry.customType === "plannotator").data.phase, "planning");
      evidence.denial = a.messages.at(-1);
    });
    await check("Local code-review command uses upstream argument parsing and delivers feedback", async () => {
      const before = a.messages.length;
      await a.command("plannotator-review", "--no-git-remote-check");
      assert.equal(codeSessions.length, 1);
      codeSessions[0].decide({ approved: false, feedback: "Verify this finding against the local change", annotations: [{ id: "fixture-comment" }] });
      await until(() => a.messages.length === before + 1);
      assert.match(a.messages.at(-1).content, /Verify this finding against the local change/);
      assert.equal(a.messages.at(-1).options.deliverAs, "followUp");
      evidence.codeReview = a.messages.at(-1);
    });
    await check("Desktop shutdown closes pending tool plan, removes registry entry, suppresses late decision", async () => {
      await a.tool("plannotator_submit_plan").execute("shutdown", { filePath: "plan.md" }, undefined, undefined, a.ctx());
      const pending = planSessions.at(-1);
      assert.equal(registry.openFor(a.sm.getSessionId()).length, 1);
      const before = a.messages.length;
      await a.wrapper.shutdown();
      assert.equal(pending.stops, 1); assert.equal(pending.closes, 1);
      assert.equal(registry.openFor(a.sm.getSessionId()).length, 0);
      pending.decide({ approved: true });
      await tick(); await tick();
      assert.equal(a.messages.length, before);
      assert.equal(a.disposed, true);
      assert.throws(() => a.ctx().mode, /stale/);
      evidence.shutdown = { stops: pending.stops, closeKeepingDraft: pending.closes, lateDecisionSuppressed: true, disposed: a.disposed };
    });
    for (const h of harnesses) assert.deepEqual(h.errors, [], `SDK errors in ${h.name}`);
    assert.deepEqual(sourceErrors, [], "No swallowed upstream errors");
    assert.deepEqual(denied, [], "No network/process/model/parser capability may be attempted");
    evidence.uiMethods = [...new Set(harnesses.flatMap((h) => h.uiEvents.map((event) => event.method).filter(Boolean)))];
    evidence.sessionEntries = a.sm.getBranch().filter((entry) => entry.customType?.startsWith("plannotator"));
    return {
      passed: true, package: "@plannotator/pi-extension@0.28.23", sdk: "@earendil-works/pi-coding-agent@1.3.0",
      sourceDir: source, runDir, expectedRegistryIntegrity: registryIntegrity,
      sdkVersions, checkerSha256: sha256(fs.readFileSync(self)),
      reviewedFiles: Object.keys(reviewed).length, checks, evidence: plain(evidence),
      boundaries: { real: ["DefaultPackageManager manifest resolution with in-memory settings", "Pi extension factory loader", "Pi event bus", "Pi extension runner", "in-memory SessionManager", "AgentSessionWrapper RPC UI/shutdown"],
        fake: ["BrowserSession starters, decisions and stop", "runtime sendUserMessage/sendMessage delivery sinks", "model registry"],
        adapter: ["in-memory TS stripping and allowlisted module linking", "Pi loader pi-ai/compat alias", "unexercised parse5 functions fail closed"] },
      activity: { modelRequests: 0, networkRequests: 0, serverStarts: 0, browserStarts: 0,
        installs: 0, lifecycleScripts: 0, thirdPartyAccounts: 0, realCredentialsLoaded: false, blockedAttempts: denied,
        sourceReadPaths: [...fsReads], sourceWritePaths: [...fsWrites], imports: [...imports].sort() },
      runtimeConsumption: { source: "npm:@plannotator/pi-extension@0.28.23", manifest: { extensions: ["./"] },
        existingPath: "Plugins POST install -> DefaultPackageManager.installAndPersist -> Pi resource loader -> package/index.ts -> bindExtensions(mode=rpc)",
        installPerformed: false, generalAgentToolDefault: "off on Pi; slash commands and plan-submit tool remain available" },
      limitations: [
        "BrowserSession, real review HTTP routes, bundled HTML rendering and browser callbacks were not exercised.",
        "Desktop HTTP/SSE routes, React UI and a real AgentSession model loop were not started. Captured followUp delivery would normally start/queue a model turn.",
        "The event API uses startPlanReviewSession independently of default factory deps.startPlanReview. Event API reviews intentionally survive session shutdown and record late decisions; pending tool-plan reviews close with their source session.",
        "parse5 is absent in this desktop checkout; the inactive todo HTML helper import is supplied throwing functions only. Full package runtime needs its declared dependencies resolved.",
        "Annotation and last-message starters are injected but not exercised. Upstream review/annotate feedback can route to the process-wide current session after replacement; only plan decision source routing is proven here.",
        "hasUI and readable bundled HTML are required for interactive plan submission; upstream auto-approves when either is missing.",
        "No plugin install/settings persistence or real credentials were used. This is a contract compatibility result, not a complete installed desktop integration claim.",
      ],
    };
  } finally {
    for (const h of harnesses) {
      if (!h.disposed) await h.wrapper.shutdown();
      h.bus.clear();
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args.includes("--help")) {
    console.log("Opt-in only: node e2e/plannotator-compat.mjs --source-dir /absolute/path/to/inspected/package\nNo install, download, server, browser or model requests. Evidence: test-results/pilaude/plannotator-contract-*/result.json");
    return;
  }
  if (args[0] === "--isolated-child") {
    assert.equal(args.length, 3);
    const report = await child(path.resolve(args[1]), path.resolve(args[2]));
    fs.writeFileSync(path.join(args[2], "result.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, evidence: path.join(args[2], "result.json") }));
    return;
  }
  assert.equal(args[0], "--source-dir", "Explicit --source-dir is required");
  assert.equal(args.length, 2, "Only --source-dir is accepted");
  assert.ok(path.isAbsolute(args[1]), "Source directory must be absolute");
  const source = fs.realpathSync(args[1]);
  verifySource(source);
  const evidenceRoot = path.join(repo, "test-results/pilaude");
  fs.mkdirSync(evidenceRoot, { recursive: true });
  const runDir = fs.mkdtempSync(path.join(evidenceRoot, "plannotator-contract-"));
  for (const name of ["home", "agent", "config", "data", "cache", "tmp"]) fs.mkdirSync(path.join(runDir, name));
  const env = {};
  // Do not inherit API keys, tokens, NODE_OPTIONS, settings paths, SSH or proxy
  // variables. Preserve only OS runtime prerequisites; use independent homes.
  for (const name of ["SystemRoot", "WINDIR", "COMSPEC", "PATHEXT", "PATH"]) if (process.env[name]) env[name] = process.env[name];
  Object.assign(env, {
    HOME: path.join(runDir, "home"), USERPROFILE: path.join(runDir, "home"),
    XDG_CONFIG_HOME: path.join(runDir, "config"), XDG_DATA_HOME: path.join(runDir, "data"), XDG_CACHE_HOME: path.join(runDir, "cache"),
    APPDATA: path.join(runDir, "config"), LOCALAPPDATA: path.join(runDir, "cache"),
    PI_CODING_AGENT_DIR: path.join(runDir, "agent"), PLANNOTATOR_DATA_DIR: path.join(runDir, "data/plannotator"),
    TMP: path.join(runDir, "tmp"), TEMP: path.join(runDir, "tmp"), TMPDIR: path.join(runDir, "tmp"),
    PLANNOTATOR_INBOX_TOOL: "false", PLANNOTATOR_BROWSER: "none", PLANNOTATOR_REMOTE: "false",
    PLANNOTATOR_GIT_REMOTE_CHECK: "false", NO_COLOR: "1",
  });
  const run = spawnSync(process.execPath, ["--experimental-vm-modules", self, "--isolated-child", source, runDir], {
    cwd: runDir, env, encoding: "utf8", timeout: 60000, maxBuffer: 2 * 1024 * 1024,
  });
  fs.writeFileSync(path.join(runDir, "stdout.log"), run.stdout ?? "");
  fs.writeFileSync(path.join(runDir, "stderr.log"), run.stderr ?? "");
  if (run.status !== 0) {
    console.error(run.stderr || run.error || "Isolated checker failed");
    console.error(`Evidence: ${runDir}`);
    process.exitCode = 1;
  } else console.log(run.stdout.trim());
}
await main().catch((error) => { console.error(error.stack ?? error); process.exitCode = 1; });
