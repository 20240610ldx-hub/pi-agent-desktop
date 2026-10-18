import assert from "node:assert/strict";
import test from "node:test";
import { parseChangesFeedbackRequest, subscribeChangesFeedback, requestChangesFeedback } from "./changes-feedback.ts";
import { APP_PREF_KEYS } from "./app-prefs.ts";

const now = 10_000;
const request = { id: "request-1", targetId: "main-window", cwd: "D:\\code\\project", text: "Review old line 82", createdAt: now };

test("feedback is addressed to a live window and current directory, with bounded fresh text", () => {
  const parse = (value, target = "main-window", cwd = "d:/code/project/", time = now) => parseChangesFeedbackRequest(JSON.stringify(value), target, cwd, time);
  assert.deepEqual(parse(request), request);
  for (const value of [null, [], { ...request, id: "" }, { ...request, targetId: "other" }, { ...request, cwd: "D:/elsewhere" }, { ...request, text: " " }, { ...request, text: "x".repeat(65537) }, { ...request, createdAt: 50_000 }, { ...request, createdAt: -30_000 }]) assert.equal(parse(value), null);
  assert.equal(parseChangesFeedbackRequest("broken", "main-window", request.cwd, now), null);
  assert.equal(parse({ ...request, cwd: "/Code/project" }, "main-window", "/code/project"), null, "POSIX case remains significant");
});

test("live receiver inserts once, acknowledges only accepted drafts, and never replays stored content", () => {
  const original = globalThis.window;
  const listeners = new Set();
  const stored = new Map([[APP_PREF_KEYS.changesFeedbackRequest, JSON.stringify({ ...request, createdAt: Date.now() })]]);
  const storage = { setItem: (key, value) => stored.set(key, value), getItem: (key) => stored.get(key) ?? null };
  globalThis.window = { localStorage: storage, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  try {
    let inserts = 0;
    const close = subscribeChangesFeedback({ targetId: request.targetId, cwd: request.cwd, onFeedback: () => { inserts++; return true; } });
    assert.equal(inserts, 0);
    const event = { storageArea: storage, key: APP_PREF_KEYS.changesFeedbackRequest, newValue: stored.get(APP_PREF_KEYS.changesFeedbackRequest) };
    for (const listener of listeners) { listener(event); listener(event); }
    assert.equal(inserts, 1);
    assert.equal(JSON.parse(stored.get(APP_PREF_KEYS.changesFeedbackAck)).id, request.id);
    close(); assert.equal(listeners.size, 0);
    stored.delete(APP_PREF_KEYS.changesFeedbackAck);
    const refuse = subscribeChangesFeedback({ targetId: request.targetId, cwd: request.cwd, onFeedback: () => false });
    for (const listener of listeners) listener(event);
    assert.equal(stored.has(APP_PREF_KEYS.changesFeedbackAck), false);
    refuse();
    const delayed = subscribeChangesFeedback({ targetId: request.targetId, cwd: request.cwd, onFeedback: () => { inserts++; return true; } });
    stored.delete(APP_PREF_KEYS.changesFeedbackRequest);
    for (const listener of listeners) listener(event);
    assert.equal(inserts, 1, "a cancelled request's queued event cannot modify the draft after copy fallback");
    assert.equal(stored.has(APP_PREF_KEYS.changesFeedbackAck), false);
    delayed();
  } finally { globalThis.window = original; }
});

test("sender listens before writing, accepts only its acknowledgement, and cleans its own payload", async () => {
  const original = globalThis.window;
  const listeners = new Set();
  const stored = new Map();
  const storage = { getItem: (key) => stored.get(key) ?? null, removeItem: (key) => stored.delete(key), setItem(key, value) {
    stored.set(key, value);
    if (key !== APP_PREF_KEYS.changesFeedbackRequest) return;
    assert.equal(listeners.size, 1);
    const sent = JSON.parse(value);
    const wrong = JSON.stringify({ id: "wrong", targetId: sent.targetId, deliveredAt: Date.now() });
    for (const listener of listeners) listener({ storageArea: storage, key: APP_PREF_KEYS.changesFeedbackAck, newValue: wrong });
    const ack = JSON.stringify({ id: sent.id, targetId: sent.targetId, deliveredAt: Date.now() });
    stored.set(APP_PREF_KEYS.changesFeedbackAck, ack);
    for (const listener of [...listeners]) listener({ storageArea: storage, key: APP_PREF_KEYS.changesFeedbackAck, newValue: ack });
  } };
  globalThis.window = { localStorage: storage, addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) };
  try {
    assert.equal(await requestChangesFeedback(request), true);
    assert.equal(listeners.size, 0);
    assert.equal(stored.size, 0);
    assert.equal(await requestChangesFeedback({ cwd: request.cwd, text: "" }), false);
  } finally { globalThis.window = original; }
});
