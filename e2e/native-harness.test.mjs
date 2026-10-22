import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { after, describe, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import {
  CHECKS, DPI_LABELS, EXIT, HarnessError, assertInside, cleanupOwned, descendantsOf, formatCheckList, inspectDesktopLog,
  listProcesses, normalizeRequestPath, taskkillArgs, ownedProcesses, parseArgs, parseBaseOrigin, parseDpiLabel, parseProbeOutput, processKey, readPng, runBaseline,
  runProbe, startFixtureProxy,
} from "./native-harness.mjs";

const CLI = fileURLToPath(new URL("./native-baseline.mjs", import.meta.url));
const windowsOnly = process.platform === "win32" ? test : () => {};
const temp = mkdtempSync(path.join(os.tmpdir(), "native-harness-test-"));
after(() => rmSync(temp, { recursive: true, force: true }));

const SLEEPER = "setInterval(() => {}, 1000)";
const spawnSleeper = (extra = "") => spawn(process.execPath, ["-e", `${extra}${SLEEPER}`], { stdio: "ignore", windowsHide: true });
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (error) { return error.code === "EPERM"; } };
const waitDead = async (pid, ms = 5000) => { const end = Date.now() + ms; while (alive(pid) && Date.now() < end) await delay(100); return !alive(pid); };

function runCli(args) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [CLI, ...args], { windowsHide: true });
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function stubServer(handler = (request, response) => response.end("ok")) {
  const requests = [];
  const server = http.createServer((request, response) => { requests.push(`${request.method} ${request.url}`); handler(request, response); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return { origin: `http://127.0.0.1:${server.address().port}`, requests, close: () => { server.closeAllConnections(); return new Promise((resolve) => server.close(resolve)); } };
}

describe("arguments", () => {
  const ok = ["--check", "launch", "--base", "http://127.0.0.1:30142", "--out", "x"];

  test("valid arguments parse with label and defaults", () => {
    const parsed = parseArgs([...ok, "--label", "dpi150"]);
    assert.equal(parsed.check, "launch");
    assert.equal(parsed.base, "http://127.0.0.1:30142");
    assert.equal(parsed.labelPercent, 150);
    assert.equal(parsed.cdpTimeoutMs, 60000);
    assert.ok(parsed.exe.endsWith("pi-agent-desktop.exe"));
    assert.deepEqual(parseArgs(["--list"]), { list: true });
  });

  test("bad arguments are usage errors", () => {
    const bad = [
      ["--check", "bogus", "--base", "http://127.0.0.1:1", "--out", "x"],
      ["--check", "launch", "--out", "x"],
      ["--check", "launch", "--base", "http://127.0.0.1:30142"],
      ["--check", "launch", "--base", "http://localhost:30142", "--out", "x"],
      ["--check", "launch", "--base", "http://127.0.0.1:30142/path", "--out", "x"],
      ["--check", "launch", "--base", "http://user@127.0.0.1:30142", "--out", "x"],
      [...ok, "--label", "dpi999"],
      [...ok, "--cdp-timeout-ms", "10"],
      [...ok, "--nope"],
      [...ok, "--exe"],
    ];
    for (const args of bad) assert.throws(() => parseArgs(args), (error) => error instanceof HarnessError && error.exitCode === EXIT.usage, args.join(" "));
    assert.equal(parseDpiLabel("dpi175"), DPI_LABELS.dpi175);
    assert.throws(() => parseBaseOrigin("https://127.0.0.1:1"), HarnessError);
  });

  test("--list ids match the documented table", async () => {
    const { readFileSync } = await import("node:fs");
    const doc = readFileSync(new URL("../docs/pilaude-windows-regression.md", import.meta.url), "utf8");
    const section = doc.slice(doc.indexOf("Windows 原生验收基线"));
    const documented = [...section.matchAll(/^\|\s*(N\d+)\s*\|/gm)].map((match) => match[1]);
    assert.deepEqual(documented, CHECKS.map((check) => check.id));
    assert.deepEqual(formatCheckList().split("\n").map((line) => line.split("\t")[0]), documented);
  });

  test("CLI: bad arguments exit 64, missing exe exits 2 without starting anything", async () => {
    const usage = await runCli(["--check", "bogus"]);
    assert.equal(usage.code, EXIT.usage);
    assert.match(usage.stderr, /--check must be one of/);
    const dev = await stubServer();
    try {
      const before = await listProcessCount();
      const missing = await runCli(["--check", "launch", "--base", dev.origin, "--out", path.join(temp, "missing"), "--exe", path.join(temp, "no-such.exe")]);
      assert.equal(missing.code, EXIT.prerequisite);
      assert.match(missing.stderr, /cargo build --manifest-path src-tauri\/Cargo\.toml --no-default-features/);
      assert.equal(await listProcessCount(), before, "no process was started");
    } finally { await dev.close(); }
  });
});

async function listProcessCount() {
  return (await listProcesses()).filter((item) => /^(pi-agent-desktop|msedgewebview2)/i.test(item.name)).length;
}

describe("process ownership (pure)", () => {
  // A later pid means a later creation time, unless a test says otherwise.
  const at = (second) => `2026-01-01T00:00:${String(second).padStart(2, "0")}.1234567Z`;
  const p = (pid, ppid, name = "node.exe", cmd = "", second = pid) => ({ pid, ppid, name, created: at(second), cmd });
  test("descendants follow parent links and ignore siblings", () => {
    const all = [p(1, 0), p(2, 1), p(3, 2), p(4, 1), p(9, 0), p(10, 9)];
    assert.deepEqual(descendantsOf(1, all).map((item) => item.pid).sort(), [1, 2, 3, 4]);
    assert.deepEqual(descendantsOf(404, all), []);
  });

  test("a child older than its parent is a recycled ppid, not a descendant", () => {
    // pid 5 was an orphan of an earlier, dead process 1 whose pid the new root reuses.
    const all = [p(1, 0, "pi-agent-desktop.exe", "", 20), p(5, 1, "node.exe", "", 10), p(6, 1, "node.exe", "", 21), p(7, 6, "node.exe", "", 22), p(8, 6, "node.exe", "", 15)];
    assert.deepEqual(descendantsOf(1, all).map((item) => item.pid).sort((a, b) => a - b), [1, 6, 7]);
  });

  test("the root must be the process we started: a recycled root pid pulls in nothing", () => {
    const all = [p(1, 0, "svchost.exe", "", 30), p(2, 1, "node.exe", "", 31)];
    const spawnedAt = Date.parse("2026-01-01T00:00:20Z");
    assert.deepEqual(descendantsOf(1, all, { notBefore: spawnedAt }).map((item) => item.pid), [1, 2], "created after spawn: ours");
    assert.deepEqual(descendantsOf(1, all, { notBefore: Date.parse("2026-01-01T00:00:40Z") }), [], "created before spawn: someone else's");
    assert.deepEqual(descendantsOf(1, all, { rootCreated: at(99) }), [], "different creation time than the root we saw");
    // Root already gone: only children created after the spawn count as its orphans.
    const orphans = [p(3, 1, "msedgewebview2.exe", "", 5), p(4, 1, "msedgewebview2.exe", "", 25)];
    assert.deepEqual(descendantsOf(1, orphans, { notBefore: spawnedAt }).map((item) => item.pid), [4]);
  });

  test("any pre-existing process, not only Pilaude or WebView2, is excluded", () => {
    const all = [p(1, 0, "pi-agent-desktop.exe", "", 20), p(2, 1, "node.exe", "", 21), p(3, 1, "node.exe", "", 5)];
    const owned = ownedProcesses({ rootPid: 1, processes: all, preexisting: new Set(all.map(processKey).slice(2)) });
    assert.deepEqual(owned.map((item) => item.pid).sort(), [1, 2]);
  });

  test("orphaned WebView2 with our profile folder is owned; pre-existing and others are not", () => {
    const profile = "C:\\Temp\\pilaude-native-webview-abc";
    const all = [
      p(1, 0, "pi-agent-desktop.exe"), p(2, 1, "msedgewebview2.exe"),
      p(7, 99, "msedgewebview2.exe", `--user-data-dir=${profile}\\EBWebView`), // re-parented orphan
      p(8, 99, "msedgewebview2.exe", "--user-data-dir=C:\\Other"), // someone else's
      p(9, 99, "msedgewebview2.exe", `--user-data-dir=${profile}`), // ours but pre-existing key
    ];
    const owned = ownedProcesses({ rootPid: 1, profileDir: profile, processes: all, preexisting: new Set([processKey(all[4])]) });
    assert.deepEqual(owned.map((item) => item.pid).sort((a, b) => a - b), [1, 2, 7]);
  });

  test("residual is reported when a kill does not take effect, and pre-existing processes are never killed", async () => {
    const all = [p(1, 0, "pi-agent-desktop.exe"), p(2, 1, "msedgewebview2.exe"), p(50, 1, "msedgewebview2.exe")];
    const killed = [];
    const result = await cleanupOwned({
      known: [all[0]], profileDir: undefined, preexisting: new Set([processKey(all[2])]),
      list: async () => all, kill: async (pid) => { killed.push(pid); }, graceMs: 400, pollMs: 50,
    });
    assert.deepEqual(result.residual.map((item) => item.pid).sort(), [1, 2]);
    assert.ok(!killed.includes(50), "pre-existing child stays untouched");
    assert.ok(killed.includes(1));
    assert.ok(killed.indexOf(2) < killed.indexOf(1), "children die before their parent");
  });

  test("taskkill never expands the tree itself (no /T)", () => {
    assert.deepEqual(taskkillArgs(42), ["/PID", "42", "/F"]);
  });

  const noop = { profileDir: undefined, graceMs: 300, pollMs: 50 };

  test("root pid recycled after the app exited: the new owner is neither killed nor expanded", async () => {
    const started = p(10, 1, "pi-agent-desktop.exe", "", 20);
    // The app is gone; pid 10 now belongs to an unrelated process (created later, other parent) with a child.
    const all = [p(10, 777, "powershell.exe", "", 40), p(11, 10, "node.exe", "", 41)];
    const killed = [];
    const result = await cleanupOwned({ ...noop, known: [started], preexisting: new Set(), list: async () => all, kill: async (pid) => { killed.push(pid); } });
    assert.deepEqual(killed, []);
    assert.deepEqual(result.residual, []);
  });

  test("root never recorded (exited before any snapshot): its pid is not treated as a root", async () => {
    const all = [p(10, 777, "powershell.exe", "", 40), p(11, 10, "node.exe", "", 41)];
    const killed = [];
    await cleanupOwned({ ...noop, known: [], preexisting: new Set(), list: async () => all, kill: async (pid) => { killed.push(pid); } });
    assert.deepEqual(killed, []);
  });

  test("descendant pid recycled between iterations is not killed", async () => {
    const root = p(10, 1, "pi-agent-desktop.exe", "", 20);
    const child = p(50, 10, "msedgewebview2.exe", "", 21);
    const snapshots = [[root, child], [p(50, 777, "chrome.exe", "", 60)], []];
    const killed = [];
    const result = await cleanupOwned({
      ...noop, graceMs: 2000, known: [root], preexisting: new Set(),
      list: async () => snapshots.length > 1 ? snapshots.shift() : snapshots[0],
      kill: async (pid) => { killed.push(pid); },
    });
    assert.deepEqual(killed, [50, 10], "each owned key killed once, child first; the recycled pid 50 is left alone later");
    assert.deepEqual(result.residual, []);
  });

  test("a live recorded root expands to descendants and kills them one pid at a time", async () => {
    const root = p(10, 1, "pi-agent-desktop.exe", "", 20);
    const all = [root, p(11, 10, "node.exe", "", 21), p(12, 11, "node.exe", "", 22), p(13, 12, "node.exe", "", 5)];
    const killed = [];
    await cleanupOwned({ ...noop, known: [root], preexisting: new Set(), list: async () => all, kill: async (pid) => { killed.push(pid); } });
    assert.deepEqual(killed, [12, 11, 10], "grandchild first; pid 13 predates its parent so it is a recycled ppid");
  });
});

describe("process cleanup (real processes)", () => {
  windowsOnly("kills the started tree incl. grandchildren in 5 s and spares an unrelated decoy", async () => {
    const decoy = spawnSleeper();
    const root = spawnSleeper(`require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(SLEEPER)}], { stdio: "ignore" });`);
    await delay(1500);
    const tree = descendantsOf(root.pid, await listProcesses());
    assert.ok(tree.length >= 2, "root has a grandchild");
    const started = Date.now();
    const result = await cleanupOwned({ known: tree, profileDir: undefined, preexisting: new Set() });
    try {
      assert.ok(Date.now() - started < 5500);
      assert.deepEqual(result.residual, []);
      for (const item of tree) assert.equal(await waitDead(item.pid, 1000), true, `pid ${item.pid} is gone`);
      assert.equal(alive(decoy.pid), true, "decoy outside the tree survives");
    } finally { decoy.kill(); }
  });
});

describe("runBaseline failure paths (fake exe, real process cleanup)", () => {
  const fakeCdp = `const http = require("http");
const match = /--remote-debugging-port=(\\d+)/.exec(process.env.WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS || "");
require("child_process").spawn(process.execPath, ["-e", ${JSON.stringify(SLEEPER)}], { stdio: "ignore" });
http.createServer((req, res) => res.end(JSON.stringify({ Browser: "Fake/1" }))).listen(Number(match[1]), "127.0.0.1");
${SLEEPER}`;
  const base = (extra) => ({ check: "launch", out: path.join(temp, `run-${Math.random().toString(16).slice(2)}`), exe: process.execPath, ...extra });

  async function assertTreeGone(report) {
    assert.deepEqual(report.hygiene.residual, []);
    assert.equal(report.hygiene.preexistingTouched, 0);
    for (const pid of report.hygiene.killedPids) assert.equal(await waitDead(pid, 1000), true, `pid ${pid} still alive`);
  }

  windowsOnly("CDP port never ready: fails with stderr summary and no residual processes", async () => {
    const dev = await stubServer();
    const decoy = spawnSleeper();
    try {
      const { exitCode, report } = await runBaseline(base({
        base: dev.origin, cdpTimeoutMs: 1500, exeArgs: ["-e", `console.error("boom-from-shell"); ${SLEEPER}`],
      }));
      assert.equal(exitCode, EXIT.failed);
      assert.equal(report.status, "failed");
      assert.match(report.failure, /CDP port/);
      assert.match(report.failure, /boom-from-shell/);
      assert.ok(report.hygiene.killedPids.length >= 1);
      await assertTreeGone(report);
      assert.equal(alive(decoy.pid), true, "pre-existing decoy survives");
      assert.equal(report.realApiRequests, 0);
    } finally { decoy.kill(); await dev.close(); }
  });

  windowsOnly("app exiting before CDP: reported early, its recycled pid is never used to kill anything", async () => {
    const dev = await stubServer();
    const decoy = spawnSleeper();
    try {
      const { exitCode, report } = await runBaseline(base({ base: dev.origin, cdpTimeoutMs: 5000, exeArgs: ["-e", "process.exit(3)"] }));
      assert.equal(exitCode, EXIT.failed);
      assert.match(report.failure, /exited early with code 3/);
      assert.deepEqual(report.hygiene.killedPids, []);
      assert.equal(report.hygiene.preexistingTouched, 0);
      assert.equal(alive(decoy.pid), true);
    } finally { decoy.kill(); await dev.close(); }
  });

  windowsOnly("exception after launch still cleans the whole tree (child + grandchild)", async () => {
    const dev = await stubServer();
    try {
      const { exitCode, report } = await runBaseline(base({
        base: dev.origin, cdpTimeoutMs: 10000, exeArgs: ["-e", fakeCdp],
        hooks: { afterLaunch: async () => { await delay(800); throw new Error("boom-in-hook"); } },
      }));
      assert.equal(exitCode, EXIT.failed);
      assert.match(report.failure, /boom-in-hook/);
      assert.equal(report.launch.webview2, "Fake/1");
      assert.ok(report.hygiene.killedPids.length >= 2, "root and grandchild were both killed");
      await assertTreeGone(report);
    } finally { await dev.close(); }
  });

  // The abort fires from a hook, so it lands at a known point instead of after a timer.
  const NEVER = new Promise(() => {});
  const marker = () => path.join(temp, `spawned-${Math.random().toString(16).slice(2)}`);
  const markerScript = (file) => `require("fs").writeFileSync(${JSON.stringify(file)}, "x");`;

  windowsOnly("an interrupt after launch still cleans the whole tree and exits through the report", async () => {
    const dev = await stubServer();
    const controller = new AbortController();
    try {
      const { exitCode, report } = await runBaseline(base({
        base: dev.origin, cdpTimeoutMs: 30000, signal: controller.signal, exeArgs: ["-e", fakeCdp],
        hooks: { afterLaunch: () => { controller.abort(); return NEVER; } },
      }));
      assert.equal(exitCode, EXIT.failed);
      assert.match(report.failure, /interrupted/);
      assert.equal(report.launch.webview2, "Fake/1");
      assert.ok(report.hygiene.killedPids.length >= 2, "root and grandchild were killed");
      await assertTreeGone(report);
    } finally { await dev.close(); }
  });

  windowsOnly("an interrupt between proxy start and spawn never spawns and closes the proxy", async () => {
    const dev = await stubServer();
    const controller = new AbortController();
    const spawned = marker();
    let proxyOrigin;
    try {
      const { exitCode, report } = await runBaseline(base({
        base: dev.origin, signal: controller.signal, exeArgs: ["-e", `${markerScript(spawned)}${SLEEPER}`],
        hooks: { beforeSpawn: ({ proxy }) => { proxyOrigin = proxy.origin; controller.abort(); return NEVER; } },
      }));
      assert.equal(exitCode, EXIT.failed);
      assert.match(report.failure, /interrupted/);
      assert.equal(report.launch.pid, undefined, "no pid: nothing was spawned");
      assert.deepEqual(report.hygiene.killedPids, []);
      await delay(1500);
      assert.equal(existsSync(spawned), false, "the exe never ran");
      await assert.rejects(fetch(`${proxyOrigin}/`), "the proxy was closed");
      assert.equal(report.realApiRequests, 0);
    } finally { await dev.close(); }
  });

  windowsOnly("a signal that is already aborted stops the run before anything starts", async () => {
    const dev = await stubServer();
    const spawned = marker();
    try {
      await assert.rejects(
        runBaseline(base({ base: dev.origin, signal: AbortSignal.abort(), exeArgs: ["-e", `${markerScript(spawned)}${SLEEPER}`] })),
        (error) => error instanceof HarnessError && /interrupted/.test(error.message),
      );
      await delay(1000);
      assert.equal(existsSync(spawned), false);
      assert.deepEqual(dev.requests, [], "not even the reachability probe was sent");
    } finally { await dev.close(); }
  });

  windowsOnly("a dev server that is not running is a prerequisite error before any launch", async () => {
    const dev = await stubServer();
    const origin = dev.origin;
    await dev.close();
    await assert.rejects(runBaseline(base({ base: origin })), (error) => error instanceof HarnessError && error.exitCode === EXIT.prerequisite && /not reachable/.test(error.message));
  });

  windowsOnly("a wrong DPI label exits 3 before launching anything", async () => {
    const dev = await stubServer();
    try {
      const [system] = await runProbe({ action: "dpi" });
      const wrong = Object.entries(DPI_LABELS).find(([, percent]) => percent !== system.primaryMonitorScalePercent)[0];
      const before = await listProcessCount();
      const run = await runCli(["--check", "window", "--base", dev.origin, "--out", path.join(temp, "label"), "--exe", process.execPath, "--label", wrong]);
      assert.equal(run.code, EXIT.labelMismatch);
      assert.match(run.stderr, /does not match the measured display scale/);
      assert.equal(await listProcessCount(), before);
    } finally { await dev.close(); }
  });
});

describe("fixture proxy", () => {
  test("passes non-API paths through and answers /api from fixtures without ever reaching upstream", async () => {
    const upstream = await stubServer((request, response) => response.end(`upstream:${request.url}`));
    const proxy = await startFixtureProxy({ upstream: upstream.origin });
    try {
      assert.equal(await (await fetch(`${proxy.origin}/_next/static/app.js`)).text(), "upstream:/_next/static/app.js");
      const home = await fetch(`${proxy.origin}/api/home`);
      assert.equal(home.status, 200);
      assert.ok((await home.json()).home);
      const write = await fetch(`${proxy.origin}/api/sessions/a`, { method: "DELETE" });
      assert.equal(write.status, 409);
      const sse = await fetch(`${proxy.origin}/api/agent/a/events`);
      assert.equal(sse.headers.get("content-type"), "text/event-stream");
      await sse.body.cancel();
      assert.deepEqual(upstream.requests, ["GET /_next/static/app.js"], "no /api request reached the real server");
      assert.equal(proxy.counters.realApiRequests, 0, "nothing needed refusing");
      assert.equal(proxy.counters.blockedWrites, 1);
      assert.ok(proxy.counters.fixtureApiRequests >= 3);
    } finally { await proxy.close(); await upstream.close(); }
  });

  test("proxy listens on loopback only", async () => {
    const upstream = await stubServer();
    const proxy = await startFixtureProxy({ upstream: upstream.origin });
    try {
      assert.equal(proxy.host, "127.0.0.1");
      const other = Object.values(os.networkInterfaces()).flat().find((entry) => entry && entry.family === "IPv4" && !entry.internal);
      if (other) {
        await assert.rejects(fetch(`http://${other.address}:${proxy.port}/`, { signal: AbortSignal.timeout(3000) }), "not reachable through a non-loopback address");
      }
    } finally { await proxy.close(); await upstream.close(); }
  });

  test("API paths that dodge the router are refused, counted and never forwarded", async () => {
    const upstream = await stubServer((request, response) => response.end("upstream"));
    const proxy = await startFixtureProxy({ upstream: upstream.origin });
    const raw = (target) => new Promise((resolve, reject) => {
      const request = http.request({ host: "127.0.0.1", port: proxy.port, path: target, method: "GET" }, (response) => {
        response.resume();
        response.once("end", () => resolve(response.statusCode));
      });
      request.once("error", reject);
      request.end();
    });
    const bypasses = ["//api/x", "/%61pi/x", "/%2561pi/x", "/API/x", "/\\api/x", "///api", "/api%2Fx", "/%2e/%61pi/x"];
    try {
      for (const [index, target] of bypasses.entries()) {
        assert.equal(await raw(target), 403, target);
        assert.equal(proxy.counters.realApiRequests, index + 1, `${target} counted`);
      }
      for (const target of ["/./api/x", "/foo/../api/x", "/foo/%2e%2e/api/x"]) assert.equal(await raw(target), 200, `${target} is resolved by the router into a fixture, not upstream`);
      assert.deepEqual(upstream.requests, [], "no bypass reached the real server");
      assert.equal(await raw("/_next/static/a.js?next=/api/x"), 200, "a query string mentioning /api is not an API path");
      assert.equal(await raw("/apix/readme"), 200, "neither is a longer first segment");
      assert.deepEqual(upstream.requests, ["GET /_next/static/a.js?next=/api/x", "GET /apix/readme"]);
      assert.equal(proxy.counters.realApiRequests, bypasses.length);
    } finally { await proxy.close(); await upstream.close(); }
  });

  test("path normalization resolves the shapes a server would route to /api", () => {
    for (const target of ["/api/x", "//api/x", "/%61pi/x", "/API", "/a/../api/x?q=1", "http://h/api/x#f"]) assert.match(normalizeRequestPath(target), /^\/api(\/|$)/, target);
    for (const target of ["/", "/apix", "/_next/api/x", "/x?/api/y", "/%zzapi/x"]) assert.doesNotMatch(normalizeRequestPath(target), /^\/api(\/|$)/, target);
  });
});

describe("probe output and path safety", () => {
  test("probe JSON parsing rejects garbage and non-arrays", () => {
    assert.deepEqual(parseProbeOutput("[]"), []);
    assert.equal(parseProbeOutput('[{"handle":1}]')[0].handle, 1);
    assert.throws(() => parseProbeOutput("not json"), /invalid JSON/);
    assert.throws(() => parseProbeOutput('{"handle":1}'), /JSON array/);
  });

  test("capture paths must be plain probe file names inside the capture directory", () => {
    const dir = path.join(temp, "captures");
    assert.equal(assertInside(dir, path.join(dir, "os-window-123.png")), path.join(dir, "os-window-123.png"));
    for (const bad of [path.join(dir, "..", "os-window-1.png"), path.join(dir, "sub", "os-window-1.png"), path.join(dir, "evil.png"), path.join(temp, "os-window-1.png"), dir]) {
      assert.throws(() => assertInside(dir, bad), HarnessError, bad);
    }
  });

  windowsOnly("probe: no windows -> empty array; missing process -> explicit error; unwritable capture dir -> error", async () => {
    const sleeper = spawnSleeper();
    try {
      await delay(300);
      assert.deepEqual(await runProbe({ pid: sleeper.pid }), []);
      await assert.rejects(runProbe({ pid: 2147483000 }), /does not exist/);
      const blocker = path.join(temp, "not-a-directory");
      writeFileSync(blocker, "x");
      await assert.rejects(runProbe({ pid: sleeper.pid, captureDirectory: path.join(blocker, "sub") }), /not writable/);
    } finally { sleeper.kill(); }
  });

  windowsOnly("probe: window actions refuse handles of other processes", async () => {
    const sleeper = spawnSleeper();
    try {
      await delay(300);
      await assert.rejects(runProbe({ pid: sleeper.pid, action: "close", handle: 65552 }), /does not belong|no visible window/);
      await assert.rejects(runProbe({ pid: sleeper.pid, action: "move", x: 0, y: 0 }), /no visible window/);
    } finally { sleeper.kill(); }
  });
});

describe("png and log helpers", () => {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buffer) => { let c = 0xffffffff; for (const byte of buffer) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const head = Buffer.alloc(8); head.writeUInt32BE(data.length, 0); head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4); tail.writeUInt32BE(crc(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const png = (width, height, pixel) => {
    const header = Buffer.alloc(13); header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
    const rows = [];
    for (let y = 0; y < height; y += 1) { rows.push(Buffer.from([0])); for (let x = 0; x < width; x += 1) rows.push(Buffer.from(pixel(x, y))); }
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
  };

  test("readPng reports exact dimensions and near-zero variance for a solid image", () => {
    const info = readPng(png(7, 5, () => [200, 200, 200, 255]));
    assert.deepEqual([info.width, info.height], [7, 5]);
    assert.ok(info.stdDev < 0.001);
  });

  test("readPng reports high variance for a patterned image", () => {
    assert.ok(readPng(png(8, 8, (x, y) => ((x + y) % 2 ? [255, 255, 255, 255] : [0, 0, 0, 255]))).stdDev > 100);
  });

  test("readPng rejects non-PNG input", () => {
    assert.throws(() => readPng(Buffer.from("nope")), HarnessError);
  });

  test("desktop log inspection finds startup and panic", () => {
    assert.deepEqual(inspectDesktopLog("startup timing: x"), { hasStartup: true, hasPanic: false, bytes: 17 });
    assert.equal(inspectDesktopLog("startup\nthread panicked").hasPanic, true);
    assert.equal(inspectDesktopLog("").hasStartup, false);
  });
});
