import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installSidebarPinFixture, SIDEBAR_PIN_SESSIONS } from "./sidebar-pin-order.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const session = SIDEBAR_PIN_SESSIONS[0];
const turnCount = 36;
const messages = Array.from({ length: turnCount }, (_, index) => [
  { role: "user", content: `Navigation question ${index + 1}\nGenerated real user turn.`, timestamp: 1000 + index * 2000 },
  { role: "assistant", content: [{ type: "text", text: `Navigation answer ${index + 1}\n\n${"Generated paragraph for transcript scrolling.\n\n".repeat(5)}\`\`\`js\nconst answer = ${index + 1};\n\`\`\`` }], timestamp: 2000 + index * 2000, stopReason: "stop", provider: "generated", model: "generated" },
]).flat();

async function installNavigationFixture(context, report) {
  // Reuse the app-level API/SSE boundary fixture; the real React tree, layout,
  // scrolling, draft store and navigation handlers run unchanged.
  await installSidebarPinFixture(context, base, report);
  await context.route(`${base}/api/sessions/a?*`, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    report.apiReads.push(new URL(route.request().url()).pathname + new URL(route.request().url()).search);
    return route.fulfill({ json: {
      info: session, sessionId: session.id, filePath: session.path, leafId: "answer-35", tree: [], treeFormat: "summary", snapshotRevision: "navigation-layout-v1", totalActiveMs: 0,
      context: { messages, entryIds: messages.map((_, index) => `${index % 2 ? "answer" : "user"}-${Math.floor(index / 2)}`), oldestEntryId: "user-0", hasMore: false, model: null, thinkingLevel: "off" },
      stats: { totalMessages: messages.length, userMessages: turnCount, assistantMessages: turnCount, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] },
    } });
  });
}

async function measureNavigation(page, name, report) {
  const geometry = await page.evaluate(() => {
    const rect = (element) => element?.getBoundingClientRect().toJSON();
    const track = document.querySelector(".conversation-navigator-track");
    const rail = track.closest(".conversation-navigator");
    const scroll = document.querySelector(".chat-scroll-container");
    const composer = document.querySelector(".chat-composer");
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      region: rect(rail.parentElement), track: rect(track), transcript: rect(document.querySelector(".chat-transcript-column")), scroll: rect(scroll), composer: rect(composer),
      visible: getComputedStyle(rail).display !== "none", scrollTop: scroll.scrollTop,
    };
  });
  report.measurements.push({ name, ...geometry });
  return geometry;
}

function assertNavigationGutter(geometry, name) {
  const { track, region, transcript, visible } = geometry;
  assert.equal(visible, true, `${name}: navigation remains reachable`);
  assert.ok(track.top - region.top >= 0 && track.top - region.top <= 32, `${name}: rail belongs to the top-left of the transcript, measured top inset ${track.top - region.top}`);
  assert.ok(Math.abs(track.left - region.left - 12) <= 0.6, `${name}: rail stays at the left chat edge`);
  assert.ok(transcript.left - track.right >= 23.4, `${name}: a fixed minimum 24px gutter separates the entire rail hit target from the transcript (measured ${transcript.left - track.right})`);
  assert.ok(transcript.right <= geometry.scroll.right + 0.6, `${name}: transcript stays within its own scrollport`);
}

export async function runConversationNavigatorLayout() {
  const out = new URL(`../test-results/pilaude/conversation-navigator-layout/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, measurements: [], checks: [], captures: [], apiReads: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installNavigationFixture(context, report);
    page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText(`Navigation answer ${turnCount}`, { exact: true }).waitFor();
    const capture = async (name) => {
      const path = artifact(`${name}.png`);
      await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
      report.captures.push(path);
    };
    const settle = () => page.evaluate(async () => {
      const nextLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await nextLayout();
      await Promise.all(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished.catch(() => {})));
      await nextLayout();
    });
    let topInset;
    const checkLayout = async (name) => {
      await settle();
      const geometry = await measureNavigation(page, name, report);
      assertNavigationGutter(geometry, name);
      const inset = geometry.track.top - geometry.region.top;
      topInset ??= inset;
      assert.ok(Math.abs(inset - topInset) <= 0.6, `${name}: changing viewport height or adjacent panels preserves the same top inset`);
      return geometry;
    };
    await checkLayout("desktop-initial");
    await capture("desktop-initial");
    report.checks.push("Navigation starts at the top-left with a reserved 24px transcript gutter");

    const track = page.getByRole("button", { name: "Conversation navigation", exact: true });
    const directory = page.locator(".conversation-navigator-directory");
    const current = directory.locator('[aria-current="location"]');
    const textarea = page.locator(".chat-input-textarea");
    const draft = "Navigation preserves this unsent draft.\n第二行输入草稿";
    await textarea.fill(draft);
    await track.click();
    await directory.waitFor();
    const question = directory.getByRole("button", { name: "Navigation question 2", exact: true });
    await question.click();
    await directory.waitFor({ state: "hidden" });
    await page.waitForFunction(() => {
      const scroll = document.querySelector(".chat-scroll-container");
      const anchor = scroll.querySelector('[data-conversation-turn="1"]');
      return anchor && Math.abs(anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16) <= 2;
    });
    assert.equal(await textarea.inputValue(), draft, "Clicking a historical turn preserves the unsent draft");
    assert.equal(await track.evaluate((element) => element === document.activeElement), true, "Selecting a turn returns focus to the rail");
    await page.keyboard.press("ArrowDown");
    await directory.waitFor();
    await page.waitForFunction(() => document.querySelector('.conversation-navigator-row[aria-current="location"]')?.getAttribute("data-navigation-index") === "2");
    const indexBeforeIme = await current.getAttribute("data-navigation-index");
    const ime = await track.evaluate((element) => {
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true, isComposing: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(ime, false, "IME does not consume arrow navigation");
    assert.equal(await current.getAttribute("data-navigation-index"), indexBeforeIme, "IME does not change the active turn");
    await page.keyboard.press("Escape");
    await directory.waitFor({ state: "hidden" });
    await textarea.focus();
    const manualHistory = await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop);
    await track.hover();
    await directory.waitFor();
    await directory.locator(".conversation-navigator-row").last().hover();
    await directory.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await settle();
    assert.ok(Math.abs(await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop) - manualHistory) <= 0.6, "Hovering and scrolling the directory never auto-scrolls the transcript away from manual history");
    await textarea.hover();
    await textarea.focus();
    await directory.waitFor({ state: "hidden" });
    assert.equal(await textarea.inputValue(), draft, "Dismissing navigation leaves draft and composer focus intact");
    report.checks.push("Historical click and keyboard navigation keep real turn anchors, draft, focus and IME behavior; browsing the directory keeps manual transcript scroll");

    for (const theme of ["light", "dark"]) {
      if (theme === "dark") {
        await page.evaluate(() => localStorage.setItem("pi-theme", "dark"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByText(`Navigation answer ${turnCount}`, { exact: true }).waitFor();
        await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      }
      await page.setViewportSize({ width: 1300, height: 900 });
      const before = await checkLayout(`${theme}-desktop`);
      for (const position of [0, 0.5, 1]) {
        await page.locator(".chat-scroll-container").evaluate((element, fraction) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * fraction; }, position);
        const after = await checkLayout(`${theme}-scroll-${position}`);
        assert.ok(Math.abs(after.track.top - before.track.top) <= 0.6, "Scrolling cannot move the anchored rail");
      }
      await capture(`${theme}-desktop-bottom`);
      await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
      await checkLayout(`${theme}-sidebar-closed`);
      await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
      await page.getByRole("button", { name: "Show Files", exact: true }).click();
      await page.locator("#workspace-pane-files").waitFor({ state: "visible" });
      await checkLayout(`${theme}-files-open`);
      await capture(`${theme}-files-open`);
      await page.locator(".workspace-pane-controls").getByRole("button", { name: "Hide Files", exact: true }).click();
      const contextToggle = page.getByRole("button", { name: "Context panel", exact: true });
      if (await contextToggle.getAttribute("aria-pressed") === "true") await contextToggle.click();
      for (const viewport of [{ width: 2200, height: 1000 }, { width: 900, height: 600 }, { width: 390, height: 812 }, { width: 390, height: 340 }]) {
        await page.setViewportSize(viewport);
        const name = `${theme}-${viewport.width}x${viewport.height}`;
        const geometry = await checkLayout(name);
        await track.click();
        await directory.waitFor();
        const bounds = await directory.boundingBox();
        report.measurements.push({ name: `${name}-directory`, bounds });
        assert.ok(bounds.y >= geometry.region.top, `${name}: the directory stays below the topbar`);
        assert.ok(bounds.y + bounds.height <= geometry.composer.top - 0.5, `${name}: the directory does not cover the composer`);
        assert.ok(bounds.x >= geometry.region.left && bounds.x + bounds.width <= geometry.region.right, `${name}: the directory stays inside its chat column`);
        if (viewport.height === 340) await capture(`${name}-directory`);
        const last = directory.locator(".conversation-navigator-row").last();
        await last.focus();
        await page.keyboard.press("Enter");
        await directory.waitFor({ state: "hidden" });
        assert.equal(await textarea.inputValue(), draft, `${name}: resizing and selecting do not clear the draft`);
        await checkLayout(`${name}-selected-last`);
        await capture(name);
      }
    }
    report.checks.push("Both themes keep the fixed gutter through long scroll, sidebar changes, a Files pane, wide/narrow viewports and short height");
    assert.deepEqual(report.pageErrors, [], "No unhandled browser errors");
    assert.deepEqual(report.consoleErrors, [], "No browser console errors");
    assert.deepEqual(report.nonReadRequests, [], "No API writes were attempted");
    assert.deepEqual(report.externalRequests, [], "No external service requests");
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(`Conversation navigator layout ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runConversationNavigatorLayout();
