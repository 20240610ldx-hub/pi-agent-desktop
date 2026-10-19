import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const builtins = ["default", "proactive", "concise", "explanatory", "learning"].map((id) => ({ id, name: id, builtin: true }));

export async function runOutputStyleMenu() {
  const out = new URL(`../test-results/pilaude/output-style-menu/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], apiRequests: [], interceptedWrites: [], externalRequests: [], thinkingRequests: [], styleRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installActivityFixture(context, report);
    const selected = new Map([["activity", "default"], ["draft", "default"]]);
    const customStyles = [];
    let firstApplyFails = true;
    await context.route(`${base}/api/**`, async (route) => {
      const url = new URL(route.request().url());
      const match = /^\/api\/sessions\/([^/]+)\/output-style$/.exec(url.pathname);
      if (!match && url.pathname !== "/api/output-styles") return route.fallback();
      const method = route.request().method(), body = route.request().postDataJSON();
      report.styleRequests.push({ method, path: url.pathname, body });
      if (url.pathname === "/api/output-styles") {
        assert.equal(method, "POST", "Only explicit custom creation writes this fixture catalog");
        const style = { id: "custom:generated-style", name: body.name, instructions: body.instructions, builtin: false };
        customStyles.push(style);
        return route.fulfill({ json: { style } });
      }
      const sessionId = match[1];
      if (sessionId === "draft") return route.fulfill({ json: { supported: false, reason: "exact-system-prompt", selectedId: "default", styles: [] } });
      if (method === "PUT") {
        if (body.styleId.startsWith("custom:") && firstApplyFails) { firstApplyFails = false; return route.fulfill({ status: 503, json: { error: "Generated apply failure" } }); }
        selected.set(sessionId, body.styleId);
      }
      return route.fulfill({ json: { supported: true, selectedId: selected.get(sessionId), styles: [...builtins, ...customStyles] } });
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    const capture = async (name) => { await page.screenshot({ path: artifact(`${name}.png`), scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(artifact(`${name}.png`)); };
    const openStyleMenu = async () => {
      await page.locator(".app-topbar-title-trigger").click();
      await page.getByRole("menuitem", { name: "Output style", exact: true }).hover();
      await page.getByRole("menu", { name: "Output style", exact: true }).waitFor();
      return page.getByRole("menu", { name: "Output style", exact: true });
    };
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    await page.waitForFunction(() => Boolean(document.querySelector(".app-topbar-title-trigger")));
    let menu = await openStyleMenu();
    await menu.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).click();
    await page.waitForFunction(() => !document.querySelector('[role="menu"]'));
    menu = await openStyleMenu();
    assert.equal(await menu.getByRole("menuitemcheckbox", { name: "Concise", exact: true }).getAttribute("aria-checked"), "true");
    await capture("acknowledged-concise-menu");
    await menu.getByRole("menuitem", { name: "New style...", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "New output style", exact: true });
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.getByRole("button", { name: "Cancel", exact: true }).evaluate((element) => element === document.activeElement), true, "Initial reverse Tab stays inside the actual editor");
    await page.keyboard.press("Tab");
    assert.equal(await dialog.getByLabel("Name", { exact: true }).evaluate((element) => element === document.activeElement), true, "Native Tab cycles back to the first editor field");
    await dialog.getByLabel("Name", { exact: true }).fill("Generated clear style");
    await dialog.getByLabel("Instructions", { exact: true }).fill("Use plain language. Keep all existing task and permission boundaries.");
    await dialog.getByRole("button", { name: "Save and apply", exact: true }).click();
    await dialog.getByText("Generated apply failure", { exact: true }).waitFor();
    assert.equal(await dialog.getByLabel("Name", { exact: true }).inputValue(), "Generated clear style");
    assert.equal(customStyles.length, 1);
    await capture("saved-definition-apply-failure");
    await dialog.getByRole("button", { name: "Apply saved style", exact: true }).click();
    await dialog.waitFor({ state: "hidden" });
    menu = await openStyleMenu();
    assert.equal(await menu.getByRole("menuitemcheckbox", { name: "Generated clear style", exact: true }).getAttribute("aria-checked"), "true");
    assert.equal(customStyles.length, 1, "Apply retry did not create a duplicate definition");
    await capture("acknowledged-custom-menu");
    await page.keyboard.press("Escape");
    const contextToggle = page.getByRole("button", { name: "Context panel", exact: true });
    if (await contextToggle.getAttribute("aria-pressed") === "true") await contextToggle.click();
    const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
    if (await hideSidebar.isVisible()) await hideSidebar.click();
    for (const theme of ["light", "dark"]) {
      await page.evaluate((theme) => document.documentElement.classList.toggle("dark", theme === "dark"), theme);
      for (const width of [1300, 430]) {
        await page.setViewportSize({ width, height: 1000 });
        menu = await openStyleMenu();
        await menu.getByRole("menuitem", { name: "New style...", exact: true }).click();
        await dialog.waitFor();
        const measurement = await dialog.evaluate((element) => {
          const rect = element.getBoundingClientRect(), style = getComputedStyle(element);
          const first = element.querySelector("input").getBoundingClientRect();
          const target = document.elementFromPoint(first.x + first.width / 2, first.y + first.height / 2);
          return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, font: style.fontFamily, inputHit: target?.tagName, viewport: innerWidth };
        });
        assert.ok(measurement.x >= 0 && measurement.right <= width && measurement.y >= 0 && measurement.bottom <= 1000, "Editor fits viewport");
        assert.equal(measurement.inputHit, "INPUT", "Native editor field remains unobscured");
        report.measurements.push({ name: `${theme}-${width}-editor`, ...measurement });
        await capture(`${theme}-${width}-new-style-editor`);
        await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
      }
    }
    await page.setViewportSize({ width: 1300, height: 1000 });
    await page.goto(`${base}/?session=draft`, { waitUntil: "domcontentloaded" });
    await page.getByText("Other session answer.", { exact: true }).waitFor();
    menu = await openStyleMenu();
    assert.equal(await menu.getByRole("menuitemcheckbox").count(), 0, "Unsupported exact-prompt session has no invented checkmark");
    const disabled = menu.getByRole("menuitem", { name: "Default", exact: true });
    assert.equal(await disabled.isDisabled(), true);
    assert.match(await disabled.getAttribute("title"), /exact system prompt/);
    await capture("exact-system-prompt-unavailable");
    report.checks.push("Actual AppShell output-style submenu applies built-in and custom selection only after ACK; failed apply retains draft and retries the same saved definition; unsupported exact-prompt session is truthful; editor fits light/dark desktop/mobile with unobscured native fields.");
    assert.equal(report.styleRequests.filter((request) => request.path === "/api/output-styles").length, 1);
    assert.ok(report.styleRequests.every((request) => !request.body?.type), "No prompt or runtime command is sent");
    assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, ["Failed to load resource: the server responded with a status of 503 (Service Unavailable)"], "Only the deliberately intercepted apply failure logs a browser network error");
    report.expectedNetworkError = "One 503 from the intentionally failed custom-style apply request; user-visible error and retry were verified.";
    assert.ok(report.interceptedWrites.every((request) => request.path.endsWith("/lease")), "Only mock leases occur outside explicit intercepted style requests");
    report.status = "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally { await writeFile(artifact("results.json"), JSON.stringify(report, null, 2)); await browser?.close(); console.log(`Output style menu ${report.status}: ${artifact("results.json")}`); }
  return report;
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runOutputStyleMenu();
