import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";
import { createJiti } from "jiti";

const source = await readFile(new URL("./AppShell.tsx", import.meta.url), "utf8");
const jiti = createJiti(import.meta.url);
const draftStore = await jiti.import("../lib/draft-store.ts");

function callbackBody(name, nextName) {
  const start = source.indexOf(`const ${name} = useCallback`);
  const nextCallbackOffset = source.slice(start + 1).search(/\n  const [A-Za-z_$][\w$]* = useCallback/);
  const end = nextCallbackOffset === -1 ? -1 : start + 1 + nextCallbackOffset;
  assert.notEqual(start, -1, `${name} callback not found`);
  assert.notEqual(end, -1, `${nextName} callback not found after ${name}`);
  return source.slice(start, end);
}

test("explicit context changes invalidate a pending workspace restore", () => {
  const callbacks = [
    ["handleCwdChange", "handleSelectSession"],
    ["handleSelectSession", "handleNewSession"],
    ["handleNewSession", "hydrateSelectedSession"],
    ["handleSessionCreated", "handleAgentEnd"],
    ["handleSessionForked", "handleInitialRestoreDone"],
    ["handleSessionDeleted", "handleOpenFile"],
  ];

  for (const [name, nextName] of callbacks) {
    assert.match(callbackBody(name, nextName), /invalidateWorkspaceRestore\(\);/);
  }
});

test("active-session persistence keeps secondary selection per-tab without overwriting main workspace memory", () => {
  const start = source.indexOf("  useEffect(() => {\n    if (selectedSession) {", source.indexOf("// Persist every active-session transition"));
  const end = source.indexOf("\n\n  useEffect", start);
  const effect = source.slice(start, end);
  assert.notEqual(start, -1);
  for (const secondary of [false, true]) {
    const calls = [];
    const context = vm.createContext({
      useEffect: (callback) => callback(), selectedSession: { id: "selected", cwd: "/project", projectKey: "/project" }, newSessionCwd: null,
      conversationWindow: secondary, activeProjectKeyRef: { current: "/project" }, workspaceKeyOf: (session) => session.cwd,
      setLastOpenSession: (...args) => calls.push(["workspace", ...args]), setTabOpenSession: (...args) => calls.push(["tab", ...args]), setTabOpenNewSession: (...args) => calls.push(["new", ...args]),
    });
    vm.runInContext(effect, context);
    assert.deepEqual(calls, secondary ? [["tab", "selected"]] : [["workspace", "/project", "selected"], ["tab", "selected"]]);
  }
});

test("secondary restoration never clears the main window's missing or drifted session memory", () => {
  const callback = callbackBody("restoreWorkspaceContext", "handleCwdChange");
  for (const secondary of [false, true]) for (const sessions of [[{ id: "other", cwd: "/project" }], [{ id: "remembered", cwd: "/different" }]]) {
    const cleared = [];
    const context = vm.createContext({
      useCallback: (body) => body, conversationWindow: secondary, workspaceRestoreTokenRef: { current: 0 },
      getLastOpenSession: () => "remembered", clearLastOpen: (key) => cleared.push(key), workspaceKeyOf: (session) => session.cwd,
      sessionCatalog: sessions, router: {},
    });
    vm.runInContext(stripTypeScriptTypes(`${callback}\nglobalThis.restore = restoreWorkspaceContext;`), context);
    context.restore("/project", "/project");
    assert.deepEqual(cleared, secondary ? [] : ["/project"]);
  }
});

test("keeps chat scroll positions in page memory by session id", () => {
  assert.match(source, /useRef\(new Map<string, ChatScrollPosition>\(\)\)/);
  assert.match(source, /sessionScrollPositionsRef\.current\.set\(sessionId, position\)/);
  assert.match(source, /initialScrollPosition=\{selectedSession \? sessionScrollPositionsRef\.current\.get\(selectedSession\.id\) \?\? null : null\}/);
  assert.match(source, /onScrollPositionChange=\{handleSessionScrollPositionChange\}/);
  assert.doesNotMatch(source, /localStorage[^\n]*sessionScroll/i);
});

test("workspace restoration remains inside the cross-project branch", () => {
  assert.match(
    callbackBody("handleCwdChange", "handleSelectSession"),
    /if \(currentProject !== newProject\) \{[\s\S]*?restoreWorkspaceContext\(newProject, cwd\);[\s\S]*?\}/,
  );
});

test("New restores the draft after session navigation and workspace auto-restore", async (t) => {
  const callbacks = [
    callbackBody("restoreWorkspaceContext", "handleCwdChange"),
    callbackBody("handleCwdChange", "handleSelectSession"),
    callbackBody("handleSelectSession", "handleNewSession"),
    callbackBody("handleNewSession", "hydrateSelectedSession"),
  ].join("\n");
  const parkedKeyHelper = source.slice(source.indexOf("function parkedNewSessionDraftKey"), source.indexOf("export function AppShell"));
  const hookSource = await readFile(new URL("../hooks/useAgentSession.ts", import.meta.url), "utf8");
  const cleanupStart = hookSource.indexOf("    return () => {", hookSource.indexOf("  // Load session on mount"));
  const cleanupEnd = hookSource.indexOf("    // eslint-disable-next-line", cleanupStart);

  for (const [index, isWorktree] of [false, true].entries()) {
    const cwd = `/draft-project-${index}`;
    const rememberedCwd = isWorktree ? `${cwd}-worktree` : cwd;
    await t.test(`remembered session cwd: ${rememberedCwd}`, async () => {
      const session = { id: "remembered", cwd: rememberedCwd, projectKey: cwd };
      const response = Promise.withResolvers();
      const context = vm.createContext({
        ...draftStore,
        crypto: globalThis.crypto,
        queueMicrotask,
        URLSearchParams,
        window: { location: { pathname: "/", search: "" } },
        router: { replace() {} },
        fetch: () => response.promise,
        getLastOpenSession: (key) => key === cwd ? session.id : null,
        clearLastOpen() {},
        workspaceKeyOf: (value) => value.projectKey ?? value.cwd,
        useEffect: () => {},
        useCallback: (callback) => callback,
        useGlobalKeyboardShortcuts() {},
        useNativeAppMenu() {},
        handleRightPanelClose() {},
        handleSidebarToggle() {},
        chatInputRef: { current: null },
        rightPanelOpen: false,
        shortcutHelpOpen: false,
        activeNewSessionDraftKeyRef: { current: `new:initial:${cwd}` },
        scheduledOpenRef: { current: false },
        welcomeOpenRef: { current: false },
        activeProjectKeyRef: { current: cwd },
        workspaceRestoreTokenRef: { current: 0 },
        suppressCwdBumpRef: { current: false },
        branchLeafChangeFnRef: { current: null },
        liveFollowFrameRef: { current: null },
        bashRecoveryIdRef: { current: 0 },
        cancelEventStreamGrace() {},
        closeEvents() {},
        closeSettingsMenu() {},
        settingsSection: null,
        getLastSettingsSection: () => "general",
        isMobile: false,
        isChatWorkspaceActive: false,
        desktopMode: false,
        conversationWindow: false,
        activeCwd: cwd,
        activeFileTabId: null,
        openPanes: { files: true, terminal: false, tasks: false },
        chatWorkspaceCwd: null,
        newSessionCwd: cwd,
        newSessionDraftId: "initial",
        newSessionWorkspaceKind: "project",
        selectedSession: null,
        sessionCatalog: [],
        sessionKey: 0,
        sessionNavigation: { items: [], index: -1 },
      });
      context.invalidateWorkspaceRestore = () => context.workspaceRestoreTokenRef.current++;
      for (const [setter] of callbacks.matchAll(/\bset[A-Z]\w*(?=\()/g)) {
        const state = setter[3].toLowerCase() + setter.slice(4);
        context[setter] = (value) => {
          context[state] = typeof value === "function" ? value(context[state]) : value;
        };
      }
      vm.runInContext(stripTypeScriptTypes(`${parkedKeyHelper}\n${callbacks}
        globalThis.navigate = { handleCwdChange, handleSelectSession, handleNewSession };
      `), context);
      // Run the actual hook cleanup with the outgoing mount's captured draft key.
      const makeCleanup = vm.runInContext(stripTypeScriptTypes(`((isNew, newSessionDraftKey) => {
        const sessionHookMountedRef = { current: true };
        const newSessionPromotedRef = { current: false };
        const cancelPendingSubmissionRef = { current: null };
        const sessionIdRef = { current: null };
        const dataRef = { current: null };
        const messagesRef = { current: [] };
        const entryIdsRef = { current: [] };
        const activeLeafIdRef = { current: null };
        const historyCursorRef = { current: null };
        const hasEarlierMessagesRef = { current: false };
        const getSessionViewSnapshot = () => null;
        const setSessionViewSnapshot = () => false;
        const deleteSessionViewSnapshot = () => {};
        ${hookSource.slice(cleanupStart, cleanupEnd)}
      })`), context);
      let mountedKey = context.sessionKey;
      let cleanup = makeCleanup(true, context.activeNewSessionDraftKeyRef.current);
      async function commit() {
        if (mountedKey !== context.sessionKey) {
          cleanup();
          mountedKey = context.sessionKey;
          const activeCwd = context.newSessionCwd ?? context.activeCwd;
          const key = context.selectedSession ? null : `new:${context.newSessionDraftId}:${activeCwd}`;
          context.activeNewSessionDraftKeyRef.current = key;
          cleanup = makeCleanup(!context.selectedSession, key);
        }
        await new Promise((resolve) => setImmediate(resolve));
      }

      const draft = { value: "unsent project draft", images: [{ data: "aGVsbG8=", mimeType: "image/png" }] };
      draftStore.setDraft(context.activeNewSessionDraftKeyRef.current, draft);
      context.navigate.handleSelectSession({ ...session, cwd });
      await commit();
      context.navigate.handleNewSession("direct-return", cwd);
      await commit();
      assert.deepEqual(draftStore.getDraft(context.activeNewSessionDraftKeyRef.current), draft);
      context.navigate.handleSelectSession({ ...session, cwd });
      await commit();
      context.navigate.handleCwdChange("/other-project", "/other-project", "/other-project");
      await commit();
      context.navigate.handleCwdChange(cwd, cwd, cwd);
      await commit();
      assert.deepEqual(draftStore.getDraft(context.activeNewSessionDraftKeyRef.current), draft);
      response.resolve({ ok: true, json: async () => ({ sessions: [session] }) });
      await new Promise((resolve) => setImmediate(resolve));
      await commit();
      assert.equal(context.selectedSession.id, session.id);
      context.navigate.handleNewSession("after-auto-restore", cwd);
      await commit();
      assert.deepEqual(draftStore.getDraft(context.activeNewSessionDraftKeyRef.current), draft);
      draftStore.clearDraft(context.activeNewSessionDraftKeyRef.current);
    });
  }
});
