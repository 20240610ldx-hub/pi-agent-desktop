import assert from "node:assert/strict";
import { chromium, expect } from "playwright/test";

// Standalone regression for Changes portal focus. Uses an already-running app;
// never starts Next, creates a session, sends a model prompt, or mutates Git.
// E2E_PROJECT=/absolute/git/project node e2e/changes-focus.mjs
// The project may also be supplied as the first positional argument.
const baseUrl = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const project = process.env.E2E_PROJECT || process.argv[2];
if (!project) throw new Error("Set E2E_PROJECT or pass an absolute Git project path already allowed by the app. This focus regression cannot run without a real Git fixture.");
const origin = new URL(baseUrl);
const api = new URL("/api/git/review", origin);
api.searchParams.set("cwd", project);
const response = await fetch(api);
const snapshot = await response.json();
assert.equal(response.status, 200, `Project must be an allowed Git repository: ${snapshot.error || response.status}`);
assert.ok(snapshot.comparisonId, "Git review snapshot is required; this check does not report a fixture error as passing");
const report = { status: "running", checks: [], conditions: { large: snapshot.large, files: snapshot.files.length }, errors: [], blockedWrites: [] };
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1000, height: 760 }, reducedMotion: "reduce" });
  await context.route("**/api/**", route => {
    const request = route.request();
    if (["GET", "HEAD"].includes(request.method())) return route.continue();
    report.blockedWrites.push({ path: new URL(request.url()).pathname, method: request.method() });
    return route.fulfill({ status: 409, json: { error: "Standalone focus regression permits read-only API requests." } });
  });
  await context.addInitScript(() => localStorage.setItem("pi-locale", "en"));
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => report.errors.push(error.message));
  const url = new URL("/changes", origin);
  url.searchParams.set("cwd", project);
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 60000 });
  const pane = page.locator(".changes-pane");
  await pane.waitFor({ timeout: 60000 });
  await expect(pane.locator(".changes-diff-scroll")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  await expect(pane.locator(".changes-state.is-error")).toHaveCount(0);
  const trigger = pane.getByRole("button", { name: "Changes settings", exact: true });
  const menu = page.getByRole("menu", { name: "Changes settings", exact: true });
  for (let index = 0; index < 3; index++) {
    await trigger.click();
    const first = menu.getByRole("menuitemcheckbox").first();
    await expect(first).toBeFocused();
    assert.equal(await first.evaluate(element => getComputedStyle(element).visibility), "visible");
    await page.keyboard.press("End");
    const last = menu.getByRole("menuitem", { name: "Refresh", exact: true });
    await expect(last).toBeFocused();
    await page.setViewportSize({ width: 980 + index, height: 760 });
    await expect(last).toBeFocused();
    for (let move = 0; move < 12; move++) {
      await page.keyboard.press("ArrowUp");
      assert.equal(await page.evaluate(() => document.activeElement?.matches(':disabled, [aria-disabled="true"]') ?? false), false, "Roving focus must skip disabled items");
    }
    await page.keyboard.press("Home");
    await expect(first).toBeFocused();
    const ime = await first.evaluate(element => {
      const event = new KeyboardEvent("keydown", { key: "Escape", isComposing: true, bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return { prevented: event.defaultPrevented, active: document.activeElement === element };
    });
    assert.equal(ime.prevented, false);
    assert.equal(ime.active, true);
    await expect(menu).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
    await trigger.click();
    await expect(menu.getByRole("menuitemcheckbox").first()).toBeFocused();
    await page.keyboard.press(index % 2 ? "Shift+Tab" : "Tab");
    await expect(menu).toHaveCount(0);
    assert.equal(await trigger.evaluate(element => document.activeElement === element), false, "Tab exits without restoring the trigger");
  }
  report.checks.push("Three real menu opens focus the visible first item, Home/End stay within enabled items, resize preserves current focus, IME Escape is untouched, Escape restores the trigger, and Tab/Shift+Tab exit");
  if (snapshot.large) {
    await trigger.click();
    await expect(menu.getByRole("menuitem", { name: "Expand all files", exact: true })).toBeDisabled();
    await page.keyboard.press("End");
    await page.keyboard.press("ArrowUp");
    assert.equal(await page.evaluate(() => document.activeElement?.matches(":disabled") ?? false), false);
    await page.keyboard.press("Escape");
    report.checks.push("Large fixture exposes the real disabled Expand all item and it is skipped by keyboard focus");
  } else report.conditions.disabledExpandAll = "Not exercised: supply a large comparison fixture to expose disabled Expand all";
  await trigger.click();
  await expect(menu.getByRole("menuitemcheckbox").first()).toBeFocused();
  await pane.getByRole("button", { name: "Go to file", exact: true }).focus();
  await expect(menu).toHaveCount(0);
  await expect(pane.getByRole("button", { name: "Go to file", exact: true })).toBeFocused();
  report.checks.push("Outside focus dismisses the menu without taking focus back");
  assert.deepEqual(report.blockedWrites, []);
  assert.deepEqual(report.errors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed";
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  console.log(JSON.stringify(report, null, 2));
}
