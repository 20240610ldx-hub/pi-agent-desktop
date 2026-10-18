import assert from "node:assert/strict";
import test from "node:test";
import { formatReviewFeedback, reviewFileGroup, shortReviewRef } from "./git-review-display.ts";

test("a context anchor follows old and new endpoints without mutating the original selection", async () => {
  const { nextReviewSelection } = await import("./git-review-display.ts");
  assert.equal(typeof nextReviewSelection, "function");
  const anchor = Object.freeze({ old: 10, new: 11 });
  const start = Object.freeze(nextReviewSelection(null, { path: "test.ts", side: "new", line: 11, extend: false, inlineContextAnchor: anchor }, false));
  assert.deepEqual(start, { path: "test.ts", side: "new", start: 11, end: 11, inlineContextAnchor: anchor });
  const old = nextReviewSelection(start, { path: "test.ts", side: "old", line: 11, extend: true }, false);
  assert.deepEqual(old, { path: "test.ts", side: "old", start: 10, end: 11, inlineContextAnchor: anchor });
  const next = nextReviewSelection(old, { path: "test.ts", side: "new", line: 12, extend: true }, false);
  assert.deepEqual(next, { path: "test.ts", side: "new", start: 11, end: 12, inlineContextAnchor: anchor });
  assert.deepEqual(start, { path: "test.ts", side: "new", start: 11, end: 11, inlineContextAnchor: anchor });
});

test("selection ranges preserve explicit sides and discard unmappable or cancelled anchors", async () => {
  const { nextReviewSelection } = await import("./git-review-display.ts");
  const context = { path: "test.ts", side: "new", start: 11, end: 11, inlineContextAnchor: { old: 10, new: 11 } };
  assert.deepEqual(nextReviewSelection(context, { path: "test.ts", side: "old", line: 11, extend: true }, true), {
    path: "test.ts", side: "old", start: 11, end: 11,
  }, "Split gutters do not convert a former inline anchor");
  const old = nextReviewSelection(null, { path: "test.ts", side: "old", line: 10, extend: false }, true);
  assert.deepEqual(nextReviewSelection(old, { path: "test.ts", side: "old", line: 12, extend: true }, false), {
    path: "test.ts", side: "old", start: 10, end: 12,
  }, "An explicit old selection survives switching inline");
  const added = nextReviewSelection(context, { path: "test.ts", side: "new", line: 10, extend: false }, false);
  assert.deepEqual(added, { path: "test.ts", side: "new", start: 10, end: 10 });
  assert.deepEqual(nextReviewSelection(added, { path: "test.ts", side: "old", line: 11, extend: true }, false), {
    path: "test.ts", side: "old", start: 11, end: 11,
  }, "An added-only start has no old-side mapping");
  assert.deepEqual(nextReviewSelection(null, { path: "test.ts", side: "old", line: 11, extend: true }, false), {
    path: "test.ts", side: "old", start: 11, end: 11,
  }, "After cancellation Shift starts fresh");
  assert.deepEqual(nextReviewSelection(context, { path: "other.ts", side: "old", line: 21, extend: true }, false), {
    path: "other.ts", side: "old", start: 21, end: 21,
  }, "A context anchor cannot cross file identities");
});

test("draft feedback identifies side, rename, revisions and escapes embedded Markdown fences", () => {
  const text = formatReviewFeedback({ path: "new name.ts", oldPath: "old name.ts", comparisonId: "comparison-123", oldRevision: "base-oid", newRevision: "head-oid", side: "old", start: 5, end: 6, snippet: "```\nline", comment: "  Make it clearer. " });
  assert.ok(text.includes('"old name.ts" (old lines 5-6)'));
  assert.ok(text.includes("Old revision: base-oid"));
  assert.ok(text.includes("New revision: head-oid"));
  assert.ok(text.includes("Comparison: comparison-123"));
  assert.ok(text.includes('Renamed: "old name.ts" → "new name.ts"'));
  assert.ok(text.includes("````\n```\nline\n````"));
  assert.ok(text.endsWith("Make it clearer."));
});

test("grouping and branch labels preserve meaningful paths and remote names", () => {
  assert.equal(reviewFileGroup("src/widget.test.tsx"), "tests");
  assert.equal(reviewFileGroup("fixtures/input.json"), "tests");
  assert.equal(reviewFileGroup("src/__generated__/types.ts"), "generated");
  assert.equal(reviewFileGroup("package-lock.json"), "generated");
  assert.equal(reviewFileGroup("src/building.ts"), "source");
  assert.equal(shortReviewRef("refs/remotes/origin/main"), "origin/main");
  assert.equal(shortReviewRef("refs/heads/feature/main"), "feature/main");
});

test("review keyboard routes Home and End within a list but preserves editors, IME and modifiers", async () => {
  const { reviewNavigationIndex, reviewPaneShortcut } = await import("./git-review-display.ts");
  assert.equal(reviewNavigationIndex({ key: "End" }, 1, 5), 4);
  assert.equal(reviewNavigationIndex({ key: "Home" }, 3, 5), 0);
  assert.equal(reviewNavigationIndex({ key: "ArrowDown" }, 4, 5), 4);
  assert.equal(reviewNavigationIndex({ key: "ArrowUp" }, 0, 5), 0);
  assert.equal(reviewNavigationIndex({ key: "Home" }, 0, 0), null);
  assert.equal(reviewNavigationIndex({ key: "End", editable: true }, 1, 5), null);
  assert.equal(reviewNavigationIndex({ key: "End", isComposing: true }, 1, 5), null);
  assert.equal(reviewNavigationIndex({ key: "End", keyCode: 229 }, 1, 5), null);
  assert.equal(reviewNavigationIndex({ key: "Home", ctrlKey: true }, 1, 5), null);
  assert.equal(reviewNavigationIndex({ key: "Tab" }, 1, 5), null);
  assert.equal(reviewPaneShortcut({ key: "p", ctrlKey: true }), "finder");
  assert.equal(reviewPaneShortcut({ key: "Y", ctrlKey: true, shiftKey: true }), "files");
  assert.equal(reviewPaneShortcut({ key: "p", ctrlKey: true, editable: true }), null);
  assert.equal(reviewPaneShortcut({ key: "p", ctrlKey: true, isComposing: true }), null);
  assert.equal(reviewPaneShortcut({ key: "p", ctrlKey: true, keyCode: 229 }), null);
  assert.equal(reviewPaneShortcut({ key: "p", ctrlKey: true, altKey: true }), null);
  assert.equal(reviewPaneShortcut({ key: "p", metaKey: true, defaultPrevented: true }), null);
});
