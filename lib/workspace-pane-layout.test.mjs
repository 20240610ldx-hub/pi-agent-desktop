import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeWorkspacePaneLayout,
  reconcileWorkspacePanes,
  resizeWorkspacePaneColumn,
  splitWorkspacePaneColumn,
  toggleWorkspacePaneExpanded,
} from "./workspace-pane-layout.ts";

const emptyLayout = () => ({ version: 1, columns: [], expandedPaneId: null });
const groups = (layout) => layout.columns.map((column) => column.paneIds);
const panes = ["tasks", "browser", "files", "terminal"];

function frozenLayout() {
  return Object.freeze({
    version: 1,
    columns: Object.freeze([
      Object.freeze({ id: "left", paneIds: Object.freeze(["tasks", "browser"]), width: 620.25, split: 0.35 }),
      Object.freeze({ id: "right", paneIds: Object.freeze(["files", "terminal"]), width: 840, split: 0.65 }),
    ]),
    expandedPaneId: null,
  });
}

test("opening panes 1/2 shares the first column; 3/4 opens a column to its right", () => {
  let layout = emptyLayout();
  const expected = [
    [["tasks"]],
    [["tasks", "browser"]],
    [["tasks", "browser"], ["files"]],
    [["tasks", "browser"], ["files", "terminal"]],
  ];
  for (let count = 1; count <= panes.length; count += 1) {
    const previous = layout;
    layout = reconcileWorkspacePanes(layout, panes.slice(0, count));
    assert.deepEqual(groups(layout), expected[count - 1]);
    assert.equal(layout.expandedPaneId, null);
    for (const column of layout.columns) {
      assert.equal(column.width, 400);
      assert.equal(column.split, 0.5);
    }
    for (const column of previous.columns) {
      assert.ok(layout.columns.some((next) => next.id === column.id));
    }
    assert.deepEqual(layout, reconcileWorkspacePanes(emptyLayout(), panes.slice(0, count)));
  }
  assert.deepEqual(groups(reconcileWorkspacePanes(layout, [...panes, "preview", "changes"])), [
    ["tasks", "browser"], ["files", "terminal"], ["preview", "changes"],
  ]);
});

test("closing a pane keeps surviving panes in their original columns with saved geometry", () => {
  const layout = frozenLayout();
  const next = reconcileWorkspacePanes(layout, ["terminal", "browser", "files"]);
  assert.deepEqual(next, {
    version: 1,
    columns: [
      { ...layout.columns[0], paneIds: ["browser"] },
      layout.columns[1],
    ],
    expandedPaneId: null,
  });
  assert.deepEqual(reconcileWorkspacePanes(next, ["files", "terminal", "browser"]), next);
});

test("deleting an empty left column preserves the right column ID, pane order and sizes", () => {
  const layout = frozenLayout();
  const next = reconcileWorkspacePanes(layout, ["terminal", "files"]);
  assert.deepEqual(next.columns, [layout.columns[1]]);
  assert.deepEqual(reconcileWorkspacePanes(next, []), emptyLayout());
});

test("new panes fill the rightmost vacancy without merging existing columns", () => {
  const layout = frozenLayout();
  const sparse = reconcileWorkspacePanes(layout, ["tasks", "files"]);
  assert.deepEqual(groups(sparse), [["tasks"], ["files"]]);
  const next = reconcileWorkspacePanes(sparse, ["new-pane", "files", "tasks"]);
  assert.deepEqual(groups(next), [["tasks"], ["files", "new-pane"]]);
  assert.deepEqual(next.columns.map((column) => column.id), ["left", "right"]);
  const filled = reconcileWorkspacePanes(next, ["tasks", "files", "new-pane", "another-pane"]);
  assert.deepEqual(groups(filled), [["tasks", "another-pane"], ["files", "new-pane"]]);
  assert.equal(filled.columns[0].width, 620.25);
  assert.equal(filled.columns[1].split, 0.65);
});

test("new column IDs are deterministic and avoid surviving and just-removed column IDs", () => {
  const layout = normalizeWorkspacePaneLayout({
    version: 1,
    columns: [
      { id: "column-1", paneIds: ["tasks"] },
      { id: "column-2", paneIds: ["files", "terminal"] },
    ],
  });
  const next = reconcileWorkspacePanes(layout, ["files", "terminal", "browser", "preview"]);
  assert.equal(next.columns[0].id, "column-2");
  assert.notEqual(next.columns[1].id, "column-1");
  assert.notEqual(next.columns[1].id, "column-2");
  assert.deepEqual(next, reconcileWorkspacePanes(layout, ["files", "terminal", "browser", "preview"]));
  assert.deepEqual(normalizeWorkspacePaneLayout(JSON.parse(JSON.stringify(next))), next);
});

test("invalid roots and unsupported storage versions normalize to an empty SSR-safe layout", () => {
  for (const raw of [
    undefined, null, false, 1, "broken JSON", [],
    {}, { version: "1", columns: [] }, { version: 2, columns: [] },
    { version: 1, columns: {} }, { version: 1, columns: null },
  ]) {
    assert.deepEqual(normalizeWorkspacePaneLayout(raw), emptyLayout());
  }
  const first = normalizeWorkspacePaneLayout(null);
  first.columns.push({ id: "mutated", paneIds: ["files"], width: 400, split: 0.5 });
  assert.deepEqual(normalizeWorkspacePaneLayout(null), emptyLayout());
});

test("storage recovery drops malformed, empty, duplicate and excess panes without repacking", () => {
  const raw = JSON.parse(JSON.stringify({
    version: 1,
    columns: [
      null, false, [], {}, { id: "invalid", paneIds: "tasks" },
      { id: "left", paneIds: [null, "tasks", "tasks", 4, "browser", "overflow"], width: 600, split: 0.4 },
      { id: "duplicate-only", paneIds: ["tasks", "browser"] },
      { id: "empty", paneIds: [] },
      { id: "right", paneIds: ["browser", "files", "files", "terminal"] },
      { id: "third", paneIds: ["overflow"] },
    ],
    expandedPaneId: "terminal",
    extra: "ignored",
  }));
  assert.deepEqual(normalizeWorkspacePaneLayout(raw), {
    version: 1,
    columns: [
      { id: "left", paneIds: ["tasks", "browser"], width: 600, split: 0.4 },
      { id: "right", paneIds: ["files", "terminal"], width: 400, split: 0.5 },
      { id: "third", paneIds: ["overflow"], width: 400, split: 0.5 },
    ],
    expandedPaneId: "terminal",
  });
  assert.equal(normalizeWorkspacePaneLayout({
    version: 1, columns: [{ id: "left", paneIds: ["tasks", "browser", "overflow"] }], expandedPaneId: "overflow",
  }).expandedPaneId, null);
});

const invalidIds = [
  "", " space", "space ", "a b", "a.b", "a/b", "a:b", "a\nb", "files\n", "files\r", "<pane>", "面板", "a".repeat(129),
  "__proto__", "prototype", "constructor", "toString", "hasOwnProperty", "__defineGetter__",
  null, undefined, false, 0, {}, [],
];

test("IDs require 1..128 simple ASCII characters and exclude prototype-related keys", () => {
  const validIds = ["files", "Terminal_2", "pane-3", "a".repeat(128)];
  const next = reconcileWorkspacePanes(emptyLayout(), [...invalidIds, ...validIds, ...validIds]);
  assert.deepEqual(next.columns.flatMap((column) => column.paneIds), validIds);
  assert.deepEqual(groups(normalizeWorkspacePaneLayout({
    version: 1,
    columns: [{ id: "left", paneIds: [...invalidIds, "files", "terminal"] }],
    expandedPaneId: "__proto__",
  })), [["files", "terminal"]]);
  assert.equal(Object.hasOwn(Object.prototype, "polluted"), false);
});

test("invalid and duplicate column IDs are repaired without stealing later valid keys", () => {
  const columns = [
    { id: "left", paneIds: ["tasks"] },
    { id: "left", paneIds: ["browser"] },
    ...invalidIds.map((id, index) => ({ id, paneIds: [`pane-${index}`] })),
    { id: "column-1", paneIds: ["files"] },
    { id: "column-2", paneIds: ["terminal"] },
  ];
  const raw = { version: 1, columns, expandedPaneId: "browser" };
  const normalized = normalizeWorkspacePaneLayout(raw);
  const ids = normalized.columns.map((column) => column.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[0], "left");
  assert.equal(ids.at(-2), "column-1");
  assert.equal(ids.at(-1), "column-2");
  for (const id of ids) {
    assert.match(id, /^[A-Za-z0-9_-]{1,128}$/);
    assert.ok(!invalidIds.includes(id));
  }
  assert.deepEqual(groups(normalized), columns.map((column) => column.paneIds));
  assert.deepEqual(normalizeWorkspacePaneLayout(raw), normalized);
  assert.deepEqual(normalizeWorkspacePaneLayout(normalized), normalized);
});

test("width and split normalization clamps finite numbers and defaults invalid values without coercion", () => {
  for (const [width, split, expectedWidth, expectedSplit] of [
    [100, -1, 280, 0.2], [1500, 2, 1200, 0.8],
    [280, 0.2, 280, 0.2], [1200, 0.8, 1200, 0.8],
    [620.25, 0.37, 620.25, 0.37],
    [NaN, NaN, 400, 0.5], [Infinity, Infinity, 400, 0.5], [-Infinity, -Infinity, 400, 0.5],
    ["600", "0.3", 400, 0.5], [null, null, 400, 0.5], [false, {}, 400, 0.5],
    [undefined, undefined, 400, 0.5],
  ]) {
    const normalized = normalizeWorkspacePaneLayout({
      version: 1, columns: [{ id: "left", paneIds: ["files"], width, split }],
    });
    assert.equal(normalized.columns[0].width, expectedWidth);
    assert.equal(normalized.columns[0].split, expectedSplit);
  }
});

test("resize and split updates clamp only the target column and survive a JSON storage round trip", () => {
  const layout = frozenLayout();
  const resized = resizeWorkspacePaneColumn(layout, "left", 50);
  assert.equal(resized.columns[0].width, 280);
  assert.equal(resized.columns[0].split, 0.35);
  assert.deepEqual(resized.columns[1], layout.columns[1]);
  assert.equal(resizeWorkspacePaneColumn(layout, "left", 9000).columns[0].width, 1200);
  assert.equal(resizeWorkspacePaneColumn(layout, "left", NaN).columns[0].width, 400);
  assert.equal(resizeWorkspacePaneColumn(layout, "left", Infinity).columns[0].width, 400);
  const split = splitWorkspacePaneColumn(resized, "right", 0.05);
  assert.equal(split.columns[1].split, 0.2);
  assert.equal(split.columns[1].width, 840);
  assert.deepEqual(split.columns[0], resized.columns[0]);
  assert.equal(splitWorkspacePaneColumn(layout, "right", 5).columns[1].split, 0.8);
  assert.equal(splitWorkspacePaneColumn(layout, "right", NaN).columns[1].split, 0.5);
  assert.equal(splitWorkspacePaneColumn(layout, "right", -Infinity).columns[1].split, 0.5);
  const saved = splitWorkspacePaneColumn(resizeWorkspacePaneColumn(layout, "left", 720.5), "right", 0.42);
  const restored = normalizeWorkspacePaneLayout(JSON.parse(JSON.stringify(saved)));
  assert.deepEqual(restored, saved);
  assert.deepEqual(reconcileWorkspacePanes(restored, [...panes].reverse()), saved);
  assert.deepEqual(resizeWorkspacePaneColumn(layout, "missing", 900), layout);
  assert.deepEqual(splitWorkspacePaneColumn(layout, "__proto__", 0.3), layout);
});

test("expand, switch and restore preserve all column IDs, pane order and geometry", () => {
  const layout = frozenLayout();
  const expanded = toggleWorkspacePaneExpanded(layout, "browser");
  assert.equal(expanded.expandedPaneId, "browser");
  assert.deepEqual(expanded.columns, layout.columns);
  assert.deepEqual(normalizeWorkspacePaneLayout(JSON.parse(JSON.stringify(expanded))), expanded);
  assert.deepEqual(toggleWorkspacePaneExpanded(expanded, "missing"), expanded);
  assert.deepEqual(toggleWorkspacePaneExpanded(expanded, "__proto__"), expanded);
  const switched = toggleWorkspacePaneExpanded(expanded, "terminal");
  assert.equal(switched.expandedPaneId, "terminal");
  assert.deepEqual(switched.columns, layout.columns);
  assert.deepEqual(toggleWorkspacePaneExpanded(switched, "terminal"), layout);
});

test("closing the expanded pane restores the remaining layout; closing another pane keeps expansion", () => {
  const layout = toggleWorkspacePaneExpanded(frozenLayout(), "files");
  const stillExpanded = reconcileWorkspacePanes(layout, ["tasks", "files", "terminal"]);
  assert.equal(stillExpanded.expandedPaneId, "files");
  const restored = reconcileWorkspacePanes(stillExpanded, ["tasks", "terminal"]);
  assert.deepEqual(restored, {
    version: 1,
    columns: [
      { id: "left", paneIds: ["tasks"], width: 620.25, split: 0.35 },
      { id: "right", paneIds: ["terminal"], width: 840, split: 0.65 },
    ],
    expandedPaneId: null,
  });
  const emptyColumnRemoved = reconcileWorkspacePanes(layout, ["tasks", "browser"]);
  assert.equal(emptyColumnRemoved.expandedPaneId, null);
  assert.deepEqual(emptyColumnRemoved.columns, [layout.columns[0]]);
});

test("normalization only restores expansion for an existing valid pane", () => {
  for (const expandedPaneId of [undefined, null, "missing", "left", ...invalidIds]) {
    assert.equal(normalizeWorkspacePaneLayout({
      version: 1, columns: [{ id: "left", paneIds: ["files"] }], expandedPaneId,
    }).expandedPaneId, null);
  }
});

test("all operations leave frozen inputs untouched and do not share mutable pane arrays", () => {
  const layout = frozenLayout();
  const snapshot = JSON.parse(JSON.stringify(layout));
  const openPaneIds = Object.freeze([...panes, "preview"]);
  const results = [
    normalizeWorkspacePaneLayout(layout),
    reconcileWorkspacePanes(layout, openPaneIds),
    resizeWorkspacePaneColumn(layout, "left", 700),
    splitWorkspacePaneColumn(layout, "right", 0.4),
    toggleWorkspacePaneExpanded(layout, "files"),
  ];
  for (const result of results) {
    result.columns[0].paneIds.pop();
    assert.deepEqual(layout, snapshot);
  }
  assert.deepEqual(openPaneIds, [...panes, "preview"]);
});
