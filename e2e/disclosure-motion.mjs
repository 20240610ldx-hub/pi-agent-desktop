import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const linkedBody = async (trigger) => trigger.page().locator(`[id=${JSON.stringify(await trigger.getAttribute("aria-controls"))}]`);
const waitClosed = async (body) => body.page().waitForFunction((id) => document.getElementById(id)?.getBoundingClientRect().height === 0, await body.getAttribute("id"));
const settleLayout = async (page) => {
  await page.evaluate(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); await new Promise((resolve) => requestAnimationFrame(resolve)); });
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.effect?.getComputedTiming().iterations === Infinity || animation.playState !== "running"));
};

// Click the real control and measure the native layout on each animation frame.
// No animation clocks, playback rates, synthetic transition events or CSS overrides.
async function toggleFrames(trigger) {
  return trigger.evaluate(async (button) => {
    const body = document.getElementById(button.getAttribute("aria-controls"));
    const frames = [];
    const start = performance.now();
    const sample = () => frames.push({ ms: performance.now() - start, height: body.getBoundingClientRect().height, expanded: button.getAttribute("aria-expanded"), ariaHidden: body.getAttribute("aria-hidden"), inert: body.inert });
    sample(); button.click();
    while (performance.now() - start < 300) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      sample();
    }
    return frames;
  });
}

async function captureResponsive(page, trigger, body, report, artifact) {
  if (await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().isVisible()) await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().click();
  if (await page.locator('.pilaude-context-toggle[aria-pressed="true"]').count()) await page.locator('.pilaude-context-toggle[aria-pressed="true"]').click();
  const sidebarClose = page.getByRole("button", { name: "Hide sidebar", exact: true });
  if (await sidebarClose.isVisible()) await sidebarClose.click();
  const capture = async (name) => {
    await settleLayout(page);
    const path = artifact(`${name}.png`);
    await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
    report.captures.push(path);
  };
  for (const theme of ["light", "dark"]) {
    await page.evaluate((theme) => { document.documentElement.classList.toggle("dark", theme === "dark"); }, theme);
    for (const width of [1300, 430]) {
      await page.setViewportSize({ width, height: 1000 });
      await trigger.scrollIntoViewIfNeeded();
      await settleLayout(page);
      const geometry = await trigger.evaluate((button) => {
        const rect = button.getBoundingClientRect(), scroll = button.closest(".chat-scroll-container");
        const hit = document.elementFromPoint(rect.left + Math.min(5, rect.width / 2), rect.top + rect.height / 2);
        const body = document.getElementById(button.getAttribute("aria-controls")), bodyRect = body.getBoundingClientRect();
        const bodyHit = document.elementFromPoint(bodyRect.right - 2, Math.min(innerHeight - 1, bodyRect.top + 20));
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: innerWidth, hit: button === hit || button.contains(hit), bodyLeft: bodyRect.left, bodyRight: bodyRect.right, bodyHit: body === bodyHit || body.contains(bodyHit), scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
      });
      report.measurements.push({ name: `disclosure-geometry-${theme}-${width}`, ...geometry });
      assert.ok(geometry.left >= 0 && geometry.right <= width + 1 && geometry.hit, `${theme}/${width}: disclosure is visible and reachable in the viewport`);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1, `${theme}/${width}: no horizontal transcript overflow`);
      assert.ok(geometry.bodyLeft >= 0 && geometry.bodyRight <= width + 1 && geometry.bodyHit, `${theme}/${width}: expanded body fits and its far edge is reachable`);
      await capture(`expanded-${theme}-${width}`);
    }
  }
  await page.setViewportSize({ width: 1300, height: 1000 });
  await trigger.click(); await waitClosed(body);
  await capture("collapsed-dark-1300");
  report.checks.push("Captured settled actual disclosure UI at desktop/mobile widths in light/dark themes with trigger and full-body hit tests");
}

export async function runDisclosureMotion() {
  const out = new URL(`../test-results/pilaude/disclosure-motion/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, captureOnly: process.env.E2E_DISCLOSURE_CAPTURE_ONLY === "1", checks: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "no-preference", serviceWorkers: "block" });
    const state = await installActivityFixture(context, report);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    // Public controls keep later responsive captures focused on the transcript.
    if (await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().isVisible()) await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().click();
    const contextToggle = page.locator('.pilaude-context-toggle[aria-pressed="true"]');
    if (await contextToggle.count()) await contextToggle.click();
    const group = page.locator(".process-details-trigger").first();
    const groupBody = await linkedBody(group);
    if (report.captureOnly) {
      await group.click();
      await groupBody.locator(".thinking-disclosure-toggle").click();
      await page.getByText("Full stored reasoning at original block index two.", { exact: true }).waitFor();
      await groupBody.locator(".tool-call-trigger").click();
      await captureResponsive(page, group, groupBody, report, artifact);
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
      report.status = "passed";
      return report;
    }
    assert.equal(await group.getAttribute("aria-expanded"), "false");
    assert.equal(await page.evaluate(() => document.activeElement?.matches('.process-details-trigger, .thinking-disclosure-toggle, .tool-call-trigger')), false, "Initially closed disclosure does not focus its trigger");
    assert.equal(await groupBody.textContent(), "", "Historical process children stay unmounted before their first open");
    const motionStyle = await groupBody.evaluate((element) => { const style = getComputedStyle(element); return { properties: style.transitionProperty, duration: style.transitionDuration, easing: style.transitionTimingFunction }; });
    assert.equal(motionStyle.duration.split(", ")[0], "0.2s");
    assert.ok(motionStyle.easing.startsWith("cubic-bezier(0.19, 1, 0.22, 1)"), "Native body consumes the reference ThinkingAccordion easing");
    report.measurements.push({ name: "reference-disclosure-motion", ...motionStyle });
    const groupOpen = await toggleFrames(group);
    const tool = groupBody.locator(".tool-call-trigger");
    const toolOpen = await toggleFrames(tool);
    const toolClose = await toggleFrames(tool);
    const groupClose = await toggleFrames(group);
    for (const [name, frames] of [["group-open", groupOpen], ["tool-open", toolOpen], ["tool-close", toolClose], ["group-close", groupClose]]) {
      report.measurements.push({ name, frames });
    }
    // Each kind must render intermediate heights, rather than toggling display.
    for (const [name, frames] of [["group-open", groupOpen], ["tool-open", toolOpen], ["tool-close", toolClose], ["group-close", groupClose]]) {
      const full = Math.max(frames[0].height, frames.at(-1).height);
      assert.ok(full > 20, `${name}: fixture has measurable expanded content`);
      assert.ok(frames.some((frame) => frame.height > 0.5 && frame.height < full - 0.5), `${name}: native frames must show intermediate disclosure heights`);
      assert.ok(Math.min(frames[0].height, frames.at(-1).height) < 0.5, `${name}: closed disclosure occupies zero height`);
    }
    report.checks.push("Process and tool disclosures expand and collapse through intermediate native frame heights to zero");
    await group.click();
    const thinking = groupBody.locator(".thinking-disclosure-toggle");
    await thinking.click();
    await page.getByText("Full stored reasoning at original block index two.", { exact: true }).waitFor();
    assert.deepEqual(report.thinkingRequests, [2], "Deferred thinking uses the original block index");
    await tool.click();
    const toolBody = await linkedBody(tool);
    await toolBody.locator("button").first().focus();
    await tool.evaluate((element) => { window.__retainedToolTrigger = element; });
    const focusClose = await group.evaluate(async (button) => {
      const body = document.getElementById(button.getAttribute("aria-controls"));
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return { height: body.getBoundingClientRect().height, inert: body.inert, ariaHidden: body.getAttribute("aria-hidden"), triggerFocused: document.activeElement === button };
    });
    assert.equal(focusClose.inert, true, "Closing immediately makes all retained descendants inert");
    assert.equal(focusClose.ariaHidden, "true", "Closing immediately removes retained content from accessibility");
    assert.equal(focusClose.triggerFocused, true, "A focused descendant returns to its disclosure trigger");
    await waitClosed(groupBody);
    assert.equal(await tool.evaluate((element) => element === window.__retainedToolTrigger), true, "Closing retains process children after their first open");
    await group.click();
    assert.equal(await thinking.getAttribute("aria-expanded"), "true", "Nested thinking stays open after the process group reopens");
    assert.equal(await tool.getAttribute("aria-expanded"), "true", "Nested tool stays open after the process group reopens");
    assert.deepEqual(report.thinkingRequests, [2], "Retained children reuse the previously loaded deferred body");
    await toolBody.getByText(/fixture-history-output/).waitFor();
    await settleLayout(page);
    const historyCapture = artifact("history-thinking-tool-expanded.png");
    await page.screenshot({ path: historyCapture, scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
    report.captures.push(historyCapture);
    const input = page.locator("textarea.chat-input-textarea");
    await input.focus();
    await group.evaluate((button) => button.click());
    await waitClosed(groupBody);
    assert.equal(await input.evaluate((element) => document.activeElement === element), true, "Closing does not steal focus from outside the body");
    report.measurements.push({ name: "immediate-close-accessibility-focus", ...focusClose });
    report.checks.push("Closing immediately hides/inerts descendants and restores descendant focus only; nested toggles and deferred content survive process collapse");
    await group.click();
    const thinkingBody = await linkedBody(thinking);
    // Measure thinking through the same native frame seam as process/tool.
    const thinkingClose = await toggleFrames(thinking);
    const thinkingOpen = await toggleFrames(thinking);
    for (const [name, frames] of [["thinking-close", thinkingClose], ["thinking-open", thinkingOpen]]) {
      const full = Math.max(frames[0].height, frames.at(-1).height);
      assert.ok(frames.some((frame) => frame.height > 0.5 && frame.height < full - 0.5), `${name}: thinking retains the shared height transition`);
      report.measurements.push({ name, frames });
    }
    for (const [name, trigger, body] of [["thinking", thinking, thinkingBody], ["tool", tool, toolBody]]) {
      const reversed = await trigger.evaluate(async (button) => {
        const panel = document.getElementById(button.getAttribute("aria-controls"));
        const full = panel.getBoundingClientRect().height;
        button.click();
        await new Promise((resolve) => requestAnimationFrame(resolve));
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const closingHeight = panel.getBoundingClientRect().height;
        button.click();
        const frames = [];
        const start = performance.now();
        while (performance.now() - start < 300) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          frames.push({ ms: performance.now() - start, height: panel.getBoundingClientRect().height, text: panel.textContent.length, inert: panel.inert });
        }
        return { full, closingHeight, frames };
      });
      assert.ok(reversed.closingHeight > 0, `${name}: close retains its body during reversal`);
      assert.ok(reversed.frames.every((frame) => frame.height > 0 && frame.text > 0 && !frame.inert), `${name}: rapid reopen never releases an expanded body`);
      assert.ok(Math.abs(reversed.frames.at(-1).height - reversed.full) < 1, `${name}: rapid reversal settles at full height`);
      report.measurements.push({ name: `${name}-rapid-reversal`, ...reversed });
      // Two discrete actions before a paint never start a CSS transition.
      await trigger.evaluate(async (button) => { button.click(); await Promise.resolve(); button.click(); await Promise.resolve(); });
      assert.equal(await trigger.getAttribute("aria-expanded"), "true");
      assert.ok((await body.textContent()).length > 0);
      await trigger.evaluate((button) => button.click());
      await waitClosed(body);
      await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await body.getAttribute("id"));
      assert.equal(await body.textContent(), "", `${name}: fully closed transient body is released`);
      await trigger.click();
    }
    report.checks.push("Thinking uses intermediate heights; rapid and same-commit reversals keep expanded content; fully closed thinking/tool bodies release content");
    // Public host visibility changes can cancel a transition before it starts.
    // Hide the chat ancestor, then restore it; the app's source/CSS stays intact.
    await thinking.evaluate(async (button) => {
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      button.closest(".chat-window").hidden = true;
    });
    await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await thinkingBody.getAttribute("id"));
    await page.locator(".chat-window").evaluate((element) => { element.hidden = false; });
    assert.equal(await thinkingBody.textContent(), "", "Hidden ancestor releases a canceled thinking close");
    await thinking.click();
    await toggleFrames(thinking); // settle a close before the reduced-motion case
    await thinking.click();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await thinking.evaluate((button) => button.click());
    await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await thinkingBody.getAttribute("id"));
    assert.equal(await thinkingBody.evaluate((element) => element.getBoundingClientRect().height), 0);
    await tool.evaluate((button) => button.click());
    await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await toolBody.getAttribute("id"));
    assert.equal(await toolBody.evaluate((element) => element.getBoundingClientRect().height), 0);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    // Changing the preference during an active close must also release content.
    await thinking.click();
    await thinking.evaluate(async (button) => { await new Promise((resolve) => requestAnimationFrame(resolve)); await new Promise((resolve) => requestAnimationFrame(resolve)); button.click(); });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await thinkingBody.getAttribute("id"));
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await tool.click();
    await toolBody.locator("button").first().focus();
    const hiddenClose = await tool.evaluate(async (button) => {
      const chat = button.closest(".chat-window");
      chat.hidden = true;
      button.click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return { triggerFocused: document.activeElement === button };
    });
    assert.equal(hiddenClose.triggerFocused, false, "A hidden chat never restores focus into its own trigger");
    await page.waitForFunction((id) => !document.getElementById(id)?.textContent, await toolBody.getAttribute("id"));
    await page.locator(".chat-window").evaluate((element) => { element.hidden = false; });
    await input.focus();
    report.checks.push("Hidden ancestors, hidden sessions, reduced motion and mid-close preference changes release transient bodies without focus stealing or transitionend");
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    const stamp = Date.UTC(2026, 9, 19, 13);
    const liveUser = { role: "user", content: "Generated disclosure motion turn.", timestamp: stamp };
    const liveMessage = { role: "assistant", content: [{ type: "thinking", thinking: "Live motion reasoning.\n".repeat(9) }], timestamp: stamp + 1000, provider: "generated", model: "generated" };
    state.running = true; state.messages.push(liveUser); state.entryIds.push("motion-user"); state.revision++;
    await emit([{ type: "agent_start" }, { type: "message_end", message: liveUser }, { type: "message_start", message: liveMessage }]);
    await page.waitForFunction(() => document.querySelectorAll(".process-details-trigger").length === 2);
    const live = page.locator(".process-details-trigger").last();
    const liveBody = await linkedBody(live);
    await liveBody.locator(".thinking-disclosure-toggle").click();
    await emit([{ type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "" } }]);
    await page.waitForFunction(() => [...document.querySelectorAll('.activity-shimmer[data-active="true"]')].some((element) => getComputedStyle(element).animationName !== "none"));
    const liveCloseFrames = await live.evaluate(async (button) => {
      const body = document.getElementById(button.getAttribute("aria-controls"));
      const frames = [], start = performance.now();
      button.click();
      while (performance.now() - start < 300) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const active = [...document.querySelectorAll('.activity-shimmer[data-active="true"]')];
        frames.push({ ms: performance.now() - start, height: body.getBoundingClientRect().height, animated: active.filter((element) => getComputedStyle(element).animationName !== "none" && element.getClientRects().length).length, childAnimated: [...body.querySelectorAll('.activity-shimmer[data-active="true"]')].filter((element) => getComputedStyle(element).animationName !== "none").length });
      }
      return frames;
    });
    assert.ok(liveCloseFrames.every((frame) => frame.animated === 1 && frame.childAnimated === 0), "The group summary owns the only animation throughout closing, even while child content is still visible");
    report.measurements.push({ name: "live-close-animation-ownership", frames: liveCloseFrames });
    // Review history away from the tail, then reopen live details without scrolling.
    const scroll = page.locator(".chat-scroll-container");
    await scroll.evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); });
    await input.focus();
    const historyBefore = await scroll.evaluate((element) => element.scrollTop);
    await live.evaluate((button) => button.click());
    await page.waitForFunction((id) => document.getElementById(id)?.getBoundingClientRect().height > 100, await liveBody.getAttribute("id"));
    assert.equal(await scroll.evaluate((element) => element.scrollTop), historyBefore, "Reopening live details does not steal manual history scroll");
    assert.equal(await input.evaluate((element) => document.activeElement === element), true);
    report.checks.push("Collapsed live group owns the unique animation throughout close; reopening leaves history scroll and outside focus intact");
    await captureResponsive(page, live, liveBody, report, artifact);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.equal(report.interceptedWrites.every((request) => request.path.endsWith("/lease")), true);
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(`Disclosure motion ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runDisclosureMotion();
