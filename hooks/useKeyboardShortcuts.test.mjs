import assert from "node:assert/strict";
import test from "node:test";
import { handleExpandRightPanelShortcut, handleGlobalEscape, handleOpenSettingsShortcut, registerAbortHandler } from "./useKeyboardShortcuts.ts";

function keydown(key, { tagName = "BUTTON", defaultPrevented = false } = {}) {
  return {
    key,
    target: { tagName },
    defaultPrevented,
    preventDefault() { this.defaultPrevented = true; },
  };
}

test("Escape stops a running agent when nothing else took the key", (t) => {
  let stopped = 0;
  registerAbortHandler(() => { stopped += 1; });
  t.after(() => registerAbortHandler(null));

  const event = keydown("Escape");
  assert.equal(handleGlobalEscape(event), true);
  assert.equal(stopped, 1);
  assert.equal(event.defaultPrevented, true);
  // Focus on the page itself, as after a click on nothing in particular.
  assert.equal(handleGlobalEscape(keydown("Escape", { tagName: "BODY" })), true);
  assert.equal(stopped, 2);
  assert.equal(handleGlobalEscape(keydown("Enter")), false);
  assert.equal(stopped, 2);
});

test("an Escape something nearer already handled does not stop the agent too", (t) => {
  let stopped = 0;
  registerAbortHandler(() => { stopped += 1; });
  t.after(() => registerAbortHandler(null));

  // Settings, the Mermaid viewer or a menu closed on it and marked it handled.
  assert.equal(handleGlobalEscape(keydown("Escape", { defaultPrevented: true })), false);
  // ChatInput and other fields keep their own Escape.
  assert.equal(handleGlobalEscape(keydown("Escape", { tagName: "TEXTAREA" })), false);
  assert.equal(handleGlobalEscape(keydown("Escape", { tagName: "INPUT" })), false);
  assert.equal(stopped, 0);
});

test("with no run to stop, Escape is left alone", () => {
  registerAbortHandler(null);
  const event = keydown("Escape");
  assert.equal(handleGlobalEscape(event), false);
  assert.equal(event.defaultPrevented, false);
});

test("panel expansion uses the physical backslash key with Ctrl/Cmd+Shift and respects handled events", () => {
  let expanded = 0;
  const expand = () => { expanded += 1; };
  const event = (mods = {}) => ({ code: "Backslash", key: "|", ctrlKey: true, metaKey: false, shiftKey: true, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods });
  assert.equal(handleExpandRightPanelShortcut(event(), expand), true);
  assert.equal(handleExpandRightPanelShortcut(event({ ctrlKey: false, metaKey: true }), expand), true);
  assert.equal(expanded, 2);
  for (const mods of [{ shiftKey: false }, { altKey: true }, { ctrlKey: false }, { code: "KeyA" }, { defaultPrevented: true }]) {
    assert.equal(handleExpandRightPanelShortcut(event(mods), expand), false);
  }
  assert.equal(handleExpandRightPanelShortcut(event(), undefined), false);
  assert.equal(expanded, 2);
});

test("Cmd/Ctrl+, opens Settings unless it is already open or the key was taken", () => {
  let opened = 0;
  const open = () => { opened += 1; };
  const comma = (mods = {}) => ({ key: ",", metaKey: false, ctrlKey: false, shiftKey: false, altKey: false, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...mods });

  const ctrl = comma({ ctrlKey: true });
  assert.equal(handleOpenSettingsShortcut(ctrl, open), true);
  assert.equal(ctrl.defaultPrevented, true);
  assert.equal(handleOpenSettingsShortcut(comma({ metaKey: true }), open), true);
  assert.equal(opened, 2);

  assert.equal(handleOpenSettingsShortcut(comma(), open), false);
  assert.equal(handleOpenSettingsShortcut(comma({ ctrlKey: true, shiftKey: true }), open), false);
  assert.equal(handleOpenSettingsShortcut(comma({ ctrlKey: true, defaultPrevented: true }), open), false);
  assert.equal(handleOpenSettingsShortcut(comma({ ctrlKey: true }), undefined), false);
  assert.equal(opened, 2);
});
