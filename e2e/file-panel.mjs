import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

// overflow-anchor:none keeps the scrollY assertion about state preservation:
// with anchoring on, the text reflowing from a narrow split (~200px on Linux
// fonts) to full width legitimately shifts scrollY (120 → 83 in CI).
export const filePanelFixture = `<!doctype html><html><head><link rel="stylesheet" href="preview.css"></head><body style="margin:20px;min-height:2400px;overflow-anchor:none">
<label>Notes <input id="notes"></label>
<label>Filter <select id="filter"><option>All</option><option>Pending</option></select></label>
<p>HTML preview state must survive layout changes.</p>
<script>window.previewInstance = Math.random();</script></body></html>`;
// Loaded by relative path: proves the static preview is served from the file's
// directory rather than rendered from a detached srcDoc.
export const filePanelStylesheet = "#notes { outline: 3px solid rgb(1, 2, 3); }";

// Generated file data includes an inert application/json script. Preview opt-in
// checks sandbox capability without executing code or opening an external app.
export const fileToolbarFixture = Object.freeze({
  path: "D:/generated/activity-fixture/generated-toolbar-preview.html",
  content: '<!doctype html>\n<html><body><p>Generated toolbar preview.</p><script type="application/json">{"generated":true}</script></body></html>\n',
  patch: 'diff --git a/generated-toolbar-preview.html b/generated-toolbar-preview.html\n--- a/generated-toolbar-preview.html\n+++ b/generated-toolbar-preview.html\n@@ -1,2 +1,2 @@\n <!doctype html>\n-<html><body><p>Old generated preview.</p></body></html>\n+<html><body><p>Generated toolbar preview.</p><script type="application/json">{"generated":true}</script></body></html>\n',
});

/** Actual AppShell file viewer, generated API data and native resize controls. */
export async function runFileToolbarLayout() {
  const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
  const out = new URL(`../test-results/pilaude/file-toolbar-layout/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const downloadControl = process.env.E2E_FILE_TOOLBAR_DOWNLOAD_CONTROL === "1";
  const report = { status: "running", base, downloadControl, checks: [], captures: [], measurements: [], subchecks: [], downloadRequests: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, colorScheme: "light", reducedMotion: "reduce", acceptDownloads: true });
    const state = await installActivityFixture(context, report);
    state.messages = [{ role: "user", content: "Inspect the generated file toolbar.", timestamp: Date.UTC(2026, 9, 19) }, { role: "assistant", content: [{ type: "text", text: "[Open generated toolbar fixture](./generated-toolbar-preview.html)" }], provider: "generated", model: "generated", timestamp: Date.UTC(2026, 9, 19, 0, 0, 1), stopReason: "stop" }];
    state.entryIds = ["toolbar-user", "toolbar-answer"];
    await context.addInitScript(() => {
      if (window !== window.top) return;
      localStorage.setItem("pi-right-panel-width", "600"); sessionStorage.removeItem("pi-web:tab-open-session");
      window.__toolbarDownloadIntents = [];
      document.addEventListener("click", (event) => {
        const anchor = event.target instanceof Element ? event.target.closest("a[download]") : null;
        if (anchor) window.__toolbarDownloadIntents.push({ href: anchor.href, name: anchor.download, prevented: event.defaultPrevented });
      }, true);
    });
    await context.route("**/api/git/diff?*", (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.fallback();
      return route.fulfill({ json: { supported: true, status: "modified", patch: fileToolbarFixture.patch } });
    });
    await context.route("**/api/files/**", (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.fallback();
      const url = new URL(route.request().url());
      report.apiRequests.push({ method: route.request().method(), path: url.pathname + url.search });
      const type = url.searchParams.get("type");
      if (type === "list") return route.fulfill({ json: { entries: [] } });
      if (type === "serve") return route.fulfill({ contentType: "text/html", body: fileToolbarFixture.content, headers: { "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'none'" } });
      if (type === "download") return route.fulfill({ contentType: "text/html", body: fileToolbarFixture.content, headers: { "Content-Disposition": 'attachment; filename="generated-toolbar-preview.html"' } });
      if (type === "meta") return route.fulfill({ json: { size: Buffer.byteLength(fileToolbarFixture.content), isFile: true, isDir: false } });
      return route.fulfill({ json: { content: fileToolbarFixture.content, language: "html", size: Buffer.byteLength(fileToolbarFixture.content), nextOffset: Buffer.byteLength(fileToolbarFixture.content), truncated: false } });
    });
    if (downloadControl) await context.route(`${base}/generated-file-toolbar-download-control`, (route) => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.fallback();
      return route.fulfill({ contentType: "text/html", body: `<a href="/api/files/D%3A/generated/activity-fixture/generated-toolbar-preview.html?type=download&amp;sessionId=activity" download="generated-toolbar-preview.html">Generated download control</a>` });
    });
    context.on("request", (request) => { if (new URL(request.url()).searchParams.get("type") === "download") report.downloadRequests.push({ kind: "request", url: request.url(), method: request.method() }); });
    context.on("requestfailed", (request) => { if (new URL(request.url()).searchParams.get("type") === "download") report.downloadRequests.push({ kind: "requestfailed", url: request.url(), failure: request.failure() }); });
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByRole("link", { name: "Open generated toolbar fixture", exact: true }).click();
    const viewer = page.locator("#file-panel .file-viewer-shell").last();
    const toolbar = viewer.locator(".file-viewer-toolbar").first();
    await toolbar.getByRole("button", { name: "Preview", exact: true }).waitFor();
    await toolbar.getByRole("button", { name: "Diff", exact: true }).waitFor();
    const sidebarClose = page.getByRole("button", { name: "Hide sidebar", exact: true }); if (await sidebarClose.isVisible()) await sidebarClose.click();
    const treeToggle = page.locator('#file-panel .file-tree-toggle[aria-label="Hide file list"]'); if (await treeToggle.isVisible()) await treeToggle.click();
    const separator = page.locator('[data-resize-handle="right-panel"]');
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
      for (const target of [600, 480, 384, 300]) {
        await separator.press("Home");
        for (let width = 300; width < target; width += 12) await separator.press("ArrowLeft");
        for (const mode of ["Preview", "Source", "Diff"]) {
          await toolbar.getByRole("button", { name: mode, exact: true }).click();
          await page.evaluate(() => document.fonts.ready);
          await page.waitForFunction(() => document.getAnimations().every((animation) => animation.effect?.getComputedTiming().iterations === Infinity || animation.playState !== "running"));
          const measurement = await toolbar.evaluate((root) => {
          const box = (node) => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
          const rect = root.getBoundingClientRect(), rootStyle = getComputedStyle(root);
          const controls = root.querySelector(".file-viewer-controls"), controlStyle = getComputedStyle(controls);
          const path = root.querySelector(".file-viewer-path"), pathBox = box(path);
          const buttons = [...root.querySelectorAll("button")].map((button) => { const r = button.getBoundingClientRect(), style = getComputedStyle(button); const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return { label: button.getAttribute("aria-label") || button.textContent, ...box(button), fontSize: style.fontSize, lineHeight: style.lineHeight, padding: style.padding, nativeHit: hit === button || button.contains(hit), fits: r.x >= rect.x && r.right <= rect.right + 1 && r.y >= rect.y && r.bottom <= rect.bottom + 1 }; });
          return { viewport: innerWidth, panel: box(root.closest("#file-panel")), toolbar: box(root), scrollWidth: root.scrollWidth, toolbarGap: rootStyle.columnGap, toolbarPadding: rootStyle.padding, controls: box(controls), controlsGap: controlStyle.columnGap, controlsToToolbarWidth: controls.getBoundingClientRect().width / rect.width, buttons, adjacentButtonGaps: buttons.slice(1).map((button, index) => ({ after: buttons[index].label, before: button.label, horizontal: button.x - buttons[index].right, sameRow: Math.abs(button.y - buttons[index].y) <= 1 })), metadataVisible: getComputedStyle(root.querySelector(".file-viewer-meta")).display !== "none", path: pathBox, pathWidthRatio: pathBox.width / rect.width, pathTitle: path.getAttribute("title"), pathFontSize: getComputedStyle(path).fontSize, pathTextOverflow: getComputedStyle(path).textOverflow };
        });
          report.measurements.push({ theme, mode, requestedPaneWidth: target, ...measurement });
          if (mode === "Preview") {
            const capture = artifact(`toolbar-${theme}-${target}.png`); await page.screenshot({ path: capture, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(capture);
          }
        }
      }
    }
    for (const measurement of report.measurements) {
      assert.equal(measurement.viewport, 1500, "Only the pane changes width inside the wide viewport");
      assert.ok(Math.abs(measurement.panel.width - measurement.requestedPaneWidth) <= 1, "Native separator reaches the requested pane width");
      assert.ok(measurement.buttons.every((button) => button.fits && button.nativeHit), `${measurement.theme}/${measurement.requestedPaneWidth}: every file action remains inside its toolbar and has a real pointer target`);
      assert.ok(measurement.scrollWidth <= measurement.toolbar.width + 1, "Toolbar does not hide actions behind horizontal clipping");
      assert.ok(measurement.path.width >= 40, `${measurement.theme}/${measurement.requestedPaneWidth}/${measurement.mode}: path retains a readable allowance`);
      assert.equal(measurement.pathTitle, fileToolbarFixture.path, "Full file path remains available even when the label ellipsizes");
    }
    // Keep the UI behavior in the same real viewer after the width matrix.
    // The fixture's application/json script remains inert even after explicit opt-in.
    await page.evaluate(() => document.documentElement.classList.remove("dark"));
    const composer = page.locator(".chat-input-textarea").first();
    await composer.fill("Preserve generated toolbar draft.");
    const sourceButton = toolbar.getByRole("button", { name: "Source", exact: true });
    await sourceButton.click();
    assert.equal(await sourceButton.getAttribute("aria-pressed"), "true");
    const source = await viewer.locator(".file-source-line-content").allTextContents();
    assert.equal(source.join(""), fileToolbarFixture.content, "Source view preserves the exact generated file text");
    const diffButton = toolbar.getByRole("button", { name: "Diff", exact: true });
    await diffButton.click();
    assert.equal(await diffButton.getAttribute("aria-pressed"), "true");
    await toolbar.getByRole("button", { name: "Preview", exact: true }).click();
    const optIn = toolbar.getByRole("button", { name: "Run scripts", exact: true });
    assert.equal(await optIn.getAttribute("aria-pressed"), "false");
    assert.equal(await viewer.locator("iframe").getAttribute("sandbox"), "allow-same-origin");
    await optIn.click();
    assert.equal(await optIn.getAttribute("aria-pressed"), "true");
    assert.equal(await viewer.locator("iframe").getAttribute("sandbox"), "allow-scripts", "Opt-in retains isolated script capability without same-origin");
    await optIn.click();
    assert.equal(await viewer.locator("iframe").getAttribute("sandbox"), "allow-same-origin");
    assert.equal(await composer.inputValue(), "Preserve generated toolbar draft.", "Mode changes preserve the current draft");
    const mention = toolbar.locator(".file-viewer-actions .file-viewer-icon-button").first();
    await mention.click();
    assert.ok((await composer.inputValue()).includes("generated-toolbar-preview.html"));
    report.checks.push("24 mode/theme/pane samples retain visible paths and native file actions; source text, mode changes, sandbox gating, draft and mention checks pass");
    const failures = [];
    try {
      await sourceButton.focus(); await sourceButton.press("Enter");
      report.focusDebug = await sourceButton.evaluate((button) => ({ pressed: button.getAttribute("aria-pressed"), isActive: button === document.activeElement, activeElement: document.activeElement ? { tag: document.activeElement.tagName, id: document.activeElement.id, className: document.activeElement.className, label: document.activeElement.getAttribute("aria-label"), text: document.activeElement.textContent?.slice(0, 160) } : null }));
      assert.equal(report.focusDebug.pressed, "true");
      assert.equal(report.focusDebug.isActive, true, "Keyboard mode activation preserves button focus");
      report.subchecks.push({ name: "keyboard-focus", status: "passed" });
    } catch (error) { failures.push(error); report.subchecks.push({ name: "keyboard-focus", status: "failed", error: error.message }); }
    try {
      const downloadPromise = page.waitForEvent("download", { timeout: 10000 }).then((download) => ({ download }), (error) => ({ error }));
      await toolbar.getByRole("button", { name: "Download file", exact: true }).click();
      report.downloadDebug = await page.evaluate(() => ({ intents: window.__toolbarDownloadIntents, desktop: Boolean(window.__TAURI_INTERNALS__), buttons: [...document.querySelectorAll('.file-viewer-toolbar button')].map((button) => ({ text: button.textContent, label: button.getAttribute('aria-label'), disabled: button.disabled })), frames: [...document.querySelectorAll('iframe')].map((frame) => ({ sandbox: frame.sandbox.value, src: frame.src })) }));
      const event = await downloadPromise;
      if (event.error) throw event.error;
      const download = event.download;
      report.downloadDebug.result = { suggestedFilename: download.suggestedFilename(), url: download.url(), failure: await download.failure() };
      const downloaded = [];
      for await (const chunk of await download.createReadStream()) downloaded.push(chunk);
      assert.equal(Buffer.concat(downloaded).toString("utf8"), fileToolbarFixture.content, "Download uses the exact original file bytes");
      report.subchecks.push({ name: "real-download-exact-bytes", status: "passed" });
    } catch (error) { failures.push(error); report.subchecks.push({ name: "real-download-exact-bytes", status: "failed", error: error.message }); }
    if (downloadControl) {
      const controlPage = await context.newPage();
      controlPage.on("pageerror", (error) => report.pageErrors.push(error.message));
      try {
        await controlPage.goto(`${base}/generated-file-toolbar-download-control`, { waitUntil: "domcontentloaded" });
        const controlDownloadPromise = controlPage.waitForEvent("download", { timeout: 10000 }).then((download) => ({ download }), (error) => ({ error }));
        await controlPage.getByRole("link", { name: "Generated download control", exact: true }).click();
        const event = await controlDownloadPromise;
        if (event.error) throw event.error;
        const controlDownload = event.download;
        report.downloadControlResult = { url: controlDownload.url(), suggestedFilename: controlDownload.suggestedFilename(), failure: await controlDownload.failure() };
        const chunks = [];
        for await (const chunk of await controlDownload.createReadStream()) chunks.push(chunk);
        report.downloadControlResult.exactBytes = Buffer.concat(chunks).toString("utf8") === fileToolbarFixture.content;
        assert.equal(report.downloadControlResult.exactBytes, true, "Generated anchor control downloads the same exact fixture bytes");
        report.subchecks.push({ name: "independent-anchor-exact-bytes", status: "passed" });
      } catch (error) { failures.push(error); report.downloadControlResult = { ...report.downloadControlResult, error: error.message }; report.subchecks.push({ name: "independent-anchor-exact-bytes", status: "failed", error: error.message }); }
      finally { await controlPage.close(); }
    }
    try {
      assert.deepEqual(report.interceptedWrites, []); assert.deepEqual(report.externalRequests, []); assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []);
    } catch (error) { failures.push(error); report.subchecks.push({ name: "side-effects", status: "failed", error: error.message }); }
    if (failures.length) throw new AggregateError(failures, "One or more independent file toolbar checks failed");
    report.status = "passed";
  } catch (error) { report.status = "failed"; report.error = error.stack ?? String(error); throw error; }
  finally {
    try { await writeFile(artifact("report.json"), `${JSON.stringify(report, null, 2)}\n`); }
    finally { await browser?.close(); }
    console.log(JSON.stringify({ status: report.status, checks: report.checks, report: artifact("report.json") }));
  }
  return report;
}

export async function checkFilePanel(page, filePath) {
  const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
  if (await page.locator("#session-sidebar").evaluate((element) => element.classList.contains("sidebar-open"))) {
    await hideSidebar.click();
  }
  const panel = page.locator("#file-panel");
  const showPanel = page.viewportSize().width <= 640
    ? page.locator('.right-panel-toggle-button[aria-label="Show workspace"]')
    : page.locator('.app-topbar button[aria-label="Show workspace"]');
  const hidePanel = page.viewportSize().width <= 640
    ? page.locator('#file-panel [aria-label="Hide workspace"]')
    : page.locator('.app-topbar button[aria-label="Hide workspace"]');
  // The strip's own chip exists only while the topbar toggle is unreachable
  // (full-width desktop, and mobile where the floating toggle sits under the
  // panel), so closing from full width has to use it.
  const hidePanelInStrip = page.locator('#file-panel [aria-label="Hide workspace"]');
  await showPanel.click();
  await panel.waitFor({ state: "visible" });
  // The panel opens as a preview surface; the file list starts hidden.
  const showFileList = panel.locator('.file-tree-toggle[aria-label="Show file list"]');
  if (await showFileList.isVisible()) await showFileList.click();
  await panel.locator(`[role="button"][title="${filePath}"]`).click();
  const iframe = panel.locator("iframe");
  await iframe.waitFor();
  const frame = await (await iframe.elementHandle()).contentFrame();
  await frame.locator("#notes").waitFor();
  // Static preview: local CSS resolves, scripts stay off (sandbox + route CSP).
  assert.equal(await frame.locator("#notes").evaluate((el) => getComputedStyle(el).outlineColor), "rgb(1, 2, 3)");
  assert.equal(await frame.evaluate(() => window.previewInstance), undefined, "The static HTML preview must not run scripts");
  await frame.locator("#notes").fill("Keep this note");
  await frame.locator("#filter").selectOption({ label: "Pending" });
  await frame.evaluate(() => scrollTo(0, 120));
  const instance = await frame.evaluate(() => window.previewInstance);
  const width = () => panel.evaluate(async el => {
    await new Promise(requestAnimationFrame);
    await Promise.all(el.getAnimations().map(animation => animation.finished.catch(() => {})));
    return el.getBoundingClientRect().width;
  });
  const storedWidths = () => page.evaluate(() => [
    localStorage.getItem("pi-sidebar-width"), localStorage.getItem("pi-right-panel-width"),
  ]);
  const toggle = panel.getByRole("button", { name: "Expand panel to full width", exact: true });
  if (page.viewportSize().width <= 640) {
    assert.equal(await toggle.isVisible(), false, "Mobile already uses full width");
  } else {
    // Include a manually resized split in the round trip.
    const separator = page.locator('[data-resize-handle="right-panel"]');
    if (await separator.isVisible()) await separator.press("ArrowLeft");
    const originalWidth = await width();
    const originalStored = await storedWidths();
    // The fork keeps session stats in the topbar's More menu (upstream had a
    // dedicated "Session info" button); the strip's hide-panel chip is gone
    // too — the topbar panel toggle owns closing on desktop, the fixed
    // floating toggle on mobile.
    const moreTrigger = page.getByRole("button", { name: "More session actions", exact: true });
    const statsItem = page.locator(".app-topbar-more-menu .app-topbar-more-item").last();
    const sessionPopover = page.locator(".session-info-popover");
    const openSessionInfo = async () => {
      await moreTrigger.click();
      await statsItem.click();
      await sessionPopover.waitFor();
    };
    for (let i = 0; i < 2; i++) {
      await openSessionInfo();
      await toggle.click();
      assert.equal(await sessionPopover.count(), 0, "Full-width mode dismisses inert top-bar menus");
      assert.equal(await panel.getByRole("button", { name: "Restore panel width", exact: true }).getAttribute("aria-pressed"), "true");
      assert.equal(Math.round(await width()), page.viewportSize().width);
      assert.equal(await page.locator("#session-sidebar").evaluate(el => el.inert), true);
      assert.equal(await frame.evaluate(() => window.previewInstance), instance);
      assert.equal(await frame.evaluate(() => scrollY), 120);
      assert.equal(await frame.locator("#notes").inputValue(), "Keep this note");
      assert.equal(await frame.locator("#filter").inputValue(), "Pending");
      await panel.getByRole("button", { name: "Restore panel width", exact: true }).press("Enter");
      assert.equal(await width(), originalWidth);
      assert.deepEqual(await storedWidths(), originalStored);
      assert.equal(await page.locator("#session-sidebar").evaluate(el => el.inert), false);
    }
    await toggle.click();
    await hidePanelInStrip.click();
    await showPanel.click();
    assert.equal(await toggle.getAttribute("aria-pressed"), "false", "Reopening returns to the split layout");
    assert.equal(await width(), originalWidth);
    assert.equal(await frame.evaluate(() => window.previewInstance), instance);
  }
  // Opting into scripts swaps to an isolated srcDoc sandbox where they run.
  const runScripts = panel.getByRole("button", { name: "Run scripts", exact: true });
  await runScripts.click();
  assert.equal(await runScripts.getAttribute("aria-pressed"), "true");
  const scriptedFrame = await (await panel.locator("iframe[srcdoc]").elementHandle()).contentFrame();
  await scriptedFrame.waitForFunction(() => typeof window.previewInstance === "number");
  await runScripts.click();
  await panel.locator("iframe:not([srcdoc])").waitFor();
  await hidePanel.click();
  console.log(`PASS: file panel width and preview state at ${page.viewportSize().width}px`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runFileToolbarLayout();
