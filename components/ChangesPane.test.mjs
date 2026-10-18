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

function findElement(node, predicate) {
  if (!React.isValidElement(node)) return null;
  if (predicate(node)) return node;
  if (typeof node.type === "function") return findElement(node.type(node.props), predicate);
  for (const child of React.Children.toArray(node.props.children)) {
    const found = findElement(child, predicate);
    if (found) return found;
  }
  return null;
}

// Exercise the real line button, parent forwarding callback and selection update.
// React scheduling and browser focus are outside this callback-level seam.
function selectionHarness(patch, initialSelection = null) {
  let selectLine;
  let parent;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "selectLine") selectLine = node.initializer;
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ReviewDiff") parent = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  assert.ok(selectLine && parent);
  const attribute = name => parent.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.text === name).initializer.expression.getText(ast);
  const env = {
    file: { path: "test.ts" }, selection: initialSelection, split: false, feedback: "", notice: "",
    feedbackGeneration: { current: 0 },
    setSelection(next) { env.selection = next; },
    setFeedback(next) { env.feedback = next; },
    setNotice(next) { env.notice = next; },
  };
  const callbackCode = ts.transpileModule(`const selectLine = ${selectLine.getText(ast)};
    ({ onSelectLine: ${attribute("onSelectLine")}, onCancel: ${attribute("onCancel")} });`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const callbacks = new Script(callbackCode).runInNewContext(env);
  const props = () => ({
    file: env.file, data: { supported: true, patch }, words, split: env.split, wrap: true,
    highlight: true, context: 3, selection: env.selection, feedback: env.feedback, pending: false,
    onMore() {}, setFeedback: env.setFeedback, onSubmit() {}, ...callbacks,
  });
  const tree = () => ReviewDiff(props());
  return {
    env,
    clickLine(label, shiftKey = false) {
      const button = findElement(tree(), node => node.type === "button" && node.props["aria-label"] === label);
      assert.ok(button, `Visible line button: ${label}`);
      button.props.onClick({ shiftKey });
    },
    typeFeedback(value) {
      const textarea = findElement(tree(), node => node.type === "textarea");
      assert.ok(textarea);
      textarea.props.onChange({ target: { value } });
    },
    feedbackKey(key, options = {}) {
      const textarea = findElement(tree(), node => node.type === "textarea");
      assert.ok(textarea);
      const result = { prevented: false, stopped: false };
      textarea.props.onKeyDown({
        key, nativeEvent: {}, ...options,
        preventDefault() { result.prevented = true; }, stopPropagation() { result.stopped = true; },
      });
      return result;
    },
    cancel() {
      const button = findElement(tree(), node => node.type === "button" && node.props.children === words.cancel);
      assert.ok(button);
      button.props.onClick();
    },
    html: () => renderToStaticMarkup(React.createElement(ReviewDiff, props())),
    selected: () => env.selection && display.reviewSelection(parseUnifiedPatch(patch)[0].rows, env.selection.side, env.selection.start, env.selection.end),
  };
}

const shiftedPatch = "--- a/test.ts\n+++ b/test.ts\n@@ -9,4 +9,5 @@\n before\n+inserted\n anchor\n-deleted\n+replacement\n tail\n";

test("an inline context anchor extends to deleted lines in the old revision", () => {
  const view = selectionHarness(shiftedPatch);
  view.clickLine("Add feedback: New 11");
  view.clickLine("Add feedback: Old 11", true);
  assert.ok(view.html().includes("Selected lines: Old 10–11"), "The context start survives the revision change");
  assert.deepEqual(view.selected(), { start: 10, end: 11, snippet: "anchor\ndeleted" });
});

test("an inline context start keeps both revision coordinates across explicit endpoints", () => {
  const view = selectionHarness(shiftedPatch);
  view.clickLine("Add feedback: New 11");
  view.clickLine("Add feedback: Old 11", true);
  view.clickLine("Add feedback: New 12", true);
  assert.ok(view.html().includes("Selected lines: New 11–12"));
  assert.deepEqual(view.selected(), { start: 11, end: 12, snippet: "anchor\nreplacement" });
});

test("a split old-side selection extends after switching to one inline gutter", () => {
  const view = selectionHarness(shiftedPatch);
  view.env.split = true;
  view.clickLine("Add feedback: Old 10");
  view.env.split = false;
  view.clickLine("Add feedback: Old 11", true);
  assert.ok(view.html().includes("Selected lines: Old 10–11"));
  assert.deepEqual(view.selected(), { start: 10, end: 11, snippet: "anchor\ndeleted" });
  view.clickLine("Add feedback: Old 12", true);
  assert.deepEqual(view.selected(), { start: 10, end: 12, snippet: "anchor\ndeleted\ntail" });
});

test("split gutters keep explicit revision choices even for a former inline context start", () => {
  for (const startedInline of [false, true]) {
    const view = selectionHarness(shiftedPatch);
    view.env.split = !startedInline;
    view.clickLine("Add feedback: New 11");
    view.env.split = true;
    view.clickLine("Add feedback: Old 11", true);
    assert.ok(view.html().includes("Selected lines: Old 11"));
    assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "deleted" });
  }
});

test("an added-line start cannot map to an old revision range", () => {
  const view = selectionHarness(shiftedPatch);
  view.clickLine("Add feedback: New 10");
  view.clickLine("Add feedback: Old 11", true);
  assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "deleted" });
  assert.ok(!view.html().includes("Selected lines: Old 10–11"));
});

test("cancel clears the context start before a new Shift selection", () => {
  const view = selectionHarness(shiftedPatch);
  view.clickLine("Add feedback: New 11");
  view.typeFeedback("draft comment");
  view.cancel();
  assert.equal(view.env.feedback, "");
  assert.ok(!view.html().includes("changes-feedback-row"));
  view.clickLine("Add feedback: Old 11", true);
  assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "deleted" });
  // Selecting another changed line also replaces any former context anchor.
  view.clickLine("Add feedback: New 10");
  view.clickLine("Add feedback: Old 11", true);
  assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "deleted" });
});

test("feedback Escape preserves composing input and otherwise cancels the selection", () => {
  const view = selectionHarness(shiftedPatch);
  view.clickLine("Add feedback: New 11");
  view.typeFeedback("input in progress");
  for (const options of [{ nativeEvent: { isComposing: true } }, { keyCode: 229 }]) {
    assert.deepEqual(view.feedbackKey("Escape", options), { prevented: false, stopped: false });
    assert.equal(view.env.feedback, "input in progress");
    assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "anchor" });
  }
  assert.deepEqual(view.feedbackKey("Escape"), { prevented: true, stopped: true });
  assert.equal(view.env.feedback, "");
  assert.ok(!view.html().includes("changes-feedback-row"));
  view.clickLine("Add feedback: Old 11", true);
  assert.deepEqual(view.selected(), { start: 11, end: 11, snippet: "deleted" });
});

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
