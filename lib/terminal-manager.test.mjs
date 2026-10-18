import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createJiti } from "jiti";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../", import.meta.url)) } });
const { createTerminal, getTerminalCwd, hasTerminal, killTerminal, subscribeTerminal } = await jiti.import("./terminal-manager.ts");
const { GET } = await jiti.import("../app/api/terminal/[id]/events/route.ts");
const require = createRequire(import.meta.url);
const paths = await jiti.import("./paths.ts");
const source = readFileSync(new URL("./terminal-manager.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });

function isolatedManager(t, { env = process.env, platform = process.platform, loadPty } = {}) {
  const spawnCalls = [];
  const ptys = [];
  const sandbox = {
    exports: {},
    process: { ...process, env, platform, once() {} },
    setTimeout,
    clearTimeout,
    console,
    require(id) {
      if (id === "./paths") return paths;
      if (id !== "node-pty") return require(id);
      if (loadPty) return loadPty();
      return { spawn(...args) {
        spawnCalls.push(args);
        const exitListeners = new Set();
        const pty = {
          onData() {},
          onExit(listener) { exitListeners.add(listener); },
          write() {},
          resize() {},
          kill: t.mock.fn(),
          emitExit(exitCode) {
            for (const listener of exitListeners) listener({ exitCode });
          },
        };
        ptys.push(pty);
        return pty;
      } };
    },
  };
  // Each VM owns its registry and timers; no native worker or exit event can
  // participate when a lease test advances the clock.
  runInNewContext(outputText, sandbox);
  t.after(() => {
    for (const id of sandbox.__piWebTerminals?.keys() ?? []) sandbox.exports.killTerminal(id, true);
  });
  return { manager: sandbox.exports, spawnCalls, ptys, record: (id) => sandbox.__piWebTerminals.get(id) };
}

async function waitForNativeState(predicate, message) {
  const deadline = performance.now() + 10_000;
  while (!predicate()) {
    assert.ok(performance.now() < deadline, message);
    await delay(10);
  }
}

async function nativeTerminal(t) {
  const id = createTerminal(process.cwd(), 80, 24);
  const record = globalThis.__piWebTerminals.get(id);
  t.after(async () => {
    killTerminal(id);
    // Drain the actual exit callback before another test can replace timers.
    await waitForNativeState(() => record.exited, "native PTY did not exit after cleanup");
    assert.equal(hasTerminal(id), false);
  });
  // ConPTY publishes the PID asynchronously; its first output also releases
  // node-pty's deferred writes/kills. Unix PTYs satisfy the same condition.
  await waitForNativeState(
    () => (record.pty.pid > 0 && record.offset > 0) || record.exited,
    "native PTY did not initialize its PID and produce output",
  );
  assert.equal(record.exited, false, `native PTY exited during startup (${record.exitCode})`);
  return { id, record };
}

test("native module load failures are deferred until creation and include repair instructions", (t) => {
  const { manager } = isolatedManager(t, { loadPty() { throw new Error("Cannot find module pty.node"); } });
  assert.equal(manager.hasTerminal("missing"), false);
  assert.throws(() => manager.createTerminal(process.cwd(), 80, 24), (error) => {
    assert.match(error.message, /native terminal module/);
    assert.match(error.message, /npm rebuild node-pty --build-from-source --ignore-scripts=false --foreground-scripts/);
    assert.match(error.message, /Cannot find module pty.node/);
    return true;
  });
});

test("shell environment defaults to UTF-8 locale when the host has none", (t) => {
  const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !["LANG", "LC_ALL", "LC_CTYPE"].includes(k)));
  const { manager, spawnCalls } = isolatedManager(t, { env });
  manager.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0][2].env.LANG, "C.UTF-8");
});

test("shell environment preserves a case-insensitive Windows locale", (t) => {
  const rawEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !["lang", "lc_all", "lc_ctype"].includes(key.toLowerCase())));
  rawEnv.lang = "zh_CN.UTF-8";
  const env = new Proxy(rawEnv, {
    get(target, key) {
      if (typeof key !== "string") return Reflect.get(target, key);
      const match = Object.keys(target).find((candidate) => candidate.toLowerCase() === key.toLowerCase());
      return match ? target[match] : undefined;
    },
  });
  const { manager, spawnCalls } = isolatedManager(t, { env, platform: "win32" });
  manager.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0][2].env.lang, "zh_CN.UTF-8");
  assert.equal("LANG" in spawnCalls[0][2].env, false);
});

test("shell environment omits the web login password", (t) => {
  const env = { ...process.env, PI_WEB_PASSWORD: "web-login-password", PI_USER_SETTING: "preserved" };
  const { manager, spawnCalls } = isolatedManager(t, { env });
  manager.createTerminal(process.cwd(), 80, 24);
  assert.equal(spawnCalls.length, 1);
  assert.equal("PI_WEB_PASSWORD" in spawnCalls[0][2].env, false);
  assert.equal(spawnCalls[0][2].env.PI_USER_SETTING, "preserved");
});

for (const { name, env, expected } of [
  { name: "SystemRoot", env: { SystemRoot: "D:\\Test Windows" }, expected: "D:/Test Windows/System32/WindowsPowerShell/v1.0/powershell.exe" },
  { name: "the default Windows root", env: {}, expected: "C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe" },
]) {
  test(`Windows shells use system PowerShell from ${name} regardless of SHELL or ComSpec`, (t) => {
    const { manager, spawnCalls } = isolatedManager(t, {
      platform: "win32",
      env: { ...env, SHELL: "C:\\Git\\bin\\bash.exe", ComSpec: "C:\\Windows\\System32\\cmd.exe" },
    });
    manager.createTerminal(process.cwd(), 80, 24);
    assert.equal(spawnCalls.length, 1);
    assert.equal(spawnCalls[0][0].replaceAll("\\", "/"), expected);
    assert.deepEqual(Array.from(spawnCalls[0][1]), []);
  });
}

test("native PTY starts after install and repeated creation reuses the same workspace process", async (t) => {
  const { id, record } = await nativeTerminal(t);
  assert.ok(record.pty.pid > 0);
  assert.equal(getTerminalCwd(id), process.cwd());
  assert.equal(createTerminal(process.cwd(), 100, 30, id), id);
  assert.strictEqual(globalThis.__piWebTerminals.get(id), record);
  assert.throws(() => createTerminal(process.cwd() + "/other", 80, 24, id), /different workspace/);
  assert.ok(record.cleanupTimer, "unclaimed creations have a lease");
});

test("connected terminals outlive the grace period; only the last disconnect starts expiry", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { manager, ptys } = isolatedManager(t);
  const { createTerminal, hasTerminal, subscribeTerminal, TERMINAL_RECONNECT_MS } = manager;
  const id = createTerminal(process.cwd(), 80, 24);
  const first = subscribeTerminal(id, () => {});
  const second = subscribeTerminal(id, () => {});
  first.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS * 2);
  assert.ok(hasTerminal(id));
  second.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS - 1);
  assert.ok(hasTerminal(id));
  const resumed = subscribeTerminal(id, () => {});
  t.mock.timers.tick(TERMINAL_RECONNECT_MS);
  assert.ok(hasTerminal(id));
  resumed.unsubscribe();
  t.mock.timers.tick(TERMINAL_RECONNECT_MS - 1);
  assert.ok(hasTerminal(id));
  assert.equal(ptys[0].kill.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(hasTerminal(id), false);
  assert.equal(ptys[0].kill.mock.callCount(), 1);
});

test("unclaimed creations expire without requiring a browser cleanup request", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { manager, ptys, record } = isolatedManager(t);
  const { createTerminal, hasTerminal, TERMINAL_RECONNECT_MS } = manager;
  const id = createTerminal(process.cwd(), 80, 24);
  assert.ok(record(id).cleanupTimer, "unclaimed creations have a lease");
  t.mock.timers.tick(TERMINAL_RECONNECT_MS - 1);
  assert.ok(hasTerminal(id));
  assert.equal(ptys[0].kill.mock.callCount(), 0);
  t.mock.timers.tick(1);
  assert.equal(hasTerminal(id), false);
  assert.equal(ptys[0].kill.mock.callCount(), 1);
});

for (const platform of ["win32", "linux"]) {
  test(`${platform} terminal shutdown uses the platform-supported kill operation`, (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const { manager, ptys } = isolatedManager(t, { platform });
    const forced = manager.createTerminal(process.cwd(), 80, 24);
    manager.killTerminal(forced, true);
    assert.deepEqual(ptys[0].kill.mock.calls.map((call) => Array.from(call.arguments)), [[platform === "win32" ? undefined : "SIGKILL"]]);
    const graceful = manager.createTerminal(process.cwd(), 80, 24);
    manager.killTerminal(graceful);
    t.mock.timers.tick(2000);
    assert.deepEqual(ptys[1].kill.mock.calls.map((call) => Array.from(call.arguments)), [[undefined], [platform === "win32" ? undefined : "SIGKILL"]]);
  });
}

test("PTY exit restarts the unclaimed lease with a full reconnect grace period", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { manager, ptys, record } = isolatedManager(t);
  const { createTerminal, hasTerminal, TERMINAL_RECONNECT_MS } = manager;
  const id = createTerminal(process.cwd(), 80, 24);
  t.mock.timers.tick(1000);
  ptys[0].emitExit(0);
  assert.equal(record(id).exited, true);
  assert.equal(record(id).exitCode, 0);
  t.mock.timers.tick(TERMINAL_RECONNECT_MS - 1);
  assert.ok(hasTerminal(id));
  t.mock.timers.tick(1);
  assert.equal(hasTerminal(id), false);
  assert.equal(ptys[0].kill.mock.callCount(), 0, "an exited PTY is not killed again");
});

test("SSE resumes from Last-Event-ID and cancellation releases the connection lease", async (t) => {
  const { id, record } = await nativeTerminal(t);
  record.backlog = "old\r\nnew\r\n";
  record.offset = record.backlog.length;
  const request = new Request("http://localhost/events?after=0", { headers: { "Last-Event-ID": "5" } });
  const response = await GET(request, { params: Promise.resolve({ id }) });
  const reader = response.body.getReader();
  await reader.read();
  const replay = new TextDecoder().decode((await reader.read()).value);
  assert.match(replay, /id: 10\n/);
  assert.deepEqual(JSON.parse(replay.split("data: ")[1]), { type: "output", data: "new\r\n", offset: 10, reset: false });
  await reader.cancel();
  assert.equal(record.listeners.size, 0);
  assert.ok(record.cleanupTimer);
});

test("expired output cursors reset bounded history, while explicit close ends connected streams", async (t) => {
  const { id, record } = await nativeTerminal(t);
  record.backlog = "tail";
  record.offset = 100;
  const subscription = subscribeTerminal(id, () => {}, 10);
  assert.deepEqual(subscription.output, { type: "output", data: "tail", offset: 100, reset: true });
  subscription.unsubscribe();
  const response = await GET(new Request("http://localhost/events"), { params: Promise.resolve({ id }) });
  const reader = response.body.getReader();
  await reader.read();
  await reader.read();
  killTerminal(id);
  assert.match(new TextDecoder().decode((await reader.read()).value), /"type":"closed"/);
  assert.equal((await reader.read()).done, true);
  assert.equal(record.listeners.size, 0);
  assert.equal(hasTerminal(id), false);
});
