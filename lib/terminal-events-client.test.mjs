import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";

const { createTerminalEventsClient } = await createJiti(import.meta.url).import("./terminal-events-client.ts");
const idA = "a".repeat(32);
const idB = "b".repeat(32);
function harness() {
  const sources = [];
  const deferred = [];
  const retries = new Set();
  const lifecycle = new EventTarget();
  let online = true;
  let maximumLive = 0;
  const client = createTerminalEventsClient({
    createSource(url) {
      const source = { url, closed: false, onopen: null, onerror: null, onmessage: null,
        close() { this.closed = true; },
        open() { this.onopen?.(); },
        emit(id, event) { this.onmessage?.({ data: JSON.stringify({ id, event }) }); },
        fail() { this.onerror?.(); },
      };
      sources.push(source);
      maximumLive = Math.max(maximumLive, sources.filter((s) => !s.closed).length);
      return source;
    },
    lifecycle, online: () => online, defer: (fn) => deferred.push(fn),
    setRetry: (fn) => { retries.add(fn); return fn; }, clearRetry: (fn) => retries.delete(fn),
  });
  const listener = () => {
    const state = { events: [], opens: 0, disconnects: 0 };
    return { state, onEvent: (event) => state.events.push(event), onOpen: () => state.opens++, onDisconnect: () => state.disconnects++ };
  };
  return { client, sources, retries, lifecycle, listener,
    flush() { while (deferred.length) deferred.shift()(); },
    retry() { for (const fn of [...retries]) { retries.delete(fn); fn(); } },
    online(value) { online = value; lifecycle.dispatchEvent(new Event(value ? "online" : "offline")); },
    get current() { return sources.at(-1); },
    get maximumLive() { return maximumLive; },
    get terminals() { return JSON.parse(new URL(sources.at(-1).url, "http://test").searchParams.get("terminals")); },
  };
}

test("mounted hidden/same-cwd tabs share one source; membership closes old source first", () => {
  const h = harness();
  const a = h.listener(); const b = h.listener();
  const stopA = h.client.subscribe(idA, a);
  h.flush(); h.current.open();
  h.current.emit(idA, { type: "output", data: "first", offset: 5, reset: true });
  const first = h.current;
  const stopB = h.client.subscribe(idB, b);
  assert.equal(first.closed, true, "release the HTTP slot before opening a changed stream");
  h.flush(); h.current.open();
  assert.deepEqual(h.terminals, [{ id: idA, after: 5 }, { id: idB }]);
  h.current.emit(idB, { type: "output", data: "second", offset: 6, reset: true });
  assert.equal(a.state.events.length, 1); assert.equal(b.state.events.length, 1);
  // Switching active tab is intentionally absent from the subscription API.
  assert.equal(h.sources.filter((source) => !source.closed).length, 1);
  stopB(); h.flush(); h.current.open();
  assert.deepEqual(h.terminals, [{ id: idA, after: 5 }]);
  assert.equal(h.maximumLive, 1);
  stopA(); h.flush();
  assert.equal(h.sources.filter((source) => !source.closed).length, 0);
});

test("network retry and online resume use delivered per-id offsets without duplicate output", () => {
  const h = harness(); const a = h.listener(); const b = h.listener();
  const stops = [h.client.subscribe(idA, a), h.client.subscribe(idB, b)];
  h.flush(); h.current.open();
  h.current.emit(idA, { type: "output", data: "one", offset: 3, reset: true });
  h.current.emit(idB, { type: "output", data: "two", offset: 13, reset: true });
  h.current.fail(); assert.equal(h.current.closed, true); assert.equal(h.retries.size, 1);
  h.retry(); h.current.open();
  assert.deepEqual(h.terminals, [{ id: idA, after: 3 }, { id: idB, after: 13 }]);
  h.current.emit(idA, { type: "output", data: "one", offset: 3 });
  h.current.emit(idB, { type: "output", data: "plus", offset: 17 });
  assert.equal(a.state.events.length, 1); assert.equal(b.state.events.length, 2);
  h.online(false); assert.equal(h.current.closed, true);
  h.flush(); assert.equal(h.sources.filter((source) => !source.closed).length, 0);
  h.online(true); h.flush();
  assert.deepEqual(h.terminals, [{ id: idA, after: 3 }, { id: idB, after: 17 }]);
  assert.equal(h.maximumLive, 1);
  for (const stop of stops) stop(); h.flush();
});

test("exit/closed ends only one terminal while other leases/output continue", () => {
  const h = harness(); const a = h.listener(); const b = h.listener();
  const stopA = h.client.subscribe(idA, a); const stopB = h.client.subscribe(idB, b);
  h.flush(); h.current.open();
  h.current.emit(idA, { type: "exit", exitCode: 7 });
  h.flush(); h.current.open();
  assert.deepEqual(h.terminals, [{ id: idB }]);
  h.current.emit(idB, { type: "output", data: "alive", offset: 5, reset: true });
  assert.deepEqual(a.state.events, [{ type: "exit", exitCode: 7 }]);
  assert.equal(b.state.events.at(-1).data, "alive");
  h.current.emit(idB, { type: "closed" }); h.flush();
  assert.equal(h.sources.filter((source) => !source.closed).length, 0);
  stopA(); stopB(); h.flush();
});

test("pagehide/pageshow, StrictMode unsubscribe and stale callbacks cannot leak streams", () => {
  const h = harness(); const a = h.listener();
  const stop = h.client.subscribe(idA, a); h.flush(); h.current.open();
  h.current.emit(idA, { type: "output", data: "kept", offset: 4, reset: true });
  const staleMessage = h.current.onmessage;
  h.lifecycle.dispatchEvent(new Event("pagehide")); h.flush();
  assert.equal(h.sources.filter((source) => !source.closed).length, 0);
  staleMessage({ data: JSON.stringify({ id: idA, event: { type: "output", data: "stale", offset: 9 } }) });
  assert.equal(a.state.events.length, 1);
  h.lifecycle.dispatchEvent(new Event("pageshow")); h.flush();
  assert.deepEqual(h.terminals, [{ id: idA, after: 4 }]);
  stop(); h.flush();
  h.online(false); h.online(true); h.flush();
  assert.equal(h.sources.filter((source) => !source.closed).length, 0);
  const stop2 = h.client.subscribe(idA, h.listener()); stop2();
  const stop3 = h.client.subscribe(idB, h.listener()); h.flush();
  assert.deepEqual(h.terminals, [{ id: idB }]);
  assert.equal(h.maximumLive, 1); stop3(); h.flush();
});

test("last unsubscribe discards cursor so a new xterm for the same ID gets full replay", () => {
  const h = harness(); const a = h.listener();
  const stop = h.client.subscribe(idA, a); h.flush(); h.current.open();
  h.current.emit(idA, { type: "output", data: "old-screen", offset: 10, reset: true });
  stop(); h.flush();
  const fresh = h.listener(); const stopFresh = h.client.subscribe(idA, fresh); h.flush();
  assert.deepEqual(h.terminals, [{ id: idA }]);
  h.current.emit(idA, { type: "output", data: "full-screen", offset: 11, reset: true });
  assert.equal(fresh.state.events[0].reset, true);
  stopFresh(); h.flush();
});

test("many mounted terminals consume one slot and no transport creates/kills PTYs", () => {
  const h = harness(); const stops = [];
  for (let i = 0; i < 12; i++) { stops.push(h.client.subscribe(i.toString(16).padStart(32, "0"), h.listener())); h.flush(); }
  assert.equal(h.maximumLive, 1); assert.equal(h.terminals.length, 12);
  for (const stop of stops) stop(); h.flush();
  const source = readFileSync(new URL("./terminal-events-client.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|method:\s*["'](?:POST|DELETE)/);
  assert.match(source, /defer: \(callback\) => queueMicrotask\(callback\)/, "WebIDL queueMicrotask must not receive env as its Window receiver");
  const panel = readFileSync(new URL("../components/TerminalPanel.tsx", import.meta.url), "utf8");
  assert.match(panel, /subscribeTerminalEvents\(id,/);
  assert.doesNotMatch(panel, /new EventSource|addEventListener\("(?:online|offline|pagehide|pageshow)"/);
});
