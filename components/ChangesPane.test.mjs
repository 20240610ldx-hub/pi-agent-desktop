import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { Script } from "node:vm";
import { createJiti } from "jiti";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const display = await jiti.import("../lib/git-review-display.ts");
const syntax = await jiti.import("../lib/review-syntax.ts");
const { parseUnifiedPatch } = await jiti.import("../lib/patch.ts");
const source = readFileSync(new URL("./ChangesPane.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("ChangesPane.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const functions = ast.statements.filter(node => ts.isFunctionDeclaration(node) && ["Icon", "ReviewDiff", "ReviewRow"].includes(node.name?.text));
assert.equal(functions.length, 3);
const code = ts.transpileModule(functions.map(node => node.getText(ast)).join("\n"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
// ReviewDiff is a presentation leaf: run its real JSX and pure memo computations.
// Interaction and view-switch behavior are also checked through the actual browser.
const ReviewDiff = new Script(`${code}\nReviewDiff;`).runInNewContext({
  require: createRequire(import.meta.url), exports: {}, useMemo: fn => fn(), parseUnifiedPatch, ...display, ...syntax,
});
const patch = "--- a/test.ts\n+++ b/test.ts\n@@ -10,3 +10,4 @@\n same\n-old\n+first\n+second\n last\n";
const words = { feedback: "Add feedback", old: "Old", new: "New", unchanged: "unchanged lines", selectedLines: "Selected lines", cancel: "Cancel", addDraft: "Add to draft" };
function render(overrides = {}) {
  return renderToStaticMarkup(React.createElement(ReviewDiff, {
    file: { path: "test.ts" }, data: { supported: true, patch }, words,
    split: false, wrap: true, highlight: true, context: 3, selection: null,
    feedback: "", pending: false, onMore() {}, onSelectLine() {}, setFeedback() {}, onCancel() {}, onSubmit() {}, ...overrides,
  }));
}
function codeRows(html) { return [...html.matchAll(/<tr class="changes-code-row [^"]*">([\s\S]*?)<\/tr>/g)].map(match => match[1]); }

test("inline diff renders exactly one revision-aware number and three cells per code row", () => {
  const rows = codeRows(render());
  assert.equal(rows.length, 5);
  for (const row of rows) {
    assert.equal((row.match(/<td\b/g) ?? []).length, 3);
    assert.equal((row.match(/class="changes-line-number/g) ?? []).length, 1);
  }
  assert.ok(rows[1].includes('aria-label="Add feedback: Old 11"'));
  assert.ok(rows[2].includes('aria-label="Add feedback: New 11"'));
  assert.ok(rows[4].includes('aria-label="Add feedback: New 13"'));
  assert.match(render(), /class="changes-hunk"><td colSpan="3"/);
});

test("an old-side selection keeps old context numbers, feedback identity and table span after switching inline", () => {
  const html = render({ selection: { path: "test.ts", side: "old", start: 11, end: 12 } });
  const rows = codeRows(html);
  assert.ok(rows[4].includes('aria-label="Add feedback: Old 12"'));
  assert.ok(rows[4].includes('aria-pressed="true"'));
  assert.match(html, /changes-feedback-row"><td colSpan="3"/);
  assert.ok(html.includes("Selected lines: Old 11–12"));
});

test("split diff retains both revision gutters and four cells per code row", () => {
  const rows = codeRows(render({ split: true }));
  for (const row of rows) assert.equal((row.match(/<td\b/g) ?? []).length, 4);
  assert.ok(rows[0].includes('aria-label="Add feedback: Old 10"'));
  assert.ok(rows[0].includes('aria-label="Add feedback: New 10"'));
});
