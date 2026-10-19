import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const project = "D:/generated/title-menu-fixture";
const stamp = Date.UTC(2026, 9, 19, 12);
const session = (id, name, parentSessionId) => ({ id, name, firstMessage: "Generated title menu fixture", cwd: project, projectRoot: project, projectKey: project, path: `${project}/${id}.jsonl`, created: new Date(stamp).toISOString(), modified: new Date(stamp).toISOString(), messageCount: 2, transient: false, ...(parentSessionId ? { parentSessionId } : {}) });

/** Run the actual AppShell; intercept every API/external request before it can reach user data. */
export async function installTitleMenuFixture(context, report, { locale = "en", explorerSupported = true, failAction = null } = {}) {
  const sessions = [session("title-root", "融合实验"), session("title-child", "Generated child", "title-root"), session("title-other", "Other generated session")];
  const state = { sessions, failAction, deferRename: null, deferDelete: null, deferFork: null };
  await context.addInitScript(({ locale }) => {
    sessionStorage.removeItem("pi-web:tab-open-session");
    localStorage.setItem("pi-theme", "dark");
    localStorage.setItem("pi-locale", locale);
    localStorage.setItem("pi-workspace-pane-visibility-v1", "false");
    localStorage.setItem("pi-sound-enabled", "false");
    window.__titleMenuOpened = [];
    window.open = (...args) => { window.__titleMenuOpened.push(args); return window.__titleMenuBlockPopup ? null : { opener: null }; };
    window.EventSource = class extends EventTarget {
      static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
      constructor(url) { super(); this.url = String(url); this.readyState = 1; queueMicrotask(() => { if (this.readyState === 1) this.onopen?.(new Event("open")); }); }
      close() { this.readyState = 2; }
    };
  }, { locale });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { report.externalRequests.push(request.url()); return route.fulfill({ status: 403, body: "External requests disabled in title menu fixture" }); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const record = { method: request.method(), path: url.pathname + url.search, body: request.postData() };
    report.apiRequests.push(record);
    if (!["GET", "HEAD"].includes(request.method())) {
      report.interceptedWrites.push(record);
      if (/\/api\/agent\/[^/]+\/lease$/.test(url.pathname)) return route.fulfill({ json: { renewed: 1 } });
      if (url.pathname === "/api/cwd/validate") return route.fulfill({ json: { cwd: project } });
      if (request.method() === "PATCH" && state.deferRename) return state.deferRename(route);
      if (request.method() === "DELETE" && state.deferDelete) return state.deferDelete(route);
      if (state.failAction === request.method()) return route.fulfill({ status: 500, json: { error: "Generated action failure" } });
      if (url.pathname === "/api/sessions/title-root" && request.method() === "PATCH") {
        sessions[0].name = request.postDataJSON().name;
        return route.fulfill({ json: { success: true } });
      }
      if (url.pathname === "/api/sessions/title-root" && request.method() === "DELETE") return route.fulfill({ json: { success: true } });
      if (url.pathname === "/api/open-in-explorer" && request.method() === "POST") return route.fulfill({ json: { opened: true } });
      if (url.pathname === "/api/agent/title-root" && request.postDataJSON().type === "fork_branch") {
        if (state.deferFork) return state.deferFork(route);
        sessions.push(session("title-fork", "Generated fork", "title-root"));
        return route.fulfill({ json: { success: true, data: { newSessionId: "title-fork" } } });
      }
      return route.fulfill({ status: 409, json: { error: "Unexpected write blocked by title menu fixture" } });
    }
    if (url.pathname === "/api/sessions") return route.fulfill({ json: { sessions } });
    const info = sessions.find((item) => url.pathname === `/api/sessions/${item.id}`);
    if (info) return route.fulfill({ json: {
      info, sessionId: info.id, filePath: info.path, leafId: "generated-current-leaf", tree: [], treeFormat: "summary", snapshotRevision: "title-fixture-1", totalActiveMs: 0,
      context: { messages: [{ role: "user", content: "Generated title menu request.", timestamp: stamp }, { role: "assistant", content: [{ type: "text", text: "Generated title menu answer." }], timestamp: stamp + 1000, stopReason: "stop", provider: "generated", model: "generated" }], entryIds: ["generated-user", "generated-current-leaf"], oldestEntryId: "generated-user", hasMore: false, model: null, thinkingLevel: "off" },
      stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] },
    } });
    if (url.pathname === "/api/custom-css") return route.fulfill({ contentType: "text/css", body: "" });
    const data = {
      "/api/home": { home: project, homeDir: project }, "/api/cwd/status": { availability: "available" },
      "/api/open-in-explorer": { supported: explorerSupported, reason: explorerSupported ? null : "remote", platform: "win32" },
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

export async function runTitleConversationMenu() {
  const out = new URL(`../test-results/pilaude/title-conversation-menu/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], apiRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [] };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
    await installTitleMenuFixture(context, report);
    const page = await context.newPage(); page.setDefaultTimeout(12000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    await page.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.locator(".app-topbar-title-name").filter({ hasText: "融合实验" }).waitFor();
    const trigger = page.locator(".app-topbar-title-trigger");
    assert.equal(await trigger.count(), 1, "The title chevron is a real menu button in AppShell");
    await trigger.click();
    const root = page.locator('.dom-context-menu--conversation[aria-label="Conversation actions"]');
    await root.waitFor();
    assert.deepEqual(await root.locator(":scope > button .dom-context-menu-label").allTextContents(), ["Open in", "Rename", "Fork", "Transcript view", "Output style", "Archive", "Delete"]);
    assert.deepEqual(await root.locator(":scope > *").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("role"))), ["menuitem", "separator", "menuitem", "menuitem", "separator", "menuitem", "menuitem", "separator", "menuitem", "menuitem"]);
    assert.deepEqual(await root.locator(".dom-context-menu-shortcut").allTextContents(), ["R", "F", "A", "D"]);
    report.checks.push("Actual AppShell title trigger opens reference root order, divider positions and shortcut hints");
    await page.screenshot({ path: artifact("root-menu.png"), scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
    report.captures.push(artifact("root-menu.png"));
    await trigger.click();
    assert.equal(await root.count(), 0, "Clicking the open title trigger toggles its menu closed");
    await trigger.click(); await root.waitFor();
    await page.keyboard.press("Escape");
    assert.equal(await root.count(), 0);
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true, "Escape restores focus to the title trigger");
    await trigger.press("ArrowDown"); await root.waitFor();
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator(":focus").textContent(), "Open in›");
    await page.keyboard.press("ArrowRight");
    const openIn = page.getByRole("menu", { name: "Open in", exact: true });
    await openIn.waitFor();
    assert.deepEqual(await openIn.locator("button .dom-context-menu-label").allTextContents(), ["New window", "VS Code", "Explorer"]);
    assert.deepEqual(await openIn.locator(".dom-context-menu-shortcut").allTextContents(), ["1", "2", "3"]);
    assert.equal(await openIn.getByRole("menuitem", { name: "VS Code", exact: true }).getAttribute("aria-disabled"), "true");
    assert.match(await openIn.getByRole("menuitem", { name: "VS Code", exact: true }).getAttribute("title"), /not connected/);
    await page.keyboard.press("ArrowLeft");
    assert.equal(await page.locator(":focus").textContent(), "Open in›", "ArrowLeft returns focus to the parent submenu row");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("1");
    assert.deepEqual(await page.evaluate(() => window.__titleMenuOpened), [[`${base}/?session=title-root`, "_blank"]], "New window uses the selected session on the same origin");
    await trigger.press("Enter"); await root.waitFor();
    await page.keyboard.press("ArrowDown"); await page.keyboard.press("Enter"); await openIn.waitFor();
    await page.keyboard.press("3");
    await page.waitForFunction(() => !document.querySelector('.app-topbar-title-trigger[aria-busy="true"]'));
    assert.deepEqual(report.interceptedWrites.filter((item) => item.path === "/api/open-in-explorer").map((item) => ({ method: item.method, body: JSON.parse(item.body) })), [{ method: "POST", body: { cwd: project } }], "Explorer posts only the selected workspace through the existing route");
    await trigger.click(); await root.waitFor();
    await root.getByRole("menuitem", { name: "Transcript view", exact: true }).hover();
    const transcript = page.getByRole("menu", { name: "Transcript view", exact: true });
    await transcript.waitFor();
    assert.deepEqual(await transcript.locator("button .dom-context-menu-label").allTextContents(), ["Normal", "Thinking", "Verbose"]);
    assert.equal(await transcript.locator('[aria-disabled="true"]').count(), 3);
    assert.equal(await transcript.locator('[role="menuitemcheckbox"]').count(), 0, "Unavailable transcript choices do not pretend to be applied");
    await root.getByRole("menuitem", { name: "Output style", exact: true }).hover();
    const output = page.getByRole("menu", { name: "Output style", exact: true });
    await output.waitFor();
    assert.deepEqual(await output.locator("button .dom-context-menu-label").allTextContents(), ["Default", "Proactive", "Concise", "Explanatory", "Learning", "New style..."]);
    assert.equal(await output.locator('[aria-disabled="true"]').count(), 6);
    await page.keyboard.press("Escape");
    await trigger.click(); await root.waitFor(); await page.keyboard.press("r");
    const rename = page.getByRole("textbox", { name: "Rename", exact: true });
    await rename.waitFor(); await rename.fill("Cancelled rename");
    const writesBeforeCancel = report.interceptedWrites.length;
    await rename.press("Escape");
    assert.equal(report.interceptedWrites.length, writesBeforeCancel, "Escape cancels rename without a PATCH from blur");
    await trigger.click(); await root.waitFor(); await page.keyboard.press("r");
    await rename.waitFor(); await rename.fill("Generated renamed title");
    await rename.evaluate((node) => node.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", isComposing: true, bubbles: true, cancelable: true })));
    assert.equal(await rename.count(), 1, "IME Enter keeps the rename field open");
    await rename.press("Enter");
    await page.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "Generated renamed title");
    assert.deepEqual(report.interceptedWrites.filter((item) => item.method === "PATCH").map((item) => ({ path: item.path, body: JSON.parse(item.body) })), [{ path: "/api/sessions/title-root", body: { name: "Generated renamed title" } }]);
    report.checks.push("Keyboard arrows, Enter/access keys, Escape restoration, disabled explanations, hover submenus, rename cancellation and IME guard");
    await trigger.click(); await root.waitFor(); await page.keyboard.press("a");
    await page.waitForFunction(() => { const metadata = JSON.parse(localStorage.getItem("pi-web:sidebar-session-metadata-v1") ?? "null"); return metadata?.archivedIds?.includes("title-root"); });
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("pi-web:sidebar-session-metadata-v1")).archivedIds.sort()), ["title-child", "title-root"], "Archive delegates to sidebar family semantics and sole storage writer");
    await trigger.click(); await root.waitFor(); assert.equal(await root.getByRole("menuitem", { name: "Restore", exact: true }).count(), 1);
    await page.keyboard.press("a");
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("pi-web:sidebar-session-metadata-v1")).archivedIds.length === 0);
    await trigger.click(); await root.waitFor(); await page.keyboard.press("f");
    await page.waitForURL(/session=title-fork/);
    assert.deepEqual(report.interceptedWrites.filter((item) => item.path === "/api/agent/title-root").map((item) => JSON.parse(item.body)), [{ type: "fork_branch", entryId: "generated-current-leaf" }]);
    await page.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded" });
    await trigger.waitFor(); await trigger.click(); await root.waitFor(); await page.keyboard.press("d");
    const confirmation = page.getByRole("alertdialog");
    await confirmation.waitFor();
    const deletesBeforeCancel = report.interceptedWrites.filter((item) => item.method === "DELETE").length;
    await page.keyboard.press("Escape");
    assert.equal(await confirmation.count(), 0);
    assert.equal(report.interceptedWrites.filter((item) => item.method === "DELETE").length, deletesBeforeCancel, "Delete first opens a confirmation and Escape never sends DELETE");
    assert.equal(await trigger.evaluate((node) => node === document.activeElement), true);
    await trigger.click(); await root.waitFor(); await page.keyboard.press("d"); await confirmation.waitFor();
    await confirmation.getByRole("button", { name: "Delete", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector(".app-topbar-title-trigger"));
    assert.deepEqual(report.interceptedWrites.filter((item) => item.method === "DELETE").map((item) => item.path), ["/api/sessions/title-root"]);
    report.checks.push("Archive/restore preserve complete sidebar family; fork posts current leaf; Delete confirmation cancels safely and successful DELETE clears selection");
    for (const [locale, labels] of [["en", ["Open in", "Rename", "Fork", "Transcript view", "Output style", "Archive", "Delete"]], ["zh-CN", ["打开方式", "重命名", "分叉", "对话记录视图", "输出样式", "归档", "删除"]], ["zh-TW", ["開啟方式", "重新命名", "分岔", "對話記錄檢視", "輸出樣式", "封存", "刪除"]]]) {
      const narrow = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
      await installTitleMenuFixture(narrow, report, { locale, explorerSupported: false });
      const mobile = await narrow.newPage(); mobile.setDefaultTimeout(12000);
      await mobile.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded" });
      await mobile.waitForFunction((expected) => document.documentElement.lang === expected, locale);
      const button = mobile.locator(".app-topbar-title-trigger"); await button.waitFor();
      await button.evaluate((node) => node.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", code: "ArrowDown", isComposing: true, bubbles: true, cancelable: true })));
      assert.equal(await mobile.getByRole("menu").count(), 0, "IME arrows do not open the title menu");
      await button.click();
      const mobileRoot = mobile.locator(".dom-context-menu--conversation").first(); await mobileRoot.waitFor();
      assert.deepEqual(await mobileRoot.locator("button .dom-context-menu-label").allTextContents(), labels);
      for (const index of [0, 3, 4]) {
        await mobileRoot.locator(":scope > button").nth(index).hover();
        await mobile.waitForFunction(() => document.querySelectorAll(".dom-context-menu--conversation[data-menu-placed]").length === 2);
        for (const panel of await mobile.getByRole("menu").all()) {
          const box = await panel.boundingBox();
          assert.ok(box.x >= 7.5 && box.x + box.width <= 382.5 && box.y >= 7.5 && box.y + box.height <= 836.5, `390px ${locale} submenu stays within viewport: ${JSON.stringify(box)}`);
        }
      }
      if (locale === "en") {
        await mobileRoot.getByRole("menuitem", { name: "Open in", exact: true }).hover();
        const explorer = mobile.getByRole("menu", { name: "Open in", exact: true }).getByRole("menuitem", { name: "Explorer", exact: true });
        assert.equal(await explorer.getAttribute("aria-disabled"), "true");
        const before = report.interceptedWrites.length; await explorer.dispatchEvent("click"); assert.equal(report.interceptedWrites.length, before, "Unavailable file manager never posts an action");
      }
      await mobile.screenshot({ path: artifact(`menu-390-${locale}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
      report.captures.push(artifact(`menu-390-${locale}.png`)); await narrow.close();
    }
    report.checks.push("390px hover submenus stay on screen in English, Simplified Chinese and Traditional Chinese; unavailable Explorer is guarded; IME arrows do not open");
    const failing = await browser.newContext({ viewport: { width: 900, height: 700 }, serviceWorkers: "block" });
    await installTitleMenuFixture(failing, report, { failAction: "DELETE" });
    const failurePage = await failing.newPage(); await failurePage.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded" });
    await failurePage.locator(".app-topbar-title-trigger").click(); await failurePage.keyboard.press("d");
    await failurePage.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await failurePage.getByRole("alertdialog").getByRole("alert").waitFor();
    assert.match(await failurePage.getByRole("alertdialog").getByRole("alert").textContent(), /Generated action failure/);
    assert.equal(await failurePage.locator(".app-topbar-title-name").textContent(), "融合实验", "Failed DELETE keeps the session selected");
    await failurePage.keyboard.press("Escape"); await failing.close();
    report.checks.push("Failed DELETE keeps the conversation selected, displays the route error and allows confirmation dismissal");
    const pixels = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1.25, colorScheme: "dark", reducedMotion: "reduce", serviceWorkers: "block" });
    await installTitleMenuFixture(pixels, report);
    const pixelPage = await pixels.newPage();
    await pixelPage.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded" });
    await pixelPage.locator(".app-topbar-title-trigger").click();
    const pixelRoot = pixelPage.locator('.dom-context-menu--conversation[aria-label="Conversation actions"]');
    await pixelRoot.waitFor();
    report.measurements.push(await pixelRoot.evaluate((panel) => {
      const box = (element) => { const r = element.getBoundingClientRect(), s = getComputedStyle(element); return { x: r.x, y: r.y, width: r.width, height: r.height, fontSize: s.fontSize, padding: s.padding, radius: s.borderRadius }; };
      return { name: "conversation-root", capture: { dpr: devicePixelRatio, viewport: { width: innerWidth, height: innerHeight }, scale: "device", referenceDpi: "unknown", referenceFile: "02-conversation-root-menu.png", referenceRootRaw: { x: 127, y: 54, width: 202, height: 306 } }, trigger: box(document.querySelector(".app-topbar-title-trigger")), panel: box(panel), rows: Array.from(panel.children).map((element) => ({ label: element.textContent, role: element.getAttribute("role"), ...box(element) })) };
    }));
    await pixelPage.screenshot({ path: artifact("root-menu-dpr125-original.png"), scale: "device", style: "nextjs-portal{visibility:hidden!important}" });
    await pixelRoot.screenshot({ path: artifact("root-menu-dpr125-crop.png"), scale: "device" });
    report.captures.push(artifact("root-menu-dpr125-original.png"), artifact("root-menu-dpr125-crop.png"));
    await pixels.close();
    const delayed = await browser.newContext({ viewport: { width: 1100, height: 800 }, serviceWorkers: "block" });
    const delayedState = await installTitleMenuFixture(delayed, report);
    let releaseRename, renameStarted;
    const renameStartedPromise = new Promise((resolve) => { renameStarted = resolve; });
    delayedState.deferRename = (route) => new Promise((resolve) => { releaseRename = async () => { await route.fulfill({ status: 500, json: { error: "Generated late rename failure" } }); resolve(); }; renameStarted(); });
    const delayedPage = await delayed.newPage(); await delayedPage.goto(`${base}/?session=title-root`, { waitUntil: "domcontentloaded" });
    await delayedPage.locator(".app-topbar-title-trigger").click(); await delayedPage.keyboard.press("r");
    await delayedPage.getByRole("textbox", { name: "Rename", exact: true }).fill("Delayed generated title");
    await delayedPage.getByRole("textbox", { name: "Rename", exact: true }).press("Enter");
    await renameStartedPromise;
    await delayedPage.locator(".session-item").filter({ hasText: "Other generated session" }).first().click();
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "Other generated session");
    await delayedPage.locator(".session-item").filter({ hasText: "融合实验" }).first().click();
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "融合实验");
    await releaseRename();
    await delayedPage.waitForFunction(() => !document.querySelector('.app-topbar-title-trigger[aria-busy="true"]'));
    assert.equal(await delayedPage.locator(".app-topbar-title-action-error").count(), 0, "A late failed action from the previous conversation does not leak an error into the newly selected conversation");
    delayedState.deferRename = null;
    let releaseDelete, deleteStarted;
    const deleteStartedPromise = new Promise((resolve) => { deleteStarted = resolve; });
    delayedState.deferDelete = (route) => new Promise((resolve) => { releaseDelete = async () => { await route.fulfill({ json: { success: true } }); resolve(); }; deleteStarted(); });
    await delayedPage.locator(".app-topbar-title-trigger").click(); await delayedPage.keyboard.press("d");
    await delayedPage.getByRole("alertdialog").getByRole("button", { name: "Delete", exact: true }).click();
    await deleteStartedPromise;
    // Navigation can also originate outside the modal (another app shortcut/window).
    // Exercise the real selected-session callback through the sidebar DOM boundary.
    await delayedPage.locator(".session-item").filter({ hasText: "Other generated session" }).first().dispatchEvent("click");
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "Other generated session");
    await releaseDelete();
    await delayedPage.waitForFunction(() => !document.querySelector('.app-topbar-title-trigger[aria-busy="true"]'));
    assert.equal(await delayedPage.locator(".app-topbar-title-name").textContent(), "Other generated session", "Late DELETE success cannot clear a different selected conversation");
    delayedState.deferDelete = null;
    await delayedPage.locator(".session-item").filter({ hasText: "融合实验" }).first().click();
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "融合实验");
    let releaseFork, forkStarted;
    const forkStartedPromise = new Promise((resolve) => { forkStarted = resolve; });
    delayedState.deferFork = (route) => new Promise((resolve) => { releaseFork = async () => { delayedState.sessions.push(session("title-fork", "Generated fork", "title-root")); await route.fulfill({ json: { success: true, data: { newSessionId: "title-fork" } } }); resolve(); }; forkStarted(); });
    await delayedPage.locator(".app-topbar-title-trigger").click(); await delayedPage.keyboard.press("f"); await forkStartedPromise;
    await delayedPage.locator(".session-item").filter({ hasText: "Other generated session" }).first().click();
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "Other generated session");
    await delayedPage.locator(".session-item").filter({ hasText: "融合实验" }).first().click();
    await delayedPage.waitForFunction(() => document.querySelector(".app-topbar-title-name")?.textContent === "融合实验");
    await releaseFork();
    await delayedPage.waitForFunction(() => !document.querySelector('.app-topbar-title-trigger[aria-busy="true"]'));
    assert.equal(await delayedPage.locator(".app-topbar-title-name").textContent(), "融合实验", "Late fork success after A→B→A does not navigate away from the chosen conversation");
    await delayed.close();
    report.checks.push("Late rename failure, DELETE success, and fork success across session navigation cannot disturb the selected conversation");
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.externalRequests, []);
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.error = error.stack ?? String(error); throw error; }
  finally { await writeFile(artifact("report.json"), `${JSON.stringify(report, null, 2)}\n`); await browser?.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks, report: artifact("report.json") })); }
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runTitleConversationMenu();
