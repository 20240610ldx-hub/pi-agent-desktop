import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import test from "node:test";
import ts from "typescript";

const source = await readFile(new URL("./SidebarTitle.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("SidebarTitle.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
visit(ast);
const effects = nodes.filter((node) => ts.isCallExpression(node) && node.expression.getText(ast) === "useLayoutEffect");
const compile = (text) => new Script(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText);

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, callback) { listeners.set(type, callback); },
    removeEventListener(type, callback) { if (listeners.get(type) === callback) listeners.delete(type); },
    fire(type, event = {}) { listeners.get(type)?.(event); },
    listeners,
  };
}

function setup(scrollWidth = 200, clientWidth = 100) {
  const button = { ...eventTarget(), matches: () => true };
  const title = { ...eventTarget(), scrollWidth, clientWidth, closest: () => button };
  const window = eventTarget();
  const document = { activeElement: null };
  const timers = new Map();
  let timerId = 0;
  let resize;
  let disconnected = false;
  const state = { overflowing: false, visible: false, position: null };
  const context = createContext({
    titleRef: { current: title }, window, document,
    setOverflowing(value) { state.overflowing = value; },
    setVisible(value) { state.visible = value; },
    setPosition(value) { state.position = value; },
    setTimeout(callback) { timers.set(++timerId, callback); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    isImeComposing: (event) => event.isComposing || event.keyCode === 229,
    ResizeObserver: class {
      constructor(callback) { resize = callback; }
      observe() {}
      disconnect() { disconnected = true; }
    },
  });
  const cleanup = compile(`(${effects[0].arguments[0].getText(ast)})()`).runInContext(context);
  return {
    button, title, window, document, state, cleanup,
    resize: () => resize(),
    tick: () => { const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach((callback) => callback()); },
    get disconnected() { return disconnected; },
  };
}

test("a fitting name has neither fade state nor a hover/focus tooltip", () => {
  const ui = setup(100, 100);
  ui.title.fire("pointerenter", { pointerType: "mouse" });
  ui.tick();
  ui.button.fire("focus");
  assert.equal(ui.state.overflowing, false);
  assert.equal(ui.state.visible, false);
});

test("a clipped name opens after hover delay and closes on leave", () => {
  const ui = setup();
  assert.equal(ui.state.overflowing, true);
  ui.title.fire("pointerenter", { pointerType: "mouse" });
  assert.equal(ui.state.visible, false);
  ui.tick();
  assert.equal(ui.state.visible, true);
  ui.title.fire("pointerleave");
  assert.equal(ui.state.visible, false);
  ui.title.fire("pointerenter", { pointerType: "touch" });
  ui.tick();
  assert.equal(ui.state.visible, false);
});

test("native keyboard focus reveals the full name and Escape respects IME", () => {
  const ui = setup();
  ui.document.activeElement = ui.button;
  ui.button.fire("focus");
  assert.equal(ui.state.visible, true);
  ui.button.fire("keydown", { key: "Escape", isComposing: true });
  assert.equal(ui.state.visible, true);
  ui.button.fire("keydown", { key: "Escape", keyCode: 229 });
  assert.equal(ui.state.visible, true);
  ui.button.fire("keydown", { key: "Escape" });
  assert.equal(ui.state.visible, false);
  ui.button.fire("focus");
  ui.document.activeElement = null;
  ui.button.fire("blur");
  assert.equal(ui.state.visible, false);
});

test("resize removes stale clipping and scroll/activation closes the tooltip", () => {
  const ui = setup();
  ui.button.fire("focus");
  ui.window.fire("scroll");
  assert.equal(ui.state.visible, false);
  ui.button.fire("focus");
  ui.button.fire("pointerdown");
  assert.equal(ui.state.visible, false);
  ui.button.fire("focus");
  ui.title.clientWidth = 250;
  ui.resize();
  assert.equal(ui.state.overflowing, false);
  assert.equal(ui.state.visible, false);
});

test("mouse activation does not leave a keyboard-only tooltip behind", () => {
  const ui = setup();
  ui.button.matches = () => false;
  ui.document.activeElement = ui.button;
  ui.button.fire("focus");
  assert.equal(ui.state.visible, false);
  ui.title.fire("pointerenter", { pointerType: "mouse" });
  ui.tick();
  assert.equal(ui.state.visible, true);
  ui.title.fire("pointerleave");
  assert.equal(ui.state.visible, false);
});

test("the tooltip describes the focus button and preserves other descriptions", () => {
  const attributes = new Map([["aria-describedby", "existing"]]);
  const button = {
    getAttribute: (name) => attributes.get(name) ?? null,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: (name) => attributes.delete(name),
  };
  const context = createContext({ showTooltip: true, titleRef: { current: { closest: () => button } }, tooltipId: "full-name" });
  const cleanup = compile(`(${effects[1].arguments[0].getText(ast)})()`).runInContext(context);
  assert.equal(attributes.get("aria-describedby"), "existing full-name");
  button.setAttribute("aria-describedby", "existing full-name later");
  cleanup();
  assert.equal(attributes.get("aria-describedby"), "existing later");
});

test("unmount clears pending hover and all listeners", () => {
  const ui = setup();
  ui.title.fire("pointerenter", { pointerType: "mouse" });
  ui.cleanup();
  ui.tick();
  assert.equal(ui.state.visible, false);
  assert.equal(ui.disconnected, true);
  assert.equal(ui.title.listeners.size, 0);
  assert.equal(ui.button.listeners.size, 0);
  assert.equal(ui.window.listeners.size, 0);
});

test("the full-name popover is clamped to the viewport", () => {
  let position;
  const context = createContext({
    showTooltip: true,
    titleRef: { current: { getBoundingClientRect: () => ({ right: 270, top: 5, height: 20 }) } },
    tooltipRef: { current: { getBoundingClientRect: () => ({ width: 250, height: 36 }) } },
    window: { innerWidth: 400, innerHeight: 300 },
    setPosition: (value) => { position = value; },
  });
  compile(`(${effects[2].arguments[0].getText(ast)})()`).runInContext(context);
  assert.equal(position.left, 142);
  assert.equal(position.top, 8);
});
