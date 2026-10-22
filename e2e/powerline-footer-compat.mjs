#!/usr/bin/env node
// Opt-in registration/desktop-bridge check. The full extension entry point and
// real primary segment renderer are deliberately not executed.
// node e2e/powerline-footer-compat.mjs --footer-dir <reviewed-package>
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import { createRequire, syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { gunzipSync } from "node:zlib";

const project = fileURLToPath(new URL("../", import.meta.url));
const filename = fileURLToPath(import.meta.url);
const pin = {
  name: "pi-powerline-footer", version: "0.20.2",
  commit: "e06267494593c9006b014f42706a8d9e9259a417",
  integrity: "sha512-RK9a9gd0GjVT2sc7Ak3dAxw1BOLfq9O/muLyeQ+Zu7rHJ1s0azSudGtyk9c9dAlv7VBiq6rO5GGCfJDgtD95xQ==",
  tarball: "https://registry.npmjs.org/pi-powerline-footer/-/pi-powerline-footer-0.20.2.tgz",
};
const sha256 = value => createHash("sha256").update(value).digest("hex");

if (process.argv[2] !== "--isolated-child") {
  if (process.argv.length === 2 || process.argv.includes("--help")) {
    console.log("Usage: node e2e/powerline-footer-compat.mjs --footer-dir <reviewed-package>\nRequires original published.tgz two levels above package. Never downloads or installs. Executes only the unchanged installPowerlineWidgets closure with generated rendering dependencies and the real desktop wrapper.");
    process.exit(0);
  }
  assert.equal(process.argv.length, 4);
  assert.equal(process.argv[2], "--footer-dir");
  const sourceDir = fs.realpathSync(path.resolve(process.argv[3]));
  const resultsRoot = path.join(project, "test-results/pilaude");
  assert.ok(fs.statSync(resultsRoot).isDirectory());
  const artifacts = fs.mkdtempSync(path.join(resultsRoot, "powerline-footer-contract-"));
  for (const folder of ["workspace", "home", "agent", "tmp", "xdg"]) fs.mkdirSync(path.join(artifacts, folder));
  const environment = Object.fromEntries(["SystemRoot", "WINDIR", "COMSPEC"].filter(key => process.env[key]).map(key => [key, process.env[key]]));
  Object.assign(environment, {
    HOME: path.join(artifacts, "home"), USERPROFILE: path.join(artifacts, "home"),
    APPDATA: path.join(artifacts, "home"), LOCALAPPDATA: path.join(artifacts, "home"),
    XDG_CONFIG_HOME: path.join(artifacts, "xdg"), XDG_DATA_HOME: path.join(artifacts, "xdg"), XDG_CACHE_HOME: path.join(artifacts, "xdg"),
    PI_CODING_AGENT_DIR: path.join(artifacts, "agent"),
    TEMP: path.join(artifacts, "tmp"), TMP: path.join(artifacts, "tmp"), TMPDIR: path.join(artifacts, "tmp"),
    NODE_ENV: "test", JITI_FS_CACHE: "false", JITI_MODULE_CACHE: "false", DO_NOT_TRACK: "1",
  });
  const result = spawnSync(process.execPath, [
    "--permission", `--allow-fs-read=${project}`, `--allow-fs-read=${sourceDir}`,
    `--allow-fs-read=${path.resolve(sourceDir, "../..")}`, `--allow-fs-read=${path.dirname(process.execPath)}`,
    `--allow-fs-write=${artifacts}`, filename, "--isolated-child", sourceDir, artifacts,
  ], { cwd: path.join(artifacts, "workspace"), env: environment, encoding: "utf8", timeout: 45_000, maxBuffer: 1_000_000 });
  fs.writeFileSync(path.join(artifacts, "stdout.log"), result.stdout ?? "");
  fs.writeFileSync(path.join(artifacts, "stderr.log"), result.stderr ?? "");
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  console.log(`Evidence: ${path.relative(project, artifacts).replaceAll(path.sep, "/")}`);
  assert.equal(result.error, undefined, result.error?.message);
  assert.equal(result.status, 0, "Isolated powerline registration check failed");
} else {
  const sourceDir = path.resolve(process.argv[3]);
  const artifacts = path.resolve(process.argv[4]);
  const require = createRequire(path.join(project, "package.json"));
  const attempts = [];
  const forbid = kind => () => { attempts.push(kind); throw new Error(`Compatibility check prohibits ${kind}`); };
  globalThis.fetch = forbid("fetch");
  for (const [name, methods] of [
    ["node:child_process", ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]],
    ["node:http", ["request", "get", "createServer"]], ["node:https", ["request", "get", "createServer"]],
    ["node:net", ["connect", "createConnection", "createServer"]], ["node:tls", ["connect", "createServer"]],
    ["node:dgram", ["createSocket"]], ["node:dns", ["lookup", "resolve", "resolve4", "resolve6"]],
    ["node:dns/promises", ["lookup", "resolve", "resolve4", "resolve6"]],
  ]) {
    const builtin = require(name);
    for (const method of methods) builtin[method] = forbid(`${name}.${method}`);
  }
  syncBuiltinESMExports();
  const report = {
    status: "running", kind: "unchanged-widget-registration-with-fixture-primary-renderer", pin,
    sdk: "1.3.0", checkedSource: [], checks: [], prohibitedAttempts: attempts,
    isolation: { inheritedCredentialsRemoved: true, childProcessesAllowed: false, workersAllowed: false, writesOnlyToEvidenceDirectory: true },
    limitations: [
      "Does not execute full index.ts factory, session_start or setupCustomEditor.",
      "Primary rendering is generated fixture text; no actual segment renderer, git, queue, cwd switch, vibes/model or timer is executed.",
      "Widget snapshots recover through get_state; onEvent replays blocking requests and tools, not widgets.",
      "No package installation, provider account, HTTP/SSE/React browser, native Windows UI or visual parity evidence.",
    ],
  };
  const reportPath = path.join(artifacts, "result.json");
  const check = async (name, run) => { await run(); report.checks.push({ name, status: "passed" }); };
  try {
    assert.equal(process.permission.has("child"), false);
    assert.equal(process.permission.has("worker"), false);
    assert.equal(process.permission.has("fs.write", project), false);
    const archivePath = path.resolve(sourceDir, "../../published.tgz");
    const archive = fs.readFileSync(archivePath);
    assert.equal(`sha512-${createHash("sha512").update(archive).digest("base64")}`, pin.integrity);
    const tar = gunzipSync(archive, { maxOutputLength: 16 * 1024 * 1024 });
    const entries = new Map();
    for (let offset = 0; offset + 512 <= tar.length;) {
      const header = tar.subarray(offset, offset + 512);
      if (header.every(byte => byte === 0)) break;
      const field = (start, size) => header.subarray(start, start + size).toString("utf8").split("\0")[0];
      const name = [field(345, 155), field(0, 100)].filter(Boolean).join("/");
      const type = field(156, 1);
      assert.ok(name.startsWith("package/") && !name.includes("\\") && !name.split("/").some(part => part === ".." || part === "."));
      assert.ok(["", "0", "5"].includes(type), "No archive links or executable entry types");
      const size = Number.parseInt(field(124, 12).trim() || "0", 8);
      assert.ok(Number.isSafeInteger(size) && size >= 0 && offset + 512 + size <= tar.length);
      if (type !== "5") {
        assert.ok(!entries.has(name));
        entries.set(name, tar.subarray(offset + 512, offset + 512 + size));
      }
      offset += 512 + Math.ceil(size / 512) * 512;
    }
    const manifest = JSON.parse(entries.get("package/package.json").toString("utf8"));
    assert.equal(manifest.name, pin.name);
    assert.equal(manifest.version, pin.version);
    const sourcePath = path.join(sourceDir, "index.ts");
    assert.equal(fs.realpathSync(sourcePath).toLowerCase(), sourcePath.toLowerCase());
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.ok(source === entries.get("package/index.ts").toString("utf8"), "Reviewed source does not match the pinned archive");
    const ts = require("typescript");
    const ast = ts.createSourceFile("footer.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    const matches = [];
    const visit = node => {
      if (ts.isFunctionDeclaration(node) && node.name?.text === "installPowerlineWidgets") matches.push(node);
      ts.forEachChild(node, visit);
    };
    visit(ast);
    assert.equal(matches.length, 1);
    const fragment = matches[0].getText(ast);
    report.checkedSource.push({ file: "index.ts", fullFileSha256: sha256(source), fragment: "installPowerlineWidgets", fragmentSha256: sha256(fragment), originalArchiveMatched: true });
    const javascript = ts.transpileModule(fragment, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
    const { createJiti } = require("jiti");
    const jiti = createJiti(filename, { fsCache: false, moduleCache: false, tsconfigPaths: true });
    const { AgentSessionWrapper } = await jiti.import(path.join(project, "lib/rpc-manager.ts"));
    assert.equal(JSON.parse(fs.readFileSync(path.join(project, "node_modules/@earendil-works/pi-coding-agent/package.json"), "utf8")).version, "1.3.0");
    for (const placement of ["above", "below"]) {
      let ui;
      let disposed = 0;
      const inner = {
        sessionId: `generated-footer-${randomUUID()}`, isStreaming: false, isCompacting: false, isBashRunning: false, isIdle: true,
        sessionManager: { getCwd: () => path.join(artifacts, "workspace") }, agent: { state: {} }, extensionRunner: {},
        getContextUsage: () => null, getSteeringMessages: () => [], getFollowUpMessages: () => [],
        async bindExtensions(bindings) { assert.equal(bindings.mode, "rpc"); ui = bindings.uiContext; },
        dispose() { disposed += 1; },
      };
      const wrapper = new AgentSessionWrapper(inner);
      const events = [];
      wrapper.onEvent(event => events.push(event));
      try {
        wrapper.beginExtensionBinding();
        await wrapper.waitUntilReady();
        let text = "Generated model/context";
        let renders = 0;
        let failRender = false;
        const unexpected = name => () => { throw new Error(`Unexpected TUI-only dependency: ${name}`); };
        const context = vm.createContext({
          editorPerf: { options: { widgets: true, enabled: false, bashWidgets: true, lastPrompt: true } }, config: { placement },
          resetLayoutCache() {},
          renderPowerlinePrimaryLines(width) { renders += 1; if (failRender) throw new Error("Generated primary renderer failure"); return [`${text} (${width})`]; },
          renderPowerlineStatusLines: unexpected("status"), renderBashTranscriptLines: unexpected("bash"),
          renderPendingSendLines: unexpected("pending-send"), renderPowerlineQueuePreviewLines: unexpected("queue"),
          renderLastPromptLines: unexpected("last-prompt"), requestStatusRender: unexpected("status-repaint"),
        }, { codeGeneration: { strings: false, wasm: false } });
        vm.runInContext(javascript, context, { timeout: 1000 });
        const register = () => context.installPowerlineWidgets({ mode: "rpc", ui });
        await check(`${placement}: upstream RPC closure registers only primary through real wrapper binding`, async () => {
          register();
          const rendered = events.filter(event => event.method === "setWidget" && Array.isArray(event.widgetLines));
          assert.equal(rendered.length, 1);
          assert.equal(rendered[0].widgetKey, "powerline-top");
          assert.equal(rendered[0].widgetPlacement, placement === "above" ? "aboveEditor" : "belowEditor");
          assert.equal(renders, 1);
          assert.match(rendered[0].widgetLines[0], /^Generated model\/context \(\d+\)$/);
        });
        await check(`${placement}: get_state restores snapshot without false onEvent widget replay`, async () => {
          const lateEvents = [];
          wrapper.onEvent(event => lateEvents.push(event))();
          assert.equal(lateEvents.some(event => event.method === "setWidget"), false);
          const state = await wrapper.send({ type: "get_state" });
          assert.deepEqual(state.extensionWidgets.map(widget => [widget.key, widget.placement]), [["powerline-top", placement === "above" ? "aboveEditor" : "belowEditor"]]);
        });
        await check(`${placement}: replacement and clear remove stale generated snapshots`, async () => {
          text = "Replacement fixture";
          register();
          let state = await wrapper.send({ type: "get_state" });
          assert.equal(state.extensionWidgets.length, 1);
          assert.match(state.extensionWidgets[0].lines[0], /^Replacement fixture/);
          ui.setWidget("powerline-top", undefined);
          state = await wrapper.send({ type: "get_state" });
          assert.equal(state.extensionWidgets.length, 0);
        });
        await check(`${placement}: render error reports and clears; next explicit registration recovers`, async () => {
          failRender = true;
          register();
          assert.ok(events.some(event => event.type === "extension_error" && event.extensionPath === "extension-widget:powerline-top"));
          assert.equal((await wrapper.send({ type: "get_state" })).extensionWidgets.length, 0);
          failRender = false;
          register();
          assert.equal((await wrapper.send({ type: "get_state" })).extensionWidgets.length, 1);
        });
        await check(`${placement}: wrapper disposal closes stream and refuses late factory registration`, async () => {
          wrapper.destroy();
          assert.equal(await wrapper.waitUntilDisposed(1000), true);
          assert.equal(disposed, 1);
          assert.equal(wrapper.isAlive(), false);
          assert.ok(events.some(event => event.type === "session_shutdown"));
          const count = events.length;
          register();
          assert.equal(events.length, count);
          wrapper.destroy();
          assert.equal(disposed, 1);
        });
      } finally { wrapper.destroy(); }
    }
    assert.deepEqual(attempts, []);
    report.status = "passed";
  } catch {
    report.status = "failed";
    report.error = "The isolated powerline registration check failed.";
    throw new Error(report.error);
  } finally {
    fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify({ status: report.status, passed: report.checks.length, prohibitedAttempts: attempts, result: path.relative(project, reportPath).replaceAll(path.sep, "/") }));
  }
}
