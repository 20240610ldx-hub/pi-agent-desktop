import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { CDS_MENU_ENTER } from "../lib/cds-motion.ts";

const source = await readFile(new URL("./DomContextMenuHost.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
const ast = ts.createSourceFile("DomContextMenuHost.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const panel = ast.statements.find((node) => ts.isFunctionDeclaration(node) && node.name?.text === "MenuPanel");
const evaluate = (expression, context) => new Script(ts.transpileModule(`(${expression})`, {
  compilerOptions: { target: ts.ScriptTarget.ESNext },
}).outputText).runInContext(createContext(context));
function descendants(node, predicate) {
  const result = [];
  const visit = (child) => { if (predicate(child)) result.push(child); ts.forEachChild(child, visit); };
  visit(node);
  return result;
}

test("actual MenuPanel applies sampled source easing only after prepaint positioning", () => {
  const root = descendants(panel, (node) => ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "div")
    .find((node) => node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "role" && attribute.initializer?.getText(ast) === '"menu"'));
  const attributes = root.attributes.properties;
  const value = (name) => attributes.find((attribute) => attribute.name.getText(ast) === name)?.initializer?.expression?.getText(ast);
  const classes = evaluate(value("className"), { appearance: "session" });
  assert.match(classes, /\bcds-menu-motion\b/);
  assert.equal(evaluate(value("data-menu-placed"), { position: null }), undefined);
  assert.equal(evaluate(value("data-menu-placed"), { position: { left: 8, top: 12 } }), true);
  const style = (position) => evaluate(value("style"), { position, VIEWPORT_MARGIN: 8, CDS_MENU_ENTER });
  assert.equal(style(null).visibility, "hidden");
  const placed = style({ left: 8, top: 12 });
  assert.equal(placed.left, 8);
  assert.equal(placed.top, 12);
  assert.equal(placed["--cds-menu-enter-easing"], CDS_MENU_ENTER.easing);
  assert.equal(placed["--cds-menu-enter-duration"], "500ms");
  assert.equal(placed.transform, undefined, "the measured hit geometry must remain static");
  const start = css.indexOf("/* CDS sampled context-menu entry");
  const block = css.slice(start, css.indexOf("/* Changes dock integration", start));
  assert.match(block, /\.cds-menu-motion\[data-menu-placed\]/);
  assert.match(block, /var\(--cds-menu-enter-easing\)/);
  assert.match(block, /prefers-reduced-motion:\s*reduce/);
  assert.match(block, /animation:\s*none\s*!important/);
  assert.doesNotMatch(block, /transform\s*:/, "entry must not move the parent/submenu pointer seam");
});
