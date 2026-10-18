import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { newTerminalTab, restoreTerminalTabs, resolveActiveTerminalTabId } from "./terminal-tab-state.ts";

test("restored workspace tabs retain terminal identity and never request a new shell", () => {
  const first = newTerminalTab("/repo/worktree-a");
  const second = newTerminalTab("/repo/worktree-b");
  assert.notEqual(first.id, second.id);
  const saved = restoreTerminalTabs(JSON.stringify({ tabs: [first, second], activeId: second.id, open: true }));
  assert.deepEqual(saved, {
    tabs: [{ ...first, restored: true }, { ...second, restored: true }],
    activeId: second.id,
    open: true,
  });
});

test("same-project terminal tabs keep distinct shell identities through restore", () => {
  const first = newTerminalTab("/repo");
  const second = newTerminalTab("/repo");
  const saved = restoreTerminalTabs(JSON.stringify({ tabs: [first, second], activeId: second.id, open: true }));
  assert.equal(saved.tabs.length, 2);
  assert.deepEqual(saved.tabs.map(({ id }) => id), [first.id, second.id]);
  assert.equal(saved.activeId, second.id);
});

test("batched close callbacks cannot leave a removed terminal selected", () => {
  const [first, second, third] = [newTerminalTab("/repo"), newTerminalTab("/repo"), newTerminalTab("/repo")];
  assert.equal(resolveActiveTerminalTabId([first, second, third], third.id), third.id);
  // Concurrent B/C close callbacks can still request B after both were removed.
  assert.equal(resolveActiveTerminalTabId([first], second.id), first.id);
  assert.equal(resolveActiveTerminalTabId([], third.id), null);
  assert.equal(resolveActiveTerminalTabId([first, second], first.id), first.id);
});

test("storage corruption cannot create invalid or duplicate terminal tabs", () => {
  assert.deepEqual(restoreTerminalTabs("broken"), { tabs: [], activeId: null, open: false });
  assert.deepEqual(restoreTerminalTabs(null), { tabs: [], activeId: null, open: false });
  const tab = newTerminalTab("/repo");
  const saved = restoreTerminalTabs(JSON.stringify({
    tabs: [null, {}, tab, tab, { ...tab, id: "../../bad" }, { ...tab, cwd: null }],
    activeId: "missing",
  }));
  assert.deepEqual(saved, { tabs: [{ ...tab, restored: true }], activeId: null, open: false });
});

const source = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");
const dock = readFileSync(new URL("./WorkspacePaneDock.tsx", import.meta.url), "utf8");

test("Files and Terminal have independent selections and separate tab bars", () => {
  assert.match(source, /const filesPaneTabs: Tab\[\] = \[\.\.\.fileTabs, \.\.\.artifactTabs\.map\(artifactPanelTab\)\]/);
  assert.match(source, /const terminalPaneTabs: Tab\[\] = terminalTabs\.map/);
  assert.match(source, /tabs=\{filesPaneTabs\} activeTabId=\{activeFileTabId/);
  assert.match(source, /tabs=\{terminalPaneTabs\} activeTabId=\{activeTerminalTabId/);
  const open = source.slice(source.indexOf("const handleOpenTerminal ="), source.indexOf("// Message cards open artifacts"));
  assert.match(open, /setActiveTerminalTabId\(tab\.id\)/);
  assert.match(open, /revealWorkspacePane\("terminal"\)/);
  assert.doesNotMatch(open, /setActiveFileTabId/);
});

test("terminal IDs stay in one mounted parent while pane operations only hide them", () => {
  const hosts = source.slice(source.indexOf('<div className="workspace-terminal-tabs">'), source.indexOf('id: "tasks", title:'));
  assert.match(hosts, /terminalTabs\.map/);
  assert.match(hosts, /key=\{tab\.id\} hidden=\{tab\.id !== activeTerminalTabId\}/);
  assert.match(hosts, /active=\{rightPanelOpen && terminalVisible && tab\.id === activeTerminalTabId\}/);
  assert.match(dock, /panes\.map\(\(pane\) =>/);
  assert.match(dock, /<section key=\{pane\.id\}/);
  assert.match(dock, /hidden=\{!visible\}/);
  assert.doesNotMatch(dock.slice(dock.indexOf("  return (")), /panes\.filter[\s\S]*?\.map\(\(pane\) =>/);
  const hide = source.slice(source.indexOf("const hideWorkspacePane ="), source.indexOf("const toggleWorkspacePane ="));
  assert.match(hide, /setOpenPanes/);
  assert.doesNotMatch(hide, /setTerminalTabs|abort|fetch|setActiveFileTabId/);
});

test("workspace visibility restores independently of file or terminal tabs", () => {
  assert.match(source, /const visibility = getPrefJson\(APP_PREF_KEYS\.workspacePaneVisibility\)/);
  assert.match(source, /visibility === true && ids\.length\) setRightPanelOpen\(true\)/);
  assert.match(source, /if \(workspacePanesRestored\) setPrefJson\(APP_PREF_KEYS\.workspacePaneVisibility, rightPanelOpen\)/);
});

test("tasks use the selected session family rather than sample or synthetic tasks", () => {
  const tasks = source.slice(source.indexOf('id: "tasks", title:'), source.indexOf("{settingsSection && (", source.indexOf('id: "tasks", title:')));
  assert.match(tasks, /<AgentSessionPanel key=\{activeSessionFamily\.root\.id\}/);
  assert.match(tasks, /rootSession=\{activeSessionFamily\.root\} subagents=\{activeSessionFamily\.subagents\}/);
  assert.match(tasks, /runningSessionIds=\{runningSessionIds\}/);
  assert.match(tasks, /onSelectSession=\{handleSelectSession\}/);
});
