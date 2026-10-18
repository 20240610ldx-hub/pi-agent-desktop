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
const sidebarSource = readFileSync(new URL("./SessionSidebar.tsx", import.meta.url), "utf8");
const sidebarAst = ts.createSourceFile("SessionSidebar.tsx", sidebarSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const shellSource = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");
const shellAst = ts.createSourceFile("AppShell.tsx", shellSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const draftStore = await jiti.import("../lib/draft-store.ts");

function findNode(root, predicate) {
  if (predicate(root)) return root;
  return ts.forEachChild(root, child => findNode(child, predicate));
}
function evaluate(text, context) {
  const output = ts.transpileModule(`(${text})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: "h" },
  }).outputText;
  return new Script(output).runInNewContext({ h, ...context });
}

test("the sidebar New entry opens home with or without a selected project", () => {
  const button = findNode(sidebarAst, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(sidebarAst) === "button" && node.openingElement.attributes.getText(sidebarAst).includes("sidebar-new-row"));
  assert.ok(button);
  for (const selectedCwd of [null, "/project"]) {
    let homeCalls = 0;
    let taskCalls = 0;
    const tree = evaluate(button.getText(sidebarAst), {
      t: key => key, selectedCwd,
      onOpenWelcome() { homeCalls++; }, handleNewSession() { taskCalls++; },
    });
    assert.ok(!tree.props.disabled, "New is reachable before choosing a project");
    tree.props.onClick();
    assert.equal(homeCalls, 1);
    assert.equal(taskCalls, 0, "Home navigation does not create a new task");
  }
});

function homeNavigationHarness(selectedSession, options = {}) {
  const callback = findNode(shellAst, node => ts.isVariableDeclaration(node) && node.name.getText(shellAst) === "handleOpenWelcome");
  assert.ok(callback, "AppShell owns the explicit home navigation callback");
  const env = {
    ...draftStore, selectedSession, activeCwd: "/project", newSessionCwd: null,
    welcomeOpen: false, scheduledOpen: false, isMobile: false, sidebarOpen: true,
    sessionKey: 4, activeNewSessionDraftKeyRef: { current: "new:kept:/project" },
    activeProjectKeyRef: { current: "/project" }, branchLeafChangeFnRef: { current: null },
    scheduledOpenRef: { current: false }, welcomeOpenRef: { current: false }, suppressCwdBumpRef: { current: false },
    openPanes: { files: true, terminal: false, tasks: false, changes: false }, activeFileTabId: null,
    workspaceKeyOf: session => session.projectKey ?? session.cwd,
    parkNewSessionDraft: evaluate(`(() => { ${shellSource.slice(shellSource.indexOf("function parkedNewSessionDraftKey"), shellSource.indexOf("export function AppShell"))}\nreturn parkNewSessionDraft; })()`, draftStore),
    window: { location: { search: "?session=kept", pathname: "/" } }, URLSearchParams,
    router: { replace(url) { if (env.localNavigationOnly) assert.fail("Home uses local navigation without a server route transition"); env.url = url; env.window.location.search = url; } },
    invalidateWorkspaceRestore() {},
    newSessionDraftId: "kept", ...options,
  };
  for (const name of callback.getText(shellAst).match(/\bset[A-Z]\w*(?=\()/g) ?? []) {
    const state = name[3].toLowerCase() + name.slice(4);
    env[name] = value => { env[state] = typeof value === "function" ? value(env[state]) : value; };
  }
  env.window.history = { replaceState(_state, _unused, url) { env.url = url; env.window.location.search = url; } };
  env.handleOpenWelcome = evaluate(callback.initializer.arguments[0].getText(shellAst), env);
  const sidebar = findNode(shellAst, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText(shellAst) === "SessionSidebar");
  const homeProp = sidebar.attributes.properties.find(node => ts.isJsxAttribute(node) && node.name.text === "onOpenWelcome");
  assert.ok(homeProp, "The visible New entry receives the shell's home callback");
  const onOpenWelcome = evaluate(homeProp.initializer.expression.getText(shellAst), env);
  const button = findNode(sidebarAst, node => ts.isJsxElement(node) && node.openingElement.attributes.getText(sidebarAst).includes("sidebar-new-row"));
  return {
    env,
    clickNew() {
      evaluate(button.getText(sidebarAst), { t: key => key, selectedCwd: env.activeCwd, onOpenWelcome }).props.onClick();
      env.welcomeOpenRef.current = env.welcomeOpen;
    },
    openSession(session, isRestore = false) {
      const declaration = findNode(shellAst, node => ts.isVariableDeclaration(node) && node.name.getText(shellAst) === "handleSelectSession");
      const body = declaration.initializer.arguments[0];
      for (const name of body.getText(shellAst).match(/\bset[A-Z]\w*(?=\()/g) ?? []) {
        const state = name[3].toLowerCase() + name.slice(4);
        env[name] = value => { env[state] = typeof value === "function" ? value(env[state]) : value; };
      }
      evaluate(body.getText(shellAst), env)(session, isRestore);
    },
    openTask(id, cwd) {
      const declaration = findNode(shellAst, node => ts.isVariableDeclaration(node) && node.name.getText(shellAst) === "handleNewSession");
      const body = declaration.initializer.arguments[0];
      for (const name of body.getText(shellAst).match(/\bset[A-Z]\w*(?=\()/g) ?? []) {
        const state = name[3].toLowerCase() + name.slice(4);
        env[name] = value => { env[state] = typeof value === "function" ? value(env[state]) : value; };
      }
      env.parkedNewSessionDraftKey = cwd => `parked-new:${cwd}`;
      evaluate(body.getText(shellAst), env)(id, cwd);
    },
    chatSurface() {
      const element = findNode(shellAst, node => ts.isJsxElement(node) && node.openingElement.tagName.getText(shellAst) === "div" && node.openingElement.attributes.properties.some(attr => ts.isJsxAttribute(attr) && attr.name.text === "inert" && attr.initializer?.getText(shellAst).includes("scheduledOpen")));
      const opening = element.openingElement.getText(shellAst);
      return evaluate(opening.replace(/>$/, " />"), env);
    },
    welcomeMarkup() {
      const branch = findNode(shellAst, node => ts.isJsxExpression(node) && node.expression?.getText(shellAst).startsWith("welcomeOpen &&") && node.expression.getText(shellAst).includes("<PilaudeWelcome"));
      assert.ok(branch, "An open home view renders the existing welcome component");
      const tree = evaluate(branch.expression.getText(shellAst), {
        welcomeOpen: env.welcomeOpen, PilaudeWelcome, desktopMode: false,
        handleSelectProjectFromComposer() {}, setWelcomePickerOpen() {}, openSettingsSection() {},
      });
      return renderToStaticMarkup(h(I18nProvider, null, tree));
    },
  };
}

test("clicking New displays the existing ripple home without changing the underlying session or draft", () => {
  const session = { id: "kept", cwd: "/project" };
  const view = homeNavigationHarness(session, { localNavigationOnly: true });
  const draftKey = view.env.activeNewSessionDraftKeyRef.current;
  const draft = { value: "keep my unsent work", images: [] };
  draftStore.setDraft(draftKey, draft);
  try {
    view.clickNew();
    assert.equal(view.env.welcomeOpen, true);
    assert.equal(view.env.scheduledOpen, false);
    assert.equal(view.env.selectedSession, session);
    assert.equal(view.env.activeNewSessionDraftKeyRef.current, draftKey);
    assert.equal(view.env.sessionKey, 4, "Home navigation does not remount the composer");
    assert.deepEqual(draftStore.getDraft(draftKey), draft);
    const url = new URLSearchParams(view.env.url);
    assert.equal(url.get("view"), "new");
    assert.equal(url.get("session"), session.id, "Reload retains the underlying session selection");
    const html = view.welcomeMarkup();
    assert.match(html, /pilaude-code-ripple/);
    assert.match(html, /Open a project/);
  } finally { draftStore.clearDraft(draftKey); }
});

test("selecting the kept session leaves home and reveals the same chat mount", () => {
  const session = { id: "kept", cwd: "/project" };
  const view = homeNavigationHarness(session);
  view.clickNew();
  assert.equal(view.chatSurface().props.style.display, "none");
  assert.equal(view.chatSurface().props.inert, true);
  view.openSession(session);
  assert.equal(view.env.welcomeOpen, false, "Re-clicking the active session also leaves home");
  assert.equal(view.chatSurface().props.style.display, undefined);
  assert.equal(view.chatSurface().props.inert, false);
  assert.equal(view.env.sessionKey, 4);
  assert.equal(view.env.selectedSession, session);
});

test("a background session restore keeps home visible and keeps its URL", () => {
  const session = { id: "restored", cwd: "/project" };
  const view = homeNavigationHarness(null);
  view.clickNew();
  const url = view.env.url;
  view.openSession(session, true);
  assert.equal(view.env.welcomeOpen, true);
  assert.equal(view.env.selectedSession, session);
  assert.equal(view.env.url, url, "Session restore must not rewrite the home URL");
  assert.match(view.welcomeMarkup(), /pilaude-code-ripple/);
});

test("home reload retains a blank composer's draft identity after cwd validation", async () => {
  const view = homeNavigationHarness(null, { newSessionCwd: "/project", newSessionDraftId: "unsent" });
  view.clickNew();
  const params = new URLSearchParams(view.env.url);
  assert.equal(params.get("cwd"), "/project");
  assert.equal(params.get("draft"), "unsent");
  const draft = { value: "reload me", images: [] };
  draftStore.setDraft("new:unsent:/project", draft);
  try {
    const initialDraft = findNode(shellAst, node => ts.isVariableDeclaration(node) && ts.isArrayBindingPattern(node.name) && node.name.elements[0]?.name?.getText(shellAst) === "newSessionDraftId");
    const ref = findNode(shellAst, node => ts.isVariableDeclaration(node) && node.name.getText(shellAst) === "restoredHomeDraftIdRef");
    const refValue = ref ? evaluate(ref.initializer.arguments[0].getText(shellAst), { searchParams: params }) : null;
    const initialValue = evaluate(initialDraft.initializer.arguments[0].getText(shellAst), { restoredHomeDraftIdRef: { current: refValue } });
    assert.equal(initialValue, "unsent");
    const effect = findNode(shellAst, node => ts.isCallExpression(node) && node.expression.getText(shellAst) === "useEffect" && node.arguments[0]?.getText(shellAst).includes('fetch("/api/cwd/validate"'));
    const env = {
      initialNavigation: { requestedCwd: "/project" }, AbortController,
      fetch: async () => ({ ok: true, json: async () => ({ cwd: "/project" }) }),
      restoredHomeDraftIdRef: { current: refValue }, suppressCwdBumpRef: { current: false },
      activeNewSessionDraftKeyRef: { current: null },
      window: { location: { search: view.env.url } }, URLSearchParams,
      router: { replace() { assert.fail("A restored home URL already identifies its cwd"); } },
      setInitialCwdStatus() {}, setInitialCwdError() {}, setNewSessionCwd() {},
      setNewSessionDraftId(value) { env.draftId = value; },
    };
    const cleanup = evaluate(effect.arguments[0].getText(shellAst), env)();
    await new Promise(resolve => setImmediate(resolve));
    cleanup();
    assert.equal(env.draftId, "unsent");
    assert.equal(env.activeNewSessionDraftKeyRef.current, "new:unsent:/project");
    assert.deepEqual(draftStore.getDraft(env.activeNewSessionDraftKeyRef.current), draft);
  } finally { draftStore.clearDraft("new:unsent:/project"); }
});

test("a project's new-session action leaves home and still opens a clean composer", () => {
  const view = homeNavigationHarness({ id: "kept", cwd: "/project" });
  view.clickNew();
  view.openTask("project-new", "/project");
  assert.equal(view.env.welcomeOpen, false);
  assert.equal(view.env.selectedSession, null);
  assert.equal(view.env.newSessionCwd, "/project");
  assert.equal(view.env.activeNewSessionDraftKeyRef.current, "new:project-new:/project");
  assert.equal(view.env.sessionKey, 5);
});

test("home hides session context surfaces while retaining the chat mount", () => {
  const contextBranch = findNode(shellAst, node => ts.isJsxExpression(node) && node.expression?.getText(shellAst).startsWith("showChat && contextDockOpen"));
  assert.ok(contextBranch);
  const context = evaluate(contextBranch.expression.getText(shellAst), {
    showChat: true, contextDockOpen: true, scheduledOpen: false, welcomeOpen: true,
    settingsSection: null, projectTrustDialogOpen: false, welcomePickerOpen: false,
    PilaudeWorkspaceContext() {}, selectedSession: { id: "kept", cwd: "/project" },
    effectiveNewSessionCwd: null, activeCwd: "/project", sessionStats: null, contextUsage: null,
    systemTools: null, rightPanelOpen: false, rightPanelFullWidth: false,
    openSessionStatsPanel() {}, handleSystemInfoToggle() {}, handleContextDockClose() {}, openSettingsSection() {},
  });
  assert.equal(context, false, "The context dock cannot cover the home surface");
});

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
