import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

// The sidebar profile opens General directly, including from the mobile drawer.
async function openGeneralSettings(page) {
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  await page.locator(".pilaude-local-profile").click();
  await page.locator(".settings-general").waitFor();
}

export async function checkChatAppearanceReset(page) {
  const width = page.getByRole("slider", { name: "Chat content width", exact: true });
  const fontSize = page.getByRole("group", { name: "Conversation font size", exact: true });
  const small = fontSize.getByRole("radio", { name: "Small", exact: true });
  const medium = fontSize.getByRole("radio", { name: "Medium", exact: true });
  const large = fontSize.getByRole("radio", { name: "Large", exact: true });
  const resetWidth = page.getByRole("button", { name: "Reset chat content width", exact: true });
  const resetFontSize = page.getByRole("button", { name: "Reset chat font size", exact: true });
  await width.press("End");
  await large.check();
  await resetWidth.click();
  assert.equal(await width.inputValue(), "820");
  assert.equal(await large.isChecked(), true, "Resetting width must preserve Large font size");
  await width.press("End");
  await resetFontSize.click();
  assert.equal(await medium.isChecked(), true);
  assert.equal(await width.inputValue(), "2000", "Resetting font size must preserve width");
  await small.check();
  await resetFontSize.click();
  assert.equal(await medium.isChecked(), true, "Resetting Small must restore Medium");
  assert.equal(await width.inputValue(), "2000", "Resetting Small must preserve width");
  await resetWidth.click();
  assert.deepEqual(await page.evaluate(() => ({
    width: localStorage.getItem("pi-chat-content-width"),
    fontSize: localStorage.getItem("pi-chat-content-font-size"),
    appliedWidth: document.documentElement.style.getPropertyValue("--chat-content-max-width"),
    appliedFontSize: document.documentElement.style.getPropertyValue("--chat-content-font-size"),
  })), { width: "820", fontSize: "14", appliedWidth: "820px", appliedFontSize: "14px" });
  await page.reload({ waitUntil: "networkidle" });
  await openGeneralSettings(page);
  assert.equal(await width.inputValue(), "820");
  assert.equal(await medium.isChecked(), true);
  assert.equal(await resetWidth.isDisabled(), true);
  assert.equal(await resetFontSize.isDisabled(), true);
}

export async function checkComposerGeometry(page) {
  const textarea = page.locator(".chat-input-textarea");
  const draft = await textarea.inputValue();
  try {
    for (const value of ["", "A single line", "First line\nSecond line\nThird line"]) {
      await textarea.fill(value);
      await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const geometry = await textarea.evaluate((input) => {
        const composer = input.closest(".chat-composer");
        const action = composer.querySelector(".composer-send-button, .composer-abort-button");
        const card = composer.getBoundingClientRect();
        const text = input.getBoundingClientRect();
        const button = action.getBoundingClientRect();
        const style = getComputedStyle(input);
        const lineHeight = Number.parseFloat(style.lineHeight);
        return {
          height: card.height,
          font: style.fontSize,
          lineHeight,
          actionCenter: button.y + button.height / 2,
          lastLineCenter: text.bottom - Number.parseFloat(style.paddingBottom) - lineHeight / 2,
          cardCenter: card.y + card.height / 2,
          attachBelow: composer.parentElement.querySelector(".composer-attach-button").getBoundingClientRect().top >= card.bottom,
        };
      });
      assert.ok(Math.abs(geometry.actionCenter - geometry.lastLineCenter) <= 0.6, "Send/Stop must align to the last text row");
      assert.equal(geometry.attachBelow, true, "Attach must stay below the input card");
      if (!value.includes("\n")) {
        assert.ok(Math.abs(geometry.height - 48) <= 0.1, "The user-selected 3p single-line calibration stays 48 CSS px");
        assert.ok(Math.abs(geometry.actionCenter - geometry.cardCenter) <= 0.6, "The single-line action must be centered in the card");
      } else {
        assert.ok(geometry.height > 48, "Multiple lines must grow the card");
        assert.ok(geometry.actionCenter > geometry.cardCenter + geometry.lineHeight / 2, "Multiline actions follow the bottom row");
      }
    }
  } finally {
    await textarea.fill(draft);
  }
}

/** Diagnostic only: Canvas ink and a hidden DOM baseline probe do not identify
 * the actual fallback face/glyph baseline inside the browser's textarea. */
export async function measureComposerTypography(page, { textUtf16, expectedFontFamily = null }) {
  return page.locator('.chat-input-textarea').evaluate(async (input, options) => {
    const exact = String.fromCharCode(...options.textUtf16);
    if (input.value !== exact) throw new Error('Composer UTF-16 content differs from the explicit local reference text');
    const style = getComputedStyle(input);
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    await document.fonts.load(font, exact);
    await document.fonts.ready;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    const rect = (element) => element.getBoundingClientRect().toJSON();
    const card = input.closest('.chat-composer');
    const action = card.querySelector('.composer-send-button, .composer-abort-button');
    const box = rect(card), inputBox = rect(input), actionBox = action && rect(action);
    const canvas = document.createElement('canvas'), context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D text metrics are unavailable');
    context.font = font; context.textBaseline = 'alphabetic'; context.direction = style.direction;
    for (const property of ['fontKerning', 'fontStretch', 'fontVariantCaps', 'letterSpacing', 'wordSpacing']) {
      if (property in context) context[property] = style[property];
    }
    const metrics = context.measureText(exact);
    const number = (value) => Number.isFinite(value) ? value : null;
    const ink = { width: metrics.actualBoundingBoxLeft + metrics.actualBoundingBoxRight,
      ascent: metrics.actualBoundingBoxAscent, descent: metrics.actualBoundingBoxDescent,
      height: metrics.actualBoundingBoxAscent + metrics.actualBoundingBoxDescent,
      advanceWidth: metrics.width, left: metrics.actualBoundingBoxLeft, right: metrics.actualBoundingBoxRight,
      fontAscent: number(metrics.fontBoundingBoxAscent), fontDescent: number(metrics.fontBoundingBoxDescent),
      emAscent: number(metrics.emHeightAscent), emDescent: number(metrics.emHeightDescent) };
    const probe = document.createElement('div');
    Object.assign(probe.style, { position: 'fixed', left: '0', top: '0', width: 'max-content',
      margin: '0', padding: '0', border: '0', visibility: 'hidden', pointerEvents: 'none', whiteSpace: 'pre',
      font, lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, wordSpacing: style.wordSpacing,
      fontKerning: style.fontKerning, fontFeatureSettings: style.fontFeatureSettings,
      fontVariationSettings: style.fontVariationSettings, fontOpticalSizing: style.fontOpticalSizing,
      direction: style.direction, textRendering: style.textRendering });
    const text = document.createElement('span'); text.textContent = exact;
    const marker = document.createElement('span');
    Object.assign(marker.style, { display: 'inline-block', width: '0', height: '0', padding: '0', margin: '0', verticalAlign: 'baseline' });
    probe.append(text, marker); document.body.append(probe);
    let domProbe;
    try {
      const probeBox = rect(probe), textBox = rect(text), markerBox = rect(marker);
      domProbe = { kind: 'hidden DOM line box with zero-height baseline marker; not textarea internals',
        lineBox: { width: probeBox.width, height: probeBox.height }, inlineTextBox: { width: textBox.width, height: textBox.height },
        alphabeticBaselineFromTop: markerBox.top - probeBox.top,
        canvasInkTopFromProbeTop: markerBox.top - probeBox.top - ink.ascent,
        canvasInkBottomFromProbeTop: markerBox.top - probeBox.top + ink.descent };
    } finally { probe.remove(); }
    const lineHeight = Number.parseFloat(style.lineHeight), fontSize = Number.parseFloat(style.fontSize);
    const ratio = (a, b) => Number.isFinite(a) && Number.isFinite(b) && b > 0 ? a / b : null;
    const loadedFaces = Array.from(document.fonts).map((face) => ({ family: face.family, status: face.status, style: face.style, weight: face.weight }));
    const normalizeFamily = (family) => family.replace(/["']/g, '').trim().toLowerCase();
    return {
      viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio, cssZoom: getComputedStyle(document.documentElement).zoom, visualViewportScale: visualViewport?.scale ?? null },
      content: { utf16Length: input.value.length, exactUtf16Match: true, newlineCount: (input.value.match(/\n/g) ?? []).length },
      fonts: { status: document.fonts.status, requestedFont: font, requestedTextCheck: document.fonts.check(font, exact),
        expectedFamily: options.expectedFontFamily,
        expectedDeclaredFaceLoaded: options.expectedFontFamily ? loadedFaces.some((face) => normalizeFamily(face.family) === normalizeFamily(options.expectedFontFamily) && face.status === 'loaded') : null,
        declaredFaces: loadedFaces, actualGlyphFaceIdentity: 'unknown; ready/check and declared-face status do not identify per-glyph fallback' },
      computed: { fontFamily: style.fontFamily, fontSize: style.fontSize, fontWeight: style.fontWeight, fontStyle: style.fontStyle,
        lineHeight: style.lineHeight, letterSpacing: style.letterSpacing, wordSpacing: style.wordSpacing,
        fontKerning: style.fontKerning, fontFeatureSettings: style.fontFeatureSettings, fontVariationSettings: style.fontVariationSettings,
        fontOpticalSizing: style.fontOpticalSizing, padding: style.padding, border: style.borderWidth },
      geometry: { card: box, input: inputBox, action: actionBox, inputScrollHeight: input.scrollHeight, inputClientHeight: input.clientHeight,
        leftInputInset: inputBox.left - box.left, rightInputInset: box.right - inputBox.right,
        actionToLastLineCenter: actionBox ? actionBox.y + actionBox.height / 2 - (inputBox.bottom - Number.parseFloat(style.paddingBottom) - lineHeight / 2) : null },
      canvas: { kind: 'single unwrapped string in Canvas, alphabetic baseline; diagnostic only', font: context.font, ink }, domProbe,
      ratios: { fontSizeToCardHeight: ratio(fontSize, box.height), lineHeightToCardHeight: ratio(lineHeight, box.height),
        canvasInkToCardHeight: ratio(ink.height, box.height), canvasInkToLineHeight: ratio(ink.height, lineHeight),
        canvasAdvanceToInputWidth: ratio(ink.advanceWidth, inputBox.width), actionHeightToCardHeight: ratio(actionBox?.height, box.height) },
      limitations: ['Reference font, OS DPI and application zoom remain unknown unless independently supplied.',
        'Canvas metrics and the hidden DOM probe do not measure native textarea ink or its actual glyph baseline.',
        'Raster ink bounds require the unscaled capture and independent threshold/crop analysis; no font-size correction is inferred.'],
    };
  }, { textUtf16, expectedFontFamily });
}

export async function checkChatAppearance(page) {
  await page.setViewportSize({ width: 2560, height: 1100 });
  const textarea = page.locator(".chat-input-textarea");
  const openSettings = () => openGeneralSettings(page);
  const closeSettings = async () => {
    await page.keyboard.press("Escape");
    await page.locator(".settings-general").waitFor({ state: "detached" });
    if (page.viewportSize().width <= 640) {
      const contextDock = page.locator('.pilaude-context-dock[data-presentation="modal"]');
      if (await contextDock.isVisible()) {
        await page.keyboard.press("Escape");
        await contextDock.waitFor({ state: "detached" });
      }
      const hideSidebar = page.getByRole("button", { name: "Hide sidebar", exact: true });
      const bounds = await hideSidebar.boundingBox();
      if (bounds && bounds.x >= 0 && bounds.x + bounds.width <= page.viewportSize().width) await hideSidebar.click();
    }
  };
  const width = page.getByRole("slider", { name: "Chat content width", exact: true });
  const fontSize = page.getByRole("group", { name: "Conversation font size", exact: true });
  const small = fontSize.getByRole("radio", { name: "Small", exact: true });
  const medium = fontSize.getByRole("radio", { name: "Medium", exact: true });
  const large = fontSize.getByRole("radio", { name: "Large", exact: true });
  const userMessage = page.locator(".markdown-user-message");
  const code = page.locator(".markdown-code-block pre");
  const font = (locator) => locator.evaluate((el) => getComputedStyle(el).fontSize);
  const fittedHeight = async () => {
    // Width changes are observed and fitted on a later frame; let layout settle
    // before checking shrinkage as well as growth.
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await page.waitForFunction(() => {
      const input = document.querySelector(".chat-input-textarea");
      return input && (input.scrollHeight <= input.clientHeight + 1 || input.clientHeight >= 199);
    });
    return textarea.evaluate((el) => el.clientHeight);
  };
  const checkFixedTypography = async () => {
    assert.equal(await font(textarea), "14px", "Desktop composer font must stay fixed");
    for (const [selector, size] of [
      [".session-item-title", "14px"],
      [".pilaude-local-profile small", "12px"],
      [".pilaude-context-card > summary", "14px"],
      [".pilaude-context-usage > small", "12px"],
    ]) {
      assert.equal(await font(page.locator(selector).first()), size, `${selector} must keep its chrome font size`);
    }
  };

  // A missing preference uses Medium; stored 16 still means Large on reload.
  await page.evaluate(() => localStorage.removeItem("pi-chat-content-font-size"));
  await page.reload({ waitUntil: "networkidle" });
  await code.waitFor();
  const showSidebar = page.getByRole("button", { name: "Show sidebar", exact: true });
  if (await showSidebar.isVisible()) await showSidebar.click();
  const contextToggle = page.locator(".pilaude-context-toggle");
  if (await contextToggle.getAttribute("aria-pressed") !== "true") await contextToggle.click();
  await openSettings();
  assert.equal(await width.inputValue(), "820");
  assert.equal(await width.getAttribute("min"), "820");
  assert.equal(await width.getAttribute("max"), "2000");
  assert.deepEqual(await fontSize.getByRole("radio").evaluateAll((inputs) => inputs.map((input) => ({
    type: input.type, value: input.value,
  }))), [
    { type: "radio", value: "13" },
    { type: "radio", value: "14" },
    { type: "radio", value: "16" },
  ]);
  assert.equal(await medium.isChecked(), true, "A missing font preference must default to Medium");
  assert.equal(await page.evaluate(() => localStorage.getItem("pi-chat-content-font-size")), null);
  await width.press("End");
  await closeSettings();
  assert.equal(await font(userMessage), "14px");
  await checkFixedTypography();
  await checkComposerGeometry(page);
  const mediumCodeSize = Number.parseFloat(await font(code));
  const draft = "Existing drafts resize when the available width changes, while the composer font stays fixed. ".repeat(6);
  await textarea.fill(draft);
  const wideHeight = await fittedHeight();
  await openSettings();
  await width.press("Home");
  await closeSettings();
  const narrowHeight = await fittedHeight();
  assert.equal(await textarea.inputValue(), draft);
  assert.ok(narrowHeight > wideHeight, "Narrowing must grow the draft without another keystroke");

  let smallCodeSize;
  for (const [option, size] of [[small, 13], [medium, 14], [large, 16]]) {
    await openSettings();
    await option.check();
    assert.equal(await option.isChecked(), true);
    assert.equal(await fontSize.locator("input:checked").count(), 1);
    await closeSettings();
    assert.equal(await textarea.inputValue(), draft, "Changing reading font size must preserve the draft");
    assert.equal(await fittedHeight(), narrowHeight, "Changing reading font size must preserve draft height");
    await checkFixedTypography();
    assert.equal(await font(userMessage), `${size}px`, "User messages must follow the reading font preset");
    const codeSize = Number.parseFloat(await font(code));
    if (size === 13) {
      smallCodeSize = codeSize;
      assert.ok(codeSize < mediumCodeSize, "Small must reduce the code font size");
    } else if (size === 14) {
      assert.equal(codeSize, mediumCodeSize);
      assert.ok(codeSize > smallCodeSize, "Medium must increase the code font size from Small");
    } else {
      assert.ok(codeSize > mediumCodeSize, "Large must increase the code font size");
    }
  }
  const largeCodeSize = await font(code);
  await openSettings();
  await width.press("End");
  await closeSettings();
  assert.equal(await textarea.inputValue(), draft);
  assert.ok(await fittedHeight() < narrowHeight, "Widening must shrink the existing draft");
  assert.deepEqual(await page.evaluate(() => ({
    width: localStorage.getItem("pi-chat-content-width"),
    fontSize: localStorage.getItem("pi-chat-content-font-size"),
  })), { width: "2000", fontSize: "16" });
  await page.reload({ waitUntil: "networkidle" });
  await code.waitFor();
  assert.equal(await font(userMessage), "16px");
  assert.equal(await font(code), largeCodeSize);
  await checkFixedTypography();

  await openSettings();
  assert.equal(await width.inputValue(), "2000");
  assert.equal(await large.isChecked(), true, "Stored 16 must remain Large after reload");
  await checkChatAppearanceReset(page);
  // Language is no longer the panel's last section (15b373d moved it above
  // Chat), so "reachable" is checked two ways: the lowest control is hit-
  // testable once the panel is scrolled to its end, and the last language
  // option is hit-testable once the panel itself is scrolled to it.
  for (const viewport of [{ width: 1280, height: 600 }, { width: 320, height: 568 }]) {
    await page.setViewportSize(viewport);
    assert.equal(await page.locator(".settings-general").evaluate((panel) => {
      panel.scrollTop = panel.scrollHeight;
      // Ignore sr-only proxies; the font presets are visible native radios.
      const controls = [...panel.querySelectorAll("button, input, select, textarea")]
        .filter((el) => !el.classList.contains("sr-only") && el.getClientRects().length > 0);
      const lowest = controls.reduce((a, b) => (b.getBoundingClientRect().bottom > a.getBoundingClientRect().bottom ? b : a));
      const rect = lowest.getBoundingClientRect();
      return lowest.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, "The bottom of a short settings panel must remain reachable");
    assert.equal(await page.locator(".settings-language-options button:last-child").evaluate((el) => {
      const panel = el.closest(".settings-general");
      panel.scrollTop += el.getBoundingClientRect().top - panel.getBoundingClientRect().top - panel.clientHeight / 2;
      const rect = el.getBoundingClientRect();
      return el.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2));
    }), true, "Every language option must remain reachable in a short settings panel");
  }
  await small.check();
  await closeSettings();
  assert.equal(await font(textarea), "16px", "Mobile inputs retain the focus-zoom minimum");
  assert.equal(await font(userMessage), "13px");
  await checkComposerGeometry(page);
  const mobileDraft = "A mobile draft wraps and resizes within the available space.";
  await textarea.fill(mobileDraft);
  const mobileHeight = await fittedHeight();
  await openSettings();
  await large.check();
  await closeSettings();
  assert.equal(await font(textarea), "16px", "Mobile composer font must stay fixed across presets");
  assert.equal(await font(userMessage), "16px");
  assert.equal(await textarea.inputValue(), mobileDraft);
  assert.equal(await fittedHeight(), mobileHeight, "Changing reading font size must preserve mobile draft height");
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log("PASS: chat appearance persistence, typography, draft resizing, and short settings panels");
}

/** Opt-in local remeasurement at the existing appearance entrypoint. All session
 * data is generated; exact reference text and optional font CSS stay local. */
export async function runComposerTypographyMeasurement() {
  const out = new URL(`../test-results/pilaude/composer-calibration/font-ready-${Date.now()}/`, import.meta.url);
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: 'running', apiReadCount: 0, allowedWrites: [], nonReadRequests: [], externalRequests: [], pageErrors: [], consoleErrors: [],
    provenance: { purpose: 'current-font-diagnostics-only', referenceTextIdentity: 'unverified', referenceComparison: false },
    referenceConditions: { fontFamily: null, osDpi: null, applicationZoom: null, textIdentity: 'unverified', source: 'independent local reference; unknown values remain unknown' } };
  let browser, reportPath = null;
  try {
    await mkdir(out, { recursive: true });
    const configPath = process.env.E2E_COMPOSER_MEASUREMENT_INPUT;
    if (!configPath) throw new Error('Explicit local input is required');
    const config = JSON.parse(await readFile(configPath, 'utf8'));
    assert.ok(Array.isArray(config.textUtf16) && config.textUtf16.length > 0 && config.textUtf16.length <= 2000
      && config.textUtf16.every((unit) => Number.isInteger(unit) && unit >= 0 && unit <= 65535 && unit !== 10 && unit !== 13),
    'Measurement requires an explicit nonempty single-line UTF-16 code-unit array');
    const exact = String.fromCharCode(...config.textUtf16);
    const viewport = config.viewport ?? { width: 1504, height: 1004 };
    assert.ok(Number.isInteger(viewport.width) && viewport.width >= 641 && Number.isInteger(viewport.height) && viewport.height >= 400, 'Measurement viewport must be an explicit usable desktop size');
    const scale = config.deviceScaleFactor ?? 1.25;
    assert.ok(Number.isFinite(scale) && scale >= 1 && scale <= 3, 'Device scale factor must be between 1 and 3');
    const expectedFontFamily = config.expectedFontFamily ?? null;
    assert.ok(expectedFontFamily === null || (typeof expectedFontFamily === 'string' && expectedFontFamily.length <= 160 && !/[\x00-\x1f]/.test(expectedFontFamily)), 'Expected font family must be a plain family name');
    const customCss = process.env.E2E_COMPOSER_FONT_CSS_PATH ? await readFile(process.env.E2E_COMPOSER_FONT_CSS_PATH, 'utf8') : '';
    const base = process.env.E2E_BASE_URL || 'http://127.0.0.1:30142';
    report.capture = { scale: 'device', deviceScaleFactor: scale, viewport, resampled: false, localFontStylesheetSupplied: Boolean(customCss) };
    report.content = { kind: config.provenance?.kind === 'generated-probe' ? 'generated-probe' : 'explicit-local-input',
      utf16Length: exact.length, sha256Utf16Le: createHash('sha256').update(Buffer.from(exact, 'utf16le')).digest('hex'), rawTextRecorded: false };
    const { chromium } = await import('playwright');
    const { installSidebarPinFixture } = await import('./sidebar-pin-order.mjs');
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport, deviceScaleFactor: scale, colorScheme: 'dark', reducedMotion: 'reduce', serviceWorkers: 'block' });
    // Shared fixture logging normally retains URLs and POST bodies. This private
    // measurement keeps only counts and fixed diagnostic labels at that seam.
    const privateSink = {
      apiReads: { push: () => { report.apiReadCount += 1; } },
      nonReadRequests: { push: () => report.nonReadRequests.push('blocked-unexpected-write') },
      externalRequests: { push: () => report.externalRequests.push('blocked-external-request') },
    };
    await installSidebarPinFixture(context, base, privateSink);
    await context.addInitScript(() => { sessionStorage.setItem('sidebar-pin-initialized', '1'); localStorage.setItem('pi-theme', 'dark'); localStorage.setItem('pi-locale', 'en'); localStorage.setItem('pi-sound-enabled', 'false'); localStorage.setItem('pi-workspace-pane-visibility-v1', 'false'); });
    await context.route(`${base}/api/custom-css`, (route) => route.request().method() === 'GET' ? route.fulfill({ contentType: 'text/css', body: customCss }) : route.fallback());
    await context.route(`${base}/api/agent/a/lease`, (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      report.allowedWrites.push({ method: 'POST', path: '/api/agent/a/lease' });
      return route.fulfill({ json: { renewed: 1 } });
    });
    await context.route(`${base}/api/sessions/*/output-style`, (route) => route.request().method() === 'GET' ? route.fulfill({ json: { supported: false, reason: 'unavailable', selectedId: 'default', styles: [] } }) : route.fallback());
    const page = await context.newPage(); page.setDefaultTimeout(15000);
    // Record counts rather than page-produced text, which could contain the private sample.
    page.on('pageerror', () => report.pageErrors.push('pageerror'));
    page.on('console', (message) => { if (message.type() === 'error') report.consoleErrors.push('consoleerror'); });
    const customCssReady = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/custom-css' && response.request().method() === 'GET');
    await page.goto(`${base}/?session=a`, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await customCssReady;
    await page.getByText('Generated sidebar fixture ready.', { exact: true }).waitFor();
    const settle = () => page.evaluate(async () => { await document.fonts.ready; await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
    await settle();
    const dock = page.getByRole('button', { name: 'Context panel', exact: true });
    if (await dock.getAttribute('aria-pressed') === 'true') await dock.click();
    await page.locator('.pilaude-context-dock').waitFor({ state: 'detached' });
    const hide = page.getByRole('button', { name: 'Hide sidebar', exact: true });
    if (await hide.isVisible()) await hide.click();
    await page.locator('#session-sidebar').evaluate(async (element) => { await Promise.all(element.getAnimations().map((animation) => animation.finished.catch(() => {}))); });
    const textarea = page.locator('.chat-input-textarea');
    await textarea.fill(exact); await textarea.blur(); await settle();
    report.measurement = await measureComposerTypography(page, { textUtf16: config.textUtf16, expectedFontFamily });
    report.measurement.rasterCapture = { frameOriginalPixels: { width: viewport.width * scale, height: viewport.height * scale },
      cardPhysicalFloat: Object.fromEntries(['x', 'y', 'width', 'height'].map((key) => [key, report.measurement.geometry.card[key] * scale])),
      integerCropOriginQuantization: Object.fromEntries(['x', 'y'].map((key) => [key, Math.floor(report.measurement.geometry.card[key] * scale) - report.measurement.geometry.card[key] * scale])),
      cardScreenshot: 'actual-composer.png uses the browser element bounding-box crop; no reference resizing or resampling' };
    assert.equal(report.measurement.content.exactUtf16Match, true);
    if (expectedFontFamily) assert.equal(report.measurement.fonts.expectedDeclaredFaceLoaded, true, 'Explicit expected font face must be loaded before accepting this measurement');
    assert.equal(report.measurement.geometry.inputScrollHeight <= report.measurement.geometry.inputClientHeight + 1, true, 'The explicit text must fit without textarea scrolling');
    await page.screenshot({ path: artifact('actual-frame.png'), scale: 'device', style: 'nextjs-portal{visibility:hidden!important}' });
    await page.locator('.chat-composer').screenshot({ path: artifact('actual-composer.png'), scale: 'device' });
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.nonReadRequests, []); assert.deepEqual(report.externalRequests, []);
    assert.ok(report.allowedWrites.every((request) => request.method === 'POST' && request.path === '/api/agent/a/lease'), 'Only the mocked fixture lease is allowed');
    report.status = 'measured';
  } catch {
    report.status = 'failed'; report.failure = 'Measurement conditions failed; inspect the local metrics without logging the reference text or font source';
  } finally {
    try {
      await writeFile(artifact('measurements.json'), JSON.stringify(report, null, 2));
      reportPath = artifact('measurements.json');
    } catch {
      report.status = 'failed'; report.failure = 'Measurement report could not be saved';
    } finally {
      try { await browser?.close(); } catch { report.status = 'failed'; }
    }
    console.log(JSON.stringify({ status: report.status, report: reportPath }));
  }
  if (report.status !== 'measured') process.exitCode = 1;
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runComposerTypographyMeasurement();
