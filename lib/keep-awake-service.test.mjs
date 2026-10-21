import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { createKeepAwakeService } = await jiti.import("./keep-awake-service.ts");

function fakeBridge({ supported = true, web = false } = {}) {
  const calls = [];
  const bridge = {
    held: false,
    failNext: null,
    calls,
    async status() {
      calls.push("status");
      return web ? null : { supported, enabled: bridge.held };
    },
    async set(enabled) {
      calls.push(`set:${enabled}`);
      if (bridge.failNext) {
        const message = bridge.failNext;
        bridge.failNext = null;
        throw new Error(message);
      }
      bridge.held = enabled;
      return { supported, enabled: bridge.held };
    },
  };
  return bridge;
}

test("keep awake starts off and unknown until the native status arrives", async () => {
  const bridge = fakeBridge();
  const service = createKeepAwakeService(bridge);
  assert.deepEqual(service.getState(), {
    availability: "unknown",
    enabled: false,
    pending: false,
    error: null,
  });
  const state = await service.refresh();
  assert.equal(state.availability, "supported");
  assert.equal(state.enabled, false);
});

test("keep awake copies the OS-confirmed state and never goes optimistic", async () => {
  const bridge = fakeBridge();
  const service = createKeepAwakeService(bridge);
  await service.refresh();
  const seen = [];
  service.subscribe((state) => seen.push([state.enabled, state.pending]));
  const promise = service.setEnabled(true);
  assert.equal(service.getState().enabled, false);
  const state = await promise;
  assert.equal(state.enabled, true);
  assert.equal(bridge.held, true);
  assert.deepEqual(seen.at(0), [false, true]);
  assert.deepEqual(seen.at(-1), [true, false]);
  assert.equal((await service.setEnabled(false)).enabled, false);
});

test("keep awake failure keeps the previous state and reports the native error", async () => {
  const bridge = fakeBridge();
  const service = createKeepAwakeService(bridge);
  await service.refresh();
  bridge.failNext = "PowerSetRequest failed (error 5).";
  const failed = await service.setEnabled(true);
  assert.equal(failed.enabled, false);
  assert.equal(failed.pending, false);
  assert.equal(failed.error, "PowerSetRequest failed (error 5).");
  const ok = await service.setEnabled(true);
  assert.equal(ok.enabled, true);
  assert.equal(ok.error, null);

  bridge.failNext = "clear failed";
  const stillOn = await service.setEnabled(false);
  assert.equal(stillOn.enabled, true);
  assert.equal(stillOn.error, "clear failed");
});

test("keep awake in a browser is unavailable and never reaches the native toggle", async () => {
  const bridge = fakeBridge({ web: true });
  const service = createKeepAwakeService(bridge);
  const state = await service.refresh();
  assert.equal(state.availability, "unavailable");
  const attempt = await service.setEnabled(true);
  assert.equal(attempt.enabled, false);
  assert.match(attempt.error, /desktop app/);
  assert.deepEqual(bridge.calls, ["status"]);
});

test("keep awake on an unsupported platform returns a clear error without toggling", async () => {
  const bridge = fakeBridge({ supported: false });
  const service = createKeepAwakeService(bridge);
  assert.equal((await service.refresh()).availability, "unsupported");
  const attempt = await service.setEnabled(true);
  assert.equal(attempt.enabled, false);
  assert.match(attempt.error, /not supported/);
  assert.deepEqual(bridge.calls, ["status"]);
});

test("keep awake serializes rapid toggles in call order", async () => {
  const bridge = fakeBridge();
  const service = createKeepAwakeService(bridge);
  await service.refresh();
  const results = await Promise.all([
    service.setEnabled(true),
    service.setEnabled(false),
    service.setEnabled(true),
    service.setEnabled(true),
    service.setEnabled(false),
  ]);
  assert.deepEqual(bridge.calls.slice(1), [
    "set:true",
    "set:false",
    "set:true",
    "set:true",
    "set:false",
  ]);
  assert.equal(results.at(-1).enabled, false);
  assert.equal(bridge.held, false);
});

test("keep awake five enable/disable rounds end released", async () => {
  const bridge = fakeBridge();
  const service = createKeepAwakeService(bridge);
  await service.refresh();
  for (let i = 0; i < 5; i += 1) {
    assert.equal((await service.setEnabled(true)).enabled, true);
    assert.equal((await service.setEnabled(false)).enabled, false);
  }
  assert.equal(bridge.held, false);
});

test("keep awake unsubscribe stops notifications", async () => {
  const service = createKeepAwakeService(fakeBridge());
  let count = 0;
  const off = service.subscribe(() => {
    count += 1;
  });
  await service.refresh();
  const before = count;
  off();
  await service.refresh();
  assert.equal(count, before);
});
