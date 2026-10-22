import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "playwright/test";
import { createJiti } from "jiti";
import { installSidebarPinFixture, SIDEBAR_PIN_SESSIONS } from "./sidebar-pin-order.mjs";
const { workspacePopoutCopy } = await createJiti(import.meta.url).import("../lib/workspace-popout-copy.ts");

// Uses the existing preview. Real app handlers/React/storage; generated API data.
// No model, task, PTY, repository, account or native Windows window is created.
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const cwd = SIDEBAR_PIN_SESSIONS[0].cwd;
const oid = "a".repeat(40);
const files = ["src/first.ts", "src/retained.ts", "tests/check.ts"].map(path => ({ path, status: "modified", additions: 1, deletions: 1 }));
const patchFor = path => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,60 +1,60 @@\n${Array.from({ length: 60 }, (_, index) => index === 21 ? "-const before = 21;\n+const after = 21;" : ` const line${index + 1} = ${index + 1};`).join("\n")}\n`;
const out = new URL(`../test-results/pilaude/changes-window/run-${Date.now()}/`, import.meta.url);
await mkdir(out, { recursive: true });
const artifact = name => fileURLToPath(new URL(name, out));
const report = { status: "running", base, checks: [], measurements: [], captures: [], apiReads: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
let browser, mainPage;
let repositoryVersion = 1;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce", serviceWorkers: "block" });
  await installSidebarPinFixture(context, base, report);
  await context.route(`${base}/api/agent/a/lease`, route => route.fulfill({ json: { renewed: 1 } }));
  await context.route(`${base}/api/git/review?*`, route => {
    const params = new URL(route.request().url()).searchParams;
    report.apiReads.push(`/api/git/review?${params}`);
    const scope = params.get("scope") || "all";
    const comparisonId = `generated-${scope}-v${repositoryVersion}`;
    if (params.has("path")) return route.fulfill({ json: { comparisonId, path: params.get("path"), patch: patchFor(params.get("path")), supported: true } });
    return route.fulfill({ json: { repoRoot: cwd, currentBranch: "feature/window", headOid: "b".repeat(40), baseRef: "refs/heads/main", baseOid: "c".repeat(40), comparisonId, scope, refs: [{ name: "refs/heads/main", oid: "c".repeat(40) }], commits: [{ oid, subject: "Retained commit", authorName: "Generated", authoredAt: "2026-10-19" }], files, totals: { additions: 3, deletions: 3 }, large: false } });
  });
  context.on("page", page => {
    page.setDefaultTimeout(15000);
    page.on("pageerror", error => report.pageErrors.push(error.message));
    page.on("console", message => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
  });
  // Compile the independent route before measuring the source document: Next
  // may reload existing documents when a route is compiled for the first time.
  const warm = await context.newPage();
  await warm.goto(`${base}/changes?cwd=${encodeURIComponent(cwd)}`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await expect(warm.locator(".changes-diff-scroll")).toHaveAttribute("aria-busy", "false");
  await warm.close();
  const page = await context.newPage();
  mainPage = page;
  await page.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.getByText("Generated sidebar fixture ready.", { exact: true }).waitFor();
  const draft = page.locator(".chat-input-textarea").first();
  await draft.fill("Exact main draft 中文\nDo not send");
  await page.locator(".app-topbar").getByRole("button", { name: "Show Changes", exact: true }).click();
  const pane = page.locator("#workspace-pane-changes");
  await expect(pane.locator(".changes-diff-scroll")).toHaveAttribute("aria-busy", "false");
  await pane.getByRole("button", { name: /Retained commit/ }).click();
  await expect(pane.locator(".changes-commit-row.is-selected")).toContainText("Retained commit");
  const retained = pane.locator('.changes-tree-row').filter({ hasText: 'retained.ts' });
  await retained.click();
  const retainedSection = pane.locator('.changes-file[aria-label="src/retained.ts"]');
  await retainedSection.getByRole("button", { name: "Add feedback: New 22", exact: true }).click();
  const feedback = retainedSection.getByRole("textbox", { name: "Add feedback", exact: true });
  await feedback.fill("Unsent review 中文 = exact");
  const settings = pane.getByRole("button", { name: "Changes settings", exact: true });
  await settings.click();
  await page.getByRole("menuitemcheckbox", { name: "Side by side", exact: true }).click();
  await settings.click();
  await page.getByRole("menuitemcheckbox", { name: "Word wrap", exact: true }).click();
  await pane.locator(".changes-diff-scroll").evaluate(element => { element.scrollTop = 690; });
  const before = await pane.locator(".changes-diff-scroll").evaluate(element => element.scrollTop);
  await draft.evaluate(element => { window.__originalDraftNode = element; });
  const popPromise = context.waitForEvent("page");
  await pane.getByRole("button", { name: "Open in new browser tab", exact: true }).click();
  const popup = await popPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.locator(".changes-diff-scroll")).toHaveAttribute("aria-busy", "false", { timeout: 90000 });
  await expect(popup.locator('.changes-tree-row.is-selected')).toContainText("retained.ts");
  await expect(popup.locator('.changes-commit-row.is-selected')).toContainText("Retained commit");
  await expect(popup.locator('.changes-library-diff.is-split')).toHaveCount(3);
  await expect(popup.locator('.changes-library-diff.is-wrapped')).toHaveCount(0);
  await expect(popup.getByRole("textbox", { name: "Add feedback", exact: true })).toHaveValue("Unsent review 中文 = exact");
  const url = new URL(popup.url());
  assert.deepEqual([...url.searchParams.keys()].sort(), ["cwd", "targetId", "viewId"]);
  assert.match(url.searchParams.get("viewId"), /^[0-9a-f-]{36}$/);
  assert.equal(url.href.includes("retained.ts"), false);
  assert.equal(url.href.includes(oid), false);
  assert.equal(await popup.evaluate(() => window.opener), null);
  await expect.poll(() => popup.locator(".changes-diff-scroll").evaluate(element => element.scrollTop)).toBe(before);
  await expect(draft).toHaveValue("Exact main draft 中文\nDo not send");
  const draftIdentity = await draft.evaluate(element => ({ same: element === window.__originalDraftNode, remembered: Boolean(window.__originalDraftNode), originalConnected: window.__originalDraftNode?.isConnected, timeOrigin: performance.timeOrigin, href: location.href }));
  report.measurements.push({ draftIdentity });
  assert.equal(draftIdentity.same, true, JSON.stringify(draftIdentity));
  report.checks.push("Real pane toolbar opens same-origin browser tab with opaque ID, exact commit/file/sidebar/selection/feedback/split/wrap/scroll; original mounted draft stays exact");
  const box = await popup.locator(".changes-pane").evaluate(element => {
    const rect = selector => element.querySelector(selector)?.getBoundingClientRect().toJSON();
    const button = element.querySelector('.changes-header-actions button');
    return { viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio }, pane: element.getBoundingClientRect().toJSON(), header: rect('.changes-header'), sidebar: rect('.changes-sidebar'), diff: rect('.changes-diff-scroll'), button: button?.getBoundingClientRect().toJSON(), computed: { headerHeight: getComputedStyle(element.querySelector('.changes-header')).height } };
  });
  report.measurements.push(box);
  await popup.screenshot({ path: artifact("popout-commit-state.png") }); report.captures.push(artifact("popout-commit-state.png"));

  // Independent edits persist in this view without changing the original pane.
  await popup.locator(".changes-commits-heading").click();
  await popup.getByRole("button", { name: "Show files", exact: true }).click();
  await popup.getByRole("textbox", { name: "Add feedback", exact: true }).fill("After popout edit 中文");
  await popup.locator(".changes-diff-scroll").evaluate(element => { element.scrollTop = 930; });
  await popup.reload({ waitUntil: "domcontentloaded" });
  await expect(popup.locator(".changes-diff-scroll")).toHaveAttribute("aria-busy", "false");
  await expect(popup.locator(".changes-sidebar")).toHaveCount(0);
  await expect(popup.getByRole("textbox", { name: "Add feedback", exact: true })).toHaveValue("After popout edit 中文");
  await expect.poll(() => popup.locator(".changes-diff-scroll").evaluate(element => element.scrollTop)).toBe(930);
  await popup.getByRole("button", { name: "Show files", exact: true }).click();
  await expect(popup.locator(".changes-commits-heading")).toHaveAttribute("aria-expanded", "false");
  await expect(pane.locator(".changes-commits-heading")).toHaveAttribute("aria-expanded", "true");
  await expect(feedback).toHaveValue("Unsent review 中文 = exact");
  report.checks.push("Popout edits and reload restore independent sidebar/commits/feedback/scroll while original view and composer remain untouched");

  // Composition Escape must not dismiss unsent feedback.
  const popFeedback = popup.getByRole("textbox", { name: "Add feedback", exact: true });
  const consumed = await popFeedback.evaluate(element => {
    const event = new KeyboardEvent('keydown', { key: 'Escape', isComposing: true, keyCode: 229, bubbles: true, cancelable: true });
    element.dispatchEvent(event); return event.defaultPrevented;
  });
  assert.equal(consumed, false);
  await expect(popFeedback).toHaveValue("After popout edit 中文");
  await popFeedback.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, keyCode: 229, ctrlKey: true, bubbles: true, cancelable: true })));
  await expect(draft).toHaveValue("Exact main draft 中文\nDo not send");
  // Keep a separate reload target before successful delivery clears the comment.
  const staleViewId = await popup.evaluate(() => {
    const key = 'pi-changes-window-views-v1'; const entries = JSON.parse(localStorage.getItem(key));
    const current = entries.find(entry => entry.id === new URL(location.href).searchParams.get('viewId'));
    const id = crypto.randomUUID(); localStorage.setItem(key, JSON.stringify([...entries, { ...current, id }])); return id;
  });
  await popup.getByRole("button", { name: "Add to draft", exact: true }).click();
  await expect.poll(() => draft.inputValue()).toContain("After popout edit 中文");
  assert.ok((await draft.inputValue()).startsWith("Exact main draft 中文\nDo not send"));
  assert.equal((await draft.inputValue()).split('After popout edit 中文').length - 1, 1);
  const closed = popup.waitForEvent("close");
  await popup.locator(".changes-header-actions").getByRole("button", { name: "Close", exact: true }).click();
  await closed;
  await expect(draft).toBeVisible();
  assert.equal(await draft.evaluate(element => element === window.__originalDraftNode), true);
  await expect(pane.locator('.changes-commit-row.is-selected')).toContainText('Retained commit');
  await expect(pane.locator('.changes-tree-row.is-selected')).toContainText('retained.ts');
  report.checks.push("Composition guard preserves unsent feedback; explicit acknowledged Add to draft inserts into original draft once; closing only destroys popup");

  // Missing state must be explicit and leave a usable latest comparison.
  const missing = await context.newPage();
  const missingUrl = new URL('/changes', base); missingUrl.searchParams.set('cwd', cwd); missingUrl.searchParams.set('viewId', '31b2ff61-9167-42ca-b241-8f95792acdf4');
  await missing.goto(missingUrl.href, { waitUntil: 'domcontentloaded' });
  await expect(missing.getByRole('status').filter({ hasText: 'saved Changes view expired or is unavailable' })).toBeVisible();
  await expect(missing.locator('.changes-diff-scroll')).toHaveAttribute('aria-busy', 'false');
  await missing.screenshot({ path: artifact('missing-view-recovery.png') }); report.captures.push(artifact('missing-view-recovery.png'));
  await missing.close();
  report.checks.push("Unavailable state gives explicit recovery status and usable current comparison");
  // A file can keep its name while all revision coordinates have changed.
  repositoryVersion = 2;
  const changed = await context.newPage();
  const staleUrl = new URL(url); staleUrl.searchParams.set('viewId', staleViewId);
  await changed.goto(staleUrl.href, { waitUntil: 'domcontentloaded' });
  await expect(changed.locator('.changes-diff-scroll')).toHaveAttribute('aria-busy', 'false');
  await expect(changed.locator('.changes-feedback')).toHaveCount(0);
  await expect(changed.getByRole('status').filter({ hasText: 'comparison changed' })).toBeVisible();
  await expect(changed.getByRole('textbox', { name: 'Unbound feedback', exact: true })).toHaveValue('After popout edit 中文');
  await expect(changed.getByRole('button', { name: 'Add to draft', exact: true })).toHaveCount(0);
  await changed.locator('.changes-file[aria-label="src/retained.ts"]').getByRole('button', { name: 'Add feedback: New 22', exact: true }).click();
  await expect(changed.getByRole('textbox', { name: 'Add feedback', exact: true })).toHaveValue('After popout edit 中文');
  await expect(changed.getByRole('textbox', { name: 'Unbound feedback', exact: true })).toHaveCount(0);
  await changed.screenshot({ path: artifact('changed-comparison-feedback.png') }); report.captures.push(artifact('changed-comparison-feedback.png'));
  repositoryVersion = 3;
  await changed.getByRole('button', { name: 'Changes settings', exact: true }).click();
  await changed.getByRole('menuitem', { name: 'Refresh', exact: true }).click();
  await expect(changed.getByRole('textbox', { name: 'Unbound feedback', exact: true })).toHaveValue('After popout edit 中文');
  await expect(changed.getByRole('button', { name: 'Add to draft', exact: true })).toHaveCount(0);
  await changed.close();
  report.checks.push('A changed comparison never rebinds stale lines to a same-name path; unsent comment remains unbound and cannot submit');

  // Visiting A again must not re-address a window from the previous visit.
  const switchSession = async id => {
    const row = page.locator('.session-item-main').filter({ hasText: `Pin fixture ${id}` }).first();
    await row.click();
    await expect.poll(() => new URL(page.url()).searchParams.get('session')).toBe(id);
  };
  await switchSession('b');
  await switchSession('a');
  for (const key of ['Enter', 'Space']) {
    const open = pane.getByRole('button', { name: workspacePopoutCopy('en').tab, exact: true });
    await pane.getByRole('button', { name: 'Changes settings', exact: true }).focus();
    await page.keyboard.press('Tab');
    await expect(open).toBeFocused();
    const nextPage = context.waitForEvent('page');
    await page.keyboard.press(key);
    const next = await nextPage;
    await next.waitForLoadState('domcontentloaded');
    assert.notEqual(new URL(next.url()).searchParams.get('targetId'), url.searchParams.get('targetId'));
    await next.close();
  }
  report.checks.push('Tab reaches the popout button; Enter and Space open it; A to B to A gets a fresh feedback target');

  for (const locale of ['en', 'zh-CN', 'zh-TW']) {
    await page.evaluate(locale => localStorage.setItem('pi-locale', locale), locale);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByText('Generated sidebar fixture ready.', { exact: true }).waitFor();
    await expect(page.locator('html')).toHaveAttribute('lang', locale);
    const words = workspacePopoutCopy(locale);
    const changes = page.locator('#workspace-pane-changes');
    for (const id of ['files', 'changes']) {
      const toggle = page.locator(`.app-topbar [aria-controls="workspace-pane-${id}"]`);
      if (await toggle.getAttribute('aria-pressed') === 'false') await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    }
    const open = changes.getByRole('button', { name: words.tab, exact: true });
    await open.hover();
    await expect(page.getByRole('tooltip', { name: words.tab, exact: true })).toBeVisible();
    await page.screenshot({ path: artifact(`toolbar-${locale}.png`) }); report.captures.push(artifact(`toolbar-${locale}.png`));
    const unsupported = page.locator('#workspace-pane-files .workspace-pane-popout');
    await expect(unsupported).toHaveAttribute('aria-disabled', 'true');
    await unsupported.hover();
    await expect(page.getByRole('tooltip', { name: `${words.tab} · ${words.files}`, exact: true })).toBeVisible();
    await page.screenshot({ path: artifact(`disabled-files-${locale}.png`) }); report.captures.push(artifact(`disabled-files-${locale}.png`));
    report.measurements.push(await changes.evaluate(element => {
      const header = element.querySelector('.changes-header');
      const buttons = [...element.querySelectorAll('.changes-header-actions button')];
      const css = getComputedStyle(header);
      return { locale: document.documentElement.lang, header: header.getBoundingClientRect().toJSON(),
        padding: { top: css.paddingTop, right: css.paddingRight, bottom: css.paddingBottom, left: css.paddingLeft },
        buttons: buttons.map(button => { const rect = button.getBoundingClientRect(); const icon = button.querySelector('svg')?.getBoundingClientRect(); return { label: button.getAttribute('aria-label'), box: rect.toJSON(), iconInsets: icon && { left: icon.left - rect.left, top: icon.top - rect.top, right: rect.right - icon.right, bottom: rect.bottom - icon.bottom } }; }),
        gaps: buttons.slice(1).map((button, i) => button.getBoundingClientRect().left - buttons[i].getBoundingClientRect().right) };
    }));
  }
  report.checks.push('Three locales expose the exact shared browser-tab copy and Files disabled reason, with measured toolbar boxes and insets');
  assert.deepEqual(report.nonReadRequests, []);
  assert.deepEqual(report.externalRequests, []);
  assert.deepEqual(report.pageErrors, []);
  assert.deepEqual(report.consoleErrors, []);
  report.status = "passed";
} catch (error) {
  report.status = "failed"; report.failure = error.stack || String(error); throw error;
} finally {
  if (report.status === 'failed' && mainPage && !mainPage.isClosed()) {
    report.visibleSessionLabels = await mainPage.locator('.session-item-main').evaluateAll(elements => elements.map(element => ({ text: element.textContent, label: element.getAttribute('aria-label') })));
    await mainPage.screenshot({ path: artifact('failure-main.png') });
  }
  if (browser) await browser.close();
  await writeFile(artifact("results.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ status: report.status, report: artifact("results.json"), checks: report.checks, failure: report.failure }, null, 2));
}
