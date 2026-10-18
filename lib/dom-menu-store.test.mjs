import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { readFile } from "node:fs/promises";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { closeDomMenu, domMenuEntries, getDomMenu, openDomMenu, subscribeDomMenu } = await jiti.import("./dom-menu-store.ts");

const sep = { kind: "separator" };

test("predefined items are dropped and the separators around them tidied", () => {
  const out = domMenuEntries([
    { kind: "predefined", item: "Copy" },
    sep,
    { label: "a" },
    sep,
    { kind: "predefined", item: "Paste" },
    sep,
  ]);
  assert.deepEqual(out.map((e) => e.kind ?? e.label), ["a"]);
});

test("open publishes the menu to subscribers and close clears it", () => {
  let calls = 0;
  const off = subscribeDomMenu(() => { calls += 1; });
  openDomMenu([{ label: "Open" }], { x: 10, y: 20 });
  assert.equal(calls, 1);
  assert.deepEqual(getDomMenu()?.at, { x: 10, y: 20 });
  closeDomMenu();
  assert.equal(calls, 2);
  assert.equal(getDomMenu(), null);
  closeDomMenu();
  assert.equal(calls, 2, "closing a closed menu does not notify");
  off();
});

test("terminal appearance metadata is limited to its own menu lifetime", () => {
  openDomMenu([{ label: "Blink cursor", checked: true }], { x: 20, y: 30 }, "terminal");
  assert.equal(getDomMenu()?.appearance, "terminal");
  openDomMenu([{ label: "Open" }], { x: 10, y: 20 });
  assert.equal(getDomMenu()?.appearance, undefined);
  closeDomMenu();
});

test("DOM disabled reasons stay focusable while actions remain guarded", async () => {
  const host = await readFile(new URL("../components/DomContextMenuHost.tsx", import.meta.url), "utf8");
  assert.match(host, /aria-disabled=\{entry\.disabled \|\| undefined\}/);
  assert.match(host, /disabled=\{entry\.disabled && !entry\.disabledReason\}/);
  assert.match(host, /if \(!entry\.disabled\) onItem\(entry, \{ shiftKey: event\.shiftKey \}\)/);
  assert.match(host, /if \(item\.disabled\) return;/);
  assert.match(host, /item\.onSelect\?\.\(modifiers\)/);
});

test("session appearance and disabled reasons use the shared DOM menu", () => {
  openDomMenu([{ label: "Split view", disabled: true, disabledReason: "Unavailable" }], { x: 10, y: 20 }, "session");
  assert.equal(getDomMenu()?.appearance, "session");
  assert.equal(getDomMenu()?.entries[0].disabledReason, "Unavailable");
  closeDomMenu();
});

test("a menu with nothing renderable is not opened", () => {
  openDomMenu([{ kind: "predefined", item: "Copy" }], { x: 0, y: 0 });
  assert.equal(getDomMenu(), null);
});
