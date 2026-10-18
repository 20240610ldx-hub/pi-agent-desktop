import assert from "node:assert/strict";
import test from "node:test";
import { parseUnifiedPatch } from "./patch.ts";
import { formatReviewFeedback, inlineReviewRows, reviewFileGroup, reviewSelection, reviewWordParts, shortReviewRef } from "./git-review-display.ts";

const patch = `--- a/old.ts
+++ b/new.ts
@@ -10,4 +10,5 @@
 same
-first old
-second old
+first new
+second new
+third new
 last
@@ -30,1 +31,1 @@
-tail old
+tail new
`;

test("inline review preserves deletion block then addition block and actual line numbers", () => {
  const rows = inlineReviewRows(parseUnifiedPatch(patch)[0].rows);
  const changed = rows.filter((row) => row.type === "line" && row.cell.type !== "context");
  assert.deepEqual(changed.slice(0, 5).map((row) => [row.cell.type, row.oldLine, row.newLine, row.cell.text]), [
    ["removed", 11, null, "first old"], ["removed", 12, null, "second old"],
    ["added", null, 11, "first new"], ["added", null, 12, "second new"], ["added", null, 13, "third new"],
  ]);
  assert.deepEqual(rows.filter((row) => row.type === "hunk").map((row) => row.omitted), [9, 16]);
});

test("feedback refuses hidden gaps, wrong-side additions, and excessive line ranges", () => {
  const rows = parseUnifiedPatch(patch)[0].rows;
  assert.deepEqual(reviewSelection(rows, "old", 12, 10), { start: 10, end: 12, snippet: "same\nfirst old\nsecond old" });
  assert.deepEqual(reviewSelection(rows, "new", 11, 13), { start: 11, end: 13, snippet: "first new\nsecond new\nthird new" });
  assert.equal(reviewSelection(rows, "old", 14, 30), null);
  assert.equal(reviewSelection(rows, "old", 0, 1), null);
  assert.equal(reviewSelection(rows, "new", 1, 501), null);
  assert.equal(reviewSelection(rows, "old", 13, 14), null);
});

test("word highlighting preserves CJK, spacing and punctuation and bounds pathological lines", () => {
  const before = "const 名称 = 'old';\t // keep";
  const after = "const 名称 = 'new';\t // keep";
  const parts = reviewWordParts(before, after);
  assert.equal(parts.old.map((part) => part.text).join(""), before);
  assert.equal(parts.new.map((part) => part.text).join(""), after);
  assert.deepEqual(parts.old.filter((part) => part.changed), [{ text: "old", changed: true }]);
  assert.deepEqual(parts.new.filter((part) => part.changed), [{ text: "new", changed: true }]);
  assert.ok(reviewWordParts("a".repeat(5000), "b").old.every((part) => !part.changed));
  assert.ok(reviewWordParts("a ".repeat(200), "b ".repeat(200)).new.every((part) => !part.changed));
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
