import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";

function compile(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  return new Script(ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText);
}

const prefsScript = compile("./app-prefs.ts");
const appearanceScript = compile("./terminal-appearance.ts");
const defaults = { cursorStyle: "block", cursorBlink: true, copyOnSelect: false, scrollback: 10000 };

// Run the actual preference accessors with a browser storage stub. Only React's
// hook is mocked, exposing its snapshots and subscription without mounting a UI.
function loadStore({ stored = null, browser = true, storageThrows = false } = {}) {
  const values = new Map();
  const writes = [];
  const env = browser ? {
    window: {
      localStorage: {
        getItem(key) {
          if (storageThrows) throw new Error("Storage unavailable");
          return values.get(key) ?? null;
        },
        setItem(key, value) {
          if (storageThrows) throw new Error("Storage unavailable");
          values.set(key, value);
          writes.push([key, value]);
        },
      },
    },
  } : {};
  const prefsContext = { ...env, exports: {} };
  prefsScript.runInNewContext(prefsContext);
  const key = prefsContext.exports.APP_PREF_KEYS.terminalAppearance;
  if (stored !== null) values.set(key, stored);
  let store;
  const context = {
    ...env,
    exports: {},
    require(id) {
      if (id === "./app-prefs") return prefsContext.exports;
      if (id === "react") return {
        useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot) {
          store = { subscribe, getSnapshot, getServerSnapshot };
          return getSnapshot();
        },
      };
      throw new Error(`Unexpected dependency: ${id}`);
    },
  };
  appearanceScript.runInNewContext(context);
  const api = context.exports;
  api.useTerminalAppearance();
  return { ...api, store, key, values, writes };
}

const { normalizeTerminalAppearance } = loadStore({ browser: false });

test("normalization uses defaults for absent or invalid fields without coercion", () => {
  for (const raw of [undefined, null, false, 1000, "bar", [], { cursorStyle: "beam", cursorBlink: "false", copyOnSelect: 1, scrollback: "5000" }]) {
    assert.deepEqual({ ...normalizeTerminalAppearance(raw) }, defaults);
  }
  assert.deepEqual({ ...normalizeTerminalAppearance({ cursorStyle: "bar", scrollback: 1234 }) }, {
    ...defaults, cursorStyle: "bar",
  });
});

test("normalization preserves every supported choice and leaves the input untouched", () => {
  for (const cursorStyle of ["block", "bar", "underline"]) {
    for (const scrollback of [1000, 5000, 10000]) {
      const raw = Object.freeze({ cursorStyle, cursorBlink: false, copyOnSelect: true, scrollback, extra: "ignored" });
      assert.deepEqual({ ...normalizeTerminalAppearance(raw) }, { cursorStyle, cursorBlink: false, copyOnSelect: true, scrollback });
      assert.equal(raw.extra, "ignored");
    }
  }
});

test("partial updates share a stable snapshot, notify subscribers and survive reload", () => {
  const api = loadStore({ stored: JSON.stringify({ cursorStyle: "underline", cursorBlink: false, scrollback: 5000 }) });
  const first = api.useTerminalAppearance();
  const second = api.useTerminalAppearance();
  assert.equal(first.appearance, second.appearance);
  assert.deepEqual({ ...first.appearance }, { ...defaults, cursorStyle: "underline", cursorBlink: false, scrollback: 5000 });
  let notifications = 0;
  const unsubscribe = api.store.subscribe(() => { notifications += 1; });
  first.setAppearance({ copyOnSelect: true });
  second.setAppearance({ cursorStyle: "bar" });
  const expected = { cursorStyle: "bar", cursorBlink: false, copyOnSelect: true, scrollback: 5000 };
  const current = api.useTerminalAppearance();
  assert.deepEqual({ ...current.appearance }, expected);
  assert.equal(current.setAppearance, first.setAppearance);
  assert.equal(api.store.getSnapshot(), current.appearance);
  assert.equal(notifications, 2);
  assert.equal(api.writes.length, 2);
  assert.deepEqual(JSON.parse(api.values.get(api.key)), expected);
  const reloaded = loadStore({ stored: api.values.get(api.key) });
  assert.deepEqual({ ...reloaded.useTerminalAppearance().appearance }, expected);
  current.setAppearance({ cursorStyle: "bar" });
  assert.equal(api.store.getSnapshot(), current.appearance);
  assert.equal(api.writes.length, 2);
  unsubscribe();
  current.setAppearance({ scrollback: 1000 });
  assert.equal(notifications, 2);
});

test("SSR snapshot always uses stable defaults, including after client updates", () => {
  const server = loadStore({ browser: false });
  const initial = server.useTerminalAppearance();
  assert.deepEqual({ ...initial.appearance }, defaults);
  initial.setAppearance({ cursorStyle: "bar" });
  assert.equal(server.store.getSnapshot(), initial.appearance);
  assert.equal(server.store.getServerSnapshot(), initial.appearance);
  assert.equal(server.writes.length, 0);
  const client = loadStore({ stored: JSON.stringify({ cursorStyle: "underline" }) });
  const snapshot = client.store.getServerSnapshot();
  client.useTerminalAppearance().setAppearance({ copyOnSelect: true });
  assert.equal(client.store.getServerSnapshot(), snapshot);
  assert.deepEqual({ ...snapshot }, defaults);
});

test("malformed saved JSON falls back safely and blocked storage retains live updates", () => {
  const malformed = loadStore({ stored: "{broken" });
  assert.deepEqual({ ...malformed.useTerminalAppearance().appearance }, defaults);
  const blocked = loadStore({ storageThrows: true });
  let notifications = 0;
  blocked.store.subscribe(() => { notifications += 1; });
  assert.doesNotThrow(() => blocked.useTerminalAppearance().setAppearance({ cursorBlink: false, scrollback: 1000 }));
  assert.deepEqual({ ...blocked.useTerminalAppearance().appearance }, { ...defaults, cursorBlink: false, scrollback: 1000 });
  assert.equal(notifications, 1);
});
