import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const preview = await jiti.import("../lib/html-preview.ts");
const code = ts.transpileModule(readFileSync(new URL("./useHtmlPreviewFrame.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

// Run the real hook and registered listener; only React's lifecycle and the
// native browser opener are doubles. This is a unit fixture, not a WebView test.
function harness(active = true) {
  const listeners = new Set();
  const cleanups = [];
  const sizes = [], errors = [], opened = [], replies = [];
  const frame = { contentWindow: { postMessage: (...args) => replies.push(args) } };
  const document = { activeElement: frame };
  let clock = 10_000;
  let cursor = 0;
  const states = [];
  const exports = {};
  runInNewContext(code, {
    exports, URL, console, document,
    Date: { now: () => clock },
    window: {
      addEventListener: (name, listener) => { assert.equal(name, "message"); listeners.add(listener); },
      removeEventListener: (name, listener) => { assert.equal(name, "message"); listeners.delete(listener); },
    },
    require: (id) => {
      if (id === "react") return {
        useRef: (current) => ({ current }),
        useEffect: (effect) => { const cleanup = effect(); if (cleanup) cleanups.push(cleanup); },
        useState: (initial) => {
          const index = cursor++;
          if (!(index in states)) states[index] = initial;
          return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
        },
      };
      if (id === "@/lib/html-preview") return preview;
      if (id === "@/lib/desktop-native") return { openExternal: async (url) => { opened.push(url); } };
      if (id === "@/hooks/useTheme" || id === "@/hooks/useI18n") return {};
      throw new Error(`Unexpected import: ${id}`);
    },
  });
  const ref = { current: frame };
  exports.useHtmlPreviewFrameMessages(ref, { onSize: (n) => sizes.push(n), onError: (s) => errors.push(s) }, active);
  return {
    frame, document, sizes, errors, opened, replies, ref,
    send(data, overrides = {}) {
      for (const listener of listeners) listener({ source: frame.contentWindow, origin: "null", data, ...overrides });
    },
    advance: (ms) => { clock += ms; },
    close: () => cleanups.forEach((cleanup) => cleanup()),
    errorsFor(key) { cursor = 0; return exports.useHtmlPreviewErrors(key); },
  };
}

const messages = [
  { type: "pi-html-preview:size", height: 240 },
  { type: "pi-html-preview:error", message: "frame error" },
  { type: "pi-html-preview:open", url: "https://example.com/path" },
];
const assertIgnored = (h) => {
  assert.deepEqual(h.sizes, []);
  assert.deepEqual(h.errors, []);
  assert.deepEqual(h.opened, []);
  assert.deepEqual(h.replies, [], "the host must never reply with data or capabilities");
};

test("accepts bounded sandbox messages without sending host data back", () => {
  const h = harness();
  messages.forEach((message) => h.send(message));
  h.send({ type: "pi-html-preview:error", message: "x".repeat(500) });
  assert.deepEqual(h.sizes, [240]);
  assert.deepEqual(h.errors, ["frame error", "x".repeat(500)]);
  assert.deepEqual(h.opened, ["https://example.com/path"]);
  assert.deepEqual(h.replies, []);
});

test("rejects forged origins even when source matches the preview", () => {
  for (const origin of ["https://evil.example", "http://localhost:30141", "", undefined, null]) {
    const h = harness();
    messages.forEach((message) => h.send(message, { origin }));
    assertIgnored(h);
  }
});

test("rejects other windows, sibling frames and detached frames", () => {
  const h = harness();
  for (const source of [null, {}, { postMessage() {} }]) {
    messages.forEach((message) => h.send(message, { source }));
  }
  h.frame.contentWindow = null;
  messages.forEach((message) => h.send(message, { source: null }));
  h.ref.current = null;
  messages.forEach((message) => h.send(message));
  assertIgnored(h);
});

test("rejects malformed structures, unknown commands and invalid field values", () => {
  const h = harness();
  const malformed = [
    null, undefined, false, 1, "message", [], {}, new Map(),
    { type: "host:read", path: "/private" },
    { type: "pi-html-preview:size" },
    { type: "pi-html-preview:size", height: "240" },
    ...[NaN, Infinity, -Infinity, -1].map((height) => ({ type: "pi-html-preview:size", height })),
    { type: "pi-html-preview:error", message: {} },
    { type: "pi-html-preview:open", url: ["https://example.com"] },
    Object.assign([], { type: "pi-html-preview:size", height: 240 }),
    Object.create({ type: "pi-html-preview:size", height: 240 }),
    ...messages.map((message) => ({ ...message, extra: { command: "read" } })),
  ];
  malformed.forEach((message) => h.send(message));
  assertIgnored(h);
});

test("rejects oversized messages before callbacks or URL opening", () => {
  const h = harness();
  h.send({ type: "pi-html-preview:error", message: "x".repeat(501) });
  h.send({ type: "pi-html-preview:error", message: "x".repeat(1_000_000) });
  h.send({ type: "pi-html-preview:open", url: `https://example.com/${"x".repeat(2048)}` });
  h.send({ type: "pi-html-preview:size", height: 240, payload: "x".repeat(1_000_000) });
  assertIgnored(h);
});

test("external links require http(s), frame focus and the opening cooldown", () => {
  const h = harness();
  for (const url of ["javascript:alert(1)", "file:///private", "data:text/html,test", "tauri://localhost", "not a url"]) {
    h.send({ type: "pi-html-preview:open", url });
  }
  h.document.activeElement = null;
  h.send(messages[2]);
  assertIgnored(h);
  h.document.activeElement = h.frame;
  h.send(messages[2]);
  h.send(messages[2]);
  h.advance(1000);
  h.send({ type: "pi-html-preview:open", url: "http://example.com" });
  assert.deepEqual(h.opened, ["https://example.com/path", "http://example.com/"]);
});

test("inactive and unmounted listeners have no side effects", () => {
  const inactive = harness(false);
  messages.forEach((message) => inactive.send(message));
  assertIgnored(inactive);
  const h = harness();
  h.close();
  messages.forEach((message) => h.send(message));
  assertIgnored(h);
});

test("the host caps distinct frame errors and resets them with the document", () => {
  const h = harness();
  for (let i = 0; i < 100; i++) h.errorsFor("v1").addError(`error ${i}`);
  assert.deepEqual(Array.from(h.errorsFor("v1").errors), ["error 0", "error 1", "error 2", "error 3", "error 4"]);
  h.errorsFor("v2").addError("new error");
  h.errorsFor("v2").addError("new error");
  assert.deepEqual(Array.from(h.errorsFor("v2").errors), ["new error"]);
  h.errorsFor("v2").dismiss();
  assert.deepEqual(Array.from(h.errorsFor("v2").errors), []);
});
