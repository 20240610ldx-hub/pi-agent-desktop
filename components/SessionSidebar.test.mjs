import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script, createContext } from "node:vm";
import ts from "typescript";

const source = await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
const sessionItemSource = source.slice(source.indexOf("function SessionItem("));

test("only Shift+click bypasses session deletion confirmation", () => {
  // Deleting without Shift must always route through the confirmation step.
  // The handler moved inline into the row's menu item, so match the guard
  // itself rather than a named function, and tolerate either brace style.
  assert.match(
    sessionItemSource,
    /if \(modifiers\?\.shiftKey\)\s*\{?\s*void performDelete\(\);\s*\}?\s*else\s*\{?\s*setConfirmDelete\(true\);/,
  );
});

test("keeps the project-tree sidebar without an inline explorer section", () => {
  // Upstream's resizable sidebar explorer (ed50d88) is deliberately not
  // adopted: this fork renders the file explorer in the right panel and the
  // sidebar as a project tree. The upstream quick-filter stays.
  assert.match(source, /sidebar-search-input/);
  assert.match(source, /Project tree \(Codex-style\)/);
  assert.doesNotMatch(source, /data-resize-handle="sidebar-sections"/);
});

test("does not register row-level session deletion shortcuts", () => {
  assert.doesNotMatch(sessionItemSource, /const handleKeyDown/);
  assert.doesNotMatch(sessionItemSource, /onKeyDown=\{handleKeyDown\}/);
  assert.doesNotMatch(sessionItemSource, /tabIndex=\{0\}/);
});

test("streams running sessions and reconnects after visibility or network changes", () => {
  assert.match(source, /new EventSource\("\/api\/agent\/running\/events"\)/);
  assert.match(source, /document\.addEventListener\("visibilitychange", onVisible\)/);
  assert.match(source, /window\.addEventListener\("online", connect\)/);
  assert.match(source, /source\?\.close\(\)/);
});

test("re-adding a removed project clears only its sidebar marker", () => {
  assert.match(source, /const activateProject = useCallback\(\(cwd: string\) =>/);
  assert.match(source, /if \(!previous\.has\(projectRoot\)\) return previous;/);
  assert.match(source, /next\.delete\(projectRoot\);/);
  // The add-project dialog is the only picker left in the sidebar.
  assert.match(source, /onSelectCwd=\{\(cwd\) => \{\s+activateProject\(cwd\);/);
});

test("exposes the polled running-session set to the shell", () => {
  assert.match(source, /onRunningSessionIdsChange\?: \(ids: Set<string>\) => void/);
  assert.match(source, /onRunningSessionIdsChange\?\.\(runningSessionIds\)/);
});

test("exposes the loaded session catalog to the shell", () => {
  assert.match(source, /onSessionsChange\?: \(sessions: SessionInfo\[\]\) => void/);
  assert.match(source, /onSessionsChange\?\.\(allSessions\)/);
});

test("subagent completion stays silent and never becomes unread", () => {
  assert.match(source, /completionNotificationSuppressedSessionIds\?: string\[\]/);
  assert.match(
    source,
    /completedWithNotifications = completedInBackground\.filter\([\s\S]*?!previousSuppressedCompletionSessionIdsRef\.current\.has\(id\)[\s\S]*?!knownSubagentIds\.has\(id\)/,
  );
  assert.match(source, /completedWithNotifications\.forEach\(\(id\) => next\.add\(id\)\)/);
  assert.match(source, /if \(completedWithNotifications\.length > 0\) \{\s*onBackgroundTaskDone\?\.\(\)/);
  assert.match(
    source,
    /filter\(\(session\) => session\.relation\?\.kind !== "subagent"\)[\s\S]*?unreadEligibleIds\.has\(id\)/,
  );
});

test("includes project activity counts in accessible labels", () => {
  assert.match(
    source,
    /aria-label=\{`\$\{t\("sidebar\.agentRunning"\)\} \(\$\{activity\.running\}\)`\}/,
  );
  assert.match(
    source,
    /aria-label=\{`\$\{t\("sidebar\.newSessionActivity"\)\} \(\$\{activity\.unread\}\)`\}/,
  );
});

test("formats session timestamps in the action menu with the active locale", () => {
  assert.match(source, /import \{ formatRelativeTime \} from "@\/lib\/i18n\/format"/);
  assert.match(sessionItemSource, /const \{ locale, t \} = useI18n\(\)/);
  assert.match(sessionItemSource, /formatRelativeTime\(session\.modified, locale\)/);
});

test("does not persist an unchanged fallback title ending in whitespace", () => {
  assert.match(
    sessionItemSource,
    /const name = renameValue\.trim\(\);[\s\S]*?if \(renameValue === title \|\| name === \(session\.name \?\? ""\)\) return;/,
  );
});

test("offers the downstream context-menu hook only on a normal session row", () => {
  assert.match(sessionItemSource, /const handleContextMenu[\s\S]*?dispatchSessionRowContextMenu\(\{/);
  assert.match(
    sessionItemSource,
    /onContextMenu=\{confirmDelete \|\| renaming \? undefined : handleContextMenu\}/,
  );
});

test("lifecycle refreshes bypass the cache while cross-window polling reuses it", () => {
  assert.match(source, /function sessionListUrl\(summary: boolean, force: boolean\)/);
  assert.match(source, /if \(summary\) return "\/api\/sessions\?summary=1"/);
  assert.match(source, /if \(force\) return "\/api\/sessions\?force=1"/);
  assert.match(source, /cache: "no-store"/);
  // First paint uses the cheap summary listing, then hydrates after a delay.
  assert.match(source, /loadSessions\(true, false, true\)/);
  assert.match(source, /setTimeout\(\(\) => \{[\s\S]*?void loadSessions\(false, true\)/);
  assert.match(source, /data\.sessionListVersion !== sessionListVersionRef\.current[\s\S]*?await loadSessions\(\)/);
  assert.doesNotMatch(source, /sessionRefreshDone|sessionRefreshTimerRef|title=\{t\("sidebar\.refresh"\)\}/);
  assert.match(source, /loadSessions\(false, true\);[\s\S]*?onBackgroundTaskDone/);
});

test("does not expose disk-backed actions for transient sessions", () => {
  assert.match(sessionItemSource, /if \(session\.transient\) return;/);
  assert.match(sessionItemSource, /\{!session\.transient && \(\s*<div\s+className="session-item-trailing"/);
});

test("hides subagent rows and aggregates their state into the main session row", () => {
  assert.match(source, /const sessionFamilies = listSessionFamilies\(filteredSessions\)/);
  assert.match(source, /familySessions\.some\(\(session\) => session\.id === selectedSessionId\)/);
  assert.match(source, /familySessions\.some\(\(session\) => runningSessionIds\.has\(session\.id\)\)/);
  assert.doesNotMatch(source, /function SessionTreeItem/);
});

test("the project context menu reveals the project in the OS file manager", async () => {
  // Upstream's open-in-file-manager (#907) reaches the fork through the
  // project context menu: the desktop shell reveals natively and the browser
  // goes through /api/open-in-explorer, which the menu only offers after the
  // availability probe answered. A failure stays visible inside the menu.
  assert.match(source, /const revealProjectInFileManager = useCallback/);
  assert.match(source, /isTauriDesktop\(\) \|\| fileManagerAvailability\?\.supported/);
  assert.match(source, /revealItemInDirNative\(root\)/);
  assert.match(source, /fetch\("\/api\/open-in-explorer", \{\s*method: "POST"/);
  assert.match(source, /FILE_MANAGER_ERROR_KEYS\[data\.error \?\? ""\]/);
  // The menu itself is fork-owned (components/ProjectContextMenu.tsx).
  const menuSource = await readFile(new URL("./ProjectContextMenu.tsx", import.meta.url), "utf8");
  assert.match(menuSource, /\{projectRevealError && \(/);
  // The platform-adaptive label (Finder / Explorer / generic).
  assert.match(source, /"sidebar\.openInFinder"/);
  assert.match(source, /"sidebar\.openInExplorer"/);
  assert.match(source, /"sidebar\.openInFileManager"/);
});

test("session actions are available on selection, hover, keyboard focus and touch", () => {
  assert.match(sessionItemSource, /className="session-item-trailing"/);
  assert.match(sessionItemSource, /hidden=\{!\(hovered \|\| touchMode \|\| menuOpen \|\| isSelected \|\| focusWithin\)\}/);
  assert.match(sessionItemSource, /onFocus=\{\(\) => setFocusWithin\(true\)\}/);
  assert.match(sessionItemSource, /e\.currentTarget\.contains\(e\.relatedTarget/);
  assert.doesNotMatch(sessionItemSource, /session-item-time|formatCompactRelativeTime/);
  // Runtime-only sessions still cannot rename or delete disk files.
  assert.match(sessionItemSource, /\{!session\.transient && \(\s*<div\s+className="session-item-trailing"/);
});

test("project header shows a session count and chips only while folded", () => {
  // A folded project hides its rows, so the header carries the count.
  assert.match(source, /\{isCollapsed && \(\s*<span className="sidebar-project-tree-count"[^>]*>\s*\(\{groupTree\.length\}\)/);
  assert.match(source, /\{isCollapsed && \(\s*<span className="sidebar-project-tree-meta">/);
  // The full path/branch remains in the accessible label and clipped-name tooltip.
  assert.doesNotMatch(source, /className="sidebar-project-tree-branch"/);
  assert.match(source, /aria-label=\{rowLabel\}/);
  assert.match(source, /tooltipText=\{`\$\{projectDisplayNames\.get\(group\.projectRoot\) \?\? group\.displayName\}\\n\$\{rowLabel\}`\}/);
});

test("project header follows the name/chevron/plus reference and preserves touch actions", async () => {
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const referenceCss = css.slice(css.indexOf("/* Session titles and activity reference */"));
  assert.match(source, /sidebar-project-tree-chevron/);
  assert.doesNotMatch(source, /className="sidebar-project-tree-folder"/);
  assert.match(source, /aria-expanded=\{!isCollapsed\}/);
  assert.match(referenceCss, /\.sidebar-project-tree-row-actions \{[^}]*opacity: 1;[^}]*pointer-events: auto;/);
  assert.match(referenceCss, /:is\(:hover, :has\(:focus-visible\), \.is-menu-open\) \.sidebar-project-tree-more/);
  assert.match(referenceCss, /@media \(hover: none\) \{[^@]*\.sidebar-project-tree-more \{ opacity: 1; pointer-events: auto;/);
});

test("folded projects persist across reloads", () => {
  assert.match(source, /getPrefJson<unknown>\(APP_PREF_KEYS\.collapsedProjects\)/);
  assert.match(source, /setPrefJson\(APP_PREF_KEYS\.collapsedProjects, \[\.\.\.collapsedProjects\]\)/);
  // "Collapse all" must look at the visible projects, not the stored set's size.
  assert.match(source, /allProjects\.some\(\(g\) => !collapsedProjects\.has\(g\.projectRoot\)\)/);
});

test("expanded session previews persist and reveal how many rows are hidden", () => {
  assert.match(source, /getPrefJson<unknown>\(APP_PREF_KEYS\.expandedProjects\)/);
  assert.match(source, /setPrefJson\(APP_PREF_KEYS\.expandedProjects, \[\.\.\.expandedProjectSessions\]\)/);
  assert.match(
    source,
    /t\("sidebar\.showMoreSessions", \{ count: groupTree\.length - visibleGroupTree\.length \}\)/,
  );
});

test("shows a cross-project recent section above the project tree", () => {
  assert.match(source, /import \{ getRecallSessions, hasRecallSessionsToday \} from "@\/lib\/recent-sessions"/);
  assert.match(source, /const recentSessions = !trimmedSessionQuery/);
  assert.match(source, /<section className="sidebar-recent-section" aria-label=\{t\(hasTodaySessions \? "sidebar\.today" : "sidebar\.recent"\)\}>/);
  assert.match(source, /t\(hasTodaySessions \? "sidebar\.today" : "sidebar\.recent"\)/);
  assert.match(source, /subtitle=\{projectName\}/);
});

test("the row menu shows the compaction count only when the session was compacted", () => {
  assert.match(
    sessionItemSource,
    /\(session\.compactionCount \?\? 0\) > 0 \? \[\{ label: t\("sidebar\.compactionCount", \{ count: session\.compactionCount \?\? 0 \}\)/,
  );
});

test("the full session name survives fallback selection and whitespace normalization", () => {
  const ast = ts.createSourceFile("SessionSidebar.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes = [];
  const visit = (node) => { nodes.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  const title = nodes.find((node) => ts.isVariableDeclaration(node) && node.name.getText(ast) === "title");
  const resolve = (session, displayFirstMessage) => new Script(ts.transpileModule(title.initializer.getText(ast), {
    compilerOptions: { target: ts.ScriptTarget.ESNext },
  }).outputText).runInContext(createContext({ session, displayFirstMessage }));
  const long = "A complete title after the former fifty character boundary ".repeat(3);
  assert.equal(resolve({ id: "id", name: long }, "first message"), long.trim());
  assert.equal(resolve({ id: "id" }, long), long.trim());
  assert.equal(resolve({ id: "id", name: "多行\n名称\t保留" }, ""), "多行 名称 保留");
  assert.equal(resolve({ id: "1234567890123456" }, ""), "123456789012");
});

test("the session title is a native focusable selection button with a full accessible name", () => {
  assert.match(sessionItemSource, /<button\s+type="button"\s+className="session-item-main"/);
  assert.match(sessionItemSource, /aria-current=\{isSelected \? "page" : undefined\}/);
  assert.match(sessionItemSource, /aria-label=\{subtitle \? `\$\{title\} · \$\{subtitle\}` : title\}/);
  assert.match(sessionItemSource, /onClick=\{\(e\) => \{ e\.stopPropagation\(\); onClick\(\); \}\}/);
  assert.match(sessionItemSource, /<SidebarTitle className="session-item-title" text=\{title\} \/>/);
});

test("running, unread and neutral states use one leading dot with static reduced motion", async () => {
  const indicators = source.slice(source.indexOf("function RunningSessionIndicator"), source.indexOf("function SessionItem"));
  assert.match(indicators, /className="session-activity-dot is-running"[^>]*aria-label=\{t\("sidebar\.agentRunning"\)\}/);
  assert.match(indicators, /className="session-activity-dot is-unread"[^>]*aria-label=\{t\("sidebar\.newSessionActivity"\)\}/);
  assert.doesNotMatch(indicators, /animateTransform|<animate/);
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const referenceCss = css.slice(css.indexOf("/* Session titles and activity reference */"));
  assert.match(referenceCss, /\.session-activity-dot\.is-running \{ animation: scheduled-pulse 1\.4s ease-in-out infinite;/);
  assert.match(referenceCss, /@media \(prefers-reduced-motion: reduce\) \{\s*\.session-activity-dot\.is-running \{ animation: none;/);
  assert.match(referenceCss, /\.sidebar-title\.is-overflowing \{ mask-image: linear-gradient\(to right, #000 calc\(100% - 28\.8px\), transparent\)/);
});

const sidebarAst = ts.createSourceFile("SessionSidebar.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const declarations = [];
const collect = (node) => { if (ts.isVariableDeclaration(node)) declarations.push(node); ts.forEachChild(node, collect); };
collect(sidebarAst);
const expressionFor = (name) => declarations.find((node) => node.name.getText(sidebarAst) === name).initializer.getText(sidebarAst);
const compileExpression = (text) => new Script(ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ESNext } }).outputText);

function menuFixture(overrides = {}) {
  const calls = [];
  const session = { id: "source", modified: "now", messageCount: 4 };
  const actions = {
    metadata: { pinnedIds: [], archivedIds: [], groups: [], memberships: [] }, canReveal: true, revealLabel: "Explorer",
    onPin: (...args) => calls.push(["pin", ...args]), onMarkUnread: (...args) => calls.push(["unread", ...args]),
    onMoveGroup: (...args) => calls.push(["group", ...args]), onNewGroup: (...args) => calls.push(["newGroup", ...args]),
    onArchive: (...args) => calls.push(["archive", ...args]),
  };
  const context = createContext({ session, actions, t: (key) => key, formatRelativeTime: () => "now", locale: "en", isRunning: false, needsInput: false, forking: false,
    startRename: () => calls.push(["rename"]), forkSession: () => calls.push(["fork"]), revealSession: () => calls.push(["reveal"]), performDelete: () => calls.push(["delete"]), setConfirmDelete: () => calls.push(["confirm"]), ...overrides });
  const entries = compileExpression(`(${expressionFor("sessionMenuEntries")})()`).runInContext(context);
  return { entries, calls };
}

test("menu actions call real handlers and unimplemented open targets remain disabled", () => {
  const { entries, calls } = menuFixture();
  const open = entries.find((entry) => entry.kind === "submenu" && entry.label === "sidebar.openIn");
  for (const label of ["sidebar.openSplitView", "sidebar.openNewWindow", "VS Code"]) {
    const item = open.items.find((entry) => entry.label === label);
    assert.equal(item.disabled, true);
    assert.ok(item.disabledReason);
    assert.equal(item.onSelect, undefined);
  }
  open.items.find((entry) => entry.label === "Explorer").onSelect();
  entries.find((entry) => entry.label === "sidebar.pin").onSelect();
  entries.find((entry) => entry.label === "sidebar.markUnread").onSelect();
  entries.find((entry) => entry.label === "sidebar.archiveSession").onSelect();
  entries.find((entry) => entry.label === "sidebar.delete").onSelect();
  entries.find((entry) => entry.label === "sidebar.delete").onSelect({ shiftKey: true });
  assert.deepEqual(calls, [["reveal"], ["pin", "source", true], ["unread", "source"], ["archive", "source", true], ["confirm"], ["delete"]]);
  assert.equal(menuFixture({ isRunning: true }).entries.find((entry) => entry.label === "sidebar.fork").disabled, true);
  assert.equal(menuFixture({ needsInput: true }).entries.find((entry) => entry.label === "sidebar.fork").disabled, true);
});

test("Fork reads the saved leaf and only sends fork_branch before selecting child info", async () => {
  const calls = [];
  const child = { id: "child", cwd: "/repo" };
  const context = createContext({
    session: { id: "source" }, isRunning: false, needsInput: false, forking: false, setForking() {},
    fetch: async (url) => { calls.push(url); return { ok: true, json: async () => url.includes("source") ? { leafId: "leaf" } : { info: child } }; },
    sendAgentCommand: async (...args) => { calls.push(args); return { newSessionId: "child" }; },
    actions: { onForked: (info) => calls.push(info) }, onRenamed() {}, reportActionError(error) { throw new Error(error); }, t: (key) => key,
  });
  await compileExpression(`(${expressionFor("forkSession")})()`).runInContext(context);
  assert.equal(calls[0], "/api/sessions/source?tree=summary");
  assert.equal(calls[1][0], "source");
  assert.equal(calls[1][1].type, "fork_branch");
  assert.equal(calls[1][1].entryId, "leaf");
  assert.equal(calls[2], "/api/sessions/child?tree=summary");
  assert.equal(calls[3], child);
  assert.doesNotMatch(JSON.stringify(calls), /prompt|auto-name/);
});

test("manual unread waits for a real select and authoritative SSE replaces needs-input ids", () => {
  assert.match(source, /onMarkUnread: \(id\) => setUnreadSessionIds\(\(current\) => new Set\(current\)\.add\(id\)\)/);
  const select = expressionFor("handleSelectSessionFromList");
  assert.match(select, /setUnreadSessionIds/);
  assert.match(select, /next\.delete\(id\)/);
  assert.match(source, /setNeedsInputSessionIds\(new Set\(data\.needsInputSessionIds \?\? \[\]\)\)/);
  assert.match(source, /familySessions\.some\(\(session\) => needsInputSessionIds\.has\(session\.id\)\)/);
  assert.match(source, /sseAuthoritativeRef\.current = true/);
  assert.match(source, /window\.addEventListener\("storage", sync\)/);
  assert.match(source, /sidebar\.archivedSessions/);
});
