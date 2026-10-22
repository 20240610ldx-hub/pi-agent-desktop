import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium, expect } from "playwright/test";

// Public /changes consumer with generated Git HTTP responses and deferred patch.
const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const out = new URL(`../test-results/pilaude/changes-window-restore/run-${Date.now()}/`, import.meta.url);
await mkdir(out, { recursive: true });
const artifact = name => fileURLToPath(new URL(name, out));
const id = '31b2ff61-9167-42ca-b241-8f95792acdf4';
const cwd = 'D:/generated/window-restore';
const files = ['src/first.ts', 'src/second.ts'].map(path => ({ path, status: 'modified', additions: 1, deletions: 1 }));
const patch = path => `diff --git a/${path} b/${path}\n--- a/${path}\n+++ b/${path}\n@@ -1,90 +1,90 @@\n${Array.from({ length: 90 }, (_, index) => index === 10 ? '-old\n+new' : ` line ${index + 1}`).join('\n')}\n`;
const report = { status: 'running', checks: [], offsets: {}, pageErrors: [], consoleErrors: [], nonReadRequests: [], externalRequests: [] };
let browser;
try {
  browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
  let release;
  const delayed = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== base) { report.externalRequests.push(url.href); return route.fulfill({ body: '' }); }
    if (!url.pathname.startsWith('/api/')) return route.continue();
    if (!['GET', 'HEAD'].includes(request.method())) { report.nonReadRequests.push(url.pathname); return route.fulfill({ status: 409, json: {} }); }
    if (url.pathname !== '/api/git/review') return route.fulfill({ json: {} });
    const path = url.searchParams.get('path');
    if (path) {
      if (path === files[0].path) await delayed;
      return route.fulfill({ json: { comparisonId: 'same-comparison', path, patch: patch(path), supported: true } });
    }
    return route.fulfill({ json: { repoRoot: cwd, currentBranch: 'feature', headOid: 'a'.repeat(40), baseRef: 'refs/heads/main', baseOid: 'b'.repeat(40), comparisonId: 'same-comparison', scope: 'all', refs: [], commits: [], files, totals: { additions: 2, deletions: 2 }, large: false } });
  });
  await context.addInitScript(({ id, cwd }) => {
    if (window.top !== window || !/^https?:$/.test(location.protocol)) return;
    localStorage.setItem('pi-locale', 'en');
    localStorage.setItem('pi-changes-window-views-v1', JSON.stringify([{ id, cwd, updatedAt: Date.now(), state: { version: 1, comparisonId: 'same-comparison', scope: 'all', openPaths: ['src/second.ts'], selectedPath: 'src/second.ts', scrollTop: 600 } }]));
  }, { id, cwd });
  const page = await context.newPage(); page.on('pageerror', error => report.pageErrors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') report.consoleErrors.push(message.text()); });
  await page.goto(`${base}/changes?cwd=${encodeURIComponent(cwd)}&viewId=${id}`, { waitUntil: 'domcontentloaded', timeout: 90000 });
  await expect(page.locator('.changes-diff-scroll')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.changes-library-diff')).toHaveCount(1);
  await expect.poll(() => page.locator('.changes-diff-scroll').evaluate(element => element.scrollTop)).toBe(600);
  await page.locator('.changes-tree-row').filter({ hasText: 'first.ts' }).click();
  await expect.poll(() => page.locator('.changes-diff-scroll').evaluate(element => element.scrollTop)).toBe(0);
  report.offsets.afterSidebar = await page.locator('.changes-diff-scroll').evaluate(element => element.scrollTop);
  release();
  await expect(page.locator('.changes-library-diff')).toHaveCount(2);
  await expect.poll(() => page.locator('.changes-diff-scroll').evaluate(element => element.scrollTop)).toBe(0);
  report.offsets.afterDelayedPatch = await page.locator('.changes-diff-scroll').evaluate(element => element.scrollTop);
  report.checks.push('Sidebar file navigation cancels saved scroll restoration before a delayed patch changes content height');
  await page.screenshot({ path: artifact('sidebar-intent-after-late-patch.png') });
  assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.nonReadRequests, []); assert.deepEqual(report.externalRequests, []);
  report.status = 'passed';
} catch (error) { report.status = 'failed'; report.failure = error.stack || String(error); throw error; }
finally { if (browser) await browser.close(); await writeFile(artifact('results.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ status: report.status, report: artifact('results.json'), failure: report.failure }, null, 2)); }
