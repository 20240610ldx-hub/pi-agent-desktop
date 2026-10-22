import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, createContext } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createJiti } from "jiti";
import { reconcileWorkspacePanes, splitWorkspacePaneColumn, resizeWorkspacePaneColumn } from "../lib/workspace-pane-layout.ts";

const source = await readFile(new URL("./WorkspacePaneDock.tsx", import.meta.url), "utf8");
const shell = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const ast = ts.createSourceFile("WorkspacePaneDock.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const nodes = [];
const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
visit(ast);
const compile = (text) => new Script(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText);
const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { WorkspacePaneDock } = await jiti.import("./WorkspacePaneDock.tsx");
const { workspacePopoutCopy } = await jiti.import("../lib/workspace-popout-copy.ts");

test("the real shell supplies localized disabled popouts for all three unsupported panes", () => {
  const shellAst = ts.createSourceFile("AppShell.tsx", shell, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const paneObjects = [];
  const collect = node => {
    if (ts.isJsxAttribute(node) && node.name.getText(shellAst) === "panes") paneObjects.push(...node.initializer.expression.elements);
    ts.forEachChild(node, collect);
  };
  collect(shellAst);
  for (const locale of ["en", "zh-CN", "zh-TW"]) for (const desktopMode of [true, false]) {
    const popoutWords = workspacePopoutCopy(locale);
    for (const id of ["files", "terminal", "tasks"]) {
      const pane = paneObjects.find(node => node.properties.some(prop => prop.name?.getText(shellAst) === "id" && prop.initializer?.text === id));
      const property = pane.properties.find(prop => prop.name?.getText(shellAst) === "popout");
      const actual = compile(`(${property.initializer.getText(shellAst)})`).runInContext(createContext({ desktopMode, popoutWords }));
      assert.equal(actual.label, desktopMode ? popoutWords.window : popoutWords.tab);
      assert.equal(actual.disabledReason, popoutWords[id]);
      assert.equal(actual.onOpen, undefined);
    }
  }
});

test("all pane content remains in keyed sibling hosts when panes are hidden", () => {
  const panes = ["files", "terminal", "tasks"].map((id) => ({ id, title: id, open: id !== "tasks", onClose() {}, children: React.createElement("i", null, `${id}-host`) }));
  const html = renderToStaticMarkup(React.createElement(WorkspacePaneDock, { panes, expandLabel: "Expand", restoreLabel: "Restore", closeLabel: "Hide {name}", resizeColumnLabel: "Resize column", resizeRowsLabel: "Resize rows" }));
  assert.equal((html.match(/class="workspace-pane workspace-pane--/g) ?? []).length, 3);
  assert.match(html, /workspace-pane--tasks" hidden=""/);
  for (const id of ["files", "terminal", "tasks"]) assert.match(html, new RegExp(`${id}-host`));
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\)/);
  assert.doesNotMatch(html, /workspace-pane-toolbar/);
});

test("a pane's own toolbar receives dock state without a duplicate generic header", () => {
  let chrome;
  const html = renderToStaticMarkup(React.createElement(WorkspacePaneDock, {
    panes: [{ id: "changes", title: "Changes", open: true, customHeader: true, onClose() {}, children: (_visible, value) => { chrome = value; return React.createElement("header", { className: "changes-pane-header" }, "Review"); } }],
    expandLabel: "Expand", restoreLabel: "Restore", closeLabel: "Hide {name}", resizeColumnLabel: "Resize column", resizeRowsLabel: "Resize rows",
  }));
  assert.equal((html.match(/changes-pane-header/g) ?? []).length, 1);
  assert.doesNotMatch(html, /workspace-pane-header|workspace-pane-expand|workspace-pane-close/);
  assert.equal(chrome.expanded, false);
  assert.equal(typeof chrome.onExpand, "function");
});

test("one stacked column exposes only a row separator and fills the parent width", () => {
  const html = renderToStaticMarkup(React.createElement(WorkspacePaneDock, {
    panes: ["files", "terminal"].map((id) => ({ id, title: id, open: true, onClose() {}, children: id })),
    expandLabel: "Expand", restoreLabel: "Restore", closeLabel: "Hide {name}", resizeColumnLabel: "Resize column", resizeRowsLabel: "Resize rows",
  }));
  assert.match(html, /min-width:0;grid-template-columns:minmax\(0, 1fr\)/);
  assert.equal((html.match(/aria-orientation="horizontal"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /aria-orientation="vertical"/);
});

test("pane headers expose a real popout action or an accessible disabled reason before expand", () => {
  const html = renderToStaticMarkup(React.createElement(WorkspacePaneDock, {
    panes: [
      { id: "files", title: "Files", open: true, onClose() {}, children: "file", popout: { label: "Open in new window", disabledReason: "Files consumer is not ready" } },
      { id: "terminal", title: "Terminal", open: true, onClose() {}, children: "terminal", popout: { label: "Open in new window", onOpen() {} } },
    ],
    expandLabel: "Expand", restoreLabel: "Restore", closeLabel: "Hide {name}", resizeColumnLabel: "Resize column", resizeRowsLabel: "Resize rows",
  }));
  assert.equal((html.match(/workspace-pane-popout/g) ?? []).length, 2);
  assert.match(html, /<button(?=[^>]*aria-disabled="true")(?=[^>]*aria-label="Open in new window")(?=[^>]*aria-describedby=)[^>]*>/);
  assert.match(html, /Files consumer is not ready/);
  assert.match(html, /workspace-pane-popout[\s\S]*workspace-pane-expand/);
});

test("column keyboard resize and Escape rollback retain the original geometry", () => {
  const layout = reconcileWorkspacePanes({ version: 1, columns: [], expandedPaneId: null }, ["files", "terminal", "tasks"]);
  let saved = layout;
  let released = false;
  const context = createContext({
    layout, MIN_PANE_HEIGHT: 160, SEPARATOR_SIZE: 8,
    gridRef: { current: { clientHeight: 800 } },
    isImeComposing: () => false,
    splitWorkspacePaneColumn, resizeWorkspacePaneColumn,
    setSaved(value) { saved = value; }, setDragging() {},
    dragRef: { current: { original: layout, pointerId: 1, target: { hasPointerCapture: () => true, releasePointerCapture: () => { released = true; } } } },
  });
  const keyboard = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "resizeKey");
  context.resize = compile(`(${keyboard.initializer.getText(ast)})`).runInContext(context);
  context.resize({ key: "ArrowRight", preventDefault() {}, stopPropagation() {} }, layout.columns[0].id, "column");
  assert.equal(saved.columns[0].width, 412);
  const finish = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "endDrag");
  compile(`(${finish.initializer.arguments[0].getText(ast)})(true)`).runInContext(context);
  assert.equal(saved, layout);
  assert.equal(released, true);
});

test("last pane close collapses only workspace visibility, leaving PTY hosts untouched", () => {
  const shellAst = ts.createSourceFile("AppShell.tsx", shell, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let hide;
  const visitShell = (node) => { if (ts.isVariableDeclaration(node) && node.name.getText(shellAst) === "hideWorkspacePane") hide = node.initializer.arguments[0].getText(shellAst); ts.forEachChild(node, visitShell); };
  visitShell(shellAst);
  for (const [openPanes, expected] of [[{ files: true, terminal: true, tasks: false }, false], [{ files: false, terminal: true, tasks: false }, true]]) {
    let closed = false;
    let current = openPanes;
    const context = createContext({ openPanes, handleRightPanelClose: () => { closed = true; }, setOpenPanes: (update) => { current = update(current); } });
    compile(`(${hide})("terminal")`).runInContext(context);
    assert.equal(closed, expected);
    assert.equal(current.terminal, false);
  }
  assert.doesNotMatch(hide, /fetch|setTerminalTabs|abort/);
});

test("mobile switches panes from the existing header and retains an overlay exit", async () => {
  assert.match(shell, /overlayControls=\{isMobile \? <div className="workspace-pane-mobile-controls"/);
  assert.match(shell, /onClick=\{handleRightPanelClose\} aria-controls="file-panel" label=\{translate\("workspace\.hidePanel"\)\}/);
  assert.match(shell, /!isMobile && <WorkspacePaneControls/);
  assert.match(shell, /isMobile && showFilePanelToggle && !rightPanelOpen && \(/, "the covered background toggle must not compete with the header exit");
  const html = renderToStaticMarkup(React.createElement(WorkspacePaneDock, {
    panes: ["files", "terminal"].map((id) => ({ id, title: id, open: true, onClose() {}, children: id })),
    expandLabel: "Expand", restoreLabel: "Restore", closeLabel: "Hide {name}", resizeColumnLabel: "Resize column", resizeRowsLabel: "Resize rows",
    overlayControls: React.createElement("button", { "data-mobile-pane-controls": true }, "Switch panes"),
  }));
  assert.equal((html.match(/data-mobile-pane-controls/g) ?? []).length, 1, "only the first visible header receives mobile controls");
  assert.match(html, /workspace-pane-header[\s\S]*data-mobile-pane-controls[\s\S]*workspace-pane-expand/);
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  assert.match(css, /\.workspace-pane-header:has\(\.workspace-pane-mobile-controls\) > \.workspace-pane-title \{ display: none;/);
});

test("terminal E2E uses visible responsive entrances while preserving hide/reopen PID checks", async () => {
  const e2e = await readFile(new URL("../e2e/terminal.mjs", import.meta.url), "utf8");
  assert.match(e2e, /viewport\.width <= 640 \? '#file-panel \.workspace-pane-mobile-controls' : '\.app-topbar'/);
  assert.match(e2e, /#file-panel \.workspace-pane-hide-workbench\[aria-label="Hide workspace"\]:visible/);
  assert.match(e2e, /page\.keyboard\.press\("Backslash"\)/);
  assert.doesNotMatch(e2e, /getByTitle\((?:workspace|otherWorkspace)|#file-panel > \.workspace-pane-toolbar/);
  assert.match(e2e, /WORKSPACE:retained:\$\{workspacePid\}/);
});

test("native window buttons stay outside the horizontal scroller and pane header owns drag", () => {
  const windowHost = source.indexOf('className="workspace-pane-window-controls"');
  const scrollHost = source.indexOf('className="workspace-pane-scroll"');
  assert.ok(windowHost > 0 && windowHost < scrollHost);
  assert.match(source, /<header \{\.\.\.headerDragProps\}/);
  assert.match(source, /chromePaneId = expanded \?\? layout\.columns\.at\(-1\)\?\.paneIds\[0\]/);
  assert.match(shell, /macWindowInset=\{macLightsOverPanel\}/);
  assert.doesNotMatch(shell, /showChat && <button[^\n]*terminal\.newTerminal/);
});
