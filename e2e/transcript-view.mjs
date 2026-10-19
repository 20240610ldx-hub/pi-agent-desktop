import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";

export async function runTranscriptView() {
  const out = new URL(`../test-results/pilaude/transcript-view/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", checks: [], captures: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 950 }, reducedMotion: "reduce", serviceWorkers: "block" });
    await installActivityFixture(context, report);
    page = await context.newPage();
    page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const ready = async () => {
      await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
      await page.locator(".app-topbar-title-trigger").waitFor();
    };
    const choose = async (name, expectedChecked = null) => {
      await page.locator(".app-topbar-title-trigger").click();
      const root = page.locator(".dom-context-menu--conversation").first();
      await root.getByRole("menuitem", { name: "Transcript view", exact: true }).hover();
      const menu = page.getByRole("menu", { name: "Transcript view", exact: true });
      await menu.waitFor();
      const item = menu.getByRole("menuitemcheckbox", { name, exact: true });
      await item.waitFor();
      if (expectedChecked !== null) assert.equal(await item.getAttribute("aria-checked"), String(expectedChecked));
      await item.click();
    };
    const expanded = async (selector, expected) => {
      await page.waitForFunction(({ selector, expected }) => document.querySelector(selector)?.getAttribute("aria-expanded") === String(expected), { selector, expected });
    };
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await ready();
    await expanded(".process-details-trigger", false);
    await choose("Thinking", false);
    await expanded(".process-details-trigger", true);
    await expanded(".thinking-disclosure-toggle", true);
    await expanded(".tool-call-trigger", false);
    await page.getByText("Full stored reasoning at original block index two.", { exact: true }).waitFor();
    assert.deepEqual(report.thinkingRequests, [2]);
    report.checks.push("Thinking view opens the real process and deferred original reasoning block, leaving tool details folded");
    await page.locator(".thinking-disclosure-toggle").click();
    await expanded(".thinking-disclosure-toggle", false);
    await page.locator("textarea").first().fill("Unsaved view-mode draft");
    await choose("Verbose", false);
    await expanded(".thinking-disclosure-toggle", true);
    await expanded(".tool-call-trigger", true);
    await page.locator(".tool-call-body pre").filter({ hasText: "fixture-history-output" }).waitFor();
    assert.equal(await page.locator("textarea").first().inputValue(), "Unsaved view-mode draft");
    assert.deepEqual(report.thinkingRequests, [2], "Mode changes reuse the existing deferred cache");
    await page.locator(".tool-call-trigger").click();
    await expanded(".tool-call-trigger", false);
    await page.locator(".process-details-trigger").click();
    await expanded(".process-details-trigger", false);
    await page.locator(".process-details-trigger").click();
    await expanded(".tool-call-trigger", false);
    report.checks.push("Verbose opens tool source/results; subsequent manual toggles and cached thinking survive group collapse without replacing the draft");
    await page.getByRole("button", { name: "Activity fixture draft", exact: true }).first().click();
    await page.getByText("Other session answer.", { exact: true }).waitFor();
    await choose("Normal", true);
    await page.getByRole("button", { name: "Activity fixture activity", exact: true }).first().click();
    await ready();
    await expanded(".tool-call-trigger", true);
    assert.equal(await page.locator("textarea").first().inputValue(), "Unsaved view-mode draft");
    await page.reload({ waitUntil: "domcontentloaded" });
    await ready();
    await expanded(".tool-call-trigger", true);
    report.checks.push("Modes persist independently per conversation through session switches and reload");
    await page.screenshot({ path: artifact("verbose-light.png"), scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
    report.captures.push(artifact("verbose-light.png"));
    await choose("Normal", false);
    await expanded(".process-details-trigger", false);
    await page.locator(".process-details-trigger").click();
    await expanded(".thinking-disclosure-toggle", false);
    await expanded(".tool-call-trigger", false);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.externalRequests, []);
    assert.equal(report.interceptedWrites.some((request) => !request.path.includes("/lease") && !request.path.endsWith("/output-style")), false, "Transcript modes do not submit model or mutation requests");
    report.checks.push("Normal restores existing collapsed defaults without changing session data or sending a prompt");
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.error = error.stack ?? String(error);
    if (page && !page.isClosed()) {
      report.failurePage = await page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 9000), process: [...document.querySelectorAll('.process-details')].map((element) => ({ expanded: element.getAttribute('data-expanded'), text: element.textContent.slice(0, 500) })) })).catch(() => null);
      await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    }
    throw error;
  } finally {
    await writeFile(artifact("results.json"), `${JSON.stringify(report, null, 2)}\n`);
    await browser?.close();
    console.log(JSON.stringify({ status: report.status, report: artifact("results.json"), checks: report.checks }));
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runTranscriptView();
