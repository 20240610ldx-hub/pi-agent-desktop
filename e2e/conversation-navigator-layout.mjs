import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installSidebarPinFixture, SIDEBAR_PIN_SESSIONS } from "./sidebar-pin-order.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const session = SIDEBAR_PIN_SESSIONS[0];
const turnCount = 36;
const chapterSpecs = [
  { turn: 0, title: "Codebase exploration" },
  { turn: 0, title: "Implementation strategy" },
  { turn: 3, title: "Fixture preparation" },
  { turn: 6, title: "Regression verification" },
  { turn: 9, title: "Layout correction" },
  { turn: 12, title: "Keyboard interactions" },
  { turn: 15, title: "History navigation" },
  { turn: 18, title: "Hidden chat restore" },
  { turn: 21, title: "Responsive measurements" },
  { turn: 24, title: "Regression verification" },
  { turn: 27, title: "Accessibility checks" },
  { turn: 30, title: "Final review with a deliberately long authored chapter title for bounded directory ellipsis and width verification" },
].map((chapter, index) => ({ ...chapter, chapterId: `generated-chapter-${index + 1}` }));
const messages = [], entryIds = [];
const append = (message, entryId) => { messages.push(message); entryIds.push(entryId); };
for (let index = 0; index < turnCount; index++) {
  append({ role: "user", content: `Navigation question ${index + 1}\nGenerated real user turn. **User bold text is not a chapter**`, timestamp: 1000 + index * 2000 }, `user-${index}`);
  for (const chapter of chapterSpecs.filter((item) => item.turn === index)) {
    append({ role: "custom", customType: "pi-web:chapter", content: chapter.title, display: true, details: { version: 1, chapterId: chapter.chapterId, title: chapter.title }, timestamp: 1100 + index * 2000 }, `entry-${chapter.chapterId}`);
    append({ role: "assistant", content: [{ type: "text", text: `Generated work for ${chapter.chapterId}.\n\n${"Generated phase paragraph.\n\n".repeat(3)}` }], timestamp: 1200 + index * 2000, stopReason: "stop", provider: "generated", model: "generated" }, `work-${chapter.chapterId}`);
  }
  append({ role: "assistant", content: [{ type: "text", text: `Navigation answer ${index + 1}\n\n**Ordinary assistant emphasis is not a chapter**\n\n## Ordinary assistant heading is not a chapter\n\n${"Generated paragraph for transcript scrolling.\n\n".repeat(5)}\`\`\`js\nconst answer = ${index + 1};\n\`\`\`` }], timestamp: 2000 + index * 2000, stopReason: "stop", provider: "generated", model: "generated" }, `answer-${index}`);
}

async function installNavigationFixture(context, report) {
  // Reuse the app-level API/SSE boundary fixture; the real React tree, layout,
  // scrolling, draft store and navigation handlers run unchanged.
  await installSidebarPinFixture(context, base, report);
  await context.addInitScript(() => {
    window.__navigationSources = [];
    window.EventSource = class extends EventTarget {
      constructor(url) { super(); this.url = String(url); this.readyState = 1; window.__navigationSources.push(this); }
      close() { this.readyState = 2; }
      static CONNECTING = 0; static OPEN = 1; static CLOSED = 2;
    };
    window.__emitNavigationEvent = (event) => {
      for (const source of window.__navigationSources) {
        if (source.readyState === 1 && /\/api\/agent\/a\/events/.test(source.url)) source.onmessage?.(new MessageEvent('message', { data: JSON.stringify(event) }));
      }
    };
  });
  await context.route(`${base}/api/agent/a/lease`, (route) => route.request().method() === 'POST' ? route.fulfill({ json: { renewed: 1 } }) : route.fallback());
  await context.route(`${base}/api/sessions/*/output-style`, (route) => route.request().method() === 'GET' ? route.fulfill({ json: { supported: false, reason: 'unavailable', selectedId: 'default', styles: [] } }) : route.fallback());
  await context.route(`${base}/api/sessions/a?*`, (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    report.apiReads.push(new URL(route.request().url()).pathname + new URL(route.request().url()).search);
    return route.fulfill({ json: {
      info: session, sessionId: session.id, filePath: session.path, leafId: "answer-35", tree: [], treeFormat: "summary", snapshotRevision: "navigation-layout-v1", totalActiveMs: 0,
      context: { messages, entryIds, oldestEntryId: "user-0", hasMore: false, model: null, thinkingLevel: "off" },
      stats: { totalMessages: messages.length, userMessages: turnCount, assistantMessages: turnCount, toolCalls: 0, toolResults: 0, tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }, cost: 0, costBreakdown: [] },
    } });
  });
}

async function measureNavigation(page, name, report) {
  const geometry = await page.evaluate(() => {
    const rect = (element) => element?.getBoundingClientRect().toJSON();
    const track = document.querySelector(".conversation-navigator-track");
    const rail = track.closest(".conversation-navigator");
    const scroll = document.querySelector(".chat-scroll-container");
    const composer = document.querySelector(".chat-composer");
    const transcript = document.querySelector('.chat-transcript-column');
    const directory = document.querySelector('.conversation-navigator-directory');
    const directoryStyle = directory && getComputedStyle(directory);
    const middle = document.querySelector('.chat-window');
    const center = (element) => { const box = element.getBoundingClientRect(); return box.left + box.width / 2; };
    const trackBox = track.getBoundingClientRect();
    const row = directory && Array.from(directory.querySelectorAll('.conversation-navigator-row')).find((element) => { const box = element.getBoundingClientRect(), panel = directory.getBoundingClientRect(); return box.top >= panel.top && box.bottom <= panel.bottom; });
    const rowBox = row?.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
      region: rect(rail.parentElement), middle: rect(middle), sidebar: rect(document.querySelector('.app-sidebar')), rightPanel: rect(document.querySelector('.right-panel-container')), track: rect(track), transcript: rect(transcript), scroll: rect(scroll), composer: rect(composer),
      transcriptCenterOffset: center(transcript) - center(middle), composerCenterOffset: center(composer) - center(middle), transcriptComposerOffset: center(transcript) - center(composer),
      directory: rect(directory), directoryStyle: directoryStyle && { width: directoryStyle.width, minWidth: directoryStyle.minWidth, maxWidth: directoryStyle.maxWidth, inlineWidth: directory.style.width },
      trackCenterHit: track.contains(document.elementFromPoint(trackBox.left + trackBox.width / 2, trackBox.top + Math.min(trackBox.height, 24) / 2)),
      directoryRowCenterHit: rowBox ? row.contains(document.elementFromPoint(rowBox.left + rowBox.width / 2, rowBox.top + rowBox.height / 2)) : null,
      visible: getComputedStyle(rail).display !== "none", scrollTop: scroll.scrollTop,
    };
  });
  report.measurements.push({ name, ...geometry });
  return geometry;
}

function assertNavigationGutter(geometry, name) {
  const { track, region, transcript, visible } = geometry;
  assert.equal(visible, true, `${name}: navigation remains reachable`);
  assert.ok(track.top - region.top >= 0 && track.top - region.top <= 32, `${name}: rail belongs to the top-left of the transcript, measured top inset ${track.top - region.top}`);
  assert.ok(Math.abs(track.left - region.left - 12) <= 0.6, `${name}: rail stays at the left chat edge`);
  assert.ok(transcript.left - track.right >= 23.4, `${name}: a fixed minimum 24px gutter separates the entire rail hit target from the transcript (measured ${transcript.left - track.right})`);
  assert.ok(transcript.right <= geometry.scroll.right + 0.6, `${name}: transcript stays within its own scrollport`);
}

export async function runConversationNavigatorLayout() {
  const out = new URL(`../test-results/pilaude/conversation-navigator-layout/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, measurements: [], checks: [], captures: [], apiReads: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 900 }, colorScheme: "light", reducedMotion: "reduce", serviceWorkers: "block" });
    await installNavigationFixture(context, report);
    page = await context.newPage();
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    page.setDefaultTimeout(15000);
    await page.goto(`${base}/?session=a`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText(`Navigation answer ${turnCount}`, { exact: true }).waitFor();
    const capture = async (name) => {
      const path = artifact(`${name}.png`);
      await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" });
      report.captures.push(path);
    };
    const settle = () => page.evaluate(async () => {
      const nextLayout = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      await nextLayout();
      await Promise.all(document.getAnimations().filter((animation) => Number.isFinite(animation.effect?.getComputedTiming().endTime)).map((animation) => animation.finished.catch(() => {})));
      await nextLayout();
    });
    let topInset;
    const checkLayout = async (name) => {
      await settle();
      const geometry = await measureNavigation(page, name, report);
      assertNavigationGutter(geometry, name);
      assert.ok(Math.abs(geometry.transcriptCenterOffset) <= 1, `${name}: transcript centers within the actual middle column (${geometry.transcriptCenterOffset}px)`);
      assert.ok(Math.abs(geometry.composerCenterOffset) <= 1, `${name}: composer centers within the actual middle column (${geometry.composerCenterOffset}px)`);
      assert.ok(Math.abs(geometry.transcriptComposerOffset) <= 1, `${name}: transcript and composer share an axis`);
      const inset = geometry.track.top - geometry.region.top;
      topInset ??= inset;
      assert.ok(Math.abs(inset - topInset) <= 0.6, `${name}: changing viewport height or adjacent panels preserves the same top inset`);
      return geometry;
    };
    if (process.env.E2E_NAV_LAYOUT_BASELINE === '1') {
      const contextToggle = page.getByRole('button', { name: 'Context panel', exact: true });
      if (await contextToggle.getAttribute('aria-pressed') === 'true') await contextToggle.click();
      await page.setViewportSize({ width: 2000, height: 1200 });
      const sample = async (name) => {
        await settle();
        const dock = page.getByRole('button', { name: 'Context panel', exact: true });
        if (await dock.getAttribute('aria-pressed') === 'true') await dock.click();
        await page.locator('.pilaude-context-dock').waitFor({ state: 'hidden' });
        await settle();
        await page.locator('.chat-input-textarea').hover(); await page.locator('.chat-input-textarea').focus();
        await page.locator('.conversation-navigator-directory').waitFor({ state: 'hidden' });
        const closed = await measureNavigation(page, `${name}-closed`, { measurements: [] });
        await page.getByRole('button', { name: 'Conversation navigation', exact: true }).click();
        await page.locator('.conversation-navigator-directory').waitFor(); await settle();
        const geometry = await measureNavigation(page, name, report); geometry.closedTrackCenterHit = closed.trackCenterHit; report.measurements.at(-1).closedTrackCenterHit = closed.trackCenterHit; await capture(name);
        await page.keyboard.press('Escape'); await textareaFallbackFocus();
        return geometry;
      };
      const textareaFallbackFocus = () => page.locator('.chat-input-textarea').focus();
      const separator = page.locator('[data-resize-handle="sidebar"]');
      await separator.focus(); await separator.press('Home');
      await sample('baseline-left-min');
      await separator.focus(); await separator.press('End');
      await sample('baseline-left-max');
      await page.getByRole('button', { name: 'Show Files', exact: true }).click();
      await page.locator('#workspace-pane-files').waitFor({ state: 'visible' });
      const rightSeparator = page.locator('[data-resize-handle="right-panel"]');
      await rightSeparator.focus(); await rightSeparator.press('Home');
      await sample('baseline-right-min');
      await rightSeparator.focus(); await rightSeparator.press('End');
      await sample('baseline-right-max');
      for (const geometry of report.measurements) {
        assert.ok(Math.abs(geometry.transcriptCenterOffset) <= 1, `${geometry.name}: transcript center offset ${geometry.transcriptCenterOffset}px from actual middle column`);
        assert.ok(Math.abs(geometry.composerCenterOffset) <= 1, `${geometry.name}: composer center offset ${geometry.composerCenterOffset}px from actual middle column`);
        assert.ok(Math.abs(geometry.transcriptComposerOffset) <= 1, `${geometry.name}: composer follows the transcript axis`);
        assert.ok(Math.abs(geometry.directory.width - 256) <= 0.6, `${geometry.name}: directory uses the chosen fixed 256px width`);
        assert.equal(geometry.closedTrackCenterHit, true, `${geometry.name}: native rail center is reachable when the directory is closed`);
        assert.equal(geometry.directoryRowCenterHit, true, `${geometry.name}: the open chapter directory has an unobstructed native row center`);
        assertNavigationGutter(geometry, geometry.name);
      }
      assert.ok(report.measurements[1].sidebar.width > report.measurements[0].sidebar.width + 200, 'Native sidebar resize changes the real left column');
      assert.ok(report.measurements[3].rightPanel.width > report.measurements[2].rightPanel.width + 200, 'Native panel resize changes the real right column');
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.nonReadRequests, []); assert.deepEqual(report.externalRequests, []);
      report.checks.push('Fixed 256px directory and centered transcript/composer across native left/right panel resize extremes');
      report.status = 'passed';
      return report;
    }
    await checkLayout("desktop-initial");
    await capture("desktop-initial");
    report.checks.push("Navigation starts at the top-left with a reserved 24px transcript gutter");

    const track = page.getByRole("button", { name: "Conversation navigation", exact: true });
    const directory = page.locator(".conversation-navigator-directory");
    const openDirectory = async () => {
      // Hover already opens the native directory over its trigger; a subsequent
      // click at the covered trigger center would target a row instead.
      if (await track.getAttribute('aria-expanded') !== 'true') {
        await track.focus();
        if (await track.getAttribute('aria-expanded') !== 'true') await page.keyboard.press('ArrowDown');
      }
      await directory.waitFor();
    };
    const current = directory.locator('[aria-current="location"]');
    const textarea = page.locator(".chat-input-textarea");
    const draft = "Navigation preserves this unsent draft.\n第二行输入草稿";
    await textarea.fill(draft);
    // Reach the true root through native End/Home navigation; this mounts older
    // retained messages before checking every authored transcript title.
    await track.focus(); await page.keyboard.press('Home');
    await page.waitForFunction(() => document.querySelector('.chat-scroll-container')?.scrollTop <= 1);
    await page.keyboard.press('Escape'); await track.click();
    await directory.waitFor();
    report.chapterTitles = await directory.locator('.conversation-navigator-label').allTextContents();
    await capture('authored-chapter-directory');
    assert.deepEqual(report.chapterTitles, ['Session start', ...chapterSpecs.map((chapter) => chapter.title)], 'Only Session start and tool-authored chapter titles appear; generated user prompts and ordinary bold text never become chapters');
    for (const authored of chapterSpecs) assert.equal(await page.locator(`[data-conversation-chapter="${authored.chapterId}"] strong`).innerText(), authored.title, 'Every authored chapter has its own bold transcript anchor');
    report.checks.push('Rail sections come exclusively from authored chapter records, including two in one user turn and duplicate titles with distinct identities');
    assert.equal(await directory.getAttribute('data-navigation-source'), 'tool-chapters');
    assert.deepEqual(await directory.locator('[data-navigation-chapter]').evaluateAll((rows) => rows.map((row) => row.dataset.navigationChapter)), chapterSpecs.map((chapter) => chapter.chapterId));
    const chapter = directory.locator(`[data-navigation-chapter="${chapterSpecs[1].chapterId}"]`);
    await chapter.click();
    await directory.waitFor({ state: "hidden" });
    await page.waitForFunction((chapterId) => {
      const scroll = document.querySelector(".chat-scroll-container");
      const anchor = scroll.querySelector(`[data-conversation-chapter="${chapterId}"]`);
      return anchor && Math.abs(anchor.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 16) <= 2;
    }, chapterSpecs[1].chapterId);
    assert.equal(await page.locator(`[data-conversation-chapter="${chapterSpecs[1].chapterId}"] strong`).innerText(), chapterSpecs[1].title, 'The authored chapter is a real bold transcript title, outside ordinary message emphasis');
    assert.equal(await textarea.inputValue(), draft, "Clicking a historical chapter preserves the unsent draft");
    assert.equal(await track.evaluate((element) => element === document.activeElement), true, "Selecting a chapter returns focus to the rail");
    await page.keyboard.press("ArrowDown");
    await directory.waitFor();
    await page.waitForFunction(() => document.querySelector('.conversation-navigator-row[aria-current="location"]')?.getAttribute("data-navigation-index") === "2");
    const indexBeforeIme = await current.getAttribute("data-navigation-index");
    const ime = await track.evaluate((element) => {
      const event = new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true, cancelable: true, isComposing: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    });
    assert.equal(ime, false, "IME does not consume arrow navigation");
    assert.equal(await current.getAttribute("data-navigation-index"), indexBeforeIme, "IME does not change the active turn");
    await page.keyboard.press("Escape");
    await directory.waitFor({ state: "hidden" });
    await textarea.focus();
    const manualHistory = await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop);
    await track.hover();
    await directory.waitFor();
    await directory.locator(".conversation-navigator-row").last().hover();
    await directory.evaluate((element) => { element.scrollTop = element.scrollHeight; });
    await settle();
    assert.ok(Math.abs(await page.locator(".chat-scroll-container").evaluate((element) => element.scrollTop) - manualHistory) <= 0.6, "Hovering and scrolling the directory never auto-scrolls the transcript away from manual history");
    const body = page.locator(`[data-conversation-chapter="${chapterSpecs[2].chapterId}"]`);
    await body.hover();
    await directory.waitFor({ state: "hidden" });
    assert.equal(await body.evaluate((element) => { const box = element.getBoundingClientRect(); return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2)); }), true, 'Moving from the directory to chapter text dismisses it and leaves body hit testing intact');
    await textarea.hover();
    await textarea.focus();
    assert.equal(await textarea.inputValue(), draft, "Dismissing navigation leaves draft and composer focus intact");
    report.checks.push("Historical chapter click and keyboard navigation keep authored anchors, draft, focus and IME behavior; browsing the directory keeps manual transcript scroll");
    const beforeLiveScroll = await page.locator('.chat-scroll-container').evaluate((element) => element.scrollTop);
    const liveChapter = { role: 'custom', customType: 'pi-web:chapter', content: 'Live verification chapter', display: true, details: { version: 1, chapterId: 'generated-live-chapter', title: 'Live verification chapter' }, timestamp: 999000 };
    await page.evaluate((message) => { window.__emitNavigationEvent({ type: 'agent_start' }); window.__emitNavigationEvent({ type: 'message_end', message }); }, liveChapter);
    await track.click(); await directory.waitFor();
    await directory.getByRole('button', { name: 'Live verification chapter', exact: true }).waitFor();
    assert.equal(await directory.getByRole('button', { name: 'Live verification chapter', exact: true }).count(), 1, 'A normal custom message_end adds exactly one authored live chapter');
    await page.evaluate((message) => window.__emitNavigationEvent({ type: 'message_end', message }), liveChapter);
    await settle();
    assert.equal(await directory.getByRole('button', { name: 'Live verification chapter', exact: true }).count(), 1, 'Replayed stable chapter identity cannot duplicate rail rows');
    assert.ok(Math.abs(await page.locator('.chat-scroll-container').evaluate((element) => element.scrollTop) - beforeLiveScroll) <= 0.6, 'Live chapter arrival does not pull manual history to the bottom');
    await page.keyboard.press('Escape'); await textarea.focus();
    assert.equal(await textarea.inputValue(), draft);
    report.checks.push('Normal live custom chapter events update the rail by stable identity without moving manual history or consuming the draft');
    await track.click(); await directory.waitFor();
    const fixedMenu = await directory.boundingBox();
    const longTitle = directory.locator(`[data-navigation-chapter="${chapterSpecs.at(-1).chapterId}"] .conversation-navigator-label`);
    assert.ok(Math.abs(fixedMenu.width - 256) <= 0.6, 'Short and long authored titles share the fixed 256px directory');
    assert.equal(await longTitle.evaluate((element) => element.scrollWidth > element.clientWidth && getComputedStyle(element).textOverflow === 'ellipsis'), true, 'Long authored title remains complete in source and uses internal ellipsis');
    await page.keyboard.press('Escape'); await textarea.focus();
    report.checks.push('Directory width stays fixed for short and long titles, with internal ellipsis');
    // The chapter tool persists before live delivery. Make the same chapter
    // available on the settlement/reload read, then finish the generated run.
    append(liveChapter, 'entry-generated-live-chapter');
    await page.evaluate(() => { window.__emitNavigationEvent({ type: 'agent_end' }); window.__emitNavigationEvent({ type: 'agent_settled' }); });
    await page.waitForFunction(() => !document.querySelector('.composer-abort-button'));
    await settle();

    for (const theme of ["light", "dark"]) {
      if (theme === "dark") {
        await page.evaluate(() => localStorage.setItem("pi-theme", "dark"));
        await page.reload({ waitUntil: "domcontentloaded" });
        await page.getByText(`Navigation answer ${turnCount}`, { exact: true }).waitFor();
        await page.waitForFunction(() => document.documentElement.dataset.theme === "dark");
      }
      await page.setViewportSize({ width: 1300, height: 900 });
      const before = await checkLayout(`${theme}-desktop`);
      for (const position of [0, 0.5, 1]) {
        await page.locator(".chat-scroll-container").evaluate((element, fraction) => { element.scrollTop = (element.scrollHeight - element.clientHeight) * fraction; }, position);
        const after = await checkLayout(`${theme}-scroll-${position}`);
        assert.ok(Math.abs(after.track.top - before.track.top) <= 0.6, "Scrolling cannot move the anchored rail");
      }
      await capture(`${theme}-desktop-bottom`);
      await page.getByRole("button", { name: "Hide sidebar", exact: true }).click();
      await checkLayout(`${theme}-sidebar-closed`);
      await page.getByRole("button", { name: "Show sidebar", exact: true }).click();
      await page.getByRole("button", { name: "Show Files", exact: true }).click();
      await page.locator("#workspace-pane-files").waitFor({ state: "visible" });
      await checkLayout(`${theme}-files-open`);
      await capture(`${theme}-files-open`);
      await page.locator(".workspace-pane-controls").getByRole("button", { name: "Hide Files", exact: true }).click();
      const contextToggle = page.getByRole("button", { name: "Context panel", exact: true });
      if (await contextToggle.getAttribute("aria-pressed") === "true") await contextToggle.click();
      for (const viewport of [{ width: 2200, height: 1000 }, { width: 900, height: 600 }, { width: 390, height: 812 }, { width: 390, height: 340 }]) {
        await page.setViewportSize(viewport);
        const name = `${theme}-${viewport.width}x${viewport.height}`;
        const geometry = await checkLayout(name);
        await openDirectory();
        const bounds = await directory.boundingBox();
        const openGeometry = await measureNavigation(page, `${name}-directory-hit`, { measurements: [] });
        report.measurements.push({ name: `${name}-directory`, bounds, rowCenterHit: openGeometry.directoryRowCenterHit });
        assert.equal(openGeometry.directoryRowCenterHit, true, `${name}: directory row is natively reachable`);
        assert.ok(Math.abs(bounds.width - Math.min(256, geometry.region.width - 24)) <= 0.6, `${name}: fixed 256px menu clamps only to its actual middle column`);
        assert.ok(bounds.y >= geometry.region.top, `${name}: the directory stays below the topbar`);
        assert.ok(bounds.y + bounds.height <= geometry.composer.top - 0.5, `${name}: the directory does not cover the composer`);
        assert.ok(bounds.x >= geometry.region.left && bounds.x + bounds.width <= geometry.region.right, `${name}: the directory stays inside its chat column`);
        if (viewport.height === 340) await capture(`${name}-directory`);
        const last = directory.locator(".conversation-navigator-row").last();
        await last.focus();
        await page.keyboard.press("Enter");
        await directory.waitFor({ state: "hidden" });
        assert.equal(await textarea.inputValue(), draft, `${name}: resizing and selecting do not clear the draft`);
        await checkLayout(`${name}-selected-last`);
        await capture(name);
      }
    }
    report.checks.push("Both themes keep the fixed gutter through long scroll, sidebar changes, a Files pane, wide/narrow viewports and short height");
    assert.deepEqual(report.pageErrors, [], "No unhandled browser errors");
    assert.deepEqual(report.consoleErrors, [], "No browser console errors");
    assert.deepEqual(report.nonReadRequests, [], "No API writes were attempted");
    assert.deepEqual(report.externalRequests, [], "No external service requests");
    report.status = "passed";
  } catch (error) {
    report.status = "failed";
    report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack);
    process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close();
    console.log(`Conversation navigator layout ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runConversationNavigatorLayout();
