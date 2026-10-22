import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { stripVTControlCharacters } from "node:util";
import { chromium } from "playwright";
import { fauxProvider } from "@earendil-works/pi-ai";
import { createAgentSessionServices, createAgentSessionFromServices, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const plain = lines => stripVTControlCharacters(lines.join("\n"));

async function realPrimary() {
  const root = await mkdtemp(join(tmpdir(), "pilaude-footer-browser-"));
  const agentDir = join(root, "agent");
  await mkdir(agentDir);
  const jiti = createJiti(import.meta.url, { fsCache: false, tsconfigPaths: true });
  const { createBuiltinPowerlineExtension } = await jiti.import("../lib/builtin-powerline-extension.ts");
  const { AgentSessionWrapper } = await jiti.import("../lib/rpc-manager.ts");
  const faux = fauxProvider({ models: [
    { id: "footer-a", name: "Claude Footer Primary A", reasoning: true, contextWindow: 200000 },
    { id: "footer-b", name: "Footer Primary B", reasoning: true, contextWindow: 64000 },
  ] });
  const runtime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  runtime.registerNativeProvider(faux.provider);
  const manager = SessionManager.create(root, join(root, "sessions"));
  const services = await createAgentSessionServices({ cwd: root, agentDir, modelRuntime: runtime, settingsManager: SettingsManager.inMemory(), resourceLoaderOptions: {
    noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
    extensionFactories: [createBuiltinPowerlineExtension({ agentDir })],
  } });
  assert.deepEqual(services.resourceLoader.getExtensions().errors, []);
  const { session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("footer-a"), thinkingLevel: "medium" });
  const wrapper = new AgentSessionWrapper(session);
  const events = [];
  wrapper.onEvent(event => events.push(event));
  wrapper.beginExtensionBinding();
  await wrapper.waitUntilReady();
  const snapshot = async () => {
    const state = await wrapper.send({ type: "get_state" });
    const wire = events.findLast(event => event.method === "setWidget" && event.widgetKey === "powerline-top" && event.widgetLines);
    assert.deepEqual(state.extensionWidgets[0].lines, wire.widgetLines);
    return { state, wire, text: plain(wire.widgetLines) };
  };
  return { async unknown() {
    const leaf = manager.appendMessage({ role: "user", content: "Generated unestimated compaction context.", timestamp: 1800000000000 });
    manager.appendCompaction("Generated compaction, no model call.", leaf, 100);
    await session.extensionRunner.emit({ type: "session_compact", compactionEntry: manager.getLeafEntry(), fromExtension: true });
    assert.equal(session.getContextUsage().tokens, null);
    return snapshot();
  }, async selectB() { await session.setModel(faux.getModel("footer-b")); return snapshot(); }, snapshot,
  async close() { wrapper.destroy(); await wrapper.waitUntilDisposed(); assert.equal(faux.state.callCount, 0); await rm(root, { recursive: true, force: true }); } };
}

export async function runPowerlineFooterConsumer() {
  const out = new URL(`../test-results/pilaude/powerline-footer-consumer/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = name => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, source: "installed pi-powerline-footer 0.20.2 public renderer -> actual SDK -> complete wrapper -> intercepted browser API/SSE", checks: [], captures: [], measurements: [], violations: [], apiRequests: [], interceptedWrites: [], externalRequests: [], thinkingRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page, core;
  try {
    core = await realPrimary();
    let current = await core.unknown();
    report.initialPrimary = { text: current.text, columns: 92 };
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", serviceWorkers: "block" });
    await installActivityFixture(context, report);
    await context.addInitScript(() => {
      if (window.top !== window.self) return;
      const sources = [];
      const Original = window.EventSource;
      window.__footerConnections = 0;
      window.EventSource = class extends Original { constructor(url) { super(url); sources.push(this); if (String(url) === "/api/agent/activity/events") window.__footerConnections++; } };
      window.__footerEmit = (event, sessionId = "activity") => {
        const live = sources.filter(source => source.readyState === 1 && source.url === `/api/agent/${sessionId}/events`);
        if (!live.length) throw new Error("Footer fixture has no live event source");
        for (const source of live) source.emit(event);
      };
      window.__footerReconnect = () => {
        for (const source of sources.filter(source => source.readyState === 1 && source.url === "/api/agent/activity/events")) {
          source.readyState = 2; source.onerror?.(new Event("error"));
        }
      };
    });
    const other = { key: "other-widget", lines: ["Generated first line", "Generated second line"], placement: "aboveEditor" };
    const items = () => [{ key: "powerline-top", lines: current.wire.widgetLines, placement: "aboveEditor" }, other];
    await context.route(`${base}/api/**`, async route => {
      const url = new URL(route.request().url());
      if (route.request().method() === "POST" && /^\/api\/agent\/[^/]+$/.test(url.pathname) && route.request().postDataJSON()?.type === "get_tools") {
        report.interceptedWrites.push({ method: "POST", path: url.pathname, body: route.request().postData() });
        return route.fulfill({ json: { tools: [] } });
      }
      if (route.request().method() === "GET" && ["/api/agent/activity", "/api/sessions/activity/state"].includes(url.pathname)) {
        return route.fulfill({ json: { running: true, state: { ...current.state, isStreaming: false, isPromptRunning: false, extensionWidgets: items() } } });
      }
      return route.fallback();
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async name => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };
    // Layout violations are collected, not thrown, so every state is still measured and captured.
    const check = (ok, message) => { if (!ok) report.violations.push(message); };
    const measure = async name => {
      const result = await page.locator(".extension-widget-primary").evaluate(element => {
        const box = node => { const rect = node.getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom }; };
        const primary = box(element), composer = box(document.querySelector(".chat-composer"));
        const input = document.querySelector(".chat-input-textarea"), inputBox = box(input), style = getComputedStyle(element);
        const hit = document.elementFromPoint(inputBox.x + inputBox.width / 2, inputBox.y + inputBox.height / 2);
        const messages = [...document.querySelectorAll(".message-user, .message-assistant")], lastMessage = messages.length ? box(messages[messages.length - 1]) : null;
        const alpha = (/rgba\([^)]*,\s*([\d.]+)\)/.exec(style.backgroundColor) ?? [])[1];
        return { primary, composer, lastMessage, background: style.backgroundColor, backgroundAlpha: alpha === undefined ? 1 : Number(alpha), input: inputBox, inputHit: hit === input, text: element.textContent, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth, overflowX: style.overflowX, font: style.fontFamily, fontSize: style.fontSize, lineHeight: style.lineHeight, viewport: { width: innerWidth, height: innerHeight }, animations: element.getAnimations({ subtree: true }).length };
      });
      result.primaryToComposerWidth = result.primary.width / result.composer.width;
      result.centerDelta = (result.primary.x + result.primary.width / 2) - (result.composer.x + result.composer.width / 2);
      report.measurements.push({ name, ...result });
      assert.equal(result.inputHit, true, `${name}: composer remains natively reachable`);
      assert.ok(result.primary.x >= 0 && result.primary.right <= result.viewport.width + 1);
      assert.ok(result.primary.bottom <= result.composer.y + 1, `${name}: primary does not cover the composer`);
      assert.equal(result.animations, 0);
      check(result.backgroundAlpha === 1, `${name}: primary paints an opaque surface (${result.background}), so transcript text cannot show through it`);
      check(Boolean(result.lastMessage), `${name}: transcript has a last message to compare`);
      const disjoint = result.lastMessage.bottom <= result.primary.y + 1 || result.lastMessage.y >= result.primary.bottom - 1 || result.lastMessage.right <= result.primary.x || result.lastMessage.x >= result.primary.right;
      check(disjoint, `${name}: primary ${JSON.stringify(result.primary)} must not intersect the last message ${JSON.stringify(result.lastMessage)}`);
      return result;
    };
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    const primary = page.locator(".extension-widget-primary");
    await primary.getByText("Footer Primary A", { exact: false }).waitFor();
    assert.equal(await primary.count(), 1);
    assert.equal(await primary.innerText(), current.text);
    assert.match(current.text, /\?\/200k/);
    assert.equal(await page.locator(".extension-widget-key").filter({ hasText: "powerline-top" }).count(), 0);
    const input = page.locator(".chat-input-textarea");
    const draft = "Generated footer draft 😀 stays in the composer";
    await input.fill(draft);
    await input.evaluate(element => { window.__footerInput = element; element.focus(); element.setSelectionRange(9, 19); });
    const otherTrigger = page.getByRole("button", { name: "Above editor widget: other-widget, 2 lines", exact: true });
    if (await otherTrigger.getAttribute("aria-expanded") === "true") await otherTrigger.click();
    await input.focus();
    current = await core.selectB();
    await page.evaluate(event => window.__footerEmit(event), current.wire);
    await page.waitForFunction(text => document.querySelector(".extension-widget-primary")?.textContent === text, current.text);
    assert.match(await primary.innerText(), /Footer Primary B/);
    assert.match(await primary.innerText(), /\?\/64k/);
    assert.equal(await otherTrigger.getAttribute("aria-expanded"), "false");
    assert.equal(await input.inputValue(), draft);
    assert.equal(await input.evaluate(element => element === window.__footerInput), true);
    assert.equal(await input.evaluate(element => element === document.activeElement), true);
    report.checks.push("Published model/context is directly visible, true unknown stays ?, update preserves another widget choice and exact draft/focus/node");
    const connections = await page.evaluate(() => window.__footerConnections);
    await page.evaluate(() => window.__footerReconnect());
    await page.waitForFunction(count => window.__footerConnections > count, connections);
    assert.equal(await primary.innerText(), current.text);
    await page.waitForFunction(text => JSON.parse(localStorage.getItem("pi-chat-drafts-v1") ?? "{}").activity?.value === text, draft);
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await primary.waitFor({ timeout: 60000 });
    assert.equal(await primary.innerText(), current.text);
    await page.getByRole("button", { name: "Context panel", exact: true }).evaluate(element => element.getAttribute("aria-pressed")).then(async open => { if (open === "true") await page.getByRole("button", { name: "Context panel", exact: true }).click(); });
    const settleChrome = async () => {
      if (await page.evaluate(() => innerWidth >= 768)) {
        for (const name of ["Hide Files", "Hide Terminal", "Hide Changes", "Hide Tasks"]) {
          const toggle = page.locator(".workspace-pane-controls").getByRole("button", { name, exact: true });
          if (await toggle.isVisible()) await toggle.click();
        }
      }
      const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
      if (await hideSidebar.isVisible()) await hideSidebar.click();
      await page.waitForFunction(() => !document.querySelector(".app-sidebar.sidebar-open") && document.querySelector(".app-sidebar").getBoundingClientRect().right <= 1);
      await page.evaluate(async () => {
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
      });
    };
    await settleChrome();
    await measure("light-desktop"); await capture("primary-light-desktop");
    await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
    await page.getByRole("treeitem", { name: /^Activity fixture draft/ }).click();
    await page.waitForURL(url => url.searchParams.get("session") === "draft");
    await primary.waitFor({ state: "hidden" });
    await page.getByRole("treeitem", { name: /^Activity fixture activity/ }).click();
    await page.waitForURL(url => url.searchParams.get("session") === "activity");
    await primary.waitFor();
    assert.equal(await primary.innerText(), current.text);
    assert.equal(await input.inputValue(), draft);
    report.checks.push("Reconnect/get_state and real session roundtrip recover one primary and preserve its draft");
    await settleChrome();
    await page.evaluate(() => document.documentElement.classList.add("dark"));
    await page.setViewportSize({ width: 390, height: 340 });
    await page.waitForFunction(() => !document.querySelector(".app-sidebar.sidebar-open") && document.querySelector(".app-sidebar").getBoundingClientRect().right <= 1);
    await page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished));
    });
    await measure("dark-short-window"); await capture("primary-dark-short-window");
    const selected = await primary.evaluate(element => { const range = document.createRange(); range.selectNodeContents(element); const selection = getSelection(); selection.removeAllRanges(); selection.addRange(range); return selection.toString(); });
    assert.equal(selected, current.text, "native selectable content retains exact renderer plain text");
    await context.newPage().then(async background => { await background.bringToFront(); await page.bringToFront(); await background.close(); });
    assert.equal(await primary.innerText(), current.text);
    assert.equal(await input.inputValue(), draft);
    report.checks.push("Short dark window retains visible primary, bounded horizontal scrolling, native text selection and reachable composer; hidden/return keeps current value");
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.equal(report.interceptedWrites.every(request => request.path.endsWith("/lease") || JSON.parse(request.body).type === "get_tools"), true);
    assert.deepEqual(report.violations, [], "primary row layout violations");
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    process.exitCode = 1; console.error(error.stack);
  } finally {
    await browser?.close(); await core?.close();
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    console.log(`Powerline footer ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runPowerlineFooterConsumer();
