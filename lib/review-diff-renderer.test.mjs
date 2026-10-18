import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const load = () => jiti.import("./review-diff-renderer.ts");
const patch = "diff --git a/test.ts b/test.ts\n--- a/test.ts\n+++ b/test.ts\n@@ -9,4 +9,5 @@\n before\n+inserted\n anchor\n-deleted\n+replacement\n tail\n";
const tokenText = nodes => (nodes ?? []).map(node => node.type === "text" ? node.value : tokenText(node.children)).join("");

test("mature parser preserves real revision identities and exact source text", async () => {
  const { parseReviewDiff, reviewDiffSelection, reviewChangeLine } = await load();
  const file = parseReviewDiff(patch);
  assert.equal(file.hunks.length, 1);
  const context = file.hunks[0].changes.find(change => change.content === "anchor");
  assert.equal(reviewChangeLine(context, "old"), 10);
  assert.equal(reviewChangeLine(context, "new"), 11);
  assert.deepEqual(reviewDiffSelection(file.hunks, "old", 10, 11), { start: 10, end: 11, snippet: "anchor\ndeleted" });
  assert.deepEqual(reviewDiffSelection(file.hunks, "new", 11, 12), { start: 11, end: 12, snippet: "anchor\nreplacement" });
  assert.equal(reviewDiffSelection(file.hunks, "old", 0, 1), null);
  assert.equal(reviewDiffSelection(file.hunks, "new", 1, 501), null);
});

test("library parser retains CR, Unicode, whitespace and no-final-newline metadata", async () => {
  const { parseReviewDiff, reviewDiffSelection } = await load();
  const file = parseReviewDiff("--- a/test.txt\n+++ b/test.txt\n@@ -1,2 +1,2 @@\n \t中文😀\r\n-old\r\n+new\r\n\\ No newline at end of file\n");
  assert.equal(file.newEndingNewLine, false);
  assert.deepEqual(reviewDiffSelection(file.hunks, "new", 1, 2), { start: 1, end: 2, snippet: "\t中文😀\r\nnew\r" });
});

test("selection refuses omitted gaps and absent sides", async () => {
  const { parseReviewDiff, reviewDiffSelection } = await load();
  const file = parseReviewDiff("--- a/a\n+++ b/a\n@@ -1 +1 @@\n-a\n+b\n@@ -10 +10 @@\n-c\n+d\n");
  assert.equal(reviewDiffSelection(file.hunks, "old", 1, 10), null);
});

test("library tokens preserve exact text and word edits without carrying syntax across omitted hunks", async () => {
  const { parseReviewDiff, tokenizeReviewDiff } = await load();
  const file = parseReviewDiff("--- a/test.sh\n+++ b/test.sh\n@@ -1,3 +1,3 @@\n-cat <<EOF\n+echo start\n body\n EOF\n@@ -20 +20 @@\n-echo old\n+echo new\n");
  const tokens = tokenizeReviewDiff(file.hunks, "test.sh", true);
  assert.equal(tokenText(tokens.old[1]), "body");
  assert.equal(tokenText(tokens.new[1]), "body");
  assert.equal(tokenText(tokens.old[19]), "echo old");
  assert.equal(tokenText(tokens.new[19]), "echo new");
  assert.match(JSON.stringify(tokens.old[0]), /edit/);
  assert.match(JSON.stringify(tokens.old[1]), /string/);
  assert.doesNotMatch(JSON.stringify(tokens.new[1]), /string/);
});

for (const highlight of [true, false]) for (const budgetFallback of [false, true]) {
  test(`empty source tokens and selections stay exact with highlight ${highlight ? "enabled" : "disabled"}${budgetFallback ? " after tokenizer-budget fallback" : ""}`, async () => {
    const { parseReviewDiff, preserveReviewEmptyLines, reviewDiffSelection, tokenizeReviewDiff } = await load();
    const longLine = "x".repeat(5000);
    const count = budgetFallback ? 5 : 4;
    const file = parseReviewDiff(`--- a/test.ts\n+++ b/test.ts\n@@ -1,${count} +1,${count} @@\n \n-\n-old\n+new\n+\n \t  \n${budgetFallback ? ` ${longLine}\n` : ""}`);
    assert.ok(file);
    const rawTokens = tokenizeReviewDiff(file.hunks, "test.ts", highlight);
    if (budgetFallback) assert.equal(rawTokens, undefined, "The fixture must actually exercise tokenizer-budget fallback");
    else assert.ok(rawTokens, "The regular fixture must use the tokenizer");
    const tokens = preserveReviewEmptyLines(file.hunks, rawTokens);
    assert.ok(tokens, "Empty source lines still require exact-text tokens after fallback");
    const expected = { old: ["", "", "old", "\t  "], new: ["", "new", "", "\t  "] };
    for (const side of ["old", "new"]) {
      const blankLines = side === "old" ? [1, 2] : [1, 3];
      for (const line of blankLines) {
        // An absent or empty token list triggers the library's visual-space fallback.
        assert.ok(tokens[side][line - 1]?.length > 0);
        assert.equal(tokenText(tokens[side][line - 1]), "");
        assert.deepEqual(reviewDiffSelection(file.hunks, side, line, line), { start: line, end: line, snippet: "" });
      }
      assert.deepEqual(reviewDiffSelection(file.hunks, side, 1, 4), { start: 1, end: 4, snippet: expected[side].join("\n") });
      if (budgetFallback) {
        assert.deepEqual(Object.keys(tokens[side]), blankLines.map(line => String(line - 1)), "Fallback keeps only the exact blank-line sentinels");
        assert.equal(tokens[side][count - 1], undefined);
      } else {
        assert.deepEqual(expected[side].map((_, index) => tokenText(tokens[side][index])), expected[side]);
      }
    }
  });
}

test("empty-line preservation never invents a token or selectable line on a missing revision", async () => {
  const { parseReviewDiff, preserveReviewEmptyLines, reviewDiffSelection } = await load();
  for (const side of ["old", "new"]) {
    const header = side === "old" ? "@@ -1 +0,0 @@\n-\n" : "@@ -0,0 +1 @@\n+\n";
    const file = parseReviewDiff(`--- a/test.ts\n+++ b/test.ts\n${header}`);
    const tokens = preserveReviewEmptyLines(file.hunks);
    const absent = side === "old" ? "new" : "old";
    assert.ok(tokens[side][0]?.length > 0);
    assert.equal(tokenText(tokens[side][0]), "");
    assert.deepEqual(Object.keys(tokens[absent]), []);
    assert.deepEqual(reviewDiffSelection(file.hunks, side, 1, 1), { start: 1, end: 1, snippet: "" });
    assert.equal(reviewDiffSelection(file.hunks, absent, 1, 1), null);
  }
});

test("renaming Python to plain text keeps each revision's grammar and absolute coordinates", async () => {
  const { parseReviewDiff, tokenizeReviewDiff } = await load();
  const file = parseReviewDiff("--- a/script.py\n+++ b/script.txt\n@@ -1000000,2 +2000000,2 @@\n def run():\n-    return True\n+    return False\n");
  const tokens = tokenizeReviewDiff(file.hunks, "script.txt", true, "script.py");
  assert.ok(tokens);
  assert.equal(tokenText(tokens.old[999999]), "def run():");
  assert.equal(tokenText(tokens.old[1000000]), "    return True");
  assert.equal(tokenText(tokens.new[1999999]), "def run():");
  assert.equal(tokenText(tokens.new[2000000]), "    return False");
  assert.match(JSON.stringify(tokens.old[999999]), /keyword/);
  assert.match(JSON.stringify(tokens.old[1000000]), /keyword/);
  assert.doesNotMatch(JSON.stringify(Object.values(tokens.new)), /"token"/);
  assert.match(JSON.stringify(tokens.old[1000000]), /"edit"/);
  assert.match(JSON.stringify(tokens.new[2000000]), /"edit"/);
  assert.deepEqual(Object.keys(tokens.old), ["999999", "1000000"]);
  assert.deepEqual(Object.keys(tokens.new), ["1999999", "2000000"]);
});

test("word edits after leading empty replacement lines keep exact revision lines and whitespace", async () => {
  const { parseReviewDiff, tokenizeReviewDiff } = await load();
  const file = parseReviewDiff("--- a/count.ts\n+++ b/count.ts\n@@ -1000000,2 +2000000,2 @@\n-\n-\tconst count = 1;  \n+\n+\tconst count = 2;  \n");
  const tokens = tokenizeReviewDiff(file.hunks, "count.ts", true);
  const edits = nodes => (nodes ?? []).flatMap(node => node.type === "edit" ? [tokenText(node.children)] : edits(node.children));
  assert.ok(tokens);
  assert.deepEqual(Object.keys(tokens.old), ["999999", "1000000"]);
  assert.deepEqual(Object.keys(tokens.new), ["1999999", "2000000"]);
  assert.equal(tokenText(tokens.old[999999]), "");
  assert.equal(tokenText(tokens.new[1999999]), "");
  assert.equal(tokenText(tokens.old[1000000]), "\tconst count = 1;  ");
  assert.equal(tokenText(tokens.new[2000000]), "\tconst count = 2;  ");
  assert.deepEqual(edits(tokens.old[999999]), []);
  assert.deepEqual(edits(tokens.new[1999999]), []);
  assert.deepEqual(edits(tokens.old[1000000]), ["1"]);
  assert.deepEqual(edits(tokens.new[2000000]), ["2"]);
});

test("unequal leading blank counts and internal blanks keep edits on their own lines without mutating hunks", async () => {
  const { parseReviewDiff, tokenizeReviewDiff } = await load();
  const file = parseReviewDiff("--- a/count.ts\n+++ b/count.ts\n@@ -20,5 +30,4 @@\n-\n-\n-\tconst count = 1;  \n-\n-\treturn count + 3; \n+\n+\tconst count = 2;  \n+\n+\treturn count + 4; \n");
  const before = structuredClone(file.hunks);
  const tokens = tokenizeReviewDiff(file.hunks, "count.ts", true);
  const edits = nodes => (nodes ?? []).flatMap(node => node.type === "edit" ? [tokenText(node.children)] : edits(node.children));
  assert.ok(tokens);
  assert.deepEqual(file.hunks, before, "Edit discovery must not alter the parser's source changes");
  assert.deepEqual(Object.keys(tokens.old), ["19", "20", "21", "22", "23"]);
  assert.deepEqual(Object.keys(tokens.new), ["29", "30", "31", "32"]);
  assert.deepEqual(Object.values(tokens.old).map(tokenText), ["", "", "\tconst count = 1;  ", "", "\treturn count + 3; "]);
  assert.deepEqual(Object.values(tokens.new).map(tokenText), ["", "\tconst count = 2;  ", "", "\treturn count + 4; "]);
  assert.deepEqual(Object.values(tokens.old).map(edits), [[], [], ["1"], [], ["3"]]);
  assert.deepEqual(Object.values(tokens.new).map(edits), [[], ["2"], [], ["4"]]);
});

test("token budgets skip pathological source but high absolute line numbers remain cheap", async () => {
  const { parseReviewDiff, tokenizeReviewDiff } = await load();
  const high = parseReviewDiff("--- a/a.ts\n+++ b/a.ts\n@@ -1000000 +1000000 @@\n-const old = 1;\n+const next = 2;\n");
  const tokens = tokenizeReviewDiff(high.hunks, "a.ts", true);
  assert.ok(tokens.old[999999]);
  assert.ok(Object.keys(tokens.old).length <= 1, "Only actual source lines are stored, without allocating a million text entries");
  const huge = parseReviewDiff(`--- a/a.ts\n+++ b/a.ts\n@@ -1 +1 @@\n-${"x".repeat(5000)}\n+y\n`);
  assert.equal(tokenizeReviewDiff(huge.hunks, "a.ts", true), undefined);
});
