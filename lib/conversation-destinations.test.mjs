import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const { outputFiles } = await build({
  absWorkingDir: fileURLToPath(root), entryPoints: ["lib/desktop-native.ts"], bundle: true, write: false,
  format: "esm", platform: "browser", external: ["@tauri-apps/*"],
  plugins: [{ name: "destinations-ipc", setup(builder) {
    builder.onResolve({ filter: /^@tauri-apps\/api\/core$/ }, () => ({ path: "core", namespace: "test-ipc" }));
    builder.onLoad({ filter: /.*/, namespace: "test-ipc" }, () => ({ contents: "export const invoke = (...args) => globalThis.__destinationInvoke(...args);" }));
  } }],
});
const native = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString("base64")}`);
async function withWindow(value, run) {
  const previous = globalThis.window, previousInvoke = globalThis.__destinationInvoke;
  globalThis.window = value;
  try { await run(); } finally { globalThis.window = previous; globalThis.__destinationInvoke = previousInvoke; }
}

test("native destinations expose a capability probe and fixed commands with data-only arguments", async () => {
  assert.equal(typeof native.getConversationDestinations, "function");
  assert.equal(typeof native.openConversationWindow, "function");
  assert.equal(typeof native.openProjectInVSCode, "function");
  await withWindow({ __TAURI_INTERNALS__: {} }, async () => {
    const calls = [];
    globalThis.__destinationInvoke = async (...args) => { calls.push(args); return { newWindow: true, vsCode: { supported: true, reason: null } }; };
    assert.equal((await native.getConversationDestinations()).vsCode.supported, true);
    await native.openConversationWindow("session&token=bad?#测试");
    await native.openProjectInVSCode("D:\\src\\R&D\\项目");
    assert.deepEqual(calls, [["conversation_destinations"], ["open_conversation_window", { sessionId: "session&token=bad?#测试" }], ["open_project_in_vscode", { cwd: "D:\\src\\R&D\\项目" }]]);
  });
});

test("browser new window is synchronous, same-origin, and detached; native-only editor remains unavailable", async () => {
  const opened = [], child = { opener: "parent" };
  await withWindow({ location: { origin: "https://fixture.example.test", pathname: "/old", search: "?token=secret" }, open: (...args) => { opened.push(args); return child; } }, async () => {
    globalThis.__destinationInvoke = () => assert.fail("browser issued native IPC");
    const pending = native.openConversationWindow("id&x=2?#标题");
    assert.equal(opened.length, 1, "browser opens in the original user gesture");
    await pending;
    const url = new URL(opened[0][0]);
    assert.equal(url.origin, "https://fixture.example.test"); assert.equal(url.pathname, "/");
    assert.deepEqual([...url.searchParams], [["session", "id&x=2?#标题"]]); assert.equal(url.hash, "");
    assert.equal(child.opener, null);
    assert.equal((await native.getConversationDestinations()).vsCode.supported, false);
    await assert.rejects(native.openProjectInVSCode("D:/fixture"), /desktop/i);
  });
});

test("invalid destination arguments fail before IPC and blocked popups report failure", async () => {
  await withWindow({ __TAURI_INTERNALS__: {} }, async () => {
    globalThis.__destinationInvoke = () => assert.fail("invalid argument reached IPC");
    for (const value of ["", " ", "id\0bad", "id\nother", "x".repeat(257)]) await assert.rejects(native.openConversationWindow(value));
    for (const value of ["", " ", "D:/src\0bad", "https://example.test", "relative/path"]) await assert.rejects(native.openProjectInVSCode(value));
  });
  await withWindow({ location: { origin: "https://fixture.example.test" }, open: () => null }, async () => {
    await assert.rejects(native.openConversationWindow("fixture"), /blocked/i);
  });
});

test("secondary conversation identity is a native bootstrap fact and cannot be requested with a URL flag", async () => {
  await withWindow({ location: { search: "?conversationWindow=true" } }, () => assert.equal(native.isConversationWindow(), false));
  await withWindow({ __TAURI_INTERNALS__: {}, __PILAUDE_CONVERSATION_WINDOW__: true }, () => assert.equal(native.isConversationWindow(), true));
});

test("destination commands are registered with distinct main and secondary capabilities", async () => {
  const source = (path) => readFile(new URL(path, root), "utf8");
  const [secondary, main, config, permissions, rust, windowSource] = await Promise.all([
    source("src-tauri/capabilities/desktop-conversation.json").then(JSON.parse), source("src-tauri/capabilities/desktop-dialog.json").then(JSON.parse),
    source("src-tauri/tauri.conf.json").then(JSON.parse), source("src-tauri/permissions/desktop-shell.toml"), source("src-tauri/src/lib.rs"), source("src-tauri/src/conversation_window.rs"),
  ]);
  assert.deepEqual(secondary.windows, ["conversation-*"]); assert.deepEqual(main.windows, ["main"]);
  assert.deepEqual(secondary.remote.urls, ["http://127.0.0.1:*/"]);
  for (const command of ["open_conversation_window", "conversation_destinations", "open_project_in_vscode"]) {
    assert.match(permissions, new RegExp(`commands\\.allow = \\["${command}"\\]`));
    assert.ok(rust.includes(`${command},`));
    const permission = `allow-${command.replaceAll("_", "-")}`;
    assert.ok(main.permissions.includes(permission)); assert.ok(secondary.permissions.includes(permission));
  }
  for (const forbidden of ["allow-quit-app", "allow-set-close-quits", "allow-clear-app-cache", "notification:default", "autostart:allow-enable"]) assert.ok(!secondary.permissions.includes(forbidden));
  assert.ok(config.app.security.capabilities.includes("desktop-conversation"));
  assert.match(windowSource, /writable:false, configurable:false/);
  assert.match(windowSource, /\.decorations\(true\)/);
  assert.match(rust, /!label\.starts_with\("conversation-"\)/);
});
