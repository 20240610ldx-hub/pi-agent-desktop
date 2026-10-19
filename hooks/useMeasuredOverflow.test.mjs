import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";

const compiled = ts.transpileModule(await readFile(new URL("./useMeasuredOverflow.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

// Exercise the public hook with browser geometry/observer boundaries, without a DOM or model service.
function mount({ height = 224, visible = true, resizeObserver = true } = {}) {
  let cursor = 0, dirty = false, current, frameId = 0, contentKey = "same source", threshold = 280;
  const slots = [], effects = [], frames = new Map(), observers = [], fontListeners = new Map(), windowListeners = new Map();
  let finishFonts;
  const fonts = { ready: new Promise((resolve) => { finishFonts = resolve; }),
    addEventListener(type, callback) { fontListeners.set(type, callback); },
    removeEventListener(type, callback) { if (fontListeners.get(type) === callback) fontListeners.delete(type); },
  };
  const child = {};
  const body = { firstElementChild: child, get scrollHeight() { return height; }, getClientRects: () => visible ? [{}] : [] };
  const react = {
    useRef(initial) { return slots[cursor++] ??= { current: initial }; },
    useState(initial) {
      const index = cursor++;
      const slot = slots[index] ??= { value: initial, set(update) {
        const next = typeof update === "function" ? update(slot.value) : update;
        if (!Object.is(next, slot.value)) { slot.value = next; dirty = true; }
      } };
      return [slot.value, slot.set];
    },
    useEffect(effect, deps) {
      const index = cursor++, old = slots[index];
      if (!old || deps.some((value, i) => !Object.is(value, old.deps[i]))) {
        const slot = slots[index] = { deps, cleanup: old?.cleanup };
        effects.push(() => { slot.cleanup?.(); slot.cleanup = effect(); });
      }
    },
  };
  class GeometryObserver {
    constructor(callback) { this.callback = callback; this.targets = new Set(); observers.push(this); }
    observe(target) { this.targets.add(target); }
    disconnect() { this.targets.clear(); }
  }
  const exports = {};
  const globals = { exports, require: (name) => { assert.equal(name, "react"); return react; },
    ResizeObserver: resizeObserver ? GeometryObserver : undefined,
    document: { fonts }, window: {
      addEventListener(type, callback) { windowListeners.set(type, callback); },
      removeEventListener(type, callback) { if (windowListeners.get(type) === callback) windowListeners.delete(type); },
    },
    requestAnimationFrame(callback) { const id = ++frameId; frames.set(id, callback); return id; },
    cancelAnimationFrame(id) { frames.delete(id); },
  };
  new Script(compiled).runInNewContext(globals);
  const render = () => {
    let passes = 0;
    do {
      assert.ok(++passes < 12, "geometry updates must settle without a render loop");
      dirty = false; cursor = 0;
      current = exports.useMeasuredOverflow(contentKey, threshold);
      current.bodyRef.current = body;
      for (const effect of effects.splice(0)) effect();
    } while (dirty);
    return current.overflowing;
  };
  const flush = () => { for (const [id, callback] of [...frames]) { frames.delete(id); callback(); } return render(); };
  render();
  return {
    get overflowing() { return current.overflowing; },
    resize(nextHeight) { height = nextHeight; for (const observer of observers) if (observer.targets.has(child)) observer.callback([]); return flush(); },
    show(value) { visible = value; return this.resize(height); },
    changeSource(value, nextHeight) { contentKey = value; height = nextHeight; return render(); },
    changeThreshold(value) { threshold = value; return render(); },
    fontEvent(type, nextHeight) { height = nextHeight; fontListeners.get(type)?.(); return flush(); },
    async fontsReady(nextHeight) { height = nextHeight; finishFonts(); await Promise.resolve(); return flush(); },
    windowResize(nextHeight) { height = nextHeight; windowListeners.get("resize")?.(); return flush(); },
    unmount() { for (const slot of slots) slot?.cleanup?.(); },
    staleResize: () => { for (const observer of observers) observer.callback([]); },
    get fontsListening() { return fontListeners.size; },
    get windowListening() { return windowListeners.size; },
    get observed() { return observers.flatMap((observer) => [...observer.targets]); },
    flush,
  };
}

test("same source gains and loses disclosure as natural content reflows while its body can remain clipped", () => {
  const hook = mount();
  assert.equal(hook.overflowing, false);
  assert.equal(hook.resize(537), true);
  assert.equal(hook.resize(224), false);
  assert.equal(hook.resize(537), true);
  hook.unmount();
});

test("hidden geometry retains the prior decision and measures again on reveal", () => {
  const hook = mount({ height: 537 });
  assert.equal(hook.overflowing, true);
  hook.show(false);
  assert.equal(hook.resize(0), true);
  assert.equal(hook.resize(224), true);
  assert.equal(hook.show(true), false);
  hook.unmount();
});

test("font completion, later font loading and fallback all refresh natural height", async () => {
  const hook = mount();
  assert.equal(await hook.fontsReady(537), true);
  assert.equal(hook.fontEvent("loadingdone", 224), false);
  assert.equal(hook.fontEvent("loadingerror", 537), true);
  hook.unmount();
});

test("source and threshold changes update measurements without replacing the owning component", () => {
  const hook = mount({ height: 537 });
  assert.equal(hook.changeSource("short replacement", 40), false);
  assert.equal(hook.changeThreshold(30), true);
  assert.equal(hook.changeThreshold(40), false);
  hook.unmount();
});

test("unmount cancels queued geometry work and ignores stale observer and font-ready callbacks", async () => {
  const hook = mount();
  hook.staleResize();
  hook.unmount();
  hook.staleResize();
  assert.equal(await hook.fontsReady(537), false);
  assert.equal(hook.windowResize(537), false);
  assert.equal(hook.fontEvent("loadingdone", 537), false);
  assert.equal(hook.fontsListening, 0);
  assert.equal(hook.windowListening, 0);
  assert.deepEqual(hook.observed, []);
});

test("window resize remains usable when ResizeObserver is unavailable", () => {
  const hook = mount({ resizeObserver: false });
  assert.equal(hook.windowResize(537), true);
  assert.equal(hook.windowResize(224), false);
  hook.unmount();
});
