import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const project = "D:/generated/activity-fixture";
const stamp = Date.UTC(2026, 9, 19, 12);
const session = (id) => ({ id, name: `Activity fixture ${id}`, firstMessage: "Generated activity fixture", cwd: project, projectRoot: project, projectKey: project, path: `${project}/${id}.jsonl`, created: new Date(stamp).toISOString(), modified: new Date(stamp).toISOString(), messageCount: 5, transient: false });
const sessions = [session("activity"), session("draft")];
const assistant = (content, timestamp = stamp + 1000, stopReason = "stop") => ({ role: "assistant", content, timestamp, stopReason, provider: "generated", model: "generated" });
const user = { role: "user", content: "Inspect the generated activity fixture.", timestamp: stamp };
const historical = assistant([
  { type: "thinking", thinking: "" },
  { type: "text", text: "I will inspect the generated file." },
  { type: "thinking", thinking: "Stored reasoning preview", deferred: true },
  { type: "toolCall", toolCallId: "history-read", toolName: "bash", input: { command: "printf fixture-history" } },
  { type: "text", text: "Historical answer stays outside the process group." },
]);
const historyResult = { role: "toolResult", toolCallId: "history-read", toolName: "bash", content: [{ type: "text", text: "fixture-history-output\n".repeat(45) }], isError: false, timestamp: stamp + 2000 };

/** The actual AppShell runs; every HTTP API and EventSource boundary is replaced before navigation. */
export async function installActivityFixture(context, report) {
  // The locally installed font stays private; only this browser response consumes
  // the existing customization. No font data or runtime state is persisted here.
  const customCss = await readFile(new URL("../test-results/pilaude/runtime-data/desktop/custom.css", import.meta.url), "utf8").catch(() => "");
  report.localFontSupplied = Boolean(customCss);
  const state = { messages: [user, historical, historyResult], entryIds: ["history-user", "history-assistant", "history-result"], running: false, revision: 1, todos: undefined, todoBranch: null };
  await context.addInitScript(() => {
    if (window.top !== window.self) return;
    localStorage.setItem("pi-theme", "light");
    localStorage.setItem("pi-locale", "en");
    localStorage.setItem("pi-workspace-pane-visibility-v1", "false");
    localStorage.setItem("pi-sound-enabled", "false");
    const sources = [];
    window.EventSource = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
      constructor(url) {
        super(); this.url = String(url); this.readyState = 1; sources.push(this);
        queueMicrotask(() => {
          if (this.readyState !== 1) return;
          this.onopen?.(new Event("open"));
          if (/\/api\/agent\/[^/]+\/events/.test(this.url)) this.emit({ type: "connected", isStreaming: false, pendingExtensionUiIds: [] });
        });
      }
      emit(value) { const event = new MessageEvent("message", { data: JSON.stringify(value) }); this.onmessage?.(event); this.dispatchEvent(event); }
      close() { this.readyState = 2; }
    };
    window.__activityEvents = (events) => {
      const active = sources.filter((source) => source.readyState === 1 && source.url === "/api/agent/activity/events");
      if (!active.length) throw new Error("Activity event source is not connected");
      for (const event of events) for (const source of active) source.emit(event);
    };
  });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { report.externalRequests.push(request.url()); return route.fulfill({ status: 200, body: "" }); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const record = { method: request.method(), path: url.pathname + url.search };
    report.apiRequests.push(record);
    if (!["GET", "HEAD"].includes(request.method())) {
      report.interceptedWrites.push({ ...record, body: request.postData() });
      if (/\/api\/agent\/[^/]+\/lease$/.test(url.pathname)) return route.fulfill({ json: { renewed: 1 } });
      return route.fulfill({ status: 409, json: { error: "Activity fixture never executes writes" } });
    }
    if (url.pathname === "/api/sessions") return route.fulfill({ json: { sessions } });
    if (/^\/api\/sessions\/[^/]+\/output-style$/.test(url.pathname)) return route.fulfill({ json: { supported: false, reason: "unavailable", selectedId: "default", styles: [] } });
    if (url.pathname === "/api/sessions/search") return route.fulfill({ json: { results: [{ session: sessions[0], before: "", match: "Stored reasoning preview", after: "", entryId: "history-assistant", blockIndex: 2 }], truncated: false } });
    if (url.pathname === "/api/sessions/activity/entries/history-assistant/thinking") {
      report.thinkingRequests.push(Number(url.searchParams.get("blockIndex")));
      return route.fulfill({ json: { thinking: "Full stored reasoning at original block index two." } });
    }
    const info = sessions.find((item) => url.pathname === `/api/sessions/${item.id}`);
    if (info) {
      const messages = info.id === "activity" ? state.messages : [{ ...user, content: "Other session." }, assistant([{ type: "text", text: "Other session answer." }])];
      const entryIds = info.id === "activity" ? state.entryIds : ["draft-user", "draft-answer"];
      const todoView = info.id === 'activity' ? state.todoBranch : null;
      return route.fulfill({ json: { sessionId: info.id, filePath: info.path, leafId: todoView?.leafId ?? entryIds.at(-1), tree: todoView?.tree ?? [], treeFormat: "summary", snapshotRevision: `activity-${state.revision}`, totalActiveMs: 0,
        context: { messages: todoView?.messages ?? messages, entryIds: todoView?.entryIds ?? entryIds, oldestEntryId: entryIds[0], hasMore: false, model: null, thinkingLevel: "off", ...(state.todos !== undefined ? { todos: info.id === 'activity' ? state.todos : null } : {}) },
        stats: { totalMessages: messages.length, userMessages: 1, assistantMessages: 1, toolCalls: 1, toolResults: 1, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] } } });
    }
    if (state.todoBranch && url.pathname === '/api/sessions/activity/context') {
      const branch = state.todoBranch.branches[url.searchParams.get('leafId')];
      return route.fulfill({ json: { context: branch ? { messages: branch.messages, entryIds: branch.entryIds, oldestEntryId: branch.entryIds[0], hasMore: false, model: null, thinkingLevel: 'off', todos: branch.todos } : { messages: [], entryIds: [], oldestEntryId: null, hasMore: false, model: null, thinkingLevel: 'off', todos: null } } });
    }
    if (/^\/api\/(agent\/activity|sessions\/activity\/state)$/.test(url.pathname)) return route.fulfill({ json: { running: state.running, state: { isStreaming: state.running, isPromptRunning: state.running } } });
    if (url.pathname === "/api/custom-css") return route.fulfill({ contentType: "text/css", body: customCss });
    const data = {
      "/api/home": { home: project, homeDir: project }, "/api/cwd/status": { availability: "available" },
      "/api/open-in-explorer": { supported: false, reason: "Generated fixture", platform: "win32" },
      "/api/worktrees": { projectRoot: project, projectKey: project, isGit: false, isTopLevel: true, currentWorktreePath: project, worktrees: [] },
      "/api/scheduled-tasks": { tasks: [], scheduler: { owner: false, ownerInfo: null } },
      "/api/desktop/environment": { hostname: "Generated fixture", platform: "win32" },
      "/api/models": { models: {}, modelList: [], defaultModel: null, modelScopeWarnings: [] },
      "/api/models/enabled": { allEnabled: true, patterns: null, stalePatterns: [], enabledTotal: 0, availableTotal: 0, providers: [], scope: "global", settingsPath: "generated", editable: false },
      "/api/models/nonchat": { classifier: [], image: [], codemode: "automatic" },
      "/api/project-trust": { requiresTrust: false, trusted: true, decision: null, inherited: false },
      "/api/auth/providers": { oauthProviders: [], apiKeyProviders: [] }, "/api/models-config": { providers: {} },
      "/api/updates": { updates: [], nextCheckAt: "2099-01-01T00:00:00Z" }, "/api/web-auth": { enabled: false },
      "/api/tools/settings": { powerShellEnabled: false, powerShellAvailable: false }, "/api/artifacts/settings": { enabled: false },
      "/api/git/status": { isGitRepository: false, files: [] },
    };
    return route.fulfill({ json: url.pathname.startsWith("/api/agent/") ? { running: false, runningSessionIds: [] } : data[url.pathname] ?? {} });
  });
  return state;
}

const settle = (page, check, arg) => page.waitForFunction(check, arg, { timeout: 15000 });
async function assertExpanded(trigger, expanded) { assert.equal(await trigger.getAttribute("aria-expanded"), String(expanded)); }
async function linkedBody(trigger) {
  const id = await trigger.getAttribute("aria-controls");
  assert.ok(id, "Disclosure button identifies its content");
  return trigger.page().locator(`[id=${JSON.stringify(id)}]`);
}

async function inspectNativeTodos(page, context, state, report, capture) {
  const snapshot = (id, tasks) => ({ source: 'rpiv-todo', snapshotEntryId: id, tasks });
  const tasks = [
    { id: 1, subject: 'Inspect generated source', status: 'completed' },
    { id: 2, subject: 'Implement generated Todo consumer', status: 'in_progress', activeForm: 'Implementing generated Todo consumer', owner: 'generated-worker' },
    { id: 3, subject: 'Verify dependency and exact state', status: 'pending', description: 'Keep <source> & task text literal.', blockedBy: [1, 2, 99] },
    { id: 4, subject: 'Deleted generated tombstone', status: 'deleted' },
  ];
  const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
  await context.route(`${base}/api/agent/activity`, async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    const command = request.postDataJSON();
    if (!['abort', 'navigate_tree'].includes(command?.type)) return route.fallback();
    report.interceptedWrites.push({ method: 'POST', path: '/api/agent/activity', body: request.postData() });
    if (command.type === 'navigate_tree') {
      const branch = state.todoBranch?.branches[command.targetId];
      if (!branch) return route.fulfill({ status: 400, json: { error: 'Unknown generated branch' } });
      Object.assign(state.todoBranch, { leafId: command.targetId, messages: branch.messages, entryIds: branch.entryIds });
      state.todos = branch.todos; state.revision++;
    }
    await route.fulfill({ json: {} });
  });
  const panel = page.locator('.session-todo-panel');
  assert.equal(await panel.count(), 0, 'A branch without canonical Todo state does not invent a panel');
  await emit([{ type: 'extension_ui_request', method: 'setWidget', widgetKey: 'rpiv-todos', widgetLines: ['Generated legacy widget fallback'], widgetPlacement: 'aboveEditor' }]);
  const input = page.locator('textarea.chat-input-textarea');
  const draft = 'Generated Todo draft 草稿 stays unsent';
  await input.fill(draft);
  const liveUser = { role: 'user', content: 'Generated canonical Todo turn.', timestamp: stamp + 3000 };
  const liveText = 'Generated live response stays active through task updates.';
  state.running = true; state.messages.push(liveUser); state.entryIds.push('todo-user'); state.revision++;
  await emit([{ type: 'agent_start' }, { type: 'message_end', message: liveUser }, { type: 'message_start', message: assistant([], stamp + 4000) }, { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 0 } }, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: liveText } }]);
  await page.getByText(liveText, { exact: true }).waitFor();
  await input.focus();
  await input.evaluate((element) => { window.__todoInput = element; element.setSelectionRange(3, 8); });
  await page.locator('.chat-scroll-container').evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  const scrollBefore = await page.locator('.chat-scroll-container').evaluate((element) => element.scrollTop);
  state.todos = snapshot('generated-todo-live', tasks);
  await emit([{ type: 'todo_state', todos: state.todos }]);
  await panel.waitFor();
  assert.equal(await panel.locator('.session-todo-row').count(), 3);
  assert.match(await panel.innerText(), /1 of 3 completed/); assert.match(await panel.innerText(), /1 in progress/); assert.match(await panel.innerText(), /1 pending/);
  assert.match(await panel.innerText(), /Owner: generated-worker/); assert.match(await panel.innerText(), /Depends on: #1, #2, #99/);
  assert.doesNotMatch(await panel.innerText(), /Deleted generated tombstone|%|Plan/);
  assert.equal(await panel.locator('source,input,[role="progressbar"]').count(), 0);
  assert.equal(await page.locator('[data-message-streaming="true"]').count(), 1, 'Todo metadata cannot end the live assistant stream');
  assert.equal(await input.inputValue(), draft);
  assert.equal(await input.evaluate((element) => element === window.__todoInput && element === document.activeElement && element.selectionStart === 3 && element.selectionEnd === 8), true, 'Task updates preserve the input node, focus and selection');
  assert.equal(await page.locator('.chat-scroll-container').evaluate((element) => element.scrollTop), scrollBefore, 'Todo updates preserve manual history position');
  assert.equal(await page.getByText('Generated legacy widget fallback', { exact: true }).count(), 0, 'Known canonical tasks replace the duplicate ANSI widget');
  const rowsBefore = await panel.locator('.session-todo-row').count();
  await emit([{ type: 'todo_state', todos: structuredClone(state.todos) }, { type: 'todo_state', todos: { source: 'rpiv-todo', snapshotEntryId: 'invalid', tasks: [{ id: 1, subject: 'Invalid generated state', status: 'success' }] } }]);
  assert.equal(await panel.locator('.session-todo-row').count(), rowsBefore);
  await capture('todo-live-canonical');
  const summary = panel.locator('summary');
  await summary.focus(); await summary.press('Enter');
  assert.equal(await panel.locator('details').getAttribute('open'), null);
  await emit([{ type: 'todo_state', todos: snapshot('generated-todo-updated', tasks.map((task) => task.id === 2 ? { ...task, status: 'completed' } : task)) }]);
  assert.equal(await panel.locator('details').getAttribute('open'), null, 'Canonical updates retain the user collapse choice');
  await summary.press('Space');
  assert.notEqual(await panel.locator('details').getAttribute('open'), null);
  assert.equal(await summary.evaluate((element) => element === document.activeElement), true);
  report.checks.push('Canonical Todo shows exact states/counts/owner/dependencies, filters only deleted rows, deduplicates replay and preserves stream/draft/focus/manual history and native disclosure');
  state.todos = snapshot('generated-todo-clear', []);
  await emit([{ type: 'todo_state', todos: state.todos }]);
  await panel.getByText('No tasks', { exact: true }).waitFor();
  assert.equal(await panel.locator('.session-todo-row').count(), 0);
  await emit([{ type: 'connected', isStreaming: true, todos: null }]);
  await panel.waitFor({ state: 'detached' });
  await emit([{ type: 'connected', isStreaming: true, todos: snapshot('generated-todo-reconnected', tasks) }, { type: 'message_start', message: assistant([{ type: 'text', text: liveText }], stamp + 4000) }]);
  await panel.waitFor();
  assert.equal(await panel.locator('.session-todo-row').count(), 3);
  await page.locator('button.composer-abort-button:visible').first().click();
  await settle(page, () => !document.querySelector('[data-message-streaming="true"]'));
  const liveAnswer = assistant([{ type: 'text', text: liveText }], stamp + 4000, 'aborted');
  state.messages.push(liveAnswer); state.entryIds.push('todo-answer'); state.running = false; state.revision++;
  await emit([{ type: 'message_end', message: liveAnswer }, { type: 'agent_end' }, { type: 'agent_settled' }]);
  assert.equal(await input.inputValue(), draft);
  await page.getByRole('button', { name: 'Activity fixture draft', exact: true }).first().click();
  await page.getByText('Other session answer.', { exact: true }).waitFor();
  assert.equal(await panel.count(), 0);
  await input.fill('Generated second session draft');
  state.todos = snapshot('generated-todo-restored', tasks);
  await page.getByRole('button', { name: 'Activity fixture activity', exact: true }).first().click();
  await panel.waitFor();
  await settle(page, (draft) => document.querySelector('textarea.chat-input-textarea')?.value === draft, draft);
  report.checks.push('Canonical clear differs from unknown; authoritative reconnect and session round trip restore only the selected snapshot and preserve independent drafts');
  const branchA = { messages: [user, assistant([{ type: 'text', text: 'Generated branch A answer.' }])], entryIds: ['branch-a-user', 'branch-a'], todos: snapshot('generated-todo-branch-a', [{ id: 11, subject: 'Generated branch A task', status: 'pending' }]) };
  const branchB = { messages: [user, assistant([{ type: 'text', text: 'Generated branch B answer.' }])], entryIds: ['branch-b-user', 'branch-b'], todos: snapshot('generated-todo-branch-b', [{ id: 22, subject: 'Generated branch B task', status: 'completed' }]) };
  const tree = ['a', 'b'].map((letter) => ({ entry: { type: 'message', id: `branch-${letter}`, parentId: null, timestamp: new Date(stamp).toISOString(), message: { role: 'user', content: `Generated Todo branch ${letter.toUpperCase()}` } }, children: [] }));
  state.todoBranch = { leafId: 'branch-a', tree, ...branchA, branches: { 'branch-a': branchA, 'branch-b': branchB } }; state.todos = branchA.todos; state.revision++;
  await page.goto(`${base}/?session=activity`, { waitUntil: 'domcontentloaded' });
  await panel.getByText('Generated branch A task', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Branches', exact: true }).first().click();
  await page.locator('.branch-tree-row').filter({ hasText: 'Generated Todo branch B' }).click();
  await panel.getByText('Generated branch B task', { exact: true }).waitFor();
  assert.equal(await panel.getByText('Generated branch A task', { exact: true }).count(), 0);
  if (await page.getByRole('button', { name: 'Branches', exact: true }).first().getAttribute('aria-pressed') !== 'true') await page.getByRole('button', { name: 'Branches', exact: true }).first().click();
  await page.locator('.branch-tree-row').filter({ hasText: 'Generated Todo branch A' }).click();
  await panel.getByText('Generated branch A task', { exact: true }).waitFor();
  report.checks.push('Actual branch picker and canonical context API restore branch-specific tasks independently of paged transcript text');
  const longTasks = Array.from({ length: 45 }, (_, index) => ({ id: index + 1, subject: `Generated long Todo task ${index + 1} with literal detail`, status: index === 0 ? 'in_progress' : 'pending', owner: index === 0 ? 'generated-worker' : undefined }));
  state.todos = snapshot('generated-todo-long', longTasks);
  await emit([{ type: 'todo_state', todos: state.todos }]);
  if (await page.getByRole('button', { name: 'Branches', exact: true }).first().getAttribute('aria-pressed') === 'true') await page.getByRole('button', { name: 'Branches', exact: true }).first().click();
  const contextToggle = page.locator('.pilaude-context-toggle[aria-pressed="true"]');
  if (await contextToggle.count()) await contextToggle.click();
  const hideSidebar = page.getByRole('button', { name: 'Hide sidebar', exact: true });
  if (await hideSidebar.first().isVisible()) await hideSidebar.first().click();
  await page.waitForFunction(() => !document.querySelector('.app-sidebar.sidebar-open') && document.querySelector('.app-sidebar').getBoundingClientRect().right <= 1);
  for (const viewport of [{ width: 1300, height: 1000 }, { width: 390, height: 340 }]) {
    await page.setViewportSize(viewport);
    await page.waitForFunction(() => !document.querySelector('.app-sidebar.sidebar-open') && document.querySelector('.app-sidebar').getBoundingClientRect().right <= 1);
    await page.evaluate(async () => {
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.allSettled(document.getAnimations().filter((animation) => animation.effect?.getTiming().iterations !== Infinity).map((animation) => animation.finished));
    });
    await input.fill('Generated long Todo draft stays editable');
    await input.focus();
    const geometry = await panel.evaluate((element) => {
      const rect = (node) => node.getBoundingClientRect().toJSON();
      const list = element.querySelector('.session-todo-list'), summary = element.querySelector('summary'), input = document.querySelector('textarea.chat-input-textarea');
      const summaryBox = summary.getBoundingClientRect(), inputBox = input.getBoundingClientRect();
      return { viewport: { width: innerWidth, height: innerHeight }, panel: rect(element), list: rect(list), listClientHeight: list.clientHeight, listScrollHeight: list.scrollHeight, summary: rect(summary), input: rect(input), summaryHit: summary.contains(document.elementFromPoint(summaryBox.left + summaryBox.width / 2, summaryBox.top + summaryBox.height / 2)), inputHit: document.elementFromPoint(inputBox.left + inputBox.width / 2, inputBox.top + inputBox.height / 2) === input, composer: rect(input.closest('.chat-composer')), inputHitOwner: document.elementFromPoint(inputBox.left + inputBox.width / 2, inputBox.top + inputBox.height / 2)?.className, summaryHitOwner: document.elementFromPoint(summaryBox.left + summaryBox.width / 2, summaryBox.top + summaryBox.height / 2)?.className, sidebarOpen: document.querySelector('#session-sidebar')?.classList.contains('sidebar-open'), animations: element.getAnimations({ subtree: true }).length };
    });
    report.measurements.push({ name: `todo-long-${viewport.width}x${viewport.height}`, ...geometry });
    assert.ok(geometry.listClientHeight < geometry.listScrollHeight && geometry.list.height <= Math.min(220, viewport.height * .25) + 1);
    assert.ok(geometry.panel.left >= 0 && geometry.panel.right <= viewport.width + 1 && geometry.panel.top >= 0);
    assert.ok(geometry.summaryHit && geometry.inputHit && geometry.input.height >= 20 && geometry.input.width >= 140, 'Bounded task history leaves composer and collapse control usable');
    assert.equal(geometry.animations, 0, 'Todo adds no competing continuous activity');
    await panel.locator('.session-todo-list').evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await capture(`todo-long-${viewport.width}x${viewport.height}`);
  }
  report.checks.push('Long canonical task lists scroll in a bounded panel on desktop and 390x340 while summary and composer retain native hit targets without added animation');
  await page.setViewportSize({ width: 1300, height: 1000 });
}

export async function runActivityDisclosure() {
  const out = new URL(`../test-results/pilaude/activity-disclosure/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    const state = await installActivityFixture(context, report);
    if (process.env.E2E_TODO_ONLY === '1') state.todos = null;
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async (name) => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    if (process.env.E2E_TODO_ONLY === '1') {
      await inspectNativeTodos(page, context, state, report, capture);
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
      assert.ok(report.interceptedWrites.every((request) => request.path.endsWith('/lease') || request.path === '/api/agent/activity' && ['abort', 'navigate_tree'].includes(JSON.parse(request.body).type)), 'Todo fixture attempts only intercepted lease/Stop/branch commands');
      report.status = 'passed';
      return report;
    }
    const history = page.locator(".process-details-trigger").first();
    await assertExpanded(history, false);
    const body = await linkedBody(history);
    assert.equal(await body.count(), 1, "Collapsed content wrapper exists for ARIA");
    assert.equal(await body.isVisible(), false);
    assert.equal(await body.getAttribute("aria-hidden"), "true");
    assert.equal(await body.evaluate((element) => element.inert && element.getBoundingClientRect().height === 0), true, "Collapsed group is inert and occupies zero height");
    assert.equal(await history.locator(":scope > :last-child").getAttribute("class"), "process-details-chevron", "Chevron trails the summary");
    await history.focus(); await history.press("Enter"); await assertExpanded(history, true);
    assert.equal(await history.evaluate((button) => button === document.activeElement), true, "Native Enter preserves focus");
    const thinking = body.locator(".thinking-disclosure-toggle");
    await assertExpanded(thinking, false);
    await thinking.click();
    await page.getByText("Full stored reasoning at original block index two.", { exact: true }).waitFor();
    assert.deepEqual(report.thinkingRequests, [2], "Filtering the empty leading thinking block keeps the stored deferred index");
    await body.locator(".tool-call-trigger").click();
    assert.equal(await body.getByText(/fixture-history-output/).isVisible(), true);
    await capture("history-expanded");
    const font = await history.evaluate(async (element) => {
      await document.fonts.ready;
      const family = getComputedStyle(element).fontFamily;
      const first = family.split(",")[0].trim().replaceAll('"', "");
      const loaded = await document.fonts.load(`13px "${first}"`);
      return { family, loadedFaces: loaded.length, status: document.fonts.status, size: getComputedStyle(element).fontSize, border: getComputedStyle(element).borderWidth, background: getComputedStyle(element).backgroundColor };
    });
    report.measurements.push({ name: "activity-summary-font", ...font });
    if (report.localFontSupplied) {
      assert.match(font.family, /Pilaude Reference Sans|Anthropic Sans|AnthropicSans/, "Activity summary consumes the locally supplied Anthropic Sans family alias");
      assert.ok(font.loadedFaces > 0, "Private local font actually loads instead of silently falling back");
    } else assert.ok(font.family.length > 0, "Fresh checkouts still resolve the existing UI font fallback");
    await history.focus(); await history.press("Space"); await assertExpanded(history, false);
    assert.equal(await history.evaluate((button) => button === document.activeElement), true, "Native Space preserves focus");
    assert.equal(await page.getByText("Historical answer stays outside the process group.", { exact: true }).isVisible(), true);
    report.checks.push("History collapses independently; trailing chevron and linked content; native Enter/Space focus; deferred original index; final answer outside");
    await capture("history-collapsed");
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    state.running = true;
    const liveUser = { role: "user", content: "Generated live activity turn.", timestamp: stamp + 3000 };
    state.messages.push(liveUser); state.entryIds.push("live-user"); state.revision++;
    await emit([{ type: "agent_start" }, { type: "message_end", message: liveUser }]);
    const liveMessage = assistant([{ type: "thinking", thinking: "Live reasoning alpha." }], stamp + 4000);
    await emit([{ type: "message_start", message: liveMessage }]);
    await settle(page, () => document.querySelectorAll(".process-details-trigger").length === 2);
    const visibleActivity = () => page.locator('.activity-shimmer[data-active="true"]:visible').count();
    const live = page.locator(".process-details-trigger").last();
    await assertExpanded(live, true);
    const liveBody = await linkedBody(live);
    const liveThinking = liveBody.locator(".thinking-disclosure-toggle");
    await assertExpanded(liveThinking, false);
    await liveThinking.click();
    assert.equal(await page.getByText("Live reasoning alpha.", { exact: true }).count(), 1, "Streaming reasoning renders exactly once");
    await emit([{ type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "" } }]);
    await settle(page, () => [...document.querySelectorAll('.activity-shimmer[data-active="true"]')].filter((element) => element.getClientRects().length).length === 1);
    assert.equal(await visibleActivity(), 1, "Only the active thinking summary shimmers");
    const reducedAnimation = await page.locator('.activity-shimmer[data-active="true"]:visible').evaluate((element) => getComputedStyle(element).animationName);
    assert.equal(reducedAnimation, "none", "Reduced motion keeps the activity label static");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const motion = await page.locator('.activity-shimmer[data-active="true"]:visible').evaluate((element) => {
      const style = getComputedStyle(element); return { name: style.animationName, duration: style.animationDuration, direction: style.animationDirection, iterations: style.animationIterationCount };
    });
    assert.notEqual(motion.name, "none"); assert.equal(motion.duration, "1.8s"); assert.equal(motion.iterations, "infinite");
    const movement = await page.locator('.activity-shimmer[data-active="true"]:visible').evaluate(async (element) => {
      const animation = element.getAnimations()[0];
      const before = { position: getComputedStyle(element).backgroundPosition, time: animation?.currentTime };
      // The reused keyframe intentionally dwells during the first/last 15%.
      // Observe real frames until it leaves that dwell, without changing time.
      const started = performance.now();
      while (getComputedStyle(element).backgroundPosition === before.position && performance.now() - started < 650) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
      return { before, after: { position: getComputedStyle(element).backgroundPosition, time: animation?.currentTime } };
    });
    assert.ok(movement.after.time > movement.before.time, "Real animation timeline advances across native animation frames");
    assert.notEqual(movement.after.position, movement.before.position, "Shimmer changes the actual text-gradient position");
    report.measurements.push({ name: "normal-motion-shimmer", ...motion, movement });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await live.click(); await assertExpanded(live, false);
    assert.equal(await visibleActivity(), 1, "Collapsed live group owns the only visible shimmer");
    await live.evaluate((button) => { window.__activityGroupButton = button; });
    liveMessage.content[0].thinking += " More reasoning.";
    await emit([{ type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: " More reasoning." } }]);
    await assertExpanded(live, false);
    assert.equal(await live.evaluate((button) => button === window.__activityGroupButton), true, "Streaming delta retains the same turn group button");
    await live.click();
    await assertExpanded(liveThinking, true);
    await page.getByText("Live reasoning alpha. More reasoning.", { exact: true }).waitFor();
    await capture("live-thinking-expanded");
    const call = { type: "toolCall", toolCallId: "live-command", toolName: "bash", input: { command: "printf fixture-live" } };
    liveMessage.content.push(call);
    await emit([{ type: "message_update", assistantMessageEvent: { type: "thinking_end", contentIndex: 0, content: liveMessage.content[0].thinking } }, { type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 1, id: call.toolCallId, toolName: call.toolName } }, { type: "message_update", assistantMessageEvent: { type: "toolcall_end", contentIndex: 1, toolCall: { id: call.toolCallId, name: call.toolName, arguments: call.input } } }, { type: "message_end", message: { ...liveMessage, stopReason: "toolUse" } }, { type: "tool_execution_start", toolCallId: call.toolCallId, toolName: call.toolName }]);
    state.messages.push({ ...liveMessage, stopReason: "toolUse" }); state.entryIds.push("live-process"); state.revision++;
    assert.equal(await liveBody.locator(".tool-call-trigger").count(), 1, "Completed tool entry remains in the same live process group exactly once");
    assert.equal(await live.evaluate((button) => button === window.__activityGroupButton), true);
    await assertExpanded(liveThinking, true);
    await settle(page, () => document.querySelector('[data-tool-call-id="live-command"]')?.getAttribute("data-status") === "running");
    const tool = liveBody.locator('[data-tool-call-id="live-command"]');
    await assertExpanded(tool.locator(".tool-call-trigger"), false);
    assert.equal(await visibleActivity(), 1, "Tool takes over the single active shimmer after thinking finishes");
    assert.equal(await liveThinking.locator('.activity-shimmer[data-active="true"]').count(), 0, "Completed thinking is static even while the turn continues");
    await tool.locator(".tool-call-trigger").click();
    const partial = { role: "toolResult", toolCallId: call.toolCallId, toolName: call.toolName, content: [{ type: "text", text: "fixture-live-partial" }], isError: false };
    await emit([{ type: "tool_execution_update", toolCallId: call.toolCallId, toolName: call.toolName, partialResult: partial }]);
    await tool.getByText("fixture-live-partial", { exact: true }).waitFor();
    assert.equal(await tool.getAttribute("data-status"), "running", "Partial output leaves tool running");
    await capture("live-tool-group");
    const result = { ...partial, content: [{ type: "text", text: "fixture-live-complete" }], timestamp: stamp + 5000 };
    state.messages.push(result); state.entryIds.push("live-result"); state.revision++;
    await emit([{ type: "tool_execution_end", toolCallId: call.toolCallId, toolName: call.toolName, isError: false }, { type: "message_end", message: result }]);
    await settle(page, () => document.querySelector('[data-tool-call-id="live-command"]')?.getAttribute("data-status") === "success");
    assert.equal(await tool.locator('.activity-shimmer[data-active="true"]').count(), 0, "Completed tool is static");
    assert.equal(await visibleActivity(), 1, "Waiting-for-model phase owns the single shimmer after completed tools");
    const final = assistant([{ type: "text", text: "Live final answer is visible outside the collapsed group." }], stamp + 6000);
    await emit([{ type: "message_start", message: { ...final, content: [] } }, { type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 0 } }]);
    await assertExpanded(live, true);
    await emit([{ type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: final.content[0].text } }]);
    await page.getByText("Live final answer is visible outside the collapsed group.", { exact: true }).waitFor();
    assert.equal(await page.locator('[data-message-streaming="true"]').count(), 1, "Only active streamed text owns the output caret");
    await assertExpanded(live, false);
    assert.equal(await liveBody.getByText("Live final answer is visible outside the collapsed group.", { exact: true }).count(), 0);
    await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex: 0, content: final.content[0].text } }]);
    assert.equal(await page.locator('[data-message-streaming="true"]').count(), 0, "text_end stops the caret before message_end");
    state.messages.push(final); state.entryIds.push("live-answer"); state.running = false; state.revision++;
    await emit([{ type: "message_end", message: final }, { type: "agent_end" }, { type: "agent_settled" }]);
    await settle(page, () => !document.querySelector('.activity-shimmer[data-active="true"]'));
    assert.equal(await page.getByText("Live final answer is visible outside the collapsed group.", { exact: true }).count(), 1);
    assert.equal(await live.locator("..").getAttribute("data-status"), "success");
    await capture("live-finished-collapsed");
    report.checks.push("Same keyed live group survives deltas and tool handoff; reasoning toggle survives group collapse and message completion; each stream/tool entry renders exactly once; one visible shimmer; final answer resets collapse and remains outside");
    const input = page.locator("textarea.chat-input-textarea");
    await input.fill("草稿 remains unsent while reviewing activity");
    const writesBefore = report.interceptedWrites.length;
    await input.dispatchEvent("compositionstart");
    await input.dispatchEvent("keydown", { key: "Enter", code: "Enter", keyCode: 229, isComposing: true, bubbles: true });
    await input.dispatchEvent("compositionend", { data: "草稿" });
    assert.equal(await input.inputValue(), "草稿 remains unsent while reviewing activity");
    assert.equal(report.interceptedWrites.length, writesBefore, "IME Enter does not submit or mutate sessions");
    await live.click(); await live.click();
    assert.equal(await input.inputValue(), "草稿 remains unsent while reviewing activity", "Activity toggles preserve composer draft");
    await page.getByRole("button", { name: "Activity fixture draft", exact: true }).first().click();
    await page.getByText("Other session answer.", { exact: true }).waitFor();
    await input.fill("Independent second draft");
    await page.getByRole("button", { name: "Activity fixture activity", exact: true }).first().click();
    await settle(page, () => document.querySelector("textarea.chat-input-textarea")?.value === "草稿 remains unsent while reviewing activity");
    assert.equal(await input.inputValue(), "草稿 remains unsent while reviewing activity");
    report.checks.push("IME Enter does not send; process toggles and session switches preserve independent composer drafts");
    const errorUser = { role: "user", content: "Generated failing tool turn.", timestamp: stamp + 7000 };
    const errorCall = assistant([{ type: "toolCall", toolCallId: "failed-command", toolName: "bash", input: { command: "exit 1" } }], stamp + 8000, "toolUse");
    state.running = true;
    state.messages.push(errorUser, errorCall); state.entryIds.push("error-user", "error-process"); state.revision++;
    await emit([{ type: "agent_start" }, { type: "message_end", message: errorUser }, { type: "message_end", message: errorCall }, { type: "tool_execution_start", toolCallId: "failed-command", toolName: "bash" }]);
    await settle(page, () => document.querySelectorAll(".process-details-trigger").length === 3);
    const errorGroup = page.locator(".process-details-trigger").last();
    await errorGroup.click(); await assertExpanded(errorGroup, false);
    await page.locator(".chat-scroll-container").evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
    const beforeFailureScroll = await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop);
    const failed = { role: "toolResult", toolCallId: "failed-command", toolName: "bash", content: [{ type: "text", text: "fixture-command-failed" }], isError: true, timestamp: stamp + 9000 };
    state.messages.push(failed); state.entryIds.push("error-result"); state.revision++;
    await emit([{ type: "tool_execution_end", toolCallId: "failed-command", toolName: "bash", isError: true }, { type: "message_end", message: failed }]);
    await settle(page, () => document.querySelector('[data-tool-call-id="failed-command"]')?.getAttribute("data-status") === "error");
    await assertExpanded(errorGroup, true);
    const failedTool = page.locator('[data-tool-call-id="failed-command"]');
    await assertExpanded(failedTool.locator(".tool-call-trigger"), true);
    assert.equal(await failedTool.getByText("fixture-command-failed", { exact: true }).isVisible(), true);
    assert.equal(await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop), beforeFailureScroll, "Error reveal leaves manual history scroll where the user put it");
    await errorGroup.click(); await assertExpanded(errorGroup, false);
    await emit([{ type: "message_end", message: assistant([{ type: "thinking", thinking: "After error." }], stamp + 10000) }]);
    await assertExpanded(errorGroup, false);
    assert.match(await errorGroup.innerText(), /1 failed/);
    await capture("failed-group-manual-collapse");
    state.messages.push(assistant([{ type: "thinking", thinking: "After error." }], stamp + 10000)); state.entryIds.push("error-after"); state.running = false; state.revision++;
    await emit([{ type: "agent_end" }, { type: "agent_settled" }]);
    await settle(page, () => !document.querySelector('.activity-shimmer[data-active="true"]'));
    report.checks.push("Actual failure auto-reveals the group and nested tool once, exposes failed count, respects subsequent manual collapse, and never steals manual history scroll");
    // Deliberately matches no titles: Enter must still mount content search.
    await page.locator(".sidebar-search-input").fill("Stored reasoning preview");
    await page.locator(".sidebar-search-input").press("Enter");
    const hit = page.locator(".session-sidebar button").filter({ has: page.locator("mark") }).first();
    await hit.waitFor(); await hit.click();
    await settle(page, () => document.querySelector(".process-details-trigger")?.getAttribute("aria-expanded") === "true");
    const revealedThinking = page.locator('[data-entry-id="history-assistant"] .thinking-disclosure');
    assert.equal(await revealedThinking.isVisible(), true, "Search reveals the original process thinking block");
    const searchGeometry = await revealedThinking.evaluate((element) => {
      const rect = element.getBoundingClientRect(), scroll = document.querySelector(".chat-scroll-container").getBoundingClientRect();
      return { targetTop: rect.top, targetBottom: rect.bottom, scrollTop: scroll.top, scrollBottom: scroll.bottom, highlighted: element.getAnimations().some((animation) => animation.effect?.getKeyframes().some((frame) => frame.backgroundColor !== undefined)) };
    });
    assert.ok(searchGeometry.targetTop >= searchGeometry.scrollTop - 1 && searchGeometry.targetBottom <= searchGeometry.scrollBottom + 1, "Search scrolls the original reasoning header into the visible scrollport");
    assert.equal(searchGeometry.highlighted, true, "The actual reasoning header received the search highlight");
    report.measurements.push({ name: "original-thinking-search-reveal", ...searchGeometry });
    report.checks.push("Content search reveals a previously collapsed process group and addresses the original thinking block");
    await page.locator(".sidebar-search-input").press("Escape");
    await page.locator(".sidebar-search-input").fill("");
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => { localStorage.setItem("pi-theme", theme); document.documentElement.classList.toggle("dark", theme === "dark"); }, theme);
      for (const width of [1300, 430]) {
        await page.setViewportSize({ width, height: 1000 });
        const geometry = await page.locator(".process-details-trigger").first().evaluate((element) => {
          const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
          const scroll = document.querySelector(".chat-scroll-container");
          return { left: rect.left, right: rect.right, height: rect.height, viewport: innerWidth, background: style.backgroundColor, border: style.borderWidth, font: style.fontFamily, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
        });
        assert.ok(geometry.left >= 0 && geometry.right <= width + 1, `${theme}/${width}: activity summary fits viewport`);
        assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${theme}/${width}: transcript has no horizontal overflow`);
        assert.equal(geometry.border, "0px"); assert.equal(geometry.background, "rgba(0, 0, 0, 0)");
        report.measurements.push({ name: `activity-${theme}-${width}`, ...geometry });
        await capture(`activity-${theme}-${width}`);
      }
    }
    await page.setViewportSize({ width: 1300, height: 1000 });
    report.checks.push("One 1.8s shimmer under normal motion, static reduced-motion labels, and unbordered summaries fit desktop/mobile in light/dark themes");
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.equal(report.interceptedWrites.every((request) => request.path.endsWith("/lease")), true, "Only intercepted lease renewals may be attempted");
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(`Activity disclosure ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runActivityDisclosure();
