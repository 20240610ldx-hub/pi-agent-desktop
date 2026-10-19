import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const stamp = Date.UTC(2026, 9, 19, 15);
const assistant = (content, timestamp) => ({ role: "assistant", content, timestamp, provider: "generated", model: "generated", stopReason: "stop" });
const examples = [
  { name: "paragraph", markdown: "Generated paragraph caret end", tail: "Generated paragraph caret end" },
  { name: "heading", markdown: "### Generated heading caret end", tail: "Generated heading caret end" },
  { name: "inline", markdown: "Generated **strong** *emphasis* and `inline caret end`", tail: "inline caret end" },
  { name: "list", markdown: "- Generated first item\n- Generated final list caret end", tail: "Generated final list caret end" },
  { name: "nested-list", markdown: "1. Generated outer item\n   - Generated nested list caret end", tail: "Generated nested list caret end" },
  { name: "table", markdown: "| Generated key | Generated value |\n| --- | --- |\n| row | Table caret end |", tail: "Table caret end" },
  { name: "fence", markdown: "```text\nGenerated code caret end\n```", tail: "Generated code caret end" },
  { name: "open-fence", markdown: "```text\nGenerated open fence caret end", tail: "Generated open fence caret end" },
  { name: "blockquote", markdown: "> Generated quote caret end", tail: "Generated quote caret end" },
];

// Native DOM/CSS seam: inspect the real caret-bearing pseudo host and the last
// rendered source character. No renderer replacement or measuring CSS override.
async function measureCaret(page, tail) {
  return page.evaluate((tail) => {
    const visible = (element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility === "visible";
    const hosts = [...document.querySelectorAll(".message-streaming-caret")];
    const carets = hosts.flatMap((root) => [root, ...root.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element, "::after");
      if (!["none", "normal"].includes(style.content) && style.display !== "none" && parseFloat(style.width) > 0 && parseFloat(style.height) > 0 && visible(element)) {
        const rect = element.getBoundingClientRect();
        const fontSize = parseFloat(style.fontSize);
        const height = style.height.endsWith("px") ? parseFloat(style.height) : fontSize;
        const top = rect.bottom - parseFloat(getComputedStyle(element).paddingBottom || "0") - parseFloat(getComputedStyle(element).borderBottomWidth || "0") - height;
        return [{ tag: element.tagName, className: element.className?.baseVal ?? element.className, root: element === root, host: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height }, estimatedCaret: { top, bottom: top + height }, width: style.width, height: style.height, content: style.content, display: style.display, animation: style.animationName, opacity: Number(style.opacity) }];
      }
      return [];
    }));
    let textEnd = null;
    for (const root of hosts) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, index = node.textContent.indexOf(tail);
        if (index < 0) continue;
        const range = document.createRange(); range.setStart(node, index + tail.length - 1); range.setEnd(node, index + tail.length);
        const rect = range.getBoundingClientRect(); textEnd = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height, parent: node.parentElement.tagName };
      }
    }
    const animations = [...new Set(hosts.flatMap((root) => root.getAnimations({ subtree: true })))].filter((animation) => animation.animationName === 'activity-caret').map((animation) => ({ name: animation.animationName, playState: animation.playState, currentTime: animation.currentTime, iterations: animation.effect.getTiming().iterations, pseudo: animation.effect.pseudoElement, visibleHost: animation.effect.target instanceof Element ? visible(animation.effect.target) : null }));
    return { activeText: document.querySelectorAll('[data-message-streaming="true"]').length, roots: hosts.length, carets, textEnd, animations, hiddenActiveHosts: hosts.filter((element) => !visible(element)).length };
  }, tail);
}

export async function runStreamingCaretBoundaries() {
  const out = new URL(`../test-results/pilaude/streaming-caret-boundaries/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], findings: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "no-preference", serviceWorkers: "block" });
    const state = await installActivityFixture(context, report);
    // Only the Stop command in this generated fixture is acknowledged. Every API
    // boundary stays intercepted; no command reaches a model/runtime/backend.
    await context.route("**/api/agent/activity", async (route) => {
      if (route.request().method() !== "POST" || route.request().postDataJSON()?.type !== "abort") return route.fallback();
      report.interceptedWrites.push({ method: "POST", path: "/api/agent/activity", body: route.request().postData() });
      await route.fulfill({ json: {} });
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    if (await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().isVisible()) await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().click();
    if (await page.locator('.pilaude-context-toggle[aria-pressed="true"]').count()) await page.locator('.pilaude-context-toggle[aria-pressed="true"]').click();
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    let sequence = 0;
    const start = async (name, markdown) => {
      const timestamp = stamp + sequence++ * 10000;
      const user = { role: "user", content: `Generated caret ${name} turn.`, timestamp };
      const message = assistant([{ type: "text", text: markdown }], timestamp + 1000);
      state.running = true; state.messages.push(user); state.entryIds.push(`caret-${name}-user`); state.revision++;
      await emit([{ type: "agent_start" }, { type: "message_end", message: user }, { type: "message_start", message: assistant([], timestamp + 1000) }, { type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 0 } }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: markdown } }]);
      await page.waitForFunction(() => document.querySelector('[data-message-streaming="true"] .markdown-body')?.textContent.length > 0);
      await page.locator('[data-message-streaming="true"]').scrollIntoViewIfNeeded();
      // The composer overlays the bottom of the scrollport; place the actual
      // streamed text above that dock using the test's user-scroll boundary.
      await page.locator('[data-message-streaming="true"]').evaluate((element) => {
        const scroll = element.closest('.chat-scroll-container');
        const rect = element.getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
        const dockTop = document.querySelector('textarea.chat-input-textarea')?.getBoundingClientRect().top ?? viewport.bottom;
        scroll.scrollTop += rect.top - viewport.top - Math.max(20, (Math.min(dockTop, viewport.bottom) - viewport.top - rect.height) / 2);
        scroll.dispatchEvent(new Event('scroll'));
      });
      return message;
    };
    const finish = async (name, message) => {
      const contentIndex = message.content.length - 1;
      await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex, content: message.content[contentIndex].text } }]);
      await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
      state.messages.push(message); state.entryIds.push(`caret-${name}-answer`); state.running = false; state.revision++;
      await emit([{ type: "message_end", message }, { type: "agent_end" }, { type: "agent_settled" }]);
    };
    for (const example of examples) {
      const message = await start(example.name, example.markdown);
      await page.waitForFunction((tail) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(tail), example.tail);
      const measurement = await measureCaret(page, example.tail);
      report.measurements.push({ name: example.name, ...measurement });
      assert.equal(measurement.activeText, 1, `${example.name}: only active text owns caret state`);
      assert.equal(measurement.carets.length, 1, `${example.name}: exactly one visible caret host`);
      assert.ok(measurement.textEnd, `${example.name}: rendered source tail has native text geometry`);
      const caret = measurement.carets[0];
      // Pseudo boxes have no DOMRect API. A root host after a block-level ending
      // is a concrete structural fallback: CSS creates an extra line after it.
      assert.equal(caret.root, false, `${example.name}: caret belongs to the terminal text container, never the Markdown root after a block`);
      if (caret.estimatedCaret.top >= measurement.textEnd.bottom + 3) report.findings.push({ name: example.name, kind: "estimated-caret-following-line-inspect-screenshot", distance: caret.estimatedCaret.top - measurement.textEnd.bottom });
      // Capture a native bright phase without modifying the caret animation.
      await page.waitForFunction(() => [...document.querySelectorAll('.message-streaming-caret, .message-streaming-caret *')].some((element) => {
        const style = getComputedStyle(element, '::after');
        return !['none', 'normal'].includes(style.content) && style.display !== 'none' && Number(style.opacity) > .85;
      }));
      const path = artifact(`caret-${example.name}.png`);
      await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(path);
      if (example.name === "paragraph") {
        const prior = message.content[0].text;
        const next = "Generated second active text block caret end";
        await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex: 0, content: prior } }, { type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 1 } }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: next } }]);
        await page.waitForFunction((next) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(next), next);
        const indexed = await measureCaret(page, next);
        report.measurements.push({ name: "indexed-next-text-block", ...indexed });
        assert.equal(indexed.activeText, 1); assert.equal(indexed.carets.length, 1);
        assert.ok(await page.getByText(prior, { exact: true }).isVisible(), "Earlier text block stays visible while the next block owns the sole caret");
        await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex: 1, content: next } }]);
        message.content.push({ type: "text", text: next });
      }
      await finish(example.name, message);
    }
    report.checks.push("Paragraph, heading, inline, list, nested list, table, fence and quote endings measured through actual indexed streaming DOM; text_end removes caret before message_end");
    const reduced = await start("reduced-hidden", "Generated reduced and hidden caret end");
    const liveFrames = await page.evaluate(async () => {
      const frames = [], start = performance.now();
      while (performance.now() - start < 650) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const host = [...document.querySelectorAll('.message-streaming-caret, .message-streaming-caret *')].find((element) => { const style = getComputedStyle(element, '::after'); return !['none', 'normal'].includes(style.content) && style.display !== 'none'; });
        if (host) frames.push({ ms: performance.now() - start, opacity: Number(getComputedStyle(host, '::after').opacity), animation: getComputedStyle(host, '::after').animationName });
      }
      return frames;
    });
    report.measurements.push({ name: "normal-caret-native-opacity", frames: liveFrames });
    assert.ok(liveFrames.length > 1 && Math.max(...liveFrames.map((frame) => frame.opacity)) - Math.min(...liveFrames.map((frame) => frame.opacity)) > .1, "Normal caret opacity changes on the native animation timeline");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "reduced", ...reducedMeasure });
    assert.equal(reducedMeasure.carets.length, 1); assert.equal(reducedMeasure.carets[0].animation, "none", "Reduced motion keeps the caret static");
    assert.equal(reducedMeasure.animations.filter((animation) => animation.playState === 'running').length, 0, "Reduced motion has no running caret animation");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator(".chat-window").evaluate((element) => { element.hidden = true; });
    const hiddenMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "supplemental-dom-hidden", ...hiddenMeasure }); assert.equal(hiddenMeasure.carets.length, 0, "Supplemental DOM hidden ancestor exposes no visible caret");
    if (hiddenMeasure.animations.some((animation) => animation.playState === 'running')) report.findings.push({ name: 'supplemental-dom-hidden', kind: 'hidden-caret-animation-still-running', animations: hiddenMeasure.animations });
    await page.locator(".chat-window").evaluate((element) => { element.hidden = false; });
    await page.locator('.sidebar-new-row').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'new');
    const newMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "actual-new-hidden-chat", ...newMeasure });
    assert.equal(newMeasure.carets.length, 0, "Actual New hides the existing chat caret");
    if (newMeasure.animations.some((animation) => animation.playState === 'running')) report.findings.push({ name: 'actual-new-hidden-chat', kind: 'hidden-caret-animation-still-running', animations: newMeasure.animations });
    await page.getByRole('button', { name: 'Activity fixture activity', exact: true }).first().click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') !== 'new' && document.querySelector('[data-message-streaming="true"]')?.getClientRects().length > 0);
    const returned = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "actual-new-return-live-chat", ...returned });
    assert.equal(returned.carets.length, 1, "Returning from New restores the same live stream's sole caret");
    await finish("reduced-hidden", reduced);
    const stopped = await start("stop", "Generated stop caret end");
    const stop = page.locator("button.composer-abort-button:visible").first();
    await stop.click();
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
    await finish("stop", { ...stopped, stopReason: "aborted" });
    const failed = await start("error", "Generated error caret end");
    await emit([{ type: "prompt_error", errorMessage: "Generated fixture error" }]);
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
    await finish("error", { ...failed, stopReason: "error", errorMessage: "Generated fixture error" });
    report.checks.push("Reduced motion has no running caret animation; supplemental hidden and actual New/return visibility measured; actual Stop/error remove active caret state immediately");
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.ok(report.interceptedWrites.every((request) => request.path.endsWith("/lease") || request.path === "/api/agent/activity" && JSON.parse(request.body).type === "abort"));
    report.status = report.findings.length ? "findings" : "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(`Streaming caret boundaries ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runStreamingCaretBoundaries();
