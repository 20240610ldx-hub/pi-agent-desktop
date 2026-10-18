import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createJiti } from "jiti";

const source = await readFile(new URL("./WorkspacePaneControls.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("WorkspacePaneControls.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
visit(ast);
const script = (text) => new Script(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText);
const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { WorkspacePaneControls } = await jiti.import("./WorkspacePaneControls.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

test("pane buttons expose real visibility and action names without invented keybindings", () => {
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(WorkspacePaneControls, {
    openPanes: { files: true, terminal: false, tasks: true }, onToggle() {},
  })));
  assert.equal((html.match(/aria-pressed="true"/g) ?? []).length, 2);
  assert.equal((html.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.match(html, /aria-label="Hide Files"/);
  assert.match(html, /aria-label="Show Terminal"/);
  assert.match(html, /aria-controls="workspace-pane-tasks"/);
  assert.doesNotMatch(html, /title=|<kbd|role="tooltip"/);
});

test("the custom tooltip waits for hover, skips touch and closes on activation", () => {
  let open = false;
  let callback;
  const attributes = nodes.filter((node) => ts.isJsxAttribute(node));
  const handler = (name) => attributes.find((node) => node.name.getText(ast) === name).initializer.expression.getText(ast);
  const context = createContext({
    clearTimer() {}, hide() { open = false; }, onClick() {},
    timerRef: { current: null }, setTimeout(fn) { callback = fn; }, setOpen(value) { open = value; },
  });
  const enter = script(`(${handler("onPointerEnter")})`).runInContext(context);
  enter({ pointerType: "touch" });
  assert.equal(callback, undefined);
  enter({ pointerType: "mouse" });
  assert.equal(open, false);
  callback();
  assert.equal(open, true);
  script(`(${handler("onClick")})({})`).runInContext(context);
  assert.equal(open, false);
  script(`(${handler("onFocus")})({currentTarget:{matches:()=>true}})`).runInContext(context);
  assert.equal(open, true);
});

test("tooltip clamp stays in the viewport and shortcut is a separate optional kbd", () => {
  const layout = nodes.find((node) => ts.isCallExpression(node) && node.expression.getText(ast) === "useLayoutEffect");
  let position;
  const context = createContext({
    open: true, buttonRef: { current: { getBoundingClientRect: () => ({ right: 390, bottom: 290 }) } },
    tooltipRef: { current: { getBoundingClientRect: () => ({ width: 225, height: 36 }) } },
    window: { innerWidth: 400, innerHeight: 300 }, setPosition: (value) => { position = value; },
  });
  script(`(${layout.arguments[0].getText(ast)})()`).runInContext(context);
  assert.equal(position.left, 165);
  assert.equal(position.top, 256);
  assert.match(source, /createPortal\([\s\S]*className="workspace-control-tooltip"/);
  assert.match(source, /shortcut && <kbd>\{shortcut\}<\/kbd>/);
  assert.match(source, /document\.body/);
});
