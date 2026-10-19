import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const stamp = Date.UTC(2026, 9, 19, 14);
const assistant = (content, time = stamp + 1000) => ({ role: "assistant", content, timestamp: time, stopReason: "toolUse", provider: "generated", model: "generated" });

async function sampleEvents(page, events, ids) {
  return page.evaluate(async ({ events, ids }) => {
    const frames = [], start = performance.now();
    window.__activityEvents(events);
    while (performance.now() - start < 550) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      frames.push({ ms: performance.now() - start, rows: ids.map((id) => {
        const row = document.querySelector(`[data-tool-call-id="${id}"]`);
        if (!row) return { id, absent: true };
        const style = getComputedStyle(row);
        return { id, opacity: Number(style.opacity), y: new DOMMatrixReadOnly(style.transform).m42, animations: row.getAnimations().map((animation) => ({ duration: animation.effect.getTiming().duration, delay: animation.effect.getTiming().delay, iterations: animation.effect.getTiming().iterations, frames: animation.effect.getKeyframes().map(({ opacity, transform }) => ({ opacity, transform })) })) };
      }) });
    }
    return frames;
  }, { events, ids });
}

export async function runActivityStepMotion() {
  const out = new URL(`../test-results/pilaude/activity-step-motion/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
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
    const liveUser = { role: "user", content: "Generated finite step motion turn.", timestamp: stamp };
    state.running = true; state.messages.push(liveUser); state.entryIds.push("step-user"); state.revision++;
    const calls = Array.from({ length: 5 }, (_, index) => ({ type: "toolCall", toolCallId: `step-${index}`, toolName: "bash", input: { command: `printf generated-step-${index}` } }));
    const message = assistant(calls);
    const events = [{ type: "agent_start" }, { type: "message_end", message: liveUser }, { type: "message_start", message: assistant([]) }];
    for (const [index, call] of calls.entries()) events.push({ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: index, id: call.toolCallId, toolName: call.toolName } }, { type: "message_update", assistantMessageEvent: { type: "toolcall_end", contentIndex: index, toolCall: { id: call.toolCallId, name: call.toolName, arguments: call.input } } });
    events.push({ type: "message_end", message });
    state.messages.push(message); state.entryIds.push("step-process"); state.revision++;
    const frames = await sampleEvents(page, events, calls.map((call) => call.toolCallId));
    report.measurements.push({ name: "same-batch-step-entry", frames });
    for (const [index, call] of calls.entries()) {
      const samples = frames.flatMap((frame) => frame.rows.filter((row) => row.id === call.toolCallId && !row.absent));
      assert.ok(samples.some((row) => row.opacity > 0 && row.opacity < 1 && row.y > 0 && row.y < 6), `${call.toolCallId}: actual native frames show opacity and translateY entry motion`);
      assert.ok(samples.slice(samples.findIndex((row) => row.opacity > 0)).every((row) => row.opacity > 0), "Consumption rerender does not restart an in-progress entry at zero");
      const animation = samples.flatMap((row) => row.animations).find((animation) => animation.duration === 180);
      assert.ok(animation, `${call.toolCallId}: entry has a finite 180ms duration`);
      assert.equal(animation.delay, Math.min(index * 40, 120), "Same-commit stagger is 40ms capped at 120ms");
      assert.equal(animation.iterations, 1);
      assert.equal(samples.at(-1).opacity, 1); assert.equal(samples.at(-1).y, 0); assert.deepEqual(samples.at(-1).animations, []);
    }
    report.checks.push("Genuine same-batch tool starts animate opacity/translateY once for 180ms with 40ms stagger capped at 120ms");
    const runningFrames = await page.evaluate(async () => {
      const row = document.querySelector('[data-tool-call-id="step-0"]');
      const icon = row.querySelector(".tool-call-status-icon");
      window.__activityEvents([{ type: "tool_execution_start", toolCallId: "step-0", toolName: "bash" }]);
      const frames = [], start = performance.now();
      while (performance.now() - start < 250) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        frames.push({ ms: performance.now() - start, status: row.dataset.status, opacity: Number(getComputedStyle(icon).opacity), shape: icon.firstElementChild.tagName, animations: icon.getAnimations().map((animation) => ({ duration: animation.effect.getTiming().duration, iterations: animation.effect.getTiming().iterations })) });
      }
      return frames;
    });
    report.measurements.push({ name: "tool-status-change", frames: runningFrames });
    assert.ok(runningFrames.some((frame) => frame.opacity >= .5 && frame.opacity < 1 && frame.status === "running" && frame.shape === "circle"), "Actual running state/icon is immediate while its finite opacity fade progresses");
    assert.ok(runningFrames.some((frame) => frame.animations.some((animation) => animation.duration === 160 && animation.iterations === 1)), "Status icon fades once for 160ms");
    assert.equal(runningFrames.at(-1).opacity, 1); assert.deepEqual(runningFrames.at(-1).animations, []);
    const result = { role: "toolResult", toolCallId: "step-0", toolName: "bash", content: [{ type: "text", text: "Generated finite result" }], isError: false, timestamp: stamp + 2000 };
    state.messages.push(result); state.entryIds.push("step-result"); state.revision++;
    const summaryFrames = await page.evaluate(async (result) => {
      const row = document.querySelector('[data-tool-call-id="step-0"]');
      const icon = row.querySelector(".tool-call-status-icon");
      const summary = row.closest(".process-details").querySelector(".process-details-label");
      window.__activityEvents([{ type: "tool_execution_end", toolCallId: "step-0", toolName: "bash", isError: false }, { type: "message_end", message: result }]);
      const frames = [], start = performance.now();
      while (performance.now() - start < 250) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        frames.push({ ms: performance.now() - start, status: row.dataset.status, shape: icon.firstElementChild.tagName, opacity: Number(getComputedStyle(summary).opacity), label: summary.textContent, animations: summary.getAnimations().filter((animation) => animation.effect.getTiming().iterations !== Infinity).map((animation) => ({ duration: animation.effect.getTiming().duration, iterations: animation.effect.getTiming().iterations })) });
      }
      return frames;
    }, result);
    report.measurements.push({ name: "summary-value-change", frames: summaryFrames });
    assert.ok(summaryFrames.some((frame) => frame.opacity >= .5 && frame.opacity < 1 && frame.status === "success" && frame.shape === "path" && /Running… · 1 message$/.test(frame.label)), "Updated status and summary text are accessible during the new-value fade");
    assert.ok(summaryFrames.some((frame) => frame.animations.some((animation) => animation.duration === 150 && animation.iterations === 1)), "Changed summary label fades once for 150ms");
    assert.equal(summaryFrames.at(-1).opacity, 1); assert.deepEqual(summaryFrames.at(-1).animations, []);
    report.checks.push("Actual status changes fade the new icon for 160ms and actual summary text changes fade once for 150ms without delaying state");
    const process = page.locator(".process-details-trigger").last();
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    const assertNoFiniteMotion = async (name, action) => {
      await action();
      const frames = await page.evaluate(async () => {
        const frames = [], start = performance.now();
        while (performance.now() - start < 350) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          frames.push({ ms: performance.now() - start, count: [...document.querySelectorAll(".tool-call-row, .tool-call-status-icon, .process-details-status, .process-details-label")].flatMap((element) => element.getAnimations()).filter((animation) => animation.effect.getTiming().iterations !== Infinity && animation.effect.getKeyframes().some((frame) => frame.opacity !== undefined)).length });
        }
        return frames;
      });
      assert.ok(frames.every((frame) => frame.count === 0), `${name}: no finite activity motion replays`);
      report.measurements.push({ name, frames });
    };
    await assertNoFiniteMotion("group-close-reopen", async () => { await process.click(); await process.click(); });
    const unchangedText = { type: "text", text: "Generated stable summary narrative." };
    await assertNoFiniteMotion("narrative-delta-same-summary", () => emit([{ type: "message_start", message: assistant([unchangedText], stamp + 3000) }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: " Another narrative delta." } }]));
    const reconnect = assistant([{ type: "toolCall", toolCallId: "reconnected-tool", toolName: "bash", input: { command: "printf reconnect-fixture" } }], stamp + 4000);
    await assertNoFiniteMotion("reconnect-bootstrap", () => emit([{ type: "connected", isStreaming: true, hasStreamingSnapshot: true, pendingExtensionUiIds: [] }, { type: "message_start", message: reconnect }]));
    await page.locator('[data-tool-call-id="reconnected-tool"]').waitFor({ state: "attached" });
    // A final answer remounts the answered group; consumed tool rows remain static.
    const final = { ...assistant([{ type: "text", text: "Generated final answer." }], stamp + 5000), stopReason: "stop" };
    state.messages.push(final); state.entryIds.push("step-final"); state.running = false; state.revision++;
    await emit([{ type: "message_end", message: final }, { type: "agent_end" }, { type: "agent_settled" }]);
    await page.getByText("Generated final answer.", { exact: true }).waitFor();
    await assertNoFiniteMotion("answered-key-remount", async () => { if (await process.getAttribute("aria-expanded") === "false") await process.click(); });
    report.checks.push("Group reopen, unchanged narrative summary, reconnect bootstrap and answered-key remount never replay entry/value motion");
    // Between tools a run can reconnect with no assistant snapshot. The next
    // actual shared message_start/toolcall_start must still earn one entry.
    const reconnectCall = { type: "toolCall", toolCallId: "post-reconnect-step", toolName: "bash", input: { command: "printf post-reconnect-step" } };
    const reconnectLive = assistant([reconnectCall], stamp + 5500);
    const reconnectFrames = await sampleEvents(page, [{ type: "agent_start" }, { type: "connected", isStreaming: true, hasStreamingSnapshot: false, pendingExtensionUiIds: [] }, { type: "message_start", message: reconnectLive }, { type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: 0, id: reconnectCall.toolCallId, toolName: reconnectCall.toolName } }, { type: "message_update", assistantMessageEvent: { type: "toolcall_end", contentIndex: 0, toolCall: { id: reconnectCall.toolCallId, name: reconnectCall.toolName, arguments: reconnectCall.input } } }], [reconnectCall.toolCallId]);
    report.measurements.push({ name: "no-snapshot-reconnect-new-entry", frames: reconnectFrames });
    assert.ok(reconnectFrames.some((frame) => !frame.rows[0].absent && frame.rows[0].opacity > 0 && frame.rows[0].opacity < 1 && frame.rows[0].y > 0), "No-snapshot reconnect preserves the next genuine entry grant");
    await emit([{ type: "message_end", message: reconnectLive }]);
    state.messages.push(reconnectLive); state.entryIds.push("post-reconnect-process"); state.revision++;
    const nextUser = { role: "user", content: "Generated hidden and reduced motion turn.", timestamp: stamp + 6000 };
    const nextMessage = assistant([{ type: "thinking", thinking: "Generated hidden motion reasoning." }], stamp + 7000);
    state.running = true; state.messages.push(nextUser); state.entryIds.push("hidden-user"); state.revision++;
    await emit([{ type: "agent_start" }, { type: "message_end", message: nextUser }, { type: "message_start", message: nextMessage }]);
    await page.waitForFunction(() => document.querySelectorAll(".process-details-trigger").length === 3);
    report.checks.push("A no-snapshot reconnect preserves the next genuinely started tool entry in the same connected run");
    const hiddenGroup = page.locator(".process-details-trigger").last();
    await hiddenGroup.click();
    const hiddenCall = { type: "toolCall", toolCallId: "hidden-step", toolName: "bash", input: { command: "printf hidden-step" } };
    nextMessage.content.push(hiddenCall);
    const append = (call, index) => [{ type: "message_update", assistantMessageEvent: { type: "toolcall_start", contentIndex: index, id: call.toolCallId, toolName: call.toolName } }, { type: "message_update", assistantMessageEvent: { type: "toolcall_end", contentIndex: index, toolCall: { id: call.toolCallId, name: call.toolName, arguments: call.input } } }];
    const hiddenFrames = await sampleEvents(page, append(hiddenCall, 1), [hiddenCall.toolCallId]);
    report.measurements.push({ name: "hidden-first-appearance", frames: hiddenFrames });
    assert.ok(hiddenFrames.some((frame) => !frame.rows[0].absent), "Hidden process still commits a real row");
    assert.ok(hiddenFrames.every((frame) => frame.rows[0].absent || frame.rows[0].animations.length === 0), "Hidden first appearance consumes without animation");
    await assertNoFiniteMotion("hidden-first-appearance-reopen", () => hiddenGroup.click());
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedCall = { type: "toolCall", toolCallId: "reduced-step", toolName: "bash", input: { command: "printf reduced-step" } };
    nextMessage.content.push(reducedCall);
    const reducedFrames = await sampleEvents(page, append(reducedCall, 2), [reducedCall.toolCallId]);
    report.measurements.push({ name: "reduced-first-appearance", frames: reducedFrames });
    assert.ok(reducedFrames.some((frame) => !frame.rows[0].absent));
    assert.ok(reducedFrames.every((frame) => frame.rows[0].absent || (frame.rows[0].animations.length === 0 && frame.rows[0].opacity === 1 && frame.rows[0].y === 0)), "Reduced first appearance consumes without hidden delay or movement");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await assertNoFiniteMotion("reduced-then-normal-reopen", async () => { await hiddenGroup.click(); await hiddenGroup.click(); });
    const cancelCall = { type: "toolCall", toolCallId: "cancel-step", toolName: "bash", input: { command: "printf cancel-step" } };
    const canceled = await page.evaluate(async ({ events, id }) => {
      window.__activityEvents(events);
      let row;
      while (!(row = document.querySelector(`[data-tool-call-id="${id}"]`))?.getAnimations().length) await new Promise((resolve) => requestAnimationFrame(resolve));
      const before = { opacity: Number(getComputedStyle(row).opacity), y: new DOMMatrixReadOnly(getComputedStyle(row).transform).m42 };
      row.closest(".process-details").querySelector(".process-details-trigger").click();
      await new Promise((resolve) => requestAnimationFrame(resolve));
      return { before, after: { animations: row.getAnimations().length, opacity: Number(getComputedStyle(row).opacity), y: new DOMMatrixReadOnly(getComputedStyle(row).transform).m42 } };
    }, { events: append(cancelCall, 3), id: cancelCall.toolCallId });
    report.measurements.push({ name: "mid-entry-close-cleanup", ...canceled });
    assert.equal(canceled.after.animations, 0); assert.equal(canceled.after.opacity, 1); assert.equal(canceled.after.y, 0);
    await page.waitForFunction(() => [...document.querySelectorAll(".tool-call-row, .tool-call-status-icon, .process-details-status, .process-details-label")].every((element) => element.getAnimations().every((animation) => animation.effect.getTiming().iterations === Infinity)));
    await assertNoFiniteMotion("canceled-entry-reopen", () => hiddenGroup.click());
    report.checks.push("Hidden/reduced first appearances consume once; closing during entry cancels to the final presentation and never replays");
    const preferenceCall = { type: "toolCall", toolCallId: "preference-step", toolName: "bash", input: { command: "printf preference-step" } };
    await emit(append(preferenceCall, 4));
    await page.waitForFunction(() => document.querySelector('[data-tool-call-id="preference-step"]')?.getAnimations().length > 0);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForFunction(() => !document.querySelector('[data-tool-call-id="preference-step"]')?.getAnimations().length);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await assertNoFiniteMotion("mid-entry-reduced-cleanup", async () => {});
    // Header buttons remain native controls; no motion helper moves focus or scroll.
    const input = page.locator("textarea.chat-input-textarea");
    await input.focus();
    const beforeScroll = await page.locator(".chat-scroll-container").evaluate((element) => { element.scrollTop = 0; element.dispatchEvent(new Event("scroll")); return element.scrollTop; });
    await emit([{ type: "tool_execution_start", toolCallId: preferenceCall.toolCallId, toolName: "bash" }]);
    await page.waitForFunction(() => document.querySelector('[data-tool-call-id="preference-step"]')?.dataset.status === "running");
    assert.equal(await input.evaluate((element) => document.activeElement === element), true, "Finite value changes preserve outside focus");
    assert.equal(await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop), beforeScroll, "Finite value changes leave manual history scroll intact");
    report.checks.push("Changing reduced motion mid-entry cleans up; finite value changes preserve outside focus and manual history scroll");
    // Restore a short visible completed group for settled screenshots.
    await page.emulateMedia({ reducedMotion: "reduce" });
    state.running = false;
    await emit([{ type: "agent_end" }, { type: "agent_settled" }]);
    const firstGroup = page.locator(".process-details-trigger").nth(1);
    if (await firstGroup.getAttribute("aria-expanded") === "false") await firstGroup.click();
    if (await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().isVisible()) await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().click();
    if (await page.locator('.pilaude-context-toggle[aria-pressed="true"]').count()) await page.locator('.pilaude-context-toggle[aria-pressed="true"]').click();
    const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
    if (await hideSidebar.isVisible()) await hideSidebar.click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
      for (const width of [1300, 430]) {
        await page.setViewportSize({ width, height: 1000 });
        await firstGroup.scrollIntoViewIfNeeded();
        await page.evaluate(async () => { await new Promise((resolve) => requestAnimationFrame(resolve)); await new Promise((resolve) => requestAnimationFrame(resolve)); });
        await page.waitForFunction(() => document.getAnimations().every((animation) => animation.effect.getComputedTiming().iterations === Infinity || animation.playState !== "running"));
        const path = artifact(`finite-settled-${theme}-${width}.png`);
        await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(path);
      }
    }
    report.checks.push("Captured settled finite activity states in desktop/mobile light/dark themes");
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.equal(report.interceptedWrites.every((request) => request.path.endsWith("/lease")), true);
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(`Activity step motion ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runActivityStepMotion();
