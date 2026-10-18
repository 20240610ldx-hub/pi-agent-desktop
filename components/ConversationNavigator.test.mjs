import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { createJiti } from "jiti";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("../hooks/useI18n.tsx");
const { ConversationNavigator, SESSION_START_INDEX, getConversationLocationTitle, findActiveConversationLocation, keepConversationItemVisible } = await jiti.import("./ConversationNavigator.tsx");
const { isImeComposing } = await jiti.import("../lib/ime.ts");
const source = readFileSync(new URL("./ConversationNavigator.tsx", import.meta.url), "utf8");
const chatSource = readFileSync(new URL("./ChatWindow.tsx", import.meta.url), "utf8");

function variableCallback(text, name) {
  const file = ts.createSourceFile("component.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(file) === name) {
      const value = node.initializer;
      return ts.isCallExpression(value) ? value.arguments[0] : value;
    }
    return ts.forEachChild(node, visit);
  }
  const callback = visit(file);
  assert.ok(callback, `${name} exists`);
  return new Script(ts.transpileModule(callback.getText(file), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText);
}

function keyEvent(key, overrides = {}) {
  return {
    key, nativeEvent: {}, prevented: false, stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
    ...overrides,
  };
}

const turns = [
  { index: 0, entryId: "first", question: "## Existing heading\nSecond line" },
  { index: 1, entryId: "second", question: "真实用户问题\nMore text" },
];

test("the rail has one real start plus loaded user turns, without question/answer previews", () => {
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(ConversationNavigator, { turns, hasSessionStart: true, scrollContainerRef: { current: null }, onSelect() {} })));
  assert.match(html, /aria-expanded="false"/);
  assert.equal((html.match(/conversation-navigator-tick/g) ?? []).length, 3);
  assert.equal((html.match(/is-active/g) ?? []).length, 1);
  assert.doesNotMatch(html, /conversation-navigator-preview|role="slider"/);
  const noHistoryStart = renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(ConversationNavigator, { turns, scrollContainerRef: { current: null }, onSelect() {} })));
  assert.equal((noHistoryStart.match(/conversation-navigator-tick/g) ?? []).length, 2);
});

test("directory labels preserve the first real line rather than inventing chapters", () => {
  assert.equal(getConversationLocationTitle("\n  ## Existing heading\r\nBody"), "Existing heading");
  assert.equal(getConversationLocationTitle("真实问题首行\n后续内容"), "真实问题首行");
  assert.equal(getConversationLocationTitle("#literal is not a heading\nBody"), "#literal is not a heading");
  assert.equal(getConversationLocationTitle("#\nBody"), "#");
});

test("scroll active follows section boundaries and does not jump toward a nearer future turn", () => {
  const anchors = [{ index: 2, top: -1100 }, { index: 3, top: 90 }, { index: 4, top: 500 }];
  assert.equal(findActiveConversationLocation(anchors, 28, false, false), 2);
  assert.equal(findActiveConversationLocation(anchors, 90, false, false), 3);
  assert.equal(findActiveConversationLocation(anchors, 800, false, false), 4);
  assert.equal(findActiveConversationLocation(anchors, 28, true, true), SESSION_START_INDEX);
  assert.equal(findActiveConversationLocation([], 28, false, false), null);
  assert.equal(findActiveConversationLocation([{ index: 0, top: 100 }], 28, false, true), SESSION_START_INDEX);
});

test("keeping a current item visible scrolls only its bounded directory or rail", () => {
  const container = { scrollTop: 100, clientTop: 1, clientHeight: 80, getBoundingClientRect: () => ({ top: 10 }) };
  keepConversationItemVisible(container, { getBoundingClientRect: () => ({ top: 20, bottom: 50 }) });
  assert.equal(container.scrollTop, 100);
  keepConversationItemVisible(container, { getBoundingClientRect: () => ({ top: -9, bottom: 20 }) });
  assert.equal(container.scrollTop, 80);
  keepConversationItemVisible(container, { getBoundingClientRect: () => ({ top: 100, bottom: 120 }) });
  assert.equal(container.scrollTop, 109);
});

test("track arrows and Home/End really select bounded locations; IME keys leave navigation alone", () => {
  const script = variableCallback(source, "handleTriggerKeyDown");
  for (const [key, current, expected] of [["ArrowUp", 2, 1], ["ArrowDown", 2, 3], ["ArrowUp", 0, 0], ["ArrowDown", 3, 3], ["Home", 3, 0], ["End", 0, 3]]) {
    let selection = null;
    let open = false;
    const handler = script.runInNewContext({ isImeComposing, activePosition: current, locations: Array(4), keyboardFocusRef: {}, setIsOpen(value) { open = value; }, selectPosition(value) { selection = value; } });
    const event = keyEvent(key);
    handler(event);
    assert.equal(selection, expected);
    assert.equal(open, true);
    assert.equal(event.prevented, true);
  }
  for (const override of [{ nativeEvent: { isComposing: true } }, { nativeEvent: { keyCode: 229 } }, { ctrlKey: true }]) {
    const handler = script.runInNewContext({ isImeComposing });
    const event = keyEvent("ArrowDown", override);
    handler(event);
    assert.equal(event.prevented, false);
  }
});

test("directory arrows move focus independently of scroll active; Enter remains native button activation", () => {
  const script = variableCallback(source, "handleDirectoryKeyDown");
  for (const [key, expected] of [["ArrowUp", 1], ["ArrowDown", 3], ["Home", 0], ["End", 6]]) {
    let focus = null;
    const handler = script.runInNewContext({ isImeComposing, focusedPosition: 2, locations: Array(7), keyboardFocusRef: {}, focusPosition(value) { focus = value; } });
    const event = keyEvent(key);
    handler(event);
    assert.equal(focus, expected);
    assert.equal(event.prevented, true);
  }
  const handler = script.runInNewContext({ isImeComposing });
  for (const event of [keyEvent("Enter"), keyEvent("ArrowDown", { nativeEvent: { keyCode: 229 } })]) {
    handler(event);
    assert.equal(event.prevented, false);
  }
});

test("row selection passes the actual turn index, including the real session start", () => {
  const script = variableCallback(source, "selectPosition");
  const selected = [];
  const active = [];
  const focused = [];
  const handler = script.runInNewContext({
    locations: [{ index: SESSION_START_INDEX, key: "session-start" }, { index: 17, key: "real-entry-id" }],
    setActiveKey(value) { active.push(value); }, setFocusedPosition(value) { focused.push(value); }, onSelect(value) { selected.push(value); },
  });
  handler(0);
  handler(1);
  handler(99);
  assert.deepEqual(selected, [SESSION_START_INDEX, 17]);
  assert.deepEqual(active, ["session-start", "real-entry-id"]);
  assert.deepEqual(focused, [0, 1]);
});

test("Escape consumes only internal keys, leaves outside menus and IME in control, and restores internal focus", () => {
  const close = variableCallback(source, "closeDirectory");
  const escape = variableCallback(source, "onEscape");
  class Node {}
  const row = new Node();
  const composerMenu = new Node();
  const rootRef = { current: { contains: (value) => value === row } };
  let open = true;
  let focusCount = 0;
  const trigger = { focus() { focusCount++; } };
  const skipFocusOpenRef = { current: false };
  const closeDirectory = close.runInNewContext({
    setIsOpen(value) { open = value; }, rootRef,
    document: { activeElement: row }, skipFocusOpenRef, triggerRef: { current: trigger },
  });
  const handler = escape.runInNewContext({ closeDirectory, isImeComposing, Node, rootRef });
  for (const target of [row, composerMenu]) {
    for (const native of [{ isComposing: true }, { keyCode: 229 }]) {
      const event = keyEvent("Escape", { target, nativeEvent: native });
      handler(event);
      assert.equal(open, true);
      assert.equal(event.prevented, false);
      assert.equal(event.stopped, false);
      assert.equal(focusCount, 0);
    }
  }
  const outside = keyEvent("Escape", { target: composerMenu });
  handler(outside);
  assert.equal(open, false, "Outside Escape still dismisses the hover directory");
  assert.equal(outside.prevented, false, "The outside menu can consume its own Escape");
  assert.equal(outside.stopped, false);
  assert.equal(focusCount, 0, "Closing the hover directory must not move outside focus");
  open = true;
  const inside = keyEvent("Escape", { target: row });
  handler(inside);
  assert.equal(open, false);
  assert.equal(focusCount, 1);
  assert.equal(skipFocusOpenRef.current, true);
  assert.equal(inside.prevented, true);
  assert.equal(inside.stopped, true);
});

test("list growth preserves manual directory scroll; opening and a different current entry reveal the active row", () => {
  // Run the component's real layout callbacks and dependency arrays across
  // commits, without substituting the reveal condition with a test copy.
  const file = ts.createSourceFile("ConversationNavigator.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const layoutCalls = [];
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(file) === "useLayoutEffect") layoutCalls.push(node.getText(file));
    ts.forEachChild(node, visit);
  }
  visit(file);
  assert.equal(layoutCalls.length, 2);
  const script = new Script(ts.transpileModule(layoutCalls.join(";"), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText);
  const previousDependencies = [];
  const runs = [0, 0];
  const track = { scrollTop: 0, clientTop: 0, clientHeight: 10, getBoundingClientRect: () => ({ top: 0 }) };
  const directory = { scrollTop: 0, clientTop: 0, clientHeight: 100, getBoundingClientRect: () => ({ top: 0 }), querySelector() { return currentRow; } };
  const tick = { getBoundingClientRect: () => ({ top: 20, bottom: 22 }) };
  let currentRow = { getBoundingClientRect: () => ({ top: 200, bottom: 230 }) };
  function commit(isOpen, activeLocationKey, locationKey) {
    let callIndex = 0;
    script.runInNewContext({
      isOpen, activeLocationKey, locationKey, keepConversationItemVisible,
      activeTickRef: { current: tick }, triggerRef: { current: track }, directoryRef: { current: directory },
      useLayoutEffect(callback, dependencies) {
        const index = callIndex++;
        const previous = previousDependencies[index];
        if (!previous || dependencies.some((value, position) => !Object.is(value, previous[position]))) {
          callback(); runs[index]++;
        }
        previousDependencies[index] = [...dependencies];
      },
    });
  }
  commit(true, "entry-b", "entry-a\nentry-b");
  assert.equal(directory.scrollTop, 130, "Opening reveals the current item");
  directory.scrollTop = 400; // The user then reads another part of the list.
  track.scrollTop = 0;
  commit(true, "entry-b", "entry-a\nentry-b\nentry-c");
  assert.equal(directory.scrollTop, 400, "Appending a turn keeps the user's directory scroll");
  assert.equal(track.scrollTop, 12, "The clipped rail still reacts to a changed list");
  commit(true, "entry-b", "older-entry\nentry-a\nentry-b\nentry-c");
  assert.equal(directory.scrollTop, 400, "Prepending keeps the same current entry identity and manual scroll");
  currentRow = { getBoundingClientRect: () => ({ top: -50, bottom: -20 }) };
  commit(true, "entry-c", "older-entry\nentry-a\nentry-b\nentry-c");
  assert.equal(directory.scrollTop, 350, "A genuinely different current entry is revealed");
  commit(false, "entry-c", "older-entry\nentry-a\nentry-b\nentry-c");
  directory.scrollTop = 200;
  commit(true, "entry-c", "older-entry\nentry-a\nentry-b\nentry-c");
  assert.equal(directory.scrollTop, 150, "Reopening reveals the same current entry again");
  assert.deepEqual(runs, [4, 4]);
});

test("ChatWindow reveals historical anchors, cancels stale jumps, and respects reduced motion", () => {
  const script = variableCallback(chatSource, "selectConversationTurn");
  for (const [turnIndex, hasEarlierMessages, reducedMotion, expected] of [[12, true, false, 334], [SESSION_START_INDEX, false, true, 0], [SESSION_START_INDEX, true, false, null]]) {
    const calls = [];
    const frames = [];
    const cancelled = [];
    let visibleCount = 20;
    const navigatorFrameRef = { current: 42 };
    const container = {
      scrollTop: 300,
      getBoundingClientRect: () => ({ top: 100 }),
      querySelector(selector) { assert.equal(selector, '[data-conversation-turn="12"]'); return { getBoundingClientRect: () => ({ top: 150 }) }; },
      scrollTo(value) { calls.push(value); },
    };
    const handler = script.runInNewContext({
      SESSION_START_INDEX, hasEarlierMessages, messages: Array(100), navigatorFrameRef,
      setVisibleCount(update) { visibleCount = update(visibleCount); },
      cancelAnimationFrame(id) { cancelled.push(id); },
      requestAnimationFrame(callback) { frames.push(callback); return frames.length; },
      scrollContainerRef: { current: container },
      window: { matchMedia: () => ({ matches: reducedMotion }) },
    });
    handler(turnIndex);
    while (frames.length) frames.shift()();
    if (expected === null) {
      assert.equal(visibleCount, 20);
      assert.deepEqual(calls, []);
    } else {
      assert.equal(visibleCount, 200);
      assert.deepEqual(cancelled, [42]);
      assert.equal(calls[0].top, expected);
      assert.equal(calls[0].behavior, reducedMotion ? "instant" : "smooth");
      assert.equal(navigatorFrameRef.current, null);
    }
  }
});
