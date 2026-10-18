import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(root),
  entryPoints: ["lib/desktop-native.ts"],
  bundle: true,
  write: false,
  format: "esm",
  platform: "browser",
  external: ["@tauri-apps/*"],
  plugins: [{
    name: "changes-window-ipc",
    setup(builder) {
      builder.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({ path: "core", namespace: "test-ipc" }));
      builder.onLoad({ filter: /.*/, namespace: "test-ipc" }, () => ({ contents: "export const invoke = (...args) => globalThis.__changesWindowInvoke(...args);" }));
    },
  }],
});
const { openChangesWindow, closeChangesWindow } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);

function withWindow(window, run) {
  const previous = globalThis.window;
  const previousInvoke = globalThis.__changesWindowInvoke;
  globalThis.window = window;
  return Promise.resolve().then(run).finally(() => {
    globalThis.window = previous;
    globalThis.__changesWindowInvoke = previousInvoke;
  });
}

test("browser click opens the same-origin route synchronously and never invokes Tauri", async () => {
  const opened = [];
  await withWindow({ location: { origin: "https://pi.example.test" }, open: (...args) => opened.push(args) }, async () => {
    globalThis.__changesWindowInvoke = () => assert.fail("browser must not invoke a native command");
    const cwd = "C:\\src\\R&D\\用户 #1?x=2";
    const promise = openChangesWindow(cwd, "main-window");
    assert.equal(opened.length, 1, "window.open runs during the user click, before any await");
    await promise;
    const [href, target, features] = opened[0];
    const url = new URL(href);
    assert.equal(url.origin, "https://pi.example.test");
    assert.equal(url.pathname, "/changes");
    assert.deepEqual([...url.searchParams], [["cwd", cwd], ["targetId", "main-window"]]);
    assert.equal(target, "_blank");
    assert.equal(features, "noopener,noreferrer");
  });
});

test("native opening uses only the dedicated command and preserves the cwd", async () => {
  const calls = [];
  await withWindow({ __TAURI_INTERNALS__: {}, open: () => assert.fail("native must not call window.open") }, async () => {
    globalThis.__changesWindowInvoke = async (...args) => { calls.push(args); };
    await openChangesWindow("D:\\project", "main-123");
    await closeChangesWindow();
    assert.deepEqual(calls, [["open_changes_window", { cwd: "D:\\project", targetId: "main-123" }], ["close_changes_window"]]);
  });
});

test("invalid popout inputs are rejected before opening a tab or issuing IPC", async () => {
  await withWindow({ open: () => assert.fail("invalid input opened a tab") }, async () => {
    globalThis.__changesWindowInvoke = () => assert.fail("invalid input issued IPC");
    for (const cwd of ["", "   ", "C:\\src\0ignored", "x".repeat(32_769)]) await assert.rejects(openChangesWindow(cwd));
    await assert.rejects(openChangesWindow("D:/project", "x".repeat(257)));
    await assert.rejects(openChangesWindow("D:/project", "target\0bad"));
  });
});

test("closing a browser popout uses the browser window close action", async () => {
  let closed = false;
  await withWindow({ close: () => { closed = true; } }, async () => {
    await closeChangesWindow();
    assert.equal(closed, true);
  });
});

test("only Changes windows receive the minimal Changes-route capability", async () => {
  const source = async (path) => readFile(new URL(path, root), "utf8");
  const [changes, main, controls, config] = await Promise.all([
    source("src-tauri/capabilities/desktop-changes.json"),
    source("src-tauri/capabilities/desktop-dialog.json"),
    source("src-tauri/capabilities/window-controls.json"),
    source("src-tauri/tauri.conf.json"),
  ]).then((values) => values.map(JSON.parse));
  assert.deepEqual(changes.windows, ["changes-*"]);
  assert.equal(changes.local, true, "Tauri devUrl is a local execution context; Rust still fixes the navigation route");
  assert.deepEqual(changes.remote.urls, ["http://127.0.0.1:*/changes"]);
  assert.deepEqual(changes.permissions.toSorted(), ["allow-get-desktop-api-token", "clipboard-manager:allow-write-text", "allow-close-changes-window"].toSorted());
  assert.deepEqual(main.windows, ["main"]);
  assert.ok(main.permissions.includes("allow-open-changes-window"));
  assert.deepEqual(controls.windows, ["main"]);
  assert.ok(config.app.security.capabilities.includes("desktop-changes"));
});
