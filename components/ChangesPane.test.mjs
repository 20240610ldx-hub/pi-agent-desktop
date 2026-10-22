import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { nextReviewSelection } = await jiti.import("../lib/git-review-display.ts");
const { parseReviewDiff, reviewChangeLine, reviewDiffSelection } = await jiti.import("../lib/review-diff-renderer.ts");
const shiftedPatch = "--- a/test.ts\n+++ b/test.ts\n@@ -9,4 +9,5 @@\n before\n+inserted\n anchor\n-deleted\n+replacement\n tail\n";
const patch = "--- a/test.ts\n+++ b/test.ts\n@@ -10,3 +10,4 @@\n same\n-old\n+first\n+second\n last\n";
const shiftedHunks = parseReviewDiff(shiftedPatch).hunks;
const contextAnchor = { old: 10, new: 11 };
const pick = (current, side, line, extend = false, split = false, inlineContextAnchor) => nextReviewSelection(current, {
  path: "test.ts", side, line, extend, inlineContextAnchor,
}, split);
const selected = (selection, hunks = shiftedHunks) => selection && reviewDiffSelection(hunks, selection.side, selection.start, selection.end);

// Domain transitions are tested through their exported API. Real SSR markup is
// covered by ReviewDiff.test.mjs; these tests do not simulate React scheduling.
test("an inline context anchor extends to deleted lines in the old revision", () => {
  const start = pick(null, "new", 11, false, false, contextAnchor);
  const range = pick(start, "old", 11, true);
  assert.equal(range.side, "old");
  assert.deepEqual(selected(range), { start: 10, end: 11, snippet: "anchor\ndeleted" });
});

test("an inline context start keeps both revision coordinates across explicit endpoints", () => {
  const start = pick(null, "new", 11, false, false, contextAnchor);
  const old = pick(start, "old", 11, true);
  const range = pick(old, "new", 12, true);
  assert.equal(range.side, "new");
  assert.deepEqual(selected(range), { start: 11, end: 12, snippet: "anchor\nreplacement" });
});

test("a split old-side selection extends after switching to one inline gutter", () => {
  const start = pick(null, "old", 10, false, true);
  const range = pick(start, "old", 11, true, false);
  assert.deepEqual(selected(range), { start: 10, end: 11, snippet: "anchor\ndeleted" });
  assert.deepEqual(selected(pick(range, "old", 12, true)), {
    start: 10, end: 12, snippet: "anchor\ndeleted\ntail",
  });
});

test("split gutters keep explicit revision choices even for a former inline context start", () => {
  for (const startedInline of [false, true]) {
    const start = pick(null, "new", 11, false, !startedInline, startedInline ? contextAnchor : undefined);
    const range = pick(start, "old", 11, true, true);
    assert.deepEqual(selected(range), { start: 11, end: 11, snippet: "deleted" });
    assert.equal(range.inlineContextAnchor, undefined);
  }
});

test("an added-line start cannot map to an old revision range", () => {
  const start = pick(null, "new", 10);
  const range = pick(start, "old", 11, true);
  assert.deepEqual(selected(range), { start: 11, end: 11, snippet: "deleted" });
});

test("cancelled or replaced context starts do not leak into a new Shift selection", () => {
  let selection = pick(null, "new", 11, false, false, contextAnchor);
  assert.deepEqual(selected(selection), { start: 11, end: 11, snippet: "anchor" });
  selection = null; // The parent owns cancellation; null is the domain boundary.
  assert.deepEqual(selected(pick(selection, "old", 11, true)), {
    start: 11, end: 11, snippet: "deleted",
  });
  const replacement = pick(pick(null, "new", 11, false, false, contextAnchor), "new", 10);
  assert.deepEqual(selected(pick(replacement, "old", 11, true)), {
    start: 11, end: 11, snippet: "deleted",
  });
});

test("the mature parser keeps original revision coordinates and feedback source", () => {
  const hunks = parseReviewDiff(patch).hunks;
  const changes = hunks.flatMap(hunk => hunk.changes);
  const removed = changes.find(change => change.type === "delete");
  const added = changes.filter(change => change.type === "insert");
  const last = changes.find(change => change.content === "last");
  assert.equal(reviewChangeLine(removed, "old"), 11);
  assert.equal(reviewChangeLine(removed, "new"), null);
  assert.deepEqual(added.map(change => reviewChangeLine(change, "new")), [11, 12]);
  assert.ok(added.every(change => reviewChangeLine(change, "old") === null));
  assert.equal(reviewChangeLine(last, "old"), 12);
  assert.equal(reviewChangeLine(last, "new"), 13);
  assert.deepEqual(selected({ path: "test.ts", side: "old", start: 11, end: 12 }, hunks), {
    start: 11, end: 12, snippet: "old\nlast",
  });
});

test("feedback keyboard wiring keeps the IME guard before Escape and submits selected source", () => {
  // A source-level consumer guard only. SSR does not execute keyboard events;
  // the actual browser checker retains composition/cancel interaction coverage.
  const source = readFileSync(new URL("./ReviewDiff.tsx", import.meta.url), "utf8");
  assert.match(source, /onKeyDown=\{event => \{\s*if \(event\.nativeEvent\.isComposing \|\| event\.keyCode === 229\) return;/);
  assert.match(source, /if \(event\.key === "Escape"\) \{ event\.preventDefault\(\); event\.stopPropagation\(\); onCancel\(\); \}/);
  assert.match(source, /event\.key === "Enter" && selected && feedback\.trim\(\)[^\n]*onSubmit\(selected\)/);
});

test("the parent consumes the selection domain and independent renderer without an inline engine", () => {
  const source = readFileSync(new URL("./ChangesPane.tsx", import.meta.url), "utf8");
  assert.match(source, /import\s*\{\s*ReviewDiff\s*\}\s*from\s*["']\.\/ReviewDiff/);
  assert.match(source, /import\s*\{[^}]*\bnextReviewSelection\b[^}]*\}\s*from\s*["']@\/lib\/git-review-display/);
  assert.match(source, /nextReviewSelection\(selection, \{ path: file\.path, side, line, extend, inlineContextAnchor \}, split\)/);
  assert.match(source, /setSelection\(next\); setFeedback\(unboundFeedback\); setUnboundFeedback\(""\); setNotice\(""\);/);
  assert.match(source, /const submitFeedback = async \(selected: \{ start: number; end: number; snippet: string \}\)/);
  assert.match(source, /selected\.start !== Math\.min\(selection\.start, selection\.end\) \|\| selected\.end !== Math\.max\(selection\.start, selection\.end\)/);
  assert.match(source, /onAddFeedback\(formatReviewFeedback\(\{ \.\.\.selected, path: file\.path,[^\n]*side: selection\.side, comment: feedback \}\)\)/);
  assert.match(source, /onSubmit=\{submitFeedback\}/);
  assert.equal(/function ReviewDiff\(|function ReviewRow\(|inlineReviewRows|reviewWordParts|tokenizeReviewCells|parseUnifiedPatch/.test(source), false, "The parent must delegate rendering and parsing to the independent renderer");
});

test("the parent cancellation clears selection and draft feedback and invalidates pending feedback", () => {
  const source = readFileSync(new URL("./ChangesPane.tsx", import.meta.url), "utf8");
  assert.match(source, /onCancel=\{\(\) => \{ feedbackGeneration\.current\+\+; setSelection\(null\); setFeedback\(""\); \}\}/);
  assert.match(source, /onSelectLine=\{\(side, line, extend, inlineContextAnchor\) => selectLine\(file, side, line, extend, inlineContextAnchor\)\}/);
});
