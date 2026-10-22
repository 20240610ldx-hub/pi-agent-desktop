import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script, createContext } from "node:vm";
import ts from "typescript";
import { isImeComposing } from "../lib/ime.ts";

const source = (await readFile(new URL("./SessionSidebar.tsx", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
const sessionItemSource = source.slice(source.indexOf("function SessionItem("));

test("C33 session corners and trailing controls match the native reference geometry", async () => {
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const c33 = css.slice(css.indexOf("/* C33 侧栏项目／会话、搜索、状态及重排"));
  assert.match(c33, /\.sidebar-project-tree-children \.session-item \{[^}]*height: 28px !important;[^}]*padding: 0 0 0 10px !important;[^}]*border-radius: 6px;/);
  // Row padding cannot override the earlier absolute right:3.2px menu slot.
  assert.match(c33, /\.app-shell \.session-sidebar \.session-item-trailing \{ right: 0; \}/);
  assert.match(css, /\.app-shell \.session-item-more \{ width: 24px; height: 24px;/);
  // The marker's 7.2px diameter and 8.7px right offset retain a 12.3px centre.
  assert.match(css, /\.session-activity-dot \{[^}]*width: 7\.2px; height: 7\.2px;/);
  assert.match(c33, /\.session-item-main \.session-activity-dot:not\(\.is-idle\) \{[^}]*right: 8\.7px;/);
});

test("C33 selected idle row reserves no trailing width; hover, menu and marker rows keep it", async () => {
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const c33 = css.slice(css.indexOf("/* C33 侧栏项目／会话、搜索、状态及重排"));
  // Resting selected row: hidden "···" and the title ends ~9.3 from the row edge (reference 9.33).
  const rest = ".session-item.is-selected:not(:hover, :focus-within, :has(.session-item-more.is-open, .session-activity-dot:not(.is-idle)))";
  assert.ok(c33.includes(`${rest} .session-item-main { padding-right: 8px; }`));
  // The generic 27.2px reservation stays for hover / focus / open menu / marker rows (and unselected rows).
  assert.match(css, /\.app-shell \.session-item:has\(\.session-item-trailing:not\(\[hidden\]\)\) \.session-item-main \{ padding-right: 27\.2px; \}/);
  assert.ok(css.indexOf("padding-right: 27.2px; }") < css.indexOf(rest), "override must come after the generic reservation");
});

test("project-list notifications change only when ordered paths or the receiver change", () => {
  const ast = ts.createSourceFile("SessionSidebar.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const component = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "SessionSidebar");
  const effect = component.body.statements.find(node => ts.isExpressionStatement(node) && ts.isCallExpression(node.expression)
    && node.expression.expression.getText(ast) === "useEffect" && node.expression.arguments[0].getText(ast).includes("onProjectsChange?."));
  assert.ok(effect);
  const key = component.body.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "projectRootsKey"));
  const code = ts.transpileModule(`(() => { ${key?.getText(ast) ?? ""}\n${effect.getText(ast)} })()`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const calls = [];
  let previousDeps;
  const context = createContext({
    activeProjects: [], onProjectsChange: roots => calls.push(Array.from(roots)),
    useEffect(callback, deps) {
      if (!previousDeps || deps.some((value, index) => !Object.is(value, previousDeps[index]))) { previousDeps = deps; callback(); }
    },
  });
  const render = roots => {
    context.activeProjects = roots.map(projectRoot => ({ projectRoot }));
    new Script(code).runInContext(context);
  };
  render(["/a", "/b"]);
  render(["/a", "/b"]);
  render(["/a", "/b"]);
  assert.deepEqual(calls, [["/a", "/b"]], "Equal project paths must not schedule another parent update");
  render(["/b", "/a"]);
  assert.deepEqual(calls.at(-1), ["/b", "/a"]);
  context.onProjectsChange = roots => calls.push(["new receiver", ...roots]);
  render(["/b", "/a"]);
  assert.deepEqual(calls.at(-1), ["new receiver", "/b", "/a"]);
  render([]);
  assert.deepEqual(calls.at(-1), ["new receiver"]);
  assert.equal(calls.length, 4);
});

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
  // sidebar as Chats + project lists. The upstream quick-filter stays.
  assert.match(source, /sidebar-search-input/);
  assert.match(source, /sidebar-chats-header/);
  assert.doesNotMatch(source, /data-resize-handle="sidebar-sections"/);
});

test("the sidebar tree supports row-level keyboard navigation", () => {
  assert.match(source, /role="tree"/);
  assert.match(source, /data-sidebar-tree-row/);
  assert.match(source, /case "ArrowDown":[\s\S]*?focusSidebarTreeRow\(current, 1\)/);
  assert.match(source, /case "ArrowUp":[\s\S]*?focusSidebarTreeRow\(current, -1\)/);
  assert.match(source, /case "Home":[\s\S]*?focusSidebarTreeRow\(current, "first"\)/);
  assert.match(source, /case "End":[\s\S]*?focusSidebarTreeRow\(current, "last"\)/);
  assert.match(sessionItemSource, /role="treeitem"/);
  assert.match(sessionItemSource, /aria-selected=\{isSelected\}/);
  assert.match(sessionItemSource, /requestDelete: beginDeleteConfirmation/);
  assert.match(sessionItemSource, /rename: startRename/);
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
  assert.match(source, /const sessionFamilies = listSessionFamilies\(projectSessions\)/);
  assert.match(source, /familySessions\.some\(\(session\) => session\.id === selectedSessionId\)/);
  assert.match(source, /familySessions\.some\(\(session\) => runningSessionIds\.has\(session\.id\)\)/);
  assert.doesNotMatch(source, /function SessionTreeItem/);
});

test("Chats sit beside Projects and never enter project grouping", () => {
  assert.match(
    source,
    /const chatSessions = filteredSessions[\s\S]*?session\.workspaceKind === "chat" \|\| isChatCwd\(session\.cwd\)[\s\S]*?const projectSessions = filteredSessions\.filter\(/,
  );
  assert.match(source, /const allChatFamilies = listSessionFamilies\(chatSessions\)/);
  assert.match(source, /const sessionFamilies = listSessionFamilies\(projectSessions\)/);
  assert.match(source, /groupByProject\(projectSessions,/);
  assert.match(source, /getRecentProjects\(allSessions\)/);
  assert.match(source, /sidebar-project-tree-header sidebar-chats-header/);
  assert.match(source, /handleNewSession\(chatWorkspaceCwd \?\? undefined, "chat"\)/);
});

test("Chats show five families at a time even when there are no projects", () => {
  assert.match(source, /const MAX_VISIBLE_CHAT_SESSIONS = 5/);
  assert.match(source, /: chatFamilies\.slice\(0, MAX_VISIBLE_CHAT_SESSIONS \* \(chatSessionPages \+ 1\)\)/);
  assert.match(source, /setChatSessionPages\(\(pages\) => pages \+ 1\)/);
  assert.match(source, /!loading && !error && chatFamilies\.length === 0/);
  assert.match(source, /sidebar-chats-empty/);
  // The Chats section renders before the Projects empty state, so it remains
  // available when `activeProjects` is empty.
  assert.match(
    source,
    /sidebar-chats-header[\s\S]*?\{allProjects\.length === 0 \? \(/,
  );
});

test("Chats fold like a project and unfold back to the first five", () => {
  // Folding drops the extra pages so the next unfold starts at five again.
  assert.match(source, /const setChatsFolded = \(folded: boolean\) => \{\s*setChatsCollapsed\(folded\);\s*if \(folded\) setChatSessionPages\(0\);/);
  // A search lists every match regardless of the fold.
  assert.match(source, /const chatsFolded = !trimmedSessionQuery && chatsCollapsed/);
  assert.match(source, /\{!chatsFolded && \(\s*<div className="sidebar-project-tree-children sidebar-chats-list">/);
  // The fold and the page count survive a reload.
  assert.match(source, /APP_PREF_KEYS\.collapsedChats/);
  assert.match(source, /APP_PREF_KEYS\.chatSessionPages/);
});

test("the Chats header shows its menu and add buttons only on hover, like Projects", () => {
  const header = source.slice(
    source.indexOf("sidebar-project-tree-header sidebar-chats-header"),
    source.indexOf("{!chatsFolded && ("),
  );
  // Same hover-revealed tools container the Projects header uses.
  assert.match(header, /className="sidebar-project-tree-tools"/);
  assert.match(header, /sidebar-project-tree-menu/);
  assert.match(header, /sidebar-project-tree-add/);
  assert.match(header, /handleNewSession\(chatWorkspaceCwd \?\? undefined, "chat"\)/);
  assert.doesNotMatch(source, /sidebar-chats-add/);
});

test("chats can be pinned and archived, ordered by recency with no date groups", () => {
  // Pinned first, then recency; archived chats leave the list unless a search is running.
  assert.match(source, /orderChatFamilies\(allChatFamilies, pinnedChats\)/);
  assert.match(source, /trimmedSessionQuery\s*\? orderedChatFamilies\s*: orderedChatFamilies\.filter\(\(family\) => !archivedChats\.has\(family\.root\.id\)\)/);
  // Rows already show their own relative time, so the list has no Today / This week headings.
  assert.doesNotMatch(source, /sidebar-chats-group-label|chatsToday|CHAT_GROUP_LABEL_KEYS/);
  // The +5 paging still runs over the whole order.
  assert.match(source, /: chatFamilies\.slice\(0, MAX_VISIBLE_CHAT_SESSIONS \* \(chatSessionPages \+ 1\)\)/);
  // Archived chats stay reachable and recoverable.
  assert.match(source, /sidebar\.showArchivedChats/);
  assert.match(source, /APP_PREF_KEYS\.pinnedChats/);
  assert.match(source, /APP_PREF_KEYS\.archivedChats/);
  // Row menu: only chat rows (depth 0) get the actions, in both the native and DOM menus.
  assert.match(source, /chatActions=\{depth === 0 \? chatActions : undefined\}/);
  assert.match(source, /t\(chatActions\.pinned \? "sidebar\.unpinChat" : "sidebar\.pinChat"\)/);
  assert.match(source, /t\(chatActions\.archived \? "sidebar\.unarchiveChat" : "sidebar\.archiveChat"\)/);
});

test("a chat's row menu can continue it in a project", () => {
  // Chats only: project rows and subagent children are never given the callback.
  assert.match(source, /onContinueInProject=\{setContinueChat\}/);
  assert.match(source, /onContinueInProject=\{depth === 0 \? onContinueInProject : undefined\}/);
  assert.match(source, /t\("sidebar\.continueInProject"\)/);
  assert.match(source, /\/continue-in-project`/);
  // The picker reuses the project picker and never offers the chat workspace itself.
  assert.match(source, /\{continueChat && \(/);
});

test("a chat cwd skips worktree lookup and stays out of project pickers", () => {
  assert.match(source, /if \(!selectedCwd \|\| selectedCwdIsChat\) \{\s*setWorktreeState\(null\)/);
  assert.match(source, /const selectedProjectRoot = selectedProjectObject\?\.kind === "project"/);
  assert.match(source, /selectedCwd=\{selectedCwdProp && !isChatCwd\(selectedCwdProp\) \? selectedCwdProp : null\}/);
  assert.match(source, /if \(isChatCwd\(cwd\)\) return projectSelection\(cwd, cwd, "chat"\)/);
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

test("Projects header actions stay hover-only", async () => {
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  assert.match(css, /\.sidebar-project-tree-tools \{[^}]*opacity: 0;[^}]*pointer-events: none;/);
  assert.match(css, /\.sidebar-project-tree-header:hover \.sidebar-project-tree-tools,/);
  assert.match(css, /\.sidebar-project-tree-header\.is-menu-open \.sidebar-project-tree-tools,/);
  assert.match(css, /\.sidebar-project-tree-header:focus-within \.sidebar-project-tree-tools \{\s*opacity: 1;\s*pointer-events: auto;/);
  assert.match(css, /@media \(hover: none\) \{[^@]*\.sidebar-project-tree-tools \{\s*opacity: 1;\s*pointer-events: auto;/);
});

test("folded projects persist across reloads", () => {
  assert.match(source, /getPrefJson<unknown>\(APP_PREF_KEYS\.collapsedProjects\)/);
  assert.match(source, /setPrefJson\(APP_PREF_KEYS\.collapsedProjects, \[\.\.\.collapsedProjects\]\)/);
  // Collapse/expand-all operate on the visible project groups.
  assert.match(source, /const canCollapseAllProjects = activeProjects\.some\(\(group\) => !collapsedProjects\.has\(group\.projectRoot\)\)/);
  assert.match(source, /const canExpandAllProjects = activeProjects\.some\(\(group\) => collapsedProjects\.has\(group\.projectRoot\)\)/);
  assert.match(source, /setCollapsedProjects\(new Set\(activeProjectRoots\)\)/);
  assert.match(source, /setCollapsedProjects\(new Set\(\)\)/);
});

test("show more reveals five sessions at a time and a project toggle resets it", () => {
  assert.match(source, /getPrefJson<unknown>\(APP_PREF_KEYS\.expandedProjects\)/);
  assert.match(source, /setPrefJson\(APP_PREF_KEYS\.expandedProjects, projectSessionPages\)/);
  assert.match(source, /const visibleSessionLimit = MAX_VISIBLE_PROJECT_SESSIONS \* \(extraPages \+ 1\)/);
  assert.match(
    source,
    /\[group\.projectRoot\]: \(prev\[group\.projectRoot\] \?\? 0\) \+ 1/,
  );
  assert.match(
    source,
    /count: Math\.min\(MAX_VISIBLE_PROJECT_SESSIONS, hiddenSessionCount\)/,
  );
  // Reopening a project starts from its latest five sessions again.
  assert.match(source, /setProjectSessionPages\(\(prev\) => \{[\s\S]*?delete next\[group\.projectRoot\]/);
  // Legacy arrays meant "expanded everything"; migrate them to one extra page.
  assert.match(source, /Array\.isArray\(stored\)[\s\S]*?\.map\(\(root\) => \[root, 1\]\)/);
});

test("Projects pane chooses between grouped and chronological views", () => {
  // The old Recent section is replaced by a persisted display mode.
  assert.doesNotMatch(source, /recent-sessions|sidebar-recent-section|hasTodaySessions|recentSessions/);
  assert.match(source, /const \[projectViewMode, setProjectViewMode\] = useState<ProjectViewMode>\(loadProjectViewMode\)/);
  assert.match(source, /setPref\(APP_PREF_KEYS\.projectViewMode, mode\)/);
  assert.match(
    source,
    /projectViewMode === "timeline"\s*\? renderTimeline\(\)\s*: activeProjects\.map\(\(group\) => renderProjectGroup\(group\)\)/,
  );
});

test("the chronological view lists session families by activity with project labels", () => {
  assert.match(source, /const timelineFamilies = projectViewMode === "timeline"/);
  assert.match(source, /sessionFamilies\.filter\(\(family\) =>/);
  assert.match(source, /\.sort\(\(a, b\) => b\.root\.modified\.localeCompare\(a\.root\.modified\)\)/);
  assert.match(source, /buildSessionTree\(\[family\.root, \.\.\.family\.subagents\]\)/);
  assert.match(source, /className="sidebar-project-timeline"/);
  assert.match(source, /subtitle=\{projectName\}/);
});

test("the Projects menu keeps grouped/timeline choices and collapse controls", async () => {
  const menuSource = await readFile(new URL("./ProjectViewMenu.tsx", import.meta.url), "utf8");
  assert.match(menuSource, /role="menuitemradio"/);
  assert.match(menuSource, /sidebar\.projectViewGrouped/);
  assert.match(menuSource, /sidebar\.projectViewTimeline/);
  assert.match(menuSource, /sidebar\.collapseAllProjects/);
  assert.match(menuSource, /sidebar\.expandAllProjects/);
  assert.match(source, /canUseNativeMenu\(\)[\s\S]*?showNativeMenu\(entries, menuPointBelow\(anchor, "right"\)\)/);
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

test("requested content search renders even when the title-filtered project list is empty", () => {
  // Chats and projects share one SessionSearch consumer, so a project list that
  // is empty after the title filter can never hide the requested content results.
  let search;
  let empty;
  const visit = (node) => {
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(sidebarAst) === "SessionSearch") search = node;
    if (ts.isConditionalExpression(node)) {
      const branch = ts.isParenthesizedExpression(node.whenTrue) ? node.whenTrue.expression : node.whenTrue;
      if (ts.isJsxElement(branch) && branch.openingElement.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute)
        && attribute.name.text === "className" && attribute.initializer?.text === "sidebar-project-tree-empty")) empty = node;
    }
    ts.forEachChild(node, visit);
  };
  visit(sidebarAst);
  assert.ok(search, "SessionSearch wraps the sidebar lists");
  assert.ok(empty, "the empty project state still exists");
  for (let ancestor = search.parent; ancestor; ancestor = ancestor.parent) {
    assert.ok(!ts.isConditionalExpression(ancestor)
      && !(ts.isBinaryExpression(ancestor) && ancestor.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken),
    "no project-list condition may unmount the content-search consumer");
  }
  let inside = false;
  for (let ancestor = empty.parent; ancestor; ancestor = ancestor.parent) if (ancestor === search) inside = true;
  assert.equal(inside, true, "the empty/loading/error branch is a child of the content-search consumer");
});

test("the native session button moves pins only for unmodified Alt+Arrow outside IME", () => {
  let mainButton;
  const visit = (node) => {
    if (ts.isJsxOpeningElement(node) && node.tagName.getText(sidebarAst) === "button"
      && node.attributes.properties.some((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === "className" && attribute.initializer?.text === "session-item-main")) mainButton = node;
    ts.forEachChild(node, visit);
  };
  visit(sidebarAst);
  const attribute = mainButton.attributes.properties.find((node) => ts.isJsxAttribute(node) && node.name.text === "onKeyDown");
  assert.ok(attribute, "The native selection button must expose the pin keyboard behavior");
  const calls = [];
  const context = createContext({ isImeComposing, onMovePinned: (direction) => calls.push(direction) });
  const handle = compileExpression(`(${attribute.initializer.expression.getText(sidebarAst)})`).runInContext(context);
  const button = {};
  const press = (overrides = {}) => {
    const effects = [];
    handle({ key: "ArrowDown", altKey: true, target: button, currentTarget: button, nativeEvent: {}, preventDefault: () => effects.push("prevent"), stopPropagation: () => effects.push("stop"), ...overrides });
    return effects;
  };
  assert.deepEqual(press(), ["prevent", "stop"]);
  assert.deepEqual(press({ key: "ArrowUp" }), ["prevent", "stop"]);
  assert.deepEqual(calls, ["down", "up"]);
  for (const ignored of [{ altKey: false }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { key: "Enter" }, { nativeEvent: { isComposing: true } }, { nativeEvent: { keyCode: 229 } }, { defaultPrevented: true }, { target: {} }]) assert.deepEqual(press(ignored), []);
  assert.deepEqual(calls, ["down", "up"]);
  context.onMovePinned = undefined;
  assert.deepEqual(press(), [], "Recent, archived, descendant, unpinned and filtered rows have no reorder callback");
});

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

// Rendered, not textual: the real native-theme.css in Chromium over markup shaped like SessionItem.
test("C33 trailing slot and row height render correctly on touch and on desktop", async () => {
  const { chromium } = await import("playwright");
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const row = (cls, title) => `<div class="session-tree-item" data-session-depth="0"><div>
    <div class="session-item ${cls}" style="height:54px;display:flex;align-items:center;padding-left:11px;padding-right:8px;border-left:2px solid transparent;gap:6px;overflow:hidden"><button class="session-item-main" type="button"><span class="session-activity-dot is-idle"></span><span class="sidebar-title session-item-title">${title}</span></button>
    <div class="session-item-trailing"><button class="session-item-more" type="button"><svg width="12" height="12"></svg></button></div></div></div></div>`;
  const html = `<!doctype html><style>${css}</style><body><div class="app-shell"><div class="session-sidebar" style="width:216px">
    <div class="sidebar-project-tree-children">${row("is-selected", "Selected idle session with a rather long title that must not run under the dots")}${row("", "Plain session")}</div></div></div></body>`;
  const browser = await chromium.launch();
  try {
    const measure = async (page, selector) => page.locator(selector).evaluate((item) => {
      const trailing = item.querySelector(".session-item-trailing"), main = item.querySelector(".session-item-main");
      const t = trailing.getBoundingClientRect(), r = item.getBoundingClientRect();
      return { height: r.height, right: r.right, trailing: getComputedStyle(trailing).display, trailingLeft: t.left, trailingWidth: t.width, padRight: getComputedStyle(main).paddingRight, titleRight: item.querySelector(".sidebar-title").getBoundingClientRect().right };
    });
    const selected = ".sidebar-project-tree-children .session-item.is-selected", plain = ".sidebar-project-tree-children .session-item:not(.is-selected)";

    const touch = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchPage = await touch.newPage();
    await touchPage.setContent(html);
    assert.equal(await touchPage.evaluate(() => matchMedia("(hover: none)").matches), true, "touch context has no hover");
    const t = await measure(touchPage, selected);
    assert.equal(t.trailing, "flex", "selected idle row keeps its \"···\" on touch");
    assert.equal(t.trailingWidth, 24);
    assert.equal(t.padRight, "27.2px", "27.2px reservation stays so the title never sits under \"···\"");
    assert.ok(t.titleRight <= t.trailingLeft, `title ends at ${t.titleRight}, trailing starts at ${t.trailingLeft}`);
    assert.ok(t.height >= 44, `project-tree selected row is ${t.height}px high on touch`);
    assert.ok((await measure(touchPage, plain)).height >= 44, "project-tree plain row is at least 44px high on touch");
    await touch.close();

    const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await desktop.newPage();
    await page.setContent(html);
    await page.mouse.move(600, 600);
    const rest = await measure(page, selected);
    assert.equal(rest.trailing, "none", "selected idle row hides \"···\" at rest on desktop");
    assert.equal(rest.padRight, "8px");
    assert.equal(rest.height, 28);
    await page.locator(selected).hover();
    const hover = await measure(page, selected);
    assert.equal(hover.trailing, "flex");
    assert.equal(hover.padRight, "27.2px");
    assert.ok(hover.titleRight <= hover.trailingLeft);
    await desktop.close();
  } finally {
    await browser.close();
  }
});

test("C33 touch block matches the specificity of the project-tree 28px row rule", async () => {
  const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");
  const touch = css.slice(css.indexOf("@media (hover: none) {", css.indexOf("/* C33 侧栏项目／会话、搜索、状态及重排")));
  assert.match(touch, /\.sidebar-project-tree-children \.session-item,[^{]*\{ height: 44px !important; min-height: 44px; \}/);
});
