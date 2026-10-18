import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";
import { fromHtml } from "hast-util-from-html";
const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ReviewDiff } = await jiti.import("./ReviewDiff.tsx");
const { parseReviewDiff, reviewDiffSelection } = await jiti.import("../lib/review-diff-renderer.ts");
const words = { feedback: "Add feedback", old: "Old", new: "New", selectedLines: "Selected lines", selectionGap: "Invalid selection", feedbackHint: "Describe this change", cancel: "Cancel", sendingFeedback: "Adding", addDraft: "Add to draft", binary: "Binary", tooLarge: "Too large", metadata: "Metadata only", noPatch: "No changes", patchTruncated: "Incomplete diff", unchanged: "unchanged lines", fullContext: "All unchanged lines", context: "More lines", noFinalNewline: "No newline at end of file" };
const patch = "--- a/test.ts\n+++ b/test.ts\n@@ -9,4 +9,5 @@\n before\n+inserted\n anchor\n-deleted\n+replacement\n tail\n";
function render(props = {}) {
  return renderToStaticMarkup(React.createElement(ReviewDiff, {
    file: { path: "test.ts", status: "modified" }, data: { supported: true, patch }, words,
    split: false, wrap: true, highlight: true, context: 3, selection: null,
    feedback: "", pending: false, onMore() {}, onSelectLine() {}, setFeedback() {}, onCancel() {}, async onSubmit() {}, ...props,
  }));
}

function findAll(node, predicate) {
  return [...(predicate(node) ? [node] : []), ...(node.children ?? []).flatMap(child => findAll(child, predicate))];
}
const hasClass = (node, name) => (node.properties?.className ?? []).includes(name);
// Read text nodes verbatim: stripping tags or normalizing whitespace would hide source corruption.
const textContent = node => node.type === "text" ? node.value : (node.children ?? []).map(textContent).join("");
const sourceRows = tree => findAll(tree, node => node.tagName === "tr" && hasClass(node, "diff-line"));
const codeCells = row => findAll(row, node => node.tagName === "td" && hasClass(node, "diff-code"));

test("Changes mounts the mature renderer and no longer contains its own diff table engine", () => {
  const source = readFileSync(new URL("./ChangesPane.tsx", import.meta.url), "utf8");
  assert.match(source, /import\s*\{\s*ReviewDiff\s*\}\s*from\s*["']\.\/ReviewDiff/);
  assert.doesNotMatch(source, /function ReviewDiff\(/);
  assert.doesNotMatch(source, /reviewWordParts|tokenizeReviewCells|inlineReviewRows/);
});

test("unified has exactly one accessible revision-aware feedback button per displayed source line", () => {
  const html = render();
  assert.match(html, /data-diff-renderer="react-diff-view"/);
  assert.equal((html.match(/data-review-line=/g) ?? []).length, 6);
  assert.match(html, /aria-label="Add feedback: Old 11"/);
  assert.match(html, /aria-label="Add feedback: New 12"/);
  assert.ok(html.includes("diff-code-insert"));
  assert.ok(html.includes("diff-code-delete"));
});

test("old context selection keeps old labels, old syntax and one feedback editor in unified mode", () => {
  const html = render({ selection: { path: "test.ts", side: "old", start: 10, end: 11 }, feedback: "Keep source identity" });
  assert.ok(html.includes("Selected lines: Old 10–11"));
  assert.match(html, /data-review-side="old" data-review-line="10"[^>]*aria-pressed="true"/);
  assert.equal((html.match(/<textarea/g) ?? []).length, 1);
  assert.ok(html.includes("Keep source identity"));
});

test("split preserves both revision feedback targets and leaves missing sides empty", () => {
  const html = render({ split: true });
  assert.match(html, /aria-label="Add feedback: Old 10"/);
  assert.match(html, /aria-label="Add feedback: New 11"/);
  assert.doesNotMatch(html, /data-review-line="(?:0|-1)"/);
  assert.match(html, /diff-split/);
});

test("split pairs replacement blocks using library alignment", () => {
  const html = render({ split: true, data: { supported: true, patch: "--- a/a.ts\n+++ b/a.ts\n@@ -1,2 +1,2 @@\n-old first\n-old second\n+new first\n+new second\n" } });
  const rows = sourceRows(fromHtml(html, { fragment: true }));
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map(row => codeCells(row).map(textContent)), [
    ["old first", "new first"],
    ["old second", "new second"],
  ]);
});

for (const side of ["old", "new"]) {
  test(`split normal context selection marks only the ${side} revision and mounts one editor`, () => {
    const line = side === "old" ? 10 : 11;
    const tree = fromHtml(render({
      split: true,
      selection: { path: "test.ts", side, start: line, end: line },
      feedback: `Feedback for ${side} anchor`,
    }), { fragment: true });
    const rows = sourceRows(tree);
    const row = rows.find(item => codeCells(item).some(cell => textContent(cell) === "anchor"));
    assert.ok(row, "The normal context row must be displayed");
    assert.deepEqual(codeCells(row).map(textContent), ["anchor", "anchor"]);
    assert.ok(hasClass(row, `review-selected-${side}`));
    assert.ok(!hasClass(row, `review-selected-${side === "old" ? "new" : "old"}`));
    assert.equal(rows.filter(item => hasClass(item, "review-selected-old") || hasClass(item, "review-selected-new")).length, 1);
    // The library's normal change key belongs to both revisions; generic selection
    // classes would therefore highlight both cells instead of the selected side.
    assert.equal(findAll(row, node => hasClass(node, "diff-code-selected") || hasClass(node, "diff-gutter-selected")).length, 0);
    const buttons = findAll(row, node => node.tagName === "button");
    assert.deepEqual(buttons.map(button => ({
      side: button.properties.dataReviewSide,
      line: button.properties.dataReviewLine,
      label: button.properties.ariaLabel,
      pressed: button.properties.ariaPressed,
      selected: hasClass(button, "is-selected"),
    })), ["old", "new"].map(revision => ({
      side: revision,
      line: revision === "old" ? "10" : "11",
      label: `Add feedback: ${revision === "old" ? "Old 10" : "New 11"}`,
      pressed: revision === side ? "true" : "false",
      selected: revision === side,
    })));
    const editors = findAll(tree, node => node.tagName === "textarea");
    assert.equal(editors.length, 1);
    assert.equal(textContent(editors[0]), `Feedback for ${side} anchor`);
    const labels = findAll(tree, node => hasClass(node, "changes-feedback-label"));
    assert.deepEqual(labels.map(textContent), [`Selected lines: ${side === "old" ? "Old 10" : "New 11"}test.ts`]);
    assert.equal(findAll(tree, node => hasClass(node, "changes-feedback-error")).length, 0);
  });
}

for (const split of [false, true]) for (const highlight of [true, false]) for (const budgetFallback of [false, true]) {
  test(`${split ? "split" : "unified"} preserves exact empty source cells with highlight ${highlight ? "enabled" : "disabled"}${budgetFallback ? " after tokenizer-budget fallback" : ""}`, () => {
    const longLine = "x".repeat(5000);
    const count = budgetFallback ? 5 : 4;
    const emptyPatch = `--- a/test.ts\n+++ b/test.ts\n@@ -1,${count} +1,${count} @@\n \n-\n-old\n+new\n+\n \t  \n${budgetFallback ? ` ${longLine}\n` : ""}`;
    const tree = fromHtml(render({ split, highlight, data: { supported: true, patch: emptyPatch } }), { fragment: true });
    const expected = split
      ? [["", ""], ["", "new"], ["old", ""], ["\t  ", "\t  "]]
      : [[""], [""], ["old"], ["new"], [""], ["\t  "]];
    if (budgetFallback) expected.push(split ? [longLine, longLine] : [longLine]);
    // No trim or whitespace normalization: an invented fallback space must fail.
    assert.deepEqual(sourceRows(tree).map(row => codeCells(row).map(textContent)), expected);
    assert.equal(findAll(tree, node => hasClass(node, "diff-code-edit")).length > 0, highlight && !budgetFallback);
  });
}

test("word edits and existing syntax are rendered by the mature tokenizer without interpreting source HTML", () => {
  const html = render({ data: { supported: true, patch: "--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-const name = '<script>old</script>';\n+const name = '<script>new</script>';\n" } });
  assert.ok(html.includes("diff-code-edit"));
  assert.ok(html.includes("token"));
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(!html.includes("<script>"));
  const plain = render({ highlight: false });
  assert.ok(!plain.includes("diff-code-edit"));
});

for (const split of [false, true]) for (const missingSide of ["old", "new", "both", "neither"]) {
  test(`${split ? "split" : "unified"} localizes one EOF notice when ${missingSide} revision lacks its final newline without adding it to source`, () => {
    const noFinalNewline = "末尾没有换行 <EOF> & fin";
    const marker = "\\ No newline at end of file\n";
    const eofPatch = `--- a/test.ts\n+++ b/test.ts\n@@ -1 +1 @@\n-old value\n${missingSide === "old" || missingSide === "both" ? marker : ""}+new value\n${missingSide === "new" || missingSide === "both" ? marker : ""}`;
    const tree = fromHtml(render({ split, data: { supported: true, patch: eofPatch }, words: { ...words, noFinalNewline } }), { fragment: true });
    const notices = findAll(tree, node => hasClass(node, "changes-eof-note"));
    const sides = missingSide === "both" ? "Old / New" : missingSide === "old" ? "Old" : "New";
    assert.deepEqual(notices.map(textContent), missingSide === "neither" ? [] : [`${sides}: ${noFinalNewline}`]);
    if (missingSide !== "neither") assert.equal(notices[0].properties.dataReviewSide, missingSide);
    assert.deepEqual(sourceRows(tree).map(row => codeCells(row).map(textContent)), split ? [["old value", "new value"]] : [["old value"], ["new value"]]);
    const file = parseReviewDiff(eofPatch);
    assert.ok(file);
    for (const side of ["old", "new"]) {
      assert.equal(file[side === "old" ? "oldEndingNewLine" : "newEndingNewLine"], missingSide !== side && missingSide !== "both");
      assert.deepEqual(reviewDiffSelection(file.hunks, side, 1, 1), { start: 1, end: 1, snippet: `${side} value` });
    }
  });
}

for (const side of ["old", "new"]) {
  test(`split whole-file ${side === "new" ? "addition" : "deletion"} has only its real revision heading, source and feedback`, () => {
    const added = side === "new";
    const patch = `diff --git a/test.ts b/test.ts\n${added ? "new file mode 100644\n--- /dev/null\n+++ b/test.ts\n@@ -0,0 +1 @@\n+" : "deleted file mode 100644\n--- a/test.ts\n+++ /dev/null\n@@ -1 +0,0 @@\n-"}const value = 1;\n\\ No newline at end of file\n`;
    const tree = fromHtml(render({ split: true, data: { supported: true, patch }, selection: { path: "test.ts", side, start: 1, end: 1 } }), { fragment: true });
    const headings = findAll(tree, node => hasClass(node, "changes-library-revisions"));
    assert.equal(headings.length, 1);
    assert.deepEqual(headings[0].children.filter(node => node.type === "element").map(textContent), [added ? "New" : "Old"]);
    assert.deepEqual(sourceRows(tree).map(row => codeCells(row).map(textContent)), [["const value = 1;"]]);
    const buttons = findAll(sourceRows(tree)[0], node => node.tagName === "button");
    assert.equal(buttons.length, 1);
    assert.equal(buttons[0].properties.dataReviewSide, side);
    assert.equal(findAll(tree, node => node.tagName === "textarea").length, 1);
    assert.deepEqual(findAll(tree, node => hasClass(node, "changes-eof-note")).map(textContent), [`${added ? "New" : "Old"}: ${words.noFinalNewline}`]);
  });
}

test("a renamed file keeps the old revision grammar in its real split consumer", () => {
  const tree = fromHtml(render({ split: true, file: { path: "script.txt", oldPath: "script.py", status: "renamed" }, data: { supported: true, patch: "--- a/script.py\n+++ b/script.txt\n@@ -1,2 +1,2 @@\n-def old():\n-    return 1\n+def next():\n+    return 2\n" } }), { fragment: true });
  for (const row of sourceRows(tree)) {
    const cells = codeCells(row);
    assert.ok(findAll(cells[0], node => hasClass(node, "keyword")).length > 0);
    assert.equal(findAll(cells[1], node => hasClass(node, "keyword")).length, 0);
  }
});

test("large absolute line numbers and unsupported file states remain presentable", () => {
  const html = render({ data: { supported: true, patch: "--- a/a.ts\n+++ b/a.ts\n@@ -1000000 +1000000 @@\n-old\n+new\n" } });
  assert.ok(html.includes("1000000"));
  assert.ok(render({ data: { supported: false, patch: "", reason: "binary" } }).includes("Binary"));
  assert.ok(render({ data: { supported: false, patch: "", reason: "too-large" } }).includes("Too large"));
});
