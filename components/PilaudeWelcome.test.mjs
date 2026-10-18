import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { createJiti } from "jiti";
import ts from "typescript";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { createElement: h } = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { PilaudeWelcome } = await jiti.import("./PilaudeWelcome");

function renderWelcome() {
  return renderToStaticMarkup(h(I18nProvider, null, h(PilaudeWelcome, {
    onOpenProject() {}, onOpenModels() {},
  })));
}

test("the quiet first launch keeps real project and model settings actions without a promotional hero", () => {
  const html = renderWelcome();
  assert.match(html, /aria-labelledby="pilaude-welcome-title"/);
  assert.match(html, /<h1[^>]*class="sr-only"[^>]*>Pilaude<\/h1>/);
  assert.match(html, /Open a project/);
  assert.match(html, /Model settings/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 2);
  assert.equal((html.match(/type="button"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /What shall we work on|Bring your|cds-button--lg|welcome-description|welcome-note/);
  assert.doesNotMatch(html, /<textarea|contenteditable|Auto mode|152|Import from CLI/);
});

test("both compact controls invoke their existing callbacks exactly once without new setup behavior", () => {
  // Execute the real JSX function with only the localization hook replaced;
  // this exercises the actual event props rather than matching source text.
  const source = readFileSync(new URL("./PilaudeWelcome.tsx", import.meta.url), "utf8");
  const file = ts.createSourceFile("PilaudeWelcome.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = file.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "PilaudeWelcome");
  assert.ok(component);
  const output = ts.transpileModule(component.getText(file).replace(/^export /, ""), {
    compilerOptions: { target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, jsxFactory: "h" },
  }).outputText;
  const run = new Script(`${output}; PilaudeWelcome`);
  const translate = (key) => ({ "welcome.openProject": "打开项目", "welcome.modelSettings": "模型设置" })[key];
  const render = run.runInNewContext({ h, useI18n: () => ({ t: translate }), PilaudeCodeRipple() { return null; } });
  let projectCalls = 0;
  let modelCalls = 0;
  const tree = render({ onOpenProject() { projectCalls++; }, onOpenModels() { modelCalls++; } });
  const buttons = [];
  function visit(node) {
    if (!node || typeof node !== "object") return;
    if (node.type === "button") buttons.push(node);
    const children = node.props?.children;
    for (const child of Array.isArray(children) ? children.flat(Infinity) : [children]) visit(child);
  }
  visit(tree);
  assert.equal(buttons.length, 2);
  assert.equal(buttons[0].props.disabled, undefined);
  assert.equal(buttons[1].props.disabled, undefined);
  buttons[0].props.onClick();
  assert.equal(projectCalls, 1);
  assert.equal(modelCalls, 0);
  buttons[1].props.onClick();
  assert.equal(projectCalls, 1);
  assert.equal(modelCalls, 1);
  assert.match(renderToStaticMarkup(tree), /打开项目/);
  assert.match(renderToStaticMarkup(tree), /模型设置/);
});
