#!/usr/bin/env node
// Opt in with two already-reviewed npm package directories. No install, build,
// lifecycle scripts, model calls, browser/server, or live tool network requests.
// Usage: node e2e/pi-optional-tools-compat.mjs --permission-dir <package> --web-dir <package>
// Evidence is component/registration/RPC-method compatibility, not a full package install or GUI test.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import * as path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";
import * as childProcess from "node:child_process";
import * as http from "node:http";
import * as https from "node:https";
import * as net from "node:net";
import * as tls from "node:tls";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.includes("--help") || args.length === 0) {
  console.log("Opt-in isolated contract check: node e2e/pi-optional-tools-compat.mjs --permission-dir <reviewed-package> --web-dir <reviewed-package>\nRequires each original published.tgz at <package>/../../published.tgz. Writes a fresh ignored report under test-results/pilaude. Does not install extensions.");
  process.exit(0);
}
assert.equal(args.length, 4, "Supply exactly --permission-dir and --web-dir");
const options = new Map();
for (let i = 0; i < args.length; i += 2) {
  assert.ok(["--permission-dir", "--web-dir"].includes(args[i]), `Unknown option ${args[i]}`);
  assert.ok(!options.has(args[i]), `Duplicate option ${args[i]}`);
  options.set(args[i], fs.realpathSync(path.resolve(args[i + 1])));
}
assert.equal(options.size, 2);
const pins = {
  permission: {
    name: "@gotgenes/pi-permission-system", version: "41.0.0", dir: options.get("--permission-dir"),
    tarball: "https://registry.npmjs.org/@gotgenes/pi-permission-system/-/pi-permission-system-41.0.0.tgz",
    integrity: "sha512-BJHnj4yrtVMT5A5Tzss+yRhdvRndJSEBMr4j3QGa+T5MxmHof1xTKlVlDA6Xiq3hFQ7LcvTTCxzvXfPW85zftA==",
  },
  web: {
    name: "pi-web-access", version: "0.42.0", dir: options.get("--web-dir"),
    tarball: "https://registry.npmjs.org/pi-web-access/-/pi-web-access-0.42.0.tgz",
    integrity: "sha512-AUtkNFw1wltHSzxEQGF9yjUjijQE75opicgXrOLCX7iRWWXaKoj0fOlPAWUHVMqRRHeUwN6S/sYFrm3+2QOtMQ==",
  },
};
const sha256 = value => createHash("sha256").update(value).digest("hex");
function verifyArchive(pin) {
  const archivePath = path.resolve(pin.dir, "../../published.tgz");
  const archive = fs.readFileSync(archivePath);
  assert.equal(`sha512-${createHash("sha512").update(archive).digest("base64")}`, pin.integrity, `${pin.name} registry integrity`);
  const tar = gunzipSync(archive, { maxOutputLength: 64 * 1024 * 1024 });
  const files = new Map();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const field = (start, size) => header.subarray(start, start + size).toString("utf8").split("\0")[0];
    const name = [field(345, 155), field(0, 100)].filter(Boolean).join("/");
    assert.ok(name.startsWith("package/") && !name.includes("\\") && !name.split("/").some(part => part === ".." || part === "."), `Unsafe archive path ${name}`);
    const type = field(156, 1);
    assert.ok(["", "0", "5"].includes(type), `Archive link or unsupported entry ${name}`);
    const size = Number.parseInt(field(124, 12).trim() || "0", 8);
    assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length);
    if (type !== "5") {
      assert.ok(!files.has(name.slice(8)), `Duplicate archive path ${name}`);
      files.set(name.slice(8), sha256(tar.subarray(offset + 512, offset + 512 + size)));
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  const manifestBytes = fs.readFileSync(path.join(pin.dir, "package.json"));
  assert.equal(sha256(manifestBytes), files.get("package.json"), "Extracted manifest matches the verified tarball");
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.name, pin.name);
  assert.equal(manifest.version, pin.version);
  return { ...pin, archivePath, files, manifest };
}
for (const key of Object.keys(pins)) pins[key] = verifyArchive(pins[key]);
const resultsRoot = path.join(root, "test-results/pilaude");
fs.mkdirSync(resultsRoot, { recursive: true });
const artifacts = fs.mkdtempSync(path.join(resultsRoot, "optional-tools-"));
const workspace = path.join(artifacts, "workspace");
const home = path.join(artifacts, "home");
const agentDir = path.join(artifacts, "agent");
for (const dir of [workspace, home, agentDir, path.join(artifacts, "tmp"), path.join(artifacts, "xdg-config"), path.join(artifacts, "xdg-data"), path.join(artifacts, "xdg-cache")]) fs.mkdirSync(dir);
// Drop inherited provider keys, proxy/cookie settings, NODE_OPTIONS, and shell hooks.
const systemEnv = Object.fromEntries(["SystemRoot", "WINDIR", "COMSPEC"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
for (const key of Object.keys(process.env)) delete process.env[key];
Object.assign(process.env, systemEnv, {
  HOME: home, USERPROFILE: home, XDG_CONFIG_HOME: path.join(artifacts, "xdg-config"),
  XDG_DATA_HOME: path.join(artifacts, "xdg-data"), XDG_CACHE_HOME: path.join(artifacts, "xdg-cache"),
  APPDATA: path.join(home, "AppData/Roaming"), LOCALAPPDATA: path.join(home, "AppData/Local"),
  TEMP: path.join(artifacts, "tmp"), TMP: path.join(artifacts, "tmp"), TMPDIR: path.join(artifacts, "tmp"),
  PI_CODING_AGENT_DIR: agentDir, PI_AGENT_DIR: agentDir, PI_WEB_ACCESS_CACHE_ROOT: path.join(artifacts, "cache"),
  JITI_FS_CACHE: "false", JITI_MODULE_CACHE: "false", DO_NOT_TRACK: "1",
});
process.chdir(workspace);
const blocked = [];
function forbidden(name) {
  return () => { blocked.push(name); throw new Error(`Fixture blocks ${name}`); };
}
// Defense in depth for host code; downloaded code additionally runs in a VM with a closed require map.
globalThis.fetch = forbidden("global fetch");
const builtinRequire = createRequire(import.meta.url);
for (const [moduleName, names] of [
  ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
  ["node:http", ["request", "get", "createServer"]], ["node:https", ["request", "get", "createServer"]],
  ["node:net", ["connect", "createConnection", "createServer"]], ["node:tls", ["connect", "createServer"]],
]) {
  const builtin = builtinRequire(moduleName);
  for (const name of names) builtin[name] = forbidden(`${moduleName}.${name}`);
}
syncBuiltinESMExports();
// Keep namespace imports above explicit so side-effect restrictions are discoverable in review.
void [childProcess, http, https, net, tls];
const report = {
  status: "running", kind: "reviewed-source-contract-with-injected-dependencies", artifacts,
  isolation: { home, userProfile: process.env.USERPROFILE, xdgConfig: process.env.XDG_CONFIG_HOME, xdgData: process.env.XDG_DATA_HOME, xdgCache: process.env.XDG_CACHE_HOME, agentDir, cwd: workspace, inheritedCredentialsRemoved: true },
  packages: Object.fromEntries(Object.entries(pins).map(([key, pin]) => [key, { name: pin.name, version: pin.version, sourceDir: pin.dir, archivePath: pin.archivePath, tarball: pin.tarball, integrity: pin.integrity, archiveIntegrityMatched: true }])),
  checkedSource: [], checks: [], stubs: [], blockedAttempts: blocked,
  gaps: [
    "Permission full src/index.ts composition, config discovery, policy manager, tree-sitter/WASM and zod dependencies were not executed.",
    "Permission evidence is real evaluate/applyPermissionGate/prompt/fail-closed components joined by a fixture factory through Pi 1.3.0's real registration API and ExtensionRunner.",
    "RPC dialog methods are extracted unchanged from the current desktop wrapper; HTTP/SSE, React dialog rendering, focus and a full AgentSession were not exercised.",
    "The permission package registers no user_bash handler; arbitrary !commands/terminal commands are not covered by these tool_call checks.",
    "Built-in desktop subagents do not establish this package's gotgenes child lifecycle protocol; subagent propagation and scheduler/headless approval coverage remain unverified.",
    "Web source index.ts registration and core execute callbacks were exercised with in-memory storage, fixture search/extraction and dependency stubs; shipped dist and real optional dependencies were not loaded.",
    "No real search provider, credential resolver/browser-cookie store, SSRF/DNS/HTTP stack, clone/git/gh, media/YouTube/ffmpeg/yt-dlp, curator/browser/server, or model summary/page answer was exercised.",
    "This is opt-in evidence and does not install either package or prove drop-in desktop compatibility.",
  ],
};
const watchdog = setTimeout(() => { console.error("Optional tools fixture deadline exceeded"); process.exit(1); }, 45000);
try {
  const ts = await import(pathToFileURL(builtinRequire.resolve("typescript")).href);
  const sdkPackage = JSON.parse(fs.readFileSync(path.join(root, "node_modules/@earendil-works/pi-coding-agent/package.json"), "utf8"));
  const lock = JSON.parse(fs.readFileSync(path.join(root, "package-lock.json"), "utf8"));
  assert.equal(sdkPackage.version, "1.3.0");
  assert.equal(lock.packages["node_modules/@earendil-works/pi-coding-agent"].version, "1.3.0");
  report.sdk = { installed: sdkPackage.version, locked: "1.3.0" };
  const sdkBase = path.join(root, "node_modules/@earendil-works/pi-coding-agent");
  const sdkRequire = createRequire(path.join(sdkBase, "package.json"));
  const { Type } = await import(pathToFileURL(sdkRequire.resolve("typebox")).href);
  const tui = await import(pathToFileURL(sdkRequire.resolve("@earendil-works/pi-tui")).href);
  const { createExtensionRuntime, loadExtensionFromFactory } = await import(pathToFileURL(path.join(sdkBase, "dist/core/extensions/loader.js")).href);
  const { ExtensionRunner } = await import(pathToFileURL(path.join(sdkBase, "dist/core/extensions/runner.js")).href);
  const { createEventBus } = await import(pathToFileURL(path.join(sdkBase, "dist/core/event-bus.js")).href);
  const check = async (name, fn) => { await fn(); report.checks.push({ name, status: "passed" }); };
  function source(pin, relative) {
    assert.ok(pin.files.has(relative), `Source is absent from original tarball: ${relative}`);
    const filename = path.join(pin.dir, relative);
    assert.equal(fs.realpathSync(filename).toLowerCase(), path.resolve(filename).toLowerCase(), "No symlinked source files");
    const text = fs.readFileSync(filename, "utf8");
    assert.equal(sha256(text), pin.files.get(relative), `Extracted source differs from verified archive: ${relative}`);
    if (!report.checkedSource.some(entry => entry.path === filename)) report.checkedSource.push({ path: filename, sha256: sha256(text) });
    return text;
  }
  const vmContext = vm.createContext({
    console, setTimeout, clearTimeout, setImmediate, clearImmediate, AbortController, AbortSignal,
    URL, TextEncoder, TextDecoder, Buffer, structuredClone,
    process: Object.freeze({ env: Object.freeze({ ...process.env }), platform: process.platform }),
    fetch: forbidden("downloaded-source fetch"),
  }, { codeGeneration: { strings: false, wasm: false } });
  const safeFs = Object.fromEntries(["existsSync", "readFileSync", "writeFileSync", "mkdirSync"].map(name => [name, (...values) => {
    const target = path.resolve(String(values[0]));
    assert.ok(target.startsWith(`${artifacts}${path.sep}`), `VM fs access outside fixture: ${target}`);
    assert.ok(!/\b(auth|credentials)\.json$|\.env(?:\.|$)/i.test(target), "No credential or dotenv access");
    return fs[name](...values);
  }]));
  const safeBuiltins = {
    "node:crypto": { createHash, randomUUID }, "node:path": path,
    "node:os": { homedir: () => home, platform: () => process.platform, tmpdir: () => path.join(artifacts, "tmp") },
    "node:fs": safeFs, "node:child_process": new Proxy({}, { get: (_object, key) => forbidden(`VM child_process.${String(key)}`) }),
    "node:module": { createRequire: forbidden("VM createRequire") },
    "@earendil-works/pi-tui": tui, typebox: { Type },
  };
  function makeLoader(pin, allow, injected = {}) {
    const cache = new Map();
    const load = relative => {
      if (cache.has(relative)) return cache.get(relative).exports;
      assert.ok(allow.has(relative), `Unreviewed source import: ${relative}`);
      const text = source(pin, relative);
      const output = ts.transpileModule(text, {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
        transformers: { before: [context => node => {
          const visit = child => ts.isMetaProperty(child) && child.keywordToken === ts.SyntaxKind.ImportKeyword
            ? ts.factory.createObjectLiteralExpression([ts.factory.createPropertyAssignment("url", ts.factory.createStringLiteral(pathToFileURL(path.join(pin.dir, relative)).href))])
            : ts.visitEachChild(child, visit, context);
          return ts.visitNode(node, visit);
        }] },
      }).outputText;
      const loadedModule = { exports: {} };
      cache.set(relative, loadedModule);
      const requireFixture = specifier => {
        if (Object.hasOwn(injected, specifier)) return injected[specifier];
        if (Object.hasOwn(safeBuiltins, specifier)) return safeBuiltins[specifier];
        let next;
        if (specifier.startsWith("#src/")) next = `${specifier.slice(1)}.ts`;
        else if (specifier.startsWith(".")) next = path.posix.normalize(path.posix.join(path.posix.dirname(relative), specifier));
        else throw new Error(`Unreviewed dependency: ${specifier}`);
        if (!next.endsWith(".ts")) next += ".ts";
        return load(next);
      };
      new vm.Script(`(function(require,module,exports){\n${output}\n})`, { filename: path.join(pin.dir, relative) })
        .runInContext(vmContext, { timeout: 5000 })(requireFixture, loadedModule, loadedModule.exports);
      return loadedModule.exports;
    };
    return load;
  }
  // Use unchanged current desktop methods without importing app startup, auth,
  // filesystem discovery, scheduler, or any real AgentSession.
  const rpcPath = path.join(root, "lib/rpc-manager.ts");
  const rpcSource = fs.readFileSync(rpcPath, "utf8");
  const rpcAst = ts.createSourceFile(rpcPath, rpcSource, ts.ScriptTarget.Latest, true);
  const wrapperClass = rpcAst.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AgentSessionWrapper");
  assert.ok(wrapperClass);
  const methodNames = ["requestExtensionUi", "createExtensionUiContext", "resolveExtensionUiResponse"];
  const methods = methodNames.map(name => {
    const method = wrapperClass.members.find(node => node.name?.getText(rpcAst) === name);
    assert.ok(method, `Desktop method ${name}`);
    return method.getText(rpcAst);
  });
  const rpcSnippet = `class RpcFixture {\n${methods.join("\n")}\n}; globalThis.RpcFixture = RpcFixture;`;
  const rpcContext = vm.createContext({ randomUUID, AbortSignal, setTimeout, clearTimeout, notifyRunningChange() {}, PLAIN_TEXT_THEME: {}, PRODUCT_NAME: "Pilaude" });
  new vm.Script(ts.transpileModule(rpcSnippet, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText).runInContext(rpcContext);
  report.desktopRpc = { path: rpcPath, sha256: sha256(rpcSource), methods: methodNames, methodSha256: methods.map(sha256) };
  function rpcFixture() {
    const rpc = new rpcContext.RpcFixture();
    Object.assign(rpc, { pendingUiRequests: new Map(), pendingUiResponses: new Map(), extensionUiAbortController: new AbortController(), events: [], emit(event) { this.events.push(event); } });
    return rpc;
  }
  const permissionAllow = new Set([
    "src/policy/rule.ts", "src/policy/wildcard-matcher.ts", "src/path/expand-home.ts", "src/access-intent/path-surfaces.ts",
    "src/policy/permission-gate.ts", "src/handlers/tool-call-boundary.ts", "src/permission-request-id.ts", "src/value-guards.ts",
    "src/authority/permission-prompt-component.ts", "src/authority/permission-dialog.ts", "src/authority/answer-window.ts", "src/authority/denying-authorizer.ts",
    "src/authority/bracketed-paste.ts", "src/authority/permission-prompt-decision.ts",
    "src/presentation/dialog-renderer.ts", "src/presentation/fact-vocabulary.ts", "src/presentation/line-fitting.ts", "src/presentation/prompt-notification.ts", "src/presentation/prompt-payload.ts",
  ]);
  const permissionLoad = makeLoader(pins.permission, permissionAllow);
  const { evaluate } = permissionLoad("src/policy/rule.ts");
  const { applyPermissionGate } = permissionLoad("src/policy/permission-gate.ts");
  const { createFailClosedToolCall } = permissionLoad("src/handlers/tool-call-boundary.ts");
  const { requestPermissionDecision } = permissionLoad("src/authority/permission-prompt-component.ts");
  const { DenyingAuthorizer } = permissionLoad("src/authority/denying-authorizer.ts");
  const permissionIndex = source(pins.permission, "src/index.ts");
  assert.match(permissionIndex, /pi\.on\(\s*"tool_call",\s*createFailClosedToolCall/);
  assert.doesNotMatch(permissionIndex, /pi\.on\(\s*"user_bash"/);
  const rules = [
    { surface: "fixture_tool", pattern: "*", action: "ask", origin: "global" },
    { surface: "fixture_tool", pattern: "allow-*", action: "allow", origin: "global" },
    { surface: "fixture_tool", pattern: "deny-*", action: "deny", origin: "global" },
  ];
  let currentValue;
  let timeoutMs;
  let executions = 0;
  let noUi = false;
  let lastGateOutcome;
  const gateEvents = [];
  const reporter = { writeReviewLog: (event, data) => gateEvents.push({ event, data }), emitDecision: event => gateEvents.push(event) };
  const audit = { recordDecision() {}, recordError() {} };
  let activeRpc;
  const permissionRuntime = createExtensionRuntime();
  const permissionExtension = await loadExtensionFromFactory(pi => {
    pi.on("tool_call", createFailClosedToolCall(async (event, ctx) => {
      const rule = evaluate(event.toolName, event.input.value, rules, { matchOptions: { caseInsensitive: true, windowsSeparators: true } });
      lastGateOutcome = await applyPermissionGate({
        state: rule.action, canGrantForSession: true,
        decidedByRule: { kind: "rule", surface: event.toolName, pattern: rule.pattern, origin: rule.origin },
        promptForApproval: () => noUi ? new DenyingAuthorizer().authorize() : requestPermissionDecision({
          mode: ctx.mode, ui: ctx.ui, promptTimeoutMs: timeoutMs, doublePressToConfirm: true,
          budget: { maxRows: 24, fieldMaxWidth: 400 }, dialogKeys: {}, promptNotifications: [], notice: {},
        }, "Permission Required", {
          kind: "tool", request: { requester: { agentName: null, forwarded: false, sessionId: null }, surface: event.toolName,
            toolName: event.toolName, invokedToolName: null, value: currentValue, matchedPattern: rule.pattern,
            matchedSpelling: null, commandContext: null, executedUnit: null, decidingPath: null },
          evidence: [], annotations: [],
        }),
        writeLog: reporter.writeReviewLog, logContext: {},
        messages: { denyReason: "Fixture policy denied", refusedReason: decision => decision.denialReason ?? "Fixture permission refused" },
      });
      return lastGateOutcome;
    }, reporter, audit, { debug() {} }));
  }, workspace, createEventBus(), permissionRuntime, "fixture:reviewed-permission-components");
  const permissionRunner = new ExtensionRunner([permissionExtension], permissionRuntime, workspace, {}, {});
  const invokeGate = async value => {
    currentValue = value;
    const result = await permissionRunner.emitToolCall({ type: "tool_call", toolName: "fixture_tool", toolCallId: randomUUID(), input: { value } });
    if (!result?.block) executions++;
    return result;
  };
  const freshUi = () => { activeRpc = rpcFixture(); permissionRunner.setUIContext(activeRpc.createExtensionUiContext(), "rpc"); return activeRpc; };
  const response = value => {
    const request = [...activeRpc.pendingUiRequests.values()].at(-1);
    assert.ok(request, "Permission ask must really be pending");
    activeRpc.resolveExtensionUiResponse({ type: "extension_ui_response", id: request.id, ...(value === undefined ? { cancelled: true } : { value }) });
    return request;
  };
  const tick = () => new Promise(resolve => setImmediate(resolve));
  await check("permission rules: allow executes fixture counter; deny never executes or prompts", async () => {
    freshUi();
    assert.ok(!(await invokeGate("allow-case")).block);
    assert.equal(executions, 1);
    assert.equal((await invokeGate("deny-case")).block, true);
    assert.equal(executions, 1);
    assert.equal(activeRpc.events.length, 0);
    assert.equal(evaluate("read", "c:\\fixtures\\a.txt", [{ surface: "read", pattern: "C:/FIXTURES/*", action: "deny", origin: "global" }], { matchOptions: { caseInsensitive: true, windowsSeparators: true } }).action, "deny");
  });
  for (const [choice, expectedBlock] of [["Yes", false], ["No", true], [undefined, true], ["Yes, for this session", false]]) {
    await check(`permission RPC ask: ${choice ?? "cancel"}`, async () => {
      freshUi();
      const before = executions;
      const pending = invokeGate("ask-case");
      await tick();
      assert.equal(executions, before, "Ask must not execute before an answer");
      const request = response(choice);
      assert.equal(request.method, "select");
      assert.ok(request.options.includes("No, provide reason"));
      assert.equal(Boolean((await pending).block), expectedBlock);
      assert.equal(lastGateOutcome.decidedBy.kind, "user");
      assert.equal(lastGateOutcome.decidedBy.via, "select");
      if (choice === "Yes, for this session") assert.equal(lastGateOutcome.sessionGrant.width, "proven");
      assert.equal(executions, before + (expectedBlock ? 0 : 1));
      assert.equal(activeRpc.pendingUiRequests.size, 0);
      assert.equal(activeRpc.events.at(-1).type, "extension_ui_closed");
    });
  }
  await check("permission RPC denial reason: select then input returns reason and never executes", async () => {
    freshUi();
    const before = executions;
    const pending = invokeGate("ask-reason");
    await tick(); response("No, provide reason"); await tick();
    assert.equal([...activeRpc.pendingUiRequests.values()][0].method, "input");
    response("  Fixture refused this operation  ");
    const result = await pending;
    assert.equal(result.block, true);
    assert.equal(result.reason, "Fixture refused this operation");
    assert.equal(executions, before);
  });
  await check("permission RPC Stop while entering denial reason also blocks without execution", async () => {
    freshUi();
    const before = executions;
    const pending = invokeGate("ask-reason-abort");
    await tick(); response("No, provide reason"); await tick();
    assert.equal([...activeRpc.pendingUiRequests.values()][0].method, "input");
    activeRpc.extensionUiAbortController.abort(new DOMException("Fixture cancelled by Stop", "AbortError"));
    assert.equal((await pending).block, true);
    assert.equal(executions, before);
    assert.equal(activeRpc.pendingUiRequests.size, 0);
  });
  await check("permission no-authority component denies headless ask without UI or execution", async () => {
    freshUi(); noUi = true;
    const before = executions;
    assert.equal((await invokeGate("ask-no-ui")).block, true);
    noUi = false;
    assert.equal(lastGateOutcome.decidedBy.kind, "unavailable");
    assert.equal(executions, before);
    assert.equal(activeRpc.events.length, 0);
  });
  await check("permission RPC unanswered window: real package timer denies and clears pending request", async () => {
    freshUi(); timeoutMs = 20;
    const before = executions;
    const result = await invokeGate("ask-timeout");
    timeoutMs = undefined;
    assert.equal(result.block, true);
    assert.equal(lastGateOutcome.decidedBy.kind, "unanswered");
    assert.equal(lastGateOutcome.decidedBy.timeoutMs, 20);
    assert.equal(executions, before);
    assert.equal(activeRpc.pendingUiRequests.size, 0);
  });
  await check("permission RPC Stop rejection: fail-closed boundary blocks with zero fixture execution", async () => {
    freshUi();
    const before = executions;
    const pending = invokeGate("ask-abort");
    await tick();
    activeRpc.extensionUiAbortController.abort(new DOMException("Fixture cancelled by Stop", "AbortError"));
    const result = await pending;
    assert.equal(result.block, true);
    assert.match(result.reason, /fail-closed/);
    assert.equal(executions, before);
    assert.equal(activeRpc.pendingUiRequests.size, 0);
  });
  await check("permission user_bash is outside the registered tool_call surface", async () => {
    assert.equal(permissionExtension.handlers.has("user_bash"), false);
    const before = executions;
    assert.equal(await permissionRunner.emitUserBash({ type: "user_bash", command: "fixture-not-executed" }), undefined);
    assert.equal(executions, before);
  });
  report.permission = { fixtureCounterExecutions: executions, realCommandsExecuted: 0, userBashHook: false, fullFactoryExecuted: false };

  const config = {
    workflow: "none", toolActivation: "eager", toolExposure: "direct", maxInlineContentChars: 1000,
    commands: Object.fromEntries(["websearch", "curator", "search", "google-account"].map(name => [name, { enabled: false }])),
    fetch: { defaultMode: "raw", allowedModes: ["raw", "readable"] },
  };
  const configPath = path.join(agentDir, "web-search.json");
  fs.writeFileSync(configPath, JSON.stringify(config));
  const stored = new Map();
  let nextId = 0;
  const storage = {
    generateId: () => `fixture-${++nextId}`, storeResult: (id, data) => stored.set(id, data), getResult: id => stored.get(id) ?? null,
    getAllResults: () => [...stored.values()], deleteResult: id => stored.delete(id), deleteHeldResult: id => stored.delete(id),
    storeFetchedContentResult(id, data) { stored.set(id, data); return data; }, holdResults() {}, releaseResults() {}, loadSessionResults: () => [],
  };
  let searchCalls = 0;
  let extractionCalls = 0;
  const fixtureText = "Fixture source content. No external request was made.\n".repeat(70);
  const fixturePages = {
    "https://fixture.invalid/docs": { title: "Fixture documentation", content: fixtureText, error: null, status: 200 },
    "https://fixture.invalid/missing": { title: "", content: "", error: "Fixture 404", status: 404 },
  };
  const fixtureSearch = {
    ALL_SEARCH_PROVIDERS: ["brave"], RESOLVED_SEARCH_PROVIDERS: ["brave"],
    getAllowedSearchProviders: () => ["brave"], providerLabel: name => name, getConfiguredSearchRouting: () => ({}),
    normalizeSearchProviderSelection(value) { assert.ok(value === "auto" || value === "brave", "Only fixture provider selections"); return value; },
    assertSearchProviderSelectionAllowed(value) { assert.ok(value === "auto" || value === "brave"); },
    async search(query, options) {
      options.signal?.throwIfAborted(); searchCalls++;
      if (query === "fixture-failure") throw new Error("Fixture provider unavailable");
      return { answer: "Fixture search answer", provider: "brave", results: [{ title: "Fixture documentation", url: "https://fixture.invalid/docs", snippet: "Fixture source content." }] };
    },
  };
  const dependencies = {
    "@earendil-works/pi-coding-agent": { buildSessionContext: forbidden("dynamic tool activation transcript") },
    "./storage.ts": storage, "./gemini-search.ts": fixtureSearch,
    "./utils.ts": {
      getWebSearchConfigPath: () => configPath, getWebSearchConfigDir: () => agentDir,
      runWithProxy: async (proxy, run) => { assert.ok(proxy === undefined || proxy === ""); return run(); },
      normalizeProxyUrl: () => { throw new Error("Fixture proxy disabled"); }, formatSeconds: String, resolveCuratorNetworkConfig: () => ({ enabled: false }),
    },
    "./extract.ts": {
      async fetchAllContent(urls, signal, options) {
        signal?.throwIfAborted(); extractionCalls++;
        assert.notEqual(options.forceClone, true); assert.equal(options.authFetchProfile, undefined);
        return urls.map(url => { assert.ok(Object.hasOwn(fixturePages, url), `Only local fixture entries are permitted: ${url}`); return { url, ...fixturePages[url] }; });
      },
    },
    "./auth-fetch.ts": { resolveAuthFetchProfile: forbidden("auth-fetch profile") },
    "./openai-search.ts": { isOpenAISearchAvailable: () => false, isCurrentModelHostedSearchEligible: () => false, isOpenAISubscriptionModelSelected: () => false },
    "./github-extract.ts": { clearCloneCache() {}, releaseClonesUnusedSince() {}, touchClones() {} },
    "./page-query.ts": { answerFromPage: forbidden("model page answer") },
    "./query-rewrite.ts": { rewriteSearchQuery: forbidden("model query rewrite") },
    "./curator-server.ts": { startCuratorServer: forbidden("curator server") },
    "./summary-review.ts": { buildDeterministicSummary: forbidden("summary"), generateSummaryDraft: forbidden("model summary"), SUMMARY_GENERATION_DEADLINE_MS: 1 },
    "./activity.ts": { activityMonitor: { clear() {}, getEntries: () => [], onUpdate: () => () => {} } },
    "./gemini-web.ts": { getActiveGoogleEmail: () => undefined, isGeminiWebAvailable: () => false },
    "./gemini-web-config.ts": { isBrowserCookieAccessAllowed: () => false },
    "./render-search-error.ts": { buildSearchErrorPlan: forbidden("TUI error renderer") },
    "./summary-model-scope.ts": new Proxy({}, { get: (_object, key) => forbidden(`model scope ${String(key)}`) }),
    // A small fixture limiter replaces unaudited p-limit@6 rather than silently consuming the host's unrelated p-limit@3.
    "p-limit": { __esModule: true, default: concurrency => {
      let active = 0; const queue = [];
      const drain = () => { while (active < concurrency && queue.length) { active++; const { run, resolve, reject } = queue.shift(); Promise.resolve().then(run).then(resolve, reject).finally(() => { active--; drain(); }); } };
      return run => new Promise((resolve, reject) => { queue.push({ run, resolve, reject }); drain(); });
    } },
  };
  // All other provider modules are deliberately inert, never credential readers.
  const webIndex = source(pins.web, "index.ts");
  const webAst = ts.createSourceFile("index.ts", webIndex, ts.ScriptTarget.Latest, true);
  const actualWeb = new Set(["index.ts", "web-tool-core.ts", "fetch-params.ts", "content-find.ts", "source-check.ts", "curator-run.ts", "tool-arguments.ts", "tool-activation.ts"]);
  for (const statement of webAst.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause?.isTypeOnly) continue;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith(".") || actualWeb.has(specifier.slice(2)) || Object.hasOwn(dependencies, specifier)) continue;
    const members = statement.importClause?.namedBindings;
    const stub = {};
    if (members && ts.isNamedImports(members)) for (const member of members.elements) {
      if (member.isTypeOnly) continue;
      const name = member.propertyName?.text ?? member.name.text;
      stub[name] = /^is.+Available$/.test(name) ? () => false : forbidden(`${specifier} ${name}`);
    }
    dependencies[specifier] = stub;
  }
  report.stubs = Object.keys(dependencies).sort();
  const webLoad = makeLoader(pins.web, actualWeb, dependencies);
  const webFactory = webLoad("index.ts").default;
  const journal = [];
  const webRuntime = createExtensionRuntime();
  webRuntime.appendEntry = (type, data) => journal.push({ type, data });
  const webExtension = await loadExtensionFromFactory(webFactory, workspace, createEventBus(), webRuntime, "fixture:reviewed-web-source");
  const tools = webExtension.tools;
  const context = { mode: "rpc", hasUI: true, cwd: workspace };
  const execute = async (name, params, signal, updates = []) => {
    const definition = tools.get(name).definition;
    return definition.execute(randomUUID(), params, signal, update => updates.push(update), context);
  };
  await check("web real source factory registers four TypeBox tools through Pi 1.3.0", async () => {
    assert.deepEqual([...tools.keys()].sort(), ["fetch_content", "get_search_content", "source_check", "web_search"]);
    for (const { definition } of tools.values()) { assert.equal(definition.parameters.type, "object"); assert.equal(typeof definition.execute, "function"); }
    assert.equal(tools.get("web_search").definition.outputSchema.type, "object");
    assert.equal(tools.get("fetch_content").definition.outputSchema.type, "object");
  });
  await check("web registered search execute returns source-linked structured content and journal data", async () => {
    const updates = [];
    const result = await execute("web_search", { query: "Fixture documentation", provider: "brave", workflow: "none" }, undefined, updates);
    assert.equal(result.structuredContent.queries[0].results[0].url, "https://fixture.invalid/docs");
    assert.equal(result.details.successfulQueries, 1); assert.ok(!result.isError);
    assert.ok(updates.length >= 2); assert.equal(journal.at(-1).type, "web-search-results");
    const retrieved = await execute("get_search_content", { responseId: result.structuredContent.responseId, queryIndex: 0 });
    assert.match(retrieved.content[0].text, /Fixture documentation/);
  });
  let fetchedId;
  await check("web registered fetch execute stores full fixture content and reports truncation", async () => {
    const result = await execute("fetch_content", { url: "https://fixture.invalid/docs", mode: "raw" });
    fetchedId = result.details.responseId;
    assert.ok(!result.isError); assert.equal(result.details.truncated, true);
    assert.equal(result.structuredContent.urls[0].content, fixtureText);
    assert.equal(result.structuredContent.urls[0].status, 200);
    const page = await execute("get_search_content", { responseId: fetchedId, offset: 20, limit: 80 });
    assert.equal(page.details.returnedChars, 80); assert.equal(page.details.nextOffset, 100);
    assert.ok(page.content[0].text.includes(fixtureText.slice(20, 100)));
    const found = await execute("get_search_content", { responseId: fetchedId, findText: "No external request", findMode: "exact" });
    assert.match(found.content[0].text, /No external request/);
  });
  await check("web source_check gathers fixture citations without claiming semantic verification", async () => {
    const result = await execute("source_check", { claim: "Fixture source content", fetchContent: true, provider: "brave" });
    assert.equal(result.details.sourceCount, 1);
    assert.ok(result.details.artifact.passages.length > 0);
    assert.equal(result.details.artifact.claims[0].status, "unclear");
    assert.ok(!result.isError);
  });
  await check("web missing/invalid inputs and provider/fetch failures return tool errors", async () => {
    for (const [name, params] of [
      ["web_search", {}], ["fetch_content", {}], ["get_search_content", { responseId: "unknown" }],
      ["fetch_content", { url: "https://fixture.invalid/docs", mode: "answer", prompt: "No models" }],
      ["web_search", { query: "fixture-failure", workflow: "none", provider: "brave" }],
      ["fetch_content", { url: "https://fixture.invalid/missing", mode: "raw" }],
      ["get_search_content", { responseId: fetchedId, offset: -1 }],
    ]) assert.equal((await execute(name, params)).isError, true, `${name} should return isError`);
  });
  await check("web pre-aborted search/fetch perform no provider or extraction operation", async () => {
    const controller = new AbortController(); controller.abort(new Error("fixture abort"));
    const before = [searchCalls, extractionCalls];
    for (const [name, params] of [["web_search", { query: "Fixture", workflow: "none" }], ["fetch_content", { url: "https://fixture.invalid/docs", mode: "raw" }]]) {
      await assert.rejects(execute(name, params, controller.signal), /fixture abort/);
    }
    assert.deepEqual([searchCalls, extractionCalls], before);
  });
  report.web = { registeredTools: [...tools.keys()], fixtureSearchCalls: searchCalls, fixtureExtractionCalls: extractionCalls, journalEntries: journal.length, sourceFactoryExecuted: true, shippedDistExecuted: false };
  assert.deepEqual(blocked, [], "No real network/server/command/model path may even be attempted");
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = { message: error.message, stack: error.stack };
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  fs.writeFileSync(path.join(artifacts, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, report: path.join(artifacts, "result.json"), ...(report.error ? { error: report.error.message } : {}) }));
}
