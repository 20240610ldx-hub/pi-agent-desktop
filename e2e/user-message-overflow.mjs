import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const project = "D:/generated/overflow-fixture";
const stamp = Date.UTC(2026, 9, 19, 17);
export const OVERFLOW_TEXT = Array.from({ length: 10 }, (_, index) => `Generated paragraph ${index + 1} keeps the same words while its real chat column changes width.`).join(" ");
const session = { id: "overflow", name: "Generated overflow fixture", firstMessage: "Generated overflow fixture", cwd: project, projectRoot: project, projectKey: project, path: `${project}/overflow.jsonl`, created: new Date(stamp).toISOString(), modified: new Date(stamp).toISOString(), messageCount: 2, transient: false };
const messages = [{ role: "user", content: OVERFLOW_TEXT, timestamp: stamp }, { role: "assistant", content: [{ type: "text", text: "Generated overflow fixture answer." }], timestamp: stamp + 1000, stopReason: "stop", provider: "generated", model: "generated" }];

/** Generated data only. Every API/SSE/clipboard boundary is intercepted; no private customization is read. */
export async function installUserOverflowFixture(context, report) {
  await context.addInitScript(() => {
    localStorage.setItem("pi-theme", "light"); localStorage.setItem("pi-locale", "en");
    localStorage.setItem("pi-sound-enabled", "false"); localStorage.setItem("pi-workspace-pane-visibility-v1", "false");
    window.__overflowClipboard = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (text) => { window.__overflowClipboard.push(String(text)); } } });
    document.execCommand = () => false;
    window.EventSource = class extends EventTarget {
      constructor(url) { super(); this.url = String(url); this.readyState = 1; queueMicrotask(() => { if (this.readyState === 1 && /\/api\/agent\/overflow\/events/.test(this.url)) this.onmessage?.(new MessageEvent("message", { data: JSON.stringify({ type: "connected", isStreaming: false, hasStreamingSnapshot: false, pendingExtensionUiIds: [] }) })); }); }
      close() { this.readyState = 2; }
    };
  });
  await context.route("**/*", async (route) => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== new URL(base).origin) { report.externalRequests.push(request.url()); return route.fulfill({ status: 200, body: "" }); }
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const record = { method: request.method(), path: url.pathname + url.search }; report.apiRequests.push(record);
    if (!["GET", "HEAD"].includes(request.method())) {
      report.interceptedWrites.push(record);
      return /\/lease$/.test(url.pathname) ? route.fulfill({ json: { renewed: 1 } }) : route.fulfill({ status: 409, json: { error: "Generated overflow fixture never executes API writes" } });
    }
    if (url.pathname === "/api/sessions") return route.fulfill({ json: { sessions: [session] } });
    if (url.pathname === "/api/sessions/overflow") return route.fulfill({ json: { sessionId: session.id, filePath: session.path, leafId: "overflow-answer", tree: [], treeFormat: "summary", snapshotRevision: "generated-overflow-1", totalActiveMs: 0, context: { messages, entryIds: ["overflow-user", "overflow-answer"], oldestEntryId: "overflow-user", hasMore: false, thinkingLevel: "off", model: null }, stats: { totalMessages: 2, userMessages: 1, assistantMessages: 1, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] } } });
    if (url.pathname === "/api/custom-css") return route.fulfill({ contentType: "text/css", body: "" });
    if (url.pathname.endsWith("/output-style")) return route.fulfill({ json: { supported: false, reason: "unavailable", selectedId: "default", styles: [] } });
    const data = {
      "/api/home": { home: project, homeDir: project }, "/api/cwd/status": { availability: "available" },
      "/api/models": { models: {}, modelList: [], defaultModel: null, modelScopeWarnings: [] }, "/api/models/nonchat": { classifier: [], image: [], codemode: "automatic" },
      "/api/models/enabled": { allEnabled: true, patterns: null, stalePatterns: [], enabledTotal: 0, availableTotal: 0, providers: [], scope: "global", settingsPath: "generated", editable: false },
      "/api/worktrees": { projectRoot: project, projectKey: project, isGit: false, isTopLevel: true, currentWorktreePath: project, worktrees: [] },
      "/api/project-trust": { requiresTrust: false, trusted: true, decision: null, inherited: false }, "/api/tools/settings": { powerShellEnabled: false, powerShellAvailable: false },
      "/api/auth/providers": { oauthProviders: [], apiKeyProviders: [] }, "/api/models-config": { providers: {} }, "/api/web-auth": { enabled: false },
      "/api/scheduled-tasks": { tasks: [], scheduler: { owner: false, ownerInfo: null } }, "/api/desktop/environment": { hostname: "Generated overflow fixture", platform: "win32" },
      "/api/updates": { updates: [], nextCheckAt: "2099-01-01T00:00:00Z" }, "/api/artifacts/settings": { enabled: false }, "/api/git/status": { isGitRepository: false, files: [] },
      "/api/open-in-explorer": { supported: false, platform: "win32" },
    };
    return route.fulfill({ json: url.pathname.startsWith("/api/agent/") || url.pathname === "/api/sessions/overflow/state" ? { running: false, runningSessionIds: [] } : data[url.pathname] ?? {} });
  });
}

async function settle(page) { await page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(resolve)); await new Promise((resolve) => requestAnimationFrame(resolve)); }); }
async function hideChrome(page) {
  await page.waitForFunction(() => document.querySelector('.app-sidebar') && !document.querySelector('.app-sidebar.sidebar-mobile-pending'));
  await settle(page);
  const pane = page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first(); if (await pane.isVisible()) await pane.click();
  const context = page.locator('.pilaude-context-toggle[aria-pressed="true"]'); if (await context.count()) await context.click();
  const backdrop = page.locator('.sidebar-overlay-backdrop');
  if (await backdrop.isVisible() && await backdrop.evaluate((element) => getComputedStyle(element).pointerEvents !== 'none')) {
    const box = await backdrop.boundingBox();
    await backdrop.click({ position: { x: box.width - 12, y: box.height / 2 } });
  }
  const sidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
  const box = await sidebar.boundingBox(), viewport = page.viewportSize();
  if (viewport.width > 640 && await page.locator('.app-sidebar.sidebar-open').count() && box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height) await sidebar.click();
  await page.waitForFunction(() => !document.querySelector('.app-sidebar.sidebar-open'));
  await page.locator('.app-sidebar').evaluate(async (element) => {
    await Promise.all(element.getAnimations().filter((animation) => animation.playState !== 'finished').map((animation) => animation.finished.catch(() => {})));
  });
}
async function measurement(page, name) {
  const value = await page.locator('.message-user-bubble').evaluate((bubble) => {
    const markdown = bubble.querySelector('.markdown-user-message'), body = markdown.parentElement, toggle = body.parentElement.querySelector('button');
    const style = getComputedStyle(body), box = body.getBoundingClientRect(), toggleBox = toggle?.getBoundingClientRect();
    const center = { x: Math.min(innerWidth - 1, Math.max(0, box.x + box.width / 2)), y: Math.min(innerHeight - 1, Math.max(0, box.y + Math.min(box.height, 80) / 2)) };
    const hit = document.elementFromPoint(center.x, center.y);
    return { viewport: innerWidth, width: box.width, renderedHeight: box.height, naturalHeight: body.scrollHeight, markdownHeight: markdown.getBoundingClientRect().height, maxHeight: style.maxHeight, overflow: style.overflow, mask: style.maskImage, toggle: toggle?.textContent.trim() ?? null, toggleCount: body.parentElement.querySelectorAll('button').length, toggleWidth: toggleBox?.width ?? null, toggleHeight: toggleBox?.height ?? null, toggleCenterHit: toggleBox ? toggle.contains(document.elementFromPoint(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2)) : null, coarsePointer: matchMedia('(pointer: coarse)').matches, toggleExpanded: toggle?.getAttribute('aria-expanded') ?? null, controlledBody: toggle?.getAttribute('aria-controls') === body.id && Boolean(body.id), bodyCenterUnobstructed: body.contains(hit), text: markdown.textContent, sameNode: window.__overflowOriginalNode === markdown, outerMaxHeight: getComputedStyle(bubble).maxHeight, outerScrollHeight: bubble.scrollHeight, outerClientHeight: bubble.clientHeight };
  });
  return { name, ...value };
}

export async function runUserMessageOverflow() {
  const out = new URL(`../test-results/pilaude/user-message-overflow/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true }); const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", checks: [], failures: [], measurements: [], captures: [], apiRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  const check = async (name, callback) => { try { await callback(); report.checks.push(name); } catch (error) { report.failures.push({ name, message: error.message }); } };
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block" });
    await installUserOverflowFixture(context, report); page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message)); page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async (name, target = page) => { const path = artifact(`${name}.png`); await target.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(path); };
    await page.goto(`${base}/?session=overflow`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Generated overflow fixture answer.", { exact: true }).waitFor(); await hideChrome(page); await settle(page);
    await page.locator('.markdown-user-message').evaluate((element) => { window.__overflowOriginalNode = element; });
    const wide = await measurement(page, "initial-wide"); report.measurements.push(wide); await capture("initial-wide");
    assert.ok(wide.naturalHeight <= 280, `Generated fixture must fit wide column: ${wide.naturalHeight}`);
    assert.equal(wide.toggle, null);
    await page.setViewportSize({ width: 430, height: 1000 }); await hideChrome(page); await settle(page);
    const narrow = await measurement(page, "same-text-narrow"); report.measurements.push(narrow); await capture("same-text-narrow");
    await check("same-text width shrink recomputes overflow", async () => { assert.ok(narrow.naturalHeight > 280); assert.ok(narrow.sameNode); assert.equal(narrow.text, wide.text); assert.equal(narrow.toggle, "Expand"); assert.equal(narrow.toggleCount, 1); assert.equal(narrow.maxHeight, "220px"); assert.equal(narrow.toggleExpanded, "false"); assert.equal(narrow.controlledBody, true); assert.equal(narrow.bodyCenterUnobstructed, true); });
    const toggle = page.locator('.message-user-bubble').getByRole("button", { name: "Expand", exact: true });
    if (await toggle.count()) {
      await toggle.click(); await settle(page); const expanded = await measurement(page, "manual-expanded-narrow"); report.measurements.push(expanded);
      await check("manual expansion preserves full text and the outer scroll bound", async () => { assert.equal(expanded.toggle, "Collapse"); assert.equal(expanded.maxHeight, "none"); assert.equal(expanded.outerMaxHeight, "300px"); assert.equal(expanded.text, wide.text); assert.equal(expanded.toggleExpanded, "true"); assert.equal(expanded.controlledBody, true); });
      await page.setViewportSize({ width: 1500, height: 1000 }); await settle(page);
      report.measurements.push(await measurement(page, "manual-expanded-wide"));
      await page.setViewportSize({ width: 430, height: 1000 }); await hideChrome(page); await settle(page);
      const retained = await measurement(page, "manual-expanded-narrow-again"); report.measurements.push(retained);
      await check("same-text resizing retains manual expansion", async () => { assert.equal(retained.toggle, "Collapse"); assert.equal(retained.maxHeight, "none"); });
    }
    // Fresh narrow mount measures overflowing=true; widening must remove a now-unneeded mask.
    await page.setViewportSize({ width: 430, height: 1000 }); await page.reload({ waitUntil: "domcontentloaded" });
    await page.getByText("Generated overflow fixture answer.", { exact: true }).waitFor(); await hideChrome(page); await settle(page);
    await page.locator('.markdown-user-message').evaluate((element) => { window.__overflowOriginalNode = element; });
    const freshNarrow = await measurement(page, "fresh-narrow"); report.measurements.push(freshNarrow);
    assert.equal(freshNarrow.toggle, "Expand");
    await page.setViewportSize({ width: 1500, height: 1000 }); await settle(page);
    const wider = await measurement(page, "same-text-widened"); report.measurements.push(wider); await capture("same-text-widened");
    await check("same-text width growth removes stale clipping and toggle", async () => { assert.ok(wider.naturalHeight <= 280); assert.ok(wider.sameNode); assert.equal(wider.toggle, null); assert.equal(wider.toggleCount, 0); assert.equal(wider.maxHeight, "none"); assert.equal(wider.mask, "none"); assert.equal(wider.bodyCenterUnobstructed, true); });

    // Exercise real font settings and retained Home navigation; no injected fonts or CSS.
    const setFont = async (label) => {
      const show = page.getByRole('button', { name: 'Show sidebar', exact: true }); if (await show.isVisible()) await show.click();
      await page.locator('.pilaude-local-profile').click(); await page.locator('.settings-general').waitFor();
      await page.getByRole('group', { name: 'Conversation font size', exact: true }).getByRole('radio', { name: label, exact: true }).check();
      await page.keyboard.press('Escape'); await page.locator('.settings-general').waitFor({ state: 'detached' });
      await hideChrome(page); await settle(page);
    };
    await setFont('Large');
    const large = await measurement(page, 'same-text-large-font'); report.measurements.push(large); await capture('same-text-large-font');
    await check('font setting reflow updates disclosure without replacing source', async () => { assert.equal(large.viewport, wider.viewport); assert.equal(large.width, wider.width); assert.ok(large.naturalHeight > 280); assert.equal(large.toggle, 'Expand'); assert.equal(large.maxHeight, '220px'); assert.equal(large.sameNode, true); assert.equal(large.text, wider.text); });
    await setFont('Medium');
    const medium = await measurement(page, 'same-text-medium-font'); report.measurements.push(medium);
    await check('font setting shrink removes the unnecessary disclosure', async () => { assert.equal(medium.toggle, null); assert.equal(medium.maxHeight, 'none'); assert.equal(medium.sameNode, true); assert.equal(medium.text, wider.text); });

    await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
    await page.locator('.sidebar-new-row').click();
    await page.waitForFunction(() => document.querySelector('.markdown-user-message')?.getClientRects().length === 0);
    await page.setViewportSize({ width: 430, height: 1000 }); await hideChrome(page); await settle(page);
    await page.getByRole('button', { name: 'Show sidebar', exact: true }).click();
    await page.locator('#session-sidebar .session-item-main').filter({ has: page.locator('.session-item-title', { hasText: session.name }) }).first().click();
    await page.getByText('Generated overflow fixture answer.', { exact: true }).waitFor(); await hideChrome(page); await settle(page);
    const restored = await measurement(page, 'retained-chat-revealed-narrow'); report.measurements.push(restored); await capture('retained-chat-revealed-narrow');
    await check('retained hidden chat recomputes on reveal at the new width', async () => { assert.equal(restored.sameNode, true); assert.equal(restored.text, wider.text); assert.ok(restored.naturalHeight > 280); assert.equal(restored.toggle, 'Expand'); assert.equal(restored.maxHeight, '220px'); assert.equal(restored.bodyCenterUnobstructed, true); });
    const keyboardToggle = page.locator('.message-user-bubble button[aria-controls]');
    await keyboardToggle.focus(); await page.keyboard.press('Enter'); await settle(page);
    await check('native keyboard activation keeps focus and exposes expanded state', async () => { const state = await measurement(page, 'keyboard-expanded'); report.measurements.push(state); assert.equal(state.toggle, 'Collapse'); assert.equal(state.toggleExpanded, 'true'); assert.equal(state.controlledBody, true); assert.equal(await keyboardToggle.evaluate((element) => document.activeElement === element), true); });
    await page.keyboard.press('Space'); await settle(page);
    await check('native Space collapses while retaining disclosure focus', async () => { const state = await measurement(page, 'keyboard-collapsed'); report.measurements.push(state); assert.equal(state.toggle, 'Expand'); assert.equal(state.toggleExpanded, 'false'); assert.equal(await keyboardToggle.evaluate((element) => document.activeElement === element), true); });
    await page.setViewportSize({ width: 1500, height: 1000 }); await hideChrome(page); await settle(page);
    await page.locator('.message-user').hover();
    const before = await page.evaluate(() => window.__overflowClipboard.length);
    await page.locator('.message-user button[title="Copy message"]').click();
    await page.waitForFunction((count) => window.__overflowClipboard.length === count + 1, before);
    await check("copy retains the same source through width changes", async () => { assert.equal(await page.evaluate(() => window.__overflowClipboard.at(-1)), OVERFLOW_TEXT); });
    // A real touch context measures native disclosure geometry and hit testing.
    const touchContext = await browser.newContext({ viewport: { width: 430, height: 1000 }, hasTouch: true, isMobile: true, deviceScaleFactor: 1, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await installUserOverflowFixture(touchContext, report);
    const touch = await touchContext.newPage();
    touch.on('pageerror', (error) => report.pageErrors.push(error.message));
    touch.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
    await touch.goto(`${base}/?session=overflow`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await touch.getByText('Generated overflow fixture answer.', { exact: true }).waitFor(); await hideChrome(touch); await settle(touch);
    const touchCollapsed = await measurement(touch, 'coarse-pointer-collapsed'); report.measurements.push(touchCollapsed); await capture('coarse-pointer-collapsed', touch);
    await check('coarse pointer disclosure has a native 44px target and reachable center', async () => { assert.equal(touchCollapsed.coarsePointer, true); assert.ok(touchCollapsed.toggleWidth >= 44 && touchCollapsed.toggleHeight >= 44, `Native disclosure target ${touchCollapsed.toggleWidth}x${touchCollapsed.toggleHeight}`); assert.equal(touchCollapsed.toggleCenterHit, true); assert.equal(touchCollapsed.bodyCenterUnobstructed, true); });
    const touchToggle = touch.locator('.message-user-bubble').getByRole('button', { name: 'Expand', exact: true });
    await touchToggle.tap(); await settle(touch);
    const touchExpanded = await measurement(touch, 'coarse-pointer-expanded'); report.measurements.push(touchExpanded);
    await check('native touch activation expands the same source', async () => { assert.equal(touchExpanded.toggle, 'Collapse'); assert.equal(touchExpanded.text, OVERFLOW_TEXT); assert.equal(touchExpanded.maxHeight, 'none'); assert.equal(touchExpanded.toggleExpanded, 'true'); });
    await touch.locator('.user-text-disclosure-toggle').scrollIntoViewIfNeeded(); await settle(touch); await capture('coarse-pointer-expanded', touch);
    await touchContext.close();
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.ok(report.interceptedWrites.every((request) => request.path.endsWith('/lease')));
    report.status = report.failures.length ? "failed" : "passed";
  } catch (error) { report.status = "failed"; report.failures.push({ name: "fixture execution", message: error.message, stack: error.stack }); }
  finally { await writeFile(artifact("results.json"), JSON.stringify(report, null, 2)); await browser?.close(); console.log(JSON.stringify({ status: report.status, checks: report.checks, failures: report.failures, report: artifact("results.json") })); }
  if (report.status !== "passed") process.exitCode = 1;
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runUserMessageOverflow();
