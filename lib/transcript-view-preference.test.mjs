import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const preferences = await jiti.import("./transcript-view-preference.ts").catch(() => ({}));

function browser() {
  const previous = globalThis.window;
  const window = new EventTarget();
  const stored = new Map();
  window.localStorage = {
    getItem: (key) => stored.get(key) ?? null,
    setItem: (key, value) => stored.set(key, value),
    removeItem: (key) => stored.delete(key),
  };
  globalThis.window = window;
  return { window, stored, restore: () => { globalThis.window = previous; } };
}

test("transcript view persists per conversation and Normal removes its override", () => {
  assert.equal(typeof preferences.setTranscriptView, "function");
  const fixture = browser();
  try {
    assert.equal(preferences.getTranscriptView("a"), "normal");
    assert.equal(preferences.setTranscriptView("a", "thinking"), true);
    assert.equal(preferences.getTranscriptView("a"), "thinking");
    assert.equal(preferences.getTranscriptView("b"), "normal");
    assert.equal(preferences.setTranscriptView("b", "verbose"), true);
    assert.equal(preferences.getTranscriptView("b"), "verbose");
    assert.equal(preferences.setTranscriptView("a", "normal"), true);
    assert.equal(preferences.getTranscriptView("a"), "normal");
    assert.equal(preferences.getTranscriptView("b"), "verbose");
    assert.equal(fixture.stored.size, 1);
  } finally { fixture.restore(); }
});

test("unavailable storage and malformed values stay Normal without successful writes", () => {
  const fixture = browser();
  try {
    preferences.setTranscriptView("unusual / 中文", "verbose");
    assert.equal(preferences.getTranscriptView("unusual / 中文"), "verbose");
    assert.equal(preferences.setTranscriptView("a", "unsupported"), false);
    assert.equal(preferences.setTranscriptView("", "thinking"), false);
    assert.equal(preferences.getTranscriptView(null), "normal");
    fixture.window.localStorage.getItem = () => "unsupported";
    assert.equal(preferences.getTranscriptView("a"), "normal");
    fixture.window.localStorage.setItem = () => { throw new Error("Storage denied"); };
    fixture.window.localStorage.removeItem = () => { throw new Error("Storage denied"); };
    assert.equal(preferences.setTranscriptView("a", "thinking"), false);
    assert.equal(preferences.setTranscriptView("a", "normal"), false);
    fixture.window.localStorage.getItem = () => { throw new Error("Storage denied"); };
    assert.equal(preferences.getTranscriptView("a"), "normal");
  } finally { fixture.restore(); }
});

test("same-window and cross-window changes notify subscribers and clean up", () => {
  assert.equal(typeof preferences.subscribeTranscriptView, "function");
  const fixture = browser();
  try {
    let changes = 0;
    const unsubscribe = preferences.subscribeTranscriptView(() => { changes++; });
    preferences.setTranscriptView("a", "thinking");
    assert.equal(changes, 1);
    const preferenceKey = [...fixture.stored.keys()][0];
    const storage = (key) => {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: key });
      fixture.window.dispatchEvent(event);
    };
    storage("unrelated");
    assert.equal(changes, 1);
    storage(preferenceKey);
    assert.equal(changes, 2);
    storage(null);
    assert.equal(changes, 3);
    unsubscribe();
    preferences.setTranscriptView("a", "verbose");
    storage(preferenceKey);
    assert.equal(changes, 3);
  } finally { fixture.restore(); }
});
