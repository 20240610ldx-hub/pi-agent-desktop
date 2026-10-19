import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";

export async function runSendingState() {
  const out = new URL(`../test-results/pilaude/sending-state/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", checks: [], captures: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [], admissions: [] };
  let browser, page;
  const pending = [];
  const admissionWaiters = new Map();
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 950 }, reducedMotion: "reduce", serviceWorkers: "block" });
    const fixture = await installActivityFixture(context, report);
    // Only this generated fixture owns these requests. Nothing is forwarded to
    // a prompt endpoint, model provider, credential store or session history.
    await context.route(/\/api\/agent\/(activity|draft)$/, async (route) => {
      const request = route.request();
      if (request.method() !== "POST") return route.fallback();
      const command = request.postDataJSON();
      report.interceptedWrites.push({ method: "POST", path: new URL(request.url()).pathname, type: command.type });
      if (command.type === "prompt") {
        fixture.running = true;
        report.admissions.push({ sessionId: new URL(request.url()).pathname.split("/").at(-1), message: command.message });
        return new Promise((resolve) => {
          pending.push({
            async finish(status = 200, body = { success: true, data: null }) {
              if (status >= 400) fixture.running = false;
              await route.fulfill({ status, json: body });
              resolve();
            },
          });
          admissionWaiters.get(report.admissions.length)?.();
          admissionWaiters.delete(report.admissions.length);
        });
      }
      if (command.type === "abort") {
        fixture.running = false;
        return route.fulfill({ json: { success: true, data: null } });
      }
      return route.fulfill({ json: { success: true, data: {} } });
    });
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const input = page.locator("textarea.chat-input-textarea");
    const sending = page.locator('[data-sending="true"]');
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    const waitAdmission = async (count) => {
      if (report.admissions.length < count) await new Promise((resolve) => admissionWaiters.set(count, resolve));
      assert.equal(report.admissions.length, count);
    };
    const send = async (text, count) => {
      await input.fill(text);
      const request = page.waitForRequest((request) => request.method() === "POST" && request.postDataJSON()?.type === "prompt");
      await input.press("Enter");
      await request;
      await waitAdmission(count);
      await sending.waitFor();
      assert.equal(await sending.innerText(), "Sending…");
      assert.equal(await sending.locator("button").count(), 0, "Sending never invents a disclosure action");
      assert.equal(await sending.locator('.activity-shimmer[data-active="true"]').count(), 1);
    };
    const finishRun = async () => {
      fixture.running = false;
      await emit([{ type: "prompt_done" }, { type: "agent_settled" }]);
      await page.getByRole("button", { name: "Send", exact: true }).waitFor();
    };
    const capture = async (name) => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };

    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    await send("Generated delayed admission", 1);
    const style = await sending.evaluate((element) => ({ family: getComputedStyle(element).fontFamily, animation: getComputedStyle(element.querySelector(".activity-shimmer")).animationName }));
    assert.equal(style.animation, "none", "Reduced motion preserves a readable static Sending label");
    await input.fill("Draft typed while awaiting admission");
    await input.focus();
    await emit([{ type: "agent_start" }]);
    assert.equal(await sending.count(), 1, "Agent start is not transport ACK");
    await capture("sending-deferred-ack");
    await emit([
      { type: "message_start", message: { role: "assistant", content: [], provider: "generated", model: "generated", timestamp: 123 } },
      { type: "message_update", assistantMessageEvent: { type: "thinking_start", contentIndex: 0 } },
      { type: "message_update", assistantMessageEvent: { type: "thinking_delta", contentIndex: 0, delta: "Generated live reasoning before admission ACK" } },
    ]);
    await sending.waitFor({ state: "detached" });
    assert.equal(await page.locator('.activity-shimmer[data-active="true"]:visible').count(), 1, "Specific live thinking supersedes Sending while the POST is still pending");
    await pending.shift().finish();
    await sending.waitFor({ state: "detached" });
    assert.equal(await page.getByRole("button", { name: "Stop agent", exact: true }).count(), 1, "ACK leaves the run active");
    assert.equal(await input.inputValue(), "Draft typed while awaiting admission");
    assert.equal(await input.evaluate((element) => element === document.activeElement), true, "ACK preserves composer focus");
    report.checks.push("Sending follows a genuinely pending prompt admission, survives agent_start, and ends at HTTP ACK while the run and draft/focus continue");
    await finishRun();

    await send("Generated rejected submission", 2);
    await pending.shift().finish(409, { error: "Generated admission rejection", code: "prompt_rejected", accepted: false });
    await sending.waitFor({ state: "detached" });
    await page.waitForFunction(() => document.querySelector("textarea.chat-input-textarea")?.value === "Generated rejected submission");
    assert.equal(report.admissions.length, 2, "Rejection restores the draft without a second prompt request");
    await page.getByRole("button", { name: "Send", exact: true }).waitFor();
    report.checks.push("Definitive admission rejection clears Sending and restores the submission once");

    await send("Generated stopped admission", 3);
    await page.getByRole("button", { name: "Stop agent", exact: true }).click();
    await sending.waitFor({ state: "detached" });
    await pending.shift().finish();
    assert.equal(await sending.count(), 0, "Late ACK after Stop does not restore Sending");
    await finishRun();
    report.checks.push("Stop clears Sending immediately and a later ACK never resurrects it");

    await send("Old A admission", 4);
    // The originating view misses settlement while away; the next mount reads
    // the generated server's idle state before another independent submission.
    fixture.running = false;
    await page.getByRole("button", { name: "Activity fixture draft", exact: true }).first().click();
    await page.getByText("Other session answer.", { exact: true }).waitFor();
    assert.equal(await sending.count(), 0);
    await input.fill("Independent B draft");
    await page.getByRole("button", { name: "Activity fixture activity", exact: true }).first().click();
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    await send("New A admission", 5);
    await input.fill("New A unsent draft");
    await input.focus();
    await pending.shift().finish();
    assert.equal(await sending.count(), 1, "Old A ACK cannot clear the newer A send");
    await pending.shift().finish();
    await sending.waitFor({ state: "detached" });
    assert.equal(await input.inputValue(), "New A unsent draft");
    assert.equal(await input.evaluate((element) => element === document.activeElement), true);
    await finishRun();
    await capture("sending-finished-draft");
    report.checks.push("A-B-A navigation clears old Sending and isolates stale acknowledgements without replacing the newer composer draft");
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.equal(report.consoleErrors.every((message) => /Generated admission rejection|409|Failed to send message/.test(message)), true, "Only the deliberately rejected fixture reports an error");
    assert.equal(report.interceptedWrites.every((write) => write.path.includes("/lease") || ["prompt", "abort", "get_state"].includes(write.type)), true);
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error.stack ?? String(error);
    if (page && !page.isClosed()) {
      report.failurePage = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 9000), sending: document.querySelector('[data-sending="true"]')?.textContent })).catch(() => null);
      await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    }
    throw error;
  } finally {
    for (const request of pending) await request.finish().catch(() => {});
    await writeFile(artifact("results.json"), `${JSON.stringify(report, null, 2)}\n`);
    await browser?.close();
    console.log(JSON.stringify({ status: report.status, report: artifact("results.json"), checks: report.checks }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runSendingState();
