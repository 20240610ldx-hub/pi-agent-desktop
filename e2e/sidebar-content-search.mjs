import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium, expect } from "playwright/test";
import { installSidebarPinFixture, SIDEBAR_PIN_METADATA_KEY, SIDEBAR_PIN_SESSIONS } from "./sidebar-pin-order.mjs";

const query = "content-only-quartz-needle";

/** Public search field -> Enter -> API query -> rendered matching excerpt. */
export async function checkSidebarContentSearch(page, base, report) {
  page.setDefaultTimeout(10000);
  await page.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.locator(".sidebar-project-tree-group .session-item-main").first().waitFor();
  assert.equal(SIDEBAR_PIN_SESSIONS.some((session) => `${session.name} ${session.firstMessage}`.includes(query)), false, "Content query is absent from every title and first message");
  const search = page.locator(".sidebar-search-input");
  await search.fill(query);
  await expect(page.locator(".sidebar-project-tree-empty")).toContainText("No sessions match your search");
  assert.equal(report.searchRequests.length, 0, "Title filtering does not request content search");
  await search.press("Enter");
  await expect.poll(() => report.searchRequests, { timeout: 5000, message: "Enter requests content search even when no project title matches" }).toEqual([query]);
  const result = page.locator(".session-sidebar button").filter({ has: page.locator("mark", { hasText: query }) });
  await expect(result).toBeVisible();
  await expect(result).toContainText("Pin fixture a");
  await expect(result).toContainText("Saved assistant content");
  report.checks.push("No title matches keeps the ordinary empty text; Enter requests unique content query and displays the matching session/excerpt");
  await search.press("Escape");
  await expect(result).toHaveCount(0);
  // Native search fields may clear on Escape; type again to verify title mode.
  await search.fill(query);
  await expect(page.locator(".sidebar-project-tree-empty")).toContainText("No sessions match your search");
  await search.fill("");
  await expect(page.locator(".sidebar-project-tree-group .session-item-main").first()).toBeVisible();
  report.checks.push("Escape restores the title-filter empty state; clearing restores project rows");
}

/** Start pilaude-ui-verification via preview_start on 30142, then run this file. */
export async function runSidebarContentSearch() {
  const base = "http://127.0.0.1:30142";
  const out = new URL(`../test-results/pilaude/sidebar-content-search/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", checks: [], apiReads: [], searchRequests: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1100 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installSidebarPinFixture(context, base, report);
    await context.addInitScript((key) => { localStorage.setItem(key, JSON.stringify({ version: 1, pinnedIds: [], archivedIds: [], groups: [], memberships: [] })); }, SIDEBAR_PIN_METADATA_KEY);
    await context.route("**/api/sessions/search?*", async (route) => {
      const url = new URL(route.request().url());
      report.searchRequests.push(url.searchParams.get("q"));
      return route.fulfill({ json: { results: [{ session: SIDEBAR_PIN_SESSIONS[0], before: "Saved assistant content ", match: query, after: " found", entryId: "answer" }], truncated: false } });
    });
    page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await checkSidebarContentSearch(page, base, report);
    assert.deepEqual(report.pageErrors, []);
    assert.deepEqual(report.consoleErrors, []);
    assert.deepEqual(report.nonReadRequests, []);
    assert.deepEqual(report.externalRequests, []);
    report.status = "passed";
    await page.screenshot({ path: artifact("passed.png"), scale: "css" });
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(`Sidebar content search ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runSidebarContentSearch();
