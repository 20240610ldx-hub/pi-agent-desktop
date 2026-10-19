import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const stamp = Date.UTC(2026, 9, 19, 12);
const assistant = (content, timestamp = stamp + 1000, stopReason = "stop") => ({ role: "assistant", content, timestamp, stopReason, provider: "generated", model: "generated" });
const result = (call, text, index) => ({ role: "toolResult", toolCallId: call.toolCallId, toolName: call.toolName, content: text === null ? [] : [{ type: "text", text }], isError: false, timestamp: stamp + 2000 + index });
const clipboardInput = { command: "  printf 'generated <&> \"quote\"'\n\tsecond line  ", path: "D:/generated/space name.txt" };
const clipboardOutput = "  generated leading spaces\r\n\ttab and <literal> & text\nlast line  \n";
const codemodeSource = "// generated original source\r\nreturn 'exact whitespace';\r\n\t  ";
const mcpSource = '<section>generated MCP plain text</section><script>window.__boundaryMcpExecuted=true</script><img src="/api/generated-mcp-image" onerror="window.__boundaryMcpExecuted=true">';
const longOutput = `generated-long-line:${"x".repeat(14000)}\n${Array.from({ length: 280 }, (_, i) => `generated line ${i}: ${"long output ".repeat(12)}`).join("\n")}\nEND GENERATED OUTPUT`;
const calls = Array.from({ length: 48 }, (_, index) => ({ type: "toolCall", toolCallId: `boundary-${index}`, toolName: index === 0 ? "mcp__generated__plaintext" : index === 1 ? "empty_output" : index === 2 ? "generated_tool_with_a_long_name_".repeat(8) : index === 4 ? "codemode" : "generated_read", input: index === 3 ? clipboardInput : index === 4 ? { code: codemodeSource } : { path: `D:/generated/step-${index}.txt` } }));
const outputs = calls.map((call, index) => ({ ...result(call, index === 0 ? mcpSource : index === 1 ? null : index === 2 ? longOutput : index === 3 ? clipboardOutput : `Generated output ${index}`, index), ...(index === 0 ? { details: { server: "generated", tool: "plaintext" } } : {}) }));
const historyProcess = assistant([{ type: "thinking", thinking: "Generated stored reasoning preview\n\nGenerated complete reasoning body." }, ...calls], stamp + 1000, "toolUse");
const historyAnswer = assistant([{ type: "text", text: "Generated final answer after forty-eight tool steps." }], stamp + 4000);

/** The real AppShell consumes generated transcript data; every API/SSE and clipboard write is intercepted. */
export async function installBoundaryFixture(context, report) {
  const state = await installActivityFixture(context, report);
  state.messages = [{ role: "user", content: "Generated forty-eight-step boundary fixture.", timestamp: stamp }, historyProcess, ...outputs, historyAnswer];
  state.entryIds = ["boundary-user", "boundary-process", ...calls.map((_, index) => `boundary-result-${index}`), "boundary-answer"];
  state.revision = 20;
  state.reconnecting = false;
  await context.addInitScript(() => {
    localStorage.removeItem("pilaude:transcript-view:v1:activity");
    localStorage.setItem("pi-thinking-expanded", "false");
    window.__boundaryClipboard = [];
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async text => { window.__boundaryClipboard.push(String(text)); } } });
  });
  // Unknown reconnect metadata is deliberately a snapshot without indexed activity.
  await context.route("**/api/{agent/activity,sessions/activity/state}", route => route.fulfill({ json: {
    running: state.running,
    state: { isStreaming: state.running, isPromptRunning: state.running, ...(state.reconnecting ? { streamingMessage: { ...assistant([{ type: "thinking", thinking: "Generated reconnect snapshot reasoning." }]), role: "assistant" } } : {}) },
  } }));
  return state;
}

async function linkedBody(trigger) {
  const id = await trigger.getAttribute("aria-controls");
  assert.ok(id, "Native disclosure identifies its content");
  return trigger.page().locator(`[id=${JSON.stringify(id)}]`);
}
async function expanded(trigger, value = true) {
  if ((await trigger.getAttribute("aria-expanded")) !== String(value)) await trigger.click();
  assert.equal(await trigger.getAttribute("aria-expanded"), String(value));
}
async function closeChrome(page) {
  const contextClose = page.locator('.pilaude-context-toggle[aria-pressed="true"]');
  if (await contextClose.isVisible().catch(() => false)) await contextClose.click();
  const sidebarClose = page.getByRole("button", { name: "Hide sidebar", exact: true });
  if (await sidebarClose.isVisible().catch(() => false)) {
    const box = await sidebarClose.boundingBox();
    if (box && box.x >= 0 && box.y >= 0 && box.x + box.width <= (await page.viewportSize()).width) await sidebarClose.click();
  }
}
const visibleShimmers = page => page.locator('.activity-shimmer[data-active="true"]:visible').count();
const waitStatus = (page, id, status) => page.waitForFunction(({ id, status }) => document.querySelector(`[data-tool-call-id="${id}"]`)?.getAttribute("data-status") === status, { id, status });
const exactCopy = async (page, button, expected) => {
  const before = await page.evaluate(() => window.__boundaryClipboard.length);
  await button.click();
  await page.waitForFunction(count => window.__boundaryClipboard.length > count, before);
  assert.equal(await page.evaluate(() => window.__boundaryClipboard.at(-1)), expected);
};

export async function runAgentOutputBoundaries() {
  const out = new URL(`../test-results/pilaude/agent-output-boundaries/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = name => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], failures: [], captures: [], measurements: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [], navigations: [] };
  let browser, page;
  const check = async (name, callback) => {
    try { await callback(); report.checks.push(name); }
    catch (error) { report.failures.push({ name, message: error.message, stack: error.stack }); }
  };
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1380, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    const state = await installBoundaryFixture(context, report);
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", error => report.pageErrors.push({ message: error.message, stack: error.stack }));
    page.on("framenavigated", frame => { if (frame === page.mainFrame()) report.navigations.push({ url: frame.url(), at: Date.now() }); });
    page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async name => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText(historyAnswer.content[0].text, { exact: true }).waitFor({ timeout: 90000 });
    await closeChrome(page);
    const group = page.locator(".process-details-trigger").first();
    await expanded(group);
    const body = await linkedBody(group);
    await body.locator('[data-tool-call-id="boundary-47"]').waitFor({ state: "attached" });
    await check("Forty-eight actual tool rows render exactly once and finish statically", async () => {
      assert.equal(await body.locator(".tool-call-row").count(), 48);
      assert.equal(await body.locator('[data-status="success"]').count(), 48);
      assert.equal(await visibleShimmers(page), 0);
      assert.equal(await page.locator('[data-message-streaming="true"]').count(), 0);
      const loops = await body.evaluate(element => element.getAnimations({ subtree: true }).filter(animation => animation.effect?.getTiming().iterations === Infinity).length);
      assert.equal(loops, 0);
      assert.match(await group.innerText(), /48/);
    });
    const copyRow = body.locator('[data-tool-call-id="boundary-3"]');
    await expanded(copyRow.locator(".tool-call-trigger"));
    await check("Native input and result Copy controls preserve exact whitespace and literal content", async () => {
      const buttons = copyRow.locator(".markdown-code-copy");
      assert.equal(await buttons.count(), 2);
      await exactCopy(page, buttons.nth(0), JSON.stringify(clipboardInput, null, 2));
      await exactCopy(page, buttons.nth(1), clipboardOutput);
      const code = body.locator('[data-tool-call-id="boundary-4"]');
      await expanded(code.locator(".tool-call-trigger"));
      await exactCopy(page, code.locator(".markdown-code-copy").first(), codemodeSource);
      report.measurements.push({ name: "clipboard-boundary", writes: await page.evaluate(() => window.__boundaryClipboard.length), exactSource: true });
    });
    const empty = body.locator('[data-tool-call-id="boundary-1"]');
    await check("A completed empty result exposes a truthful empty output", async () => {
      await expanded(empty.locator(".tool-call-trigger"));
      await empty.getByText("(no output)", { exact: true }).waitFor();
      assert.equal(await empty.getAttribute("data-status"), "success");
    });
    const mcp = body.locator('[data-tool-call-id="boundary-0"]');
    await check("MCP HTML remains literal text and never executes or creates an image request", async () => {
      await expanded(mcp.locator(".tool-call-trigger"));
      assert.equal(await mcp.locator("pre").last().textContent(), mcpSource);
      assert.equal(await mcp.locator("script,img,iframe").count(), 0);
      assert.equal(await page.evaluate(() => window.__boundaryMcpExecuted), undefined);
      assert.equal(report.apiRequests.some(item => item.path === "/api/generated-mcp-image"), false);
    });
    const longRow = body.locator('[data-tool-call-id="boundary-2"]');
    await expanded(longRow.locator(".tool-call-trigger"));
    await check("Long output is complete inside its bounded native scroll area", async () => {
      const output = longRow.locator("pre").last();
      assert.equal(await output.textContent(), longOutput);
      const geometry = await output.evaluate(element => {
        const style = getComputedStyle(element), rect = element.getBoundingClientRect();
        return { height: rect.height, maxHeight: style.maxHeight, scrollHeight: element.scrollHeight, clientHeight: element.clientHeight, scrollWidth: element.scrollWidth, clientWidth: element.clientWidth, overflowX: style.overflowX, overflowY: style.overflowY, font: style.fontFamily, whiteSpace: style.whiteSpace };
      });
      assert.ok(geometry.height <= 402 && geometry.scrollHeight > geometry.clientHeight);
      assert.equal(geometry.overflowY, "auto"); assert.equal(geometry.overflowX, "auto");
      await output.evaluate(element => { element.scrollTop = element.scrollHeight; });
      assert.ok(await output.evaluate(element => element.scrollTop > 0));
      report.measurements.push({ name: "long-output", ...geometry });
    });
    await check("Very long tool names remain inside the transcript column", async () => {
      await longRow.locator(".tool-call-trigger").scrollIntoViewIfNeeded();
      const geometry = await longRow.evaluate(element => {
        const row = element.getBoundingClientRect(), trigger = element.querySelector('.tool-call-trigger').getBoundingClientRect();
        const label = element.querySelector('.tool-call-name'), name = label.getBoundingClientRect(), scroll = document.querySelector('.chat-scroll-container');
        const chevron = element.querySelector('.tool-call-chevron').getBoundingClientRect(), metadata = element.querySelector('.tool-call-metadata')?.getBoundingClientRect();
        return { left: row.left, right: row.right, triggerRight: trigger.right, nameRight: name.right, chevronRight: chevron.right, chevronWidth: chevron.width, metadataRight: metadata?.right, text: label.textContent, ellipsis: getComputedStyle(label).textOverflow, viewport: innerWidth, scrollWidth: scroll.scrollWidth, clientWidth: scroll.clientWidth };
      });
      report.measurements.push({ name: "long-tool-name", ...geometry });
      assert.ok(geometry.nameRight <= geometry.right + 1 && geometry.triggerRight <= geometry.right + 1, `Long name must fit its row: ${JSON.stringify(geometry)}`);
      assert.ok(geometry.scrollWidth <= geometry.clientWidth + 1);
      assert.ok(geometry.chevronWidth >= 9 && geometry.chevronRight <= geometry.right + 1 && geometry.metadataRight <= geometry.right + 1, "Status metadata and chevron retain their space");
      assert.equal(geometry.text, calls[2].toolName); assert.equal(geometry.ellipsis, "ellipsis");
    });
    await capture("history-long-output");
    await check("Summary, thinking and tool hover use neutral theme text", async () => {
      await longRow.locator('.tool-call-trigger').click();
      await expanded(copyRow.locator('.tool-call-trigger'), false);
      await page.locator('.chat-scroll-container').evaluate(element => { element.scrollTop = 0; });
      const thinking = body.locator(".thinking-disclosure-toggle").first();
      for (const theme of ["light", "dark"]) {
        await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.documentElement.classList.toggle("dark", theme === "dark"); }, theme);
        for (const [kind, trigger] of [["summary", group], ["thinking", thinking], ["tool", copyRow.locator('.tool-call-trigger')]]) {
          await trigger.scrollIntoViewIfNeeded(); await trigger.hover();
          await trigger.evaluate(element => Promise.allSettled(element.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished)));
          const style = await trigger.evaluate(element => {
            const computed = getComputedStyle(element), raw = getComputedStyle(document.documentElement).getPropertyValue('--text-hover').trim();
            const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
            return { color: computed.color, textHover: raw, font: computed.fontFamily, background: computed.backgroundColor, hovered: element.matches(':hover'), hit: hit === element || element.contains(hit), rect: { x: box.x, y: box.y, width: box.width, height: box.height }, hitTag: hit?.tagName, hitClass: hit?.className };
          });
          report.measurements.push({ name: `hover-${theme}-${kind}`, ...style });
          assert.ok(style.hovered && style.hit, `${theme} ${kind}: actual hover and native center hit`);
          if (/^#[0-9a-f]{6}$/i.test(style.textHover)) {
            const expected = [1, 3, 5].map(index => parseInt(style.textHover.slice(index, index + 2), 16));
            assert.equal(style.color, `rgb(${expected.join(', ')})`, `${theme} ${kind}: resolved hover token`);
          }
          const channels = style.color.match(/[\d.]+/g).slice(0, 3).map(Number);
          assert.ok(Math.max(...channels) - Math.min(...channels) <= (theme === "dark" ? 12 : 4), `${theme} ${kind} hover is neutral`);
          if (theme === "dark") assert.ok(Math.min(...channels) >= 230, `${kind} dark hover becomes white`);
          else assert.ok(Math.max(...channels) < 180 && Math.min(...channels) > 25, `${kind} light hover becomes gray`);
        }
        await capture(`hover-${theme}`);
      }
      await page.mouse.move(0, 0);
    });
    const emit = events => page.evaluate(events => window.__activityEvents(events), events);
    await check("Parallel tool start, partial updates and independent ends keep one visible activity", async () => {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.mouse.move(0, 0);
      state.running = true;
      const user = { role: "user", content: "Generated parallel boundary turn", timestamp: stamp + 5000 };
      const parallel = ["parallel-a", "parallel-b", "parallel-queued"].map(id => ({ type: "toolCall", toolCallId: id, toolName: "bash", input: { command: `printf generated-${id}` } }));
      const message = assistant(parallel, stamp + 6000, "toolUse");
      state.messages.push(user, message); state.entryIds.push("parallel-user", "parallel-process"); state.revision++;
      await emit([{ type: "agent_start" }, { type: "message_end", message: user }, { type: "message_end", message }, { type: "tool_execution_start", toolCallId: "parallel-a", toolName: "bash" }, { type: "tool_execution_start", toolCallId: "parallel-b", toolName: "bash" }]);
      await waitStatus(page, "parallel-a", "running"); await waitStatus(page, "parallel-b", "running"); await waitStatus(page, "parallel-queued", "pending");
      assert.equal(await visibleShimmers(page), 1);
      const activeLoops = await page.locator('.activity-shimmer[data-active="true"]:visible').evaluate(element => element.getAnimations().filter(animation => animation.effect?.getTiming().iterations === Infinity).length);
      assert.equal(activeLoops, 1, "Normal motion has one real continuous animation on the selected active label");
      const activeGroup = page.locator('.process-details-trigger').last(); await expanded(activeGroup);
      const a = page.locator('[data-tool-call-id="parallel-a"]'); await expanded(a.locator('.tool-call-trigger'));
      await (await linkedBody(a.locator('.tool-call-trigger'))).waitFor({ state: 'visible' });
      const partial = result(parallel[0], "Generated partial output remains running", 0);
      await emit([{ type: "tool_execution_update", toolCallId: "parallel-a", toolName: "bash", partialResult: partial }]);
      await a.getByText(partial.content[0].text, { exact: true }).waitFor(); await waitStatus(page, "parallel-a", "running");
      assert.equal(await visibleShimmers(page), 1);
      state.messages.push(partial); state.entryIds.push("parallel-a-result"); state.revision++;
      await emit([{ type: "tool_execution_end", toolCallId: "parallel-a", toolName: "bash", isError: false }, { type: "message_end", message: partial }]);
      await waitStatus(page, "parallel-a", "success"); await waitStatus(page, "parallel-b", "running");
      assert.equal(await a.locator('.activity-shimmer').count(), 0);
      const b = result(parallel[1], "Generated parallel B complete", 1), queued = result(parallel[2], "Generated queued tool complete", 2);
      state.messages.push(b, queued); state.entryIds.push("parallel-b-result", "parallel-queued-result"); state.revision++;
      await emit([{ type: "tool_execution_end", toolCallId: "parallel-b", toolName: "bash", isError: false }, { type: "message_end", message: b }, { type: "tool_execution_start", toolCallId: "parallel-queued", toolName: "bash" }, { type: "tool_execution_end", toolCallId: "parallel-queued", toolName: "bash", isError: false }, { type: "message_end", message: queued }]);
      await waitStatus(page, "parallel-b", "success"); await waitStatus(page, "parallel-queued", "success");
      state.running = false; state.revision++;
      await emit([{ type: "agent_end" }, { type: "agent_settled" }]);
      await page.waitForFunction(() => !document.querySelector('.activity-shimmer[data-active="true"]'));
      assert.equal(await page.locator('[data-message-streaming="true"]').count(), 0);
      await capture("parallel-complete");
    });
    await check("Reconnect snapshots stay static until real indexed activity is replayed", async () => {
      state.running = true; state.reconnecting = true;
      await page.reload({ waitUntil: "domcontentloaded" });
      await page.getByText("Generated reconnect snapshot reasoning.", { exact: true }).waitFor();
      await emit([{ type: "connected", isStreaming: true, hasStreamingSnapshot: true, pendingExtensionUiIds: [] }, { type: "message_start", message: assistant([{ type: "thinking", thinking: "Generated reconnect snapshot reasoning." }]) }]);
      await page.getByText("Generated reconnect snapshot reasoning.", { exact: true }).waitFor();
      const snapshot = page.locator('.thinking-disclosure-toggle').filter({ hasText: "Generated reconnect snapshot reasoning." });
      assert.equal(await snapshot.locator('.activity-shimmer').count(), 0);
      assert.equal(await page.locator('[data-message-streaming="true"]').count(), 0);
      state.running = false; state.reconnecting = false;
      await emit([{ type: "agent_end" }, { type: "agent_settled" }]);
      await page.waitForFunction(() => !document.querySelector('.activity-shimmer[data-active="true"]'));
      await capture("reconnect-static");
    });
    await check("Coarse-pointer summary, thinking and tool targets are reachable and at least 44px high", async () => {
      const touch = await browser.newContext({ viewport: { width: 430, height: 812 }, isMobile: true, hasTouch: true, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
      await installBoundaryFixture(touch, report);
      const phone = await touch.newPage();
      phone.on("pageerror", error => report.pageErrors.push({ message: error.message, stack: error.stack }));
      phone.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
      await phone.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
      await phone.getByText(historyAnswer.content[0].text, { exact: true }).waitFor(); await closeChrome(phone);
      const summary = phone.locator('.process-details-trigger').first(); await expanded(summary);
      const phoneBody = await linkedBody(summary);
      for (const [kind, trigger] of [["summary", summary], ["thinking", phoneBody.locator('.thinking-disclosure-toggle').first()], ["tool", phoneBody.locator('[data-tool-call-id="boundary-3"] .tool-call-trigger')]]) {
        await trigger.scrollIntoViewIfNeeded();
        const geometry = await trigger.evaluate(element => {
          const box = element.getBoundingClientRect(), hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
          return { width: box.width, height: box.height, left: box.left, right: box.right, hit: hit === element || element.contains(hit), viewport: innerWidth, font: getComputedStyle(element).fontFamily };
        });
        assert.ok(geometry.height >= 44 && geometry.width >= 44 && geometry.hit, `${kind}: native center hit and touch size`);
        assert.ok(geometry.left >= 0 && geometry.right <= geometry.viewport + 1);
        report.measurements.push({ name: `touch-${kind}`, ...geometry });
      }
      const thought = phoneBody.locator('.thinking-disclosure-toggle').first(); await thought.tap();
      await phone.getByText("Generated complete reasoning body.", { exact: false }).waitFor();
      const tool = phoneBody.locator('[data-tool-call-id="boundary-3"]'); await tool.locator('.tool-call-trigger').tap();
      await tool.locator('.markdown-code-copy').first().waitFor();
      await phone.screenshot({ path: artifact("touch-details.png"), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact("touch-details.png"));
      await touch.close();
    });
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.ok(report.interceptedWrites.every(item => item.path.endsWith('/lease')), "No real model, Stop, or other application writes are attempted");
    report.status = report.failures.length ? "failed" : "passed";
  } catch (error) {
    report.status = "failed"; report.failures.push({ name: "fixture execution", message: error.message, stack: error.stack });
  } finally {
    if (report.status !== "passed" && page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    await writeFile(artifact("report.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(JSON.stringify({ status: report.status, checks: report.checks, failures: report.failures.map(({ name, message }) => ({ name, message })), report: artifact("report.json") }, null, 2));
  }
  if (report.status !== "passed") process.exitCode = 1;
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runAgentOutputBoundaries();
