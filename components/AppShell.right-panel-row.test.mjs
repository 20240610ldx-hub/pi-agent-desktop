import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const source = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

/**
 * Layout sentinels.
 *
 * The first two guard upstream segment D regressions (0e36743):
 *
 * 1. The "Center: chat" column closed right after the topbar, turning the
 *    chat wrapper into a second flex:1 ROW child: the viewport split 50/50
 *    between an empty topbar column and the chat (the "huge blank middle").
 * 2. The right-panel toggle/backdrop/resizer/panel block sat AFTER the row
 *    close, i.e. as flex-COLUMN children of .app-shell: the closed panel's
 *    content height still stole vertical space from the chat row.
 *
 * The third pins the 2026-09 full-height sidebar restructure: the sidebar is
 * a direct child of the outer row and the topbar moved into the main column
 * that follows it, so the topbar starts at the center column and the sidebar
 * runs the full window height (no blank strip above the sidebar).
 *
 * The fourth pins the right panel as a full-height embedded pane: it remains
 * a sibling of the main column, while hairline chrome and a shared header
 * surface tie it back into the shell.
 */
test("chat wrapper stays inside the center column (no 50/50 topbar split)", () => {
  // The column must NOT close between the topbar and the chat content block:
  // the early close looked like `</div>` directly between the mobile trust
  // warning and the Chat content comment.
  assert.doesNotMatch(
    source,
    /renderProjectTrustWarning\(true\)\}\n\s*<\/div>\n\s*\{\/\* Chat content \*\//,
    "column closed before the chat wrapper — chat would split 50/50 with the topbar column",
  );
});

test("right panel block is a row child (row closes after the panel, not before)", () => {
  const rowOpen = source.indexOf('display: "flex", flex: 1, minHeight: 0, overflow: "hidden"');
  assert.ok(rowOpen !== -1, "row container not found");
  const panelIdx = source.indexOf("right-panel-container");
  assert.ok(panelIdx > rowOpen, "right panel JSX must come after the row opens");
});

test("topbar sits in the main column after the sidebar (sidebar runs full height)", () => {
  const sidebarHandle = source.indexOf('data-resize-handle="sidebar"');
  assert.ok(sidebarHandle !== -1, "sidebar resize handle not found");
  const topbar = source.indexOf("Top bar with sidebar toggle");
  assert.ok(topbar > sidebarHandle, "topbar must render after the sidebar, inside the main column");

  // The tail must close panel → outer row → shell in direct succession; more
  // closes means the panel slid back under the topbar inside the main column.
  const panelIdx = source.indexOf("right-panel-container");
  const tail = source.slice(panelIdx);
  const nesting = tail.indexOf("        />\n      </div>\n    </div>\n    {settingsSection");
  assert.ok(nesting !== -1, "panel close must be followed by outer row, then shell close");
});

test("file panel stays a full-height embedded pane", () => {
  const ast = ts.createSourceFile("AppShell.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function elementWith(attribute, value) {
    let found;
    function visit(node) {
      if (ts.isJsxElement(node) && node.openingElement.attributes.properties.some(prop =>
        ts.isJsxAttribute(prop) && prop.name.getText(ast) === attribute && prop.initializer?.getText(ast) === JSON.stringify(value))) found = node;
      ts.forEachChild(node, visit);
    }
    visit(ast);
    assert.ok(found, `${attribute}=${value} element missing`);
    return found;
  }
  const main = elementWith("className", "app-main-column");
  const panel = elementWith("id", "file-panel");
  const body = elementWith("className", "pilaude-workspace-body");
  assert.equal(panel.parent, main.parent, "panel must be a full-height sibling of the main column");
  assert.equal(body.parent, main, "workspace body must stay inside the main column");
  assert.equal(elementWith("id", "session-sidebar").parent, main.parent, "sidebar must share the outer row");
  const css = readFileSync(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const workspaceCss = css.slice(css.indexOf("/* Workspace pane chrome and column sizing */"));
  assert.match(workspaceCss, /\.app-shell \.workspace-pane-workbench \{[^}]*border: 0 !important;/,
    "the host must not add a second frame around individual pane cards");
  assert.match(workspaceCss, /\.app-shell \.workspace-pane-dock \{[^}]*overflow: hidden; padding: 0;/);
  assert.equal((source.match(/<WorkspacePaneControls\b/g) ?? []).length, 2, "desktop and mobile have mutually exclusive control hosts");
  assert.match(source, /!isMobile && <WorkspacePaneControls/);
  assert.match(source, /overlayControls=\{isMobile \? <div className="workspace-pane-mobile-controls"/);
  assert.doesNotMatch(source, /workspace-pane-toolbar|workspace-pane-toolbar-spacer/);
  const workbench = source.slice(source.indexOf("{/* Workspace panes stay mounted"));
  assert.doesNotMatch(workbench, /className="file-panel-expand-button"|right-panel-close-button/);
  assert.match(source, /windowControls=\{rightPanelOpen && !isMobile && desktopChrome\.isDesktop && !desktopChrome\.isMacOS \? <WindowControls/);
});
