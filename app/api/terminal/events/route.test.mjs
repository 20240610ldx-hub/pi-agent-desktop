import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": resolve(import.meta.dirname, "../../../..") } });
const { terminalEventsResponse } = await jiti.import("../../../../lib/terminal-events-stream.ts");
const { GET } = await jiti.import("./route.ts");
const a = "a".repeat(32); const b = "b".repeat(32);
const request = (items, signal) => new Request(`http://test/api/terminal/events?terminals=${encodeURIComponent(JSON.stringify(items))}`, { signal });
function registry() {
  const calls = []; const released = [];
  const listeners = new Map();
  const subscribe = (id, callback, after) => {
    calls.push({ id, after });
    if (id !== a && id !== b) return null;
    listeners.set(id, callback);
    return { output: { type: "output", data: id === a ? "first" : "second", offset: id === a ? 5 : 6, reset: after === undefined }, exited: false, exitCode: null,
      unsubscribe() { released.push(id); listeners.delete(id); } };
  };
  return { subscribe, calls, released, listeners };
}
const decode = (value) => new TextDecoder().decode(value);
async function initial(reader, count) {
  let text = "";
  for (let i = 0; i < count; i++) text += decode((await reader.read()).value);
  return text;
}

test("one GET subscribes all requested IDs with separate cursors and holds their leases", async () => {
  const r = registry(); const abort = new AbortController();
  const response = terminalEventsResponse(request([{ id: a, after: 3 }, { id: b, after: 4 }], abort.signal), r.subscribe);
  assert.equal(response.headers.get("content-type"), "text/event-stream");
  assert.deepEqual(r.calls, [{ id: a, after: 3 }, { id: b, after: 4 }]);
  assert.equal(r.listeners.size, 2);
  const reader = response.body.getReader();
  const text = await initial(reader, 3);
  assert.match(text, new RegExp(`"id":"${a}"`)); assert.match(text, new RegExp(`"id":"${b}"`));
  assert.deepEqual(r.released, []);
  abort.abort();
  assert.deepEqual(r.released.sort(), [a, b]);
  assert.equal((await reader.read()).done, true);
});

test("one exit or missing terminal closes only its ID; remaining output stays live", async () => {
  const r = registry(); const missing = "c".repeat(32);
  const response = terminalEventsResponse(request([{ id: missing }, { id: a }, { id: b }]), r.subscribe);
  const reader = response.body.getReader();
  const text = await initial(reader, 4);
  assert.match(text, new RegExp(`"id":"${missing}","event":\\{"type":"closed"`));
  const nextExit = reader.read();
  r.listeners.get(a)({ type: "exit", exitCode: 7 });
  assert.match(decode((await nextExit).value), /"exitCode":7/);
  assert.deepEqual(r.released, [a]); assert.equal(r.listeners.has(b), true);
  r.listeners.get(b)({ type: "output", data: "still-alive", offset: 17 });
  assert.match(decode((await reader.read()).value), /still-alive/);
  await reader.cancel();
  assert.deepEqual(r.released.sort(), [a, b]);
});

test("reader cancellation, already-aborted request and slow reader release every lease", async () => {
  const r = registry();
  const response = terminalEventsResponse(request([{ id: a }, { id: b }]), r.subscribe);
  await response.body.cancel(); assert.deepEqual(r.released.sort(), [a, b]);
  const stopped = registry(); const abort = new AbortController(); abort.abort();
  const already = terminalEventsResponse(request([{ id: a }], abort.signal), stopped.subscribe);
  assert.equal((await already.body.getReader().read()).done, true); assert.equal(stopped.calls.length, 0);
  const slow = registry(); const slowResponse = terminalEventsResponse(request([{ id: a }, { id: b }]), slow.subscribe);
  slow.listeners.get(a)({ type: "output", data: "x".repeat(300 * 1024), offset: 300 * 1024 });
  assert.deepEqual(slow.released.sort(), [a, b], "bounded queue closes instead of retaining arbitrary PTY output");
  await slowResponse.body.cancel();
});

test("invalid, duplicate, excessive or unsafe subscriptions do not touch PTYs", () => {
  const invalid = [[], [{ id: "../bad" }], [{ id: a }, { id: a }], [{ id: a, after: -1 }], [{ id: a, after: 1.5 }], [{ id: a, after: "2" }], Array.from({ length: 65 }, (_, i) => ({ id: i.toString(16).padStart(32, "0") }))];
  for (const entries of invalid) {
    const r = registry(); assert.equal(terminalEventsResponse(request(entries), r.subscribe).status, 400); assert.equal(r.calls.length, 0);
  }
  const r = registry();
  assert.equal(terminalEventsResponse(new Request("http://test/api/terminal/events?terminals=bad"), r.subscribe).status, 400);
  const source = readFileSync(new URL("../../../../lib/terminal-events-stream.ts", import.meta.url), "utf8");
  assert.equal(typeof GET, "function");
  assert.doesNotMatch(source, /createTerminal|killTerminal|writeTerminal|resizeTerminal/);
});

test("two full backlogs, heavily escaped output and boundary emoji drain without reconnect loops", async () => {
  const emoji = "x".repeat(8191) + "😀" + "z".repeat(128 * 1024 - 8193);
  const escaped = "\u0000".repeat(128 * 1024);
  const outputs = new Map([[a, emoji], [b, escaped]]);
  const released = [];
  const response = terminalEventsResponse(request([{ id: a }, { id: b }]), (id) => ({
    output: { type: "output", data: outputs.get(id), offset: outputs.get(id).length, reset: true },
    exited: true, exitCode: 0, unsubscribe: () => released.push(id),
  }));
  const text = await response.text();
  const events = text.split("\n\n").filter((frame) => frame.startsWith("data: ")).map((frame) => JSON.parse(frame.slice(6)));
  for (const id of [a, b]) {
    const chunks = events.filter((envelope) => envelope.id === id && envelope.event.type === "output").map((envelope) => envelope.event);
    assert.equal(chunks.map((event) => event.data).join(""), outputs.get(id));
    assert.equal(chunks[0].reset, true); assert.ok(chunks.slice(1).every((event) => !event.reset));
    let offset = 0;
    for (const chunk of chunks) {
      offset += chunk.data.length; assert.equal(chunk.offset, offset);
      assert.equal(/[\uD800-\uDBFF]$/.test(chunk.data), false, "frames cannot split a surrogate pair");
    }
    assert.equal(events.filter((envelope) => envelope.id === id && envelope.event.type === "exit").length, 1);
  }
  assert.deepEqual(released.sort(), [a, b]);
});

test("real manager leases keep hidden terminals alive; disconnect expires only after grace", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout", "setInterval"] });
  const manager = await jiti.import("../../../../lib/terminal-manager.ts");
  const previous = globalThis.__piWebTerminals;
  const kills = [];
  const records = new Map([a, b].map((id) => [id, {
    pty: { kill: () => kills.push(id) }, cwd: "/fixture", listeners: new Set(), backlog: "", offset: 0,
    exited: false, exitCode: null, cleanupTimer: null,
  }]));
  globalThis.__piWebTerminals = records;
  t.after(() => { globalThis.__piWebTerminals = previous; });
  const response = terminalEventsResponse(request([{ id: a }, { id: b }]));
  const reader = response.body.getReader(); await initial(reader, 3);
  assert.equal(records.get(a).listeners.size, 1); assert.equal(records.get(b).listeners.size, 1);
  t.mock.timers.tick(manager.TERMINAL_RECONNECT_MS * 2);
  assert.deepEqual(kills, [], "both tabs hold leases without any active-tab polling");
  await reader.cancel();
  t.mock.timers.tick(manager.TERMINAL_RECONNECT_MS - 1); assert.deepEqual(kills, []);
  const resumed = terminalEventsResponse(request([{ id: a, after: 0 }, { id: b, after: 0 }]));
  const next = resumed.body.getReader(); await initial(next, 3);
  t.mock.timers.tick(manager.TERMINAL_RECONNECT_MS); assert.deepEqual(kills, [], "reconnect cancels pending expiry");
  await next.cancel(); t.mock.timers.tick(manager.TERMINAL_RECONNECT_MS);
  assert.deepEqual(kills.sort(), [a, b]);
});

test("heartbeat uses bounded enqueue and is cleared on abort/cancel", async (t) => {
  const timers = new Set(); const cleared = [];
  t.mock.method(globalThis, "setInterval", (callback, ms) => { const timer = { callback, ms }; timers.add(timer); return timer; });
  t.mock.method(globalThis, "clearInterval", (timer) => { timers.delete(timer); cleared.push(timer); });
  const r = registry(); const response = terminalEventsResponse(request([{ id: a }]), r.subscribe);
  const reader = response.body.getReader(); await initial(reader, 2);
  assert.equal(timers.size, 1); const timer = [...timers][0]; assert.equal(timer.ms, 30_000);
  timer.callback(); assert.equal(decode((await reader.read()).value), ":\n\n");
  await reader.cancel(); assert.equal(timers.size, 0); assert.equal(cleared.length, 1);
  timer.callback(); assert.equal(r.released.length, 1, "late heartbeat cannot reopen or re-release the subscription");
});
