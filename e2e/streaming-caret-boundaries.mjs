import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { installActivityFixture } from "./activity-disclosure.mjs";

const base = process.env.E2E_BASE_URL || "http://127.0.0.1:30142";
const stamp = Date.UTC(2026, 9, 19, 15);
const assistant = (content, timestamp) => ({ role: "assistant", content, timestamp, provider: "generated", model: "generated", stopReason: "stop" });
const examples = [
  { name: "paragraph", markdown: "Generated paragraph caret end", tail: "Generated paragraph caret end" },
  { name: "heading", markdown: "### Generated heading caret end", tail: "Generated heading caret end" },
  { name: "inline", markdown: "Generated **strong** *emphasis* and `inline caret end`", tail: "inline caret end" },
  { name: "list", markdown: "- Generated first item\n- Generated final list caret end", tail: "Generated final list caret end" },
  { name: "nested-list", markdown: "1. Generated outer item\n   - Generated nested list caret end", tail: "Generated nested list caret end" },
  { name: "table", markdown: "| Generated key | Generated value |\n| --- | --- |\n| row | Table caret end |", tail: "Table caret end" },
  { name: "fence", markdown: "```text\nGenerated code caret end\n```", tail: "Generated code caret end" },
  { name: "open-fence", markdown: "```text\nGenerated open fence caret end", tail: "Generated open fence caret end" },
  { name: "blockquote", markdown: "> Generated quote caret end", tail: "Generated quote caret end" },
];

// Native DOM/CSS seam: inspect the real caret-bearing pseudo host and the last
// rendered source character. No renderer replacement or measuring CSS override.
async function measureCaret(page, tail) {
  return page.evaluate((tail) => {
    const visible = (element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility === "visible";
    const hosts = [...document.querySelectorAll(".message-streaming-caret")];
    const carets = hosts.flatMap((root) => [root, ...root.querySelectorAll("*")].flatMap((element) => {
      const style = getComputedStyle(element, "::after");
      if (!["none", "normal"].includes(style.content) && style.display !== "none" && parseFloat(style.width) > 0 && parseFloat(style.height) > 0 && visible(element)) {
        const rect = element.getBoundingClientRect();
        const fontSize = parseFloat(style.fontSize);
        const height = style.height.endsWith("px") ? parseFloat(style.height) : fontSize;
        const top = rect.bottom - parseFloat(getComputedStyle(element).paddingBottom || "0") - parseFloat(getComputedStyle(element).borderBottomWidth || "0") - height;
        return [{ tag: element.tagName, className: element.className?.baseVal ?? element.className, root: element === root, host: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height }, estimatedCaret: { top, bottom: top + height }, width: style.width, height: style.height, content: style.content, display: style.display, animation: style.animationName, opacity: Number(style.opacity) }];
      }
      return [];
    }));
    let textEnd = null;
    for (const root of hosts) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode, index = node.textContent.indexOf(tail);
        if (index < 0) continue;
        const range = document.createRange(); range.setStart(node, index + tail.length - 1); range.setEnd(node, index + tail.length);
        const rect = range.getBoundingClientRect(); textEnd = { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, height: rect.height, parent: node.parentElement.tagName };
      }
    }
    const animations = [...new Set(hosts.flatMap((root) => root.getAnimations({ subtree: true })))].filter((animation) => animation.animationName === 'activity-caret').map((animation) => ({ name: animation.animationName, playState: animation.playState, currentTime: animation.currentTime, iterations: animation.effect.getTiming().iterations, pseudo: animation.effect.pseudoElement, visibleHost: animation.effect.target instanceof Element ? visible(animation.effect.target) : null }));
    return { activeText: document.querySelectorAll('[data-message-streaming="true"]').length, roots: hosts.length, carets, textEnd, animations, hiddenActiveHosts: hosts.filter((element) => !visible(element)).length };
  }, tail);
}

async function inspectArtifactCard(page, state, report, artifact, emit) {
  const title = 'Generated terminal artifact card';
  const source = "const generatedArtifact = '<source> & exact';";
  const markdown = `:::artifact{identifier="generated-terminal-card" type="code" title="${title}"}\n\`\`\`javascript\n${source}`;
  const user = { role: 'user', content: 'Generated mounted artifact caret turn.', timestamp: stamp };
  const message = assistant([{ type: 'text', text: markdown }], stamp + 1000);
  state.running = true; state.messages.push(user); state.entryIds.push('artifact-caret-user'); state.revision++;
  await emit([{ type: 'agent_start' }, { type: 'message_end', message: user }, { type: 'message_start', message: assistant([], stamp + 1000) }, { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 0 } }, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: markdown } }]);
  const card = page.locator('.message-streaming-caret .artifact-card').filter({ hasText: title });
  await card.waitFor();
  await page.waitForFunction(() => document.querySelector('.message-streaming-caret .artifact-card')?.classList.contains('is-generating'));
  await card.scrollIntoViewIfNeeded();
  const sample = async (name) => {
    const measurement = await page.locator('.artifact-card').filter({ hasText: title }).first().evaluate((card) => {
      const root = card.closest('.markdown-body');
      const visible = (element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility === 'visible';
      const animations = card.getAnimations({ subtree: true }).map((animation) => ({ name: animation.animationName, state: animation.playState, continuous: animation.effect.getTiming().iterations === Infinity, target: animation.effect.target?.className, pseudo: animation.effect.pseudoElement, currentTime: animation.currentTime }));
      const rect = card.getBoundingClientRect();
      const geometry = Object.fromEntries(['icon', 'title', 'subtitle', 'action'].map((part) => {
        const element = card.querySelector(`.artifact-card-${part}`), box = element.getBoundingClientRect(), style = getComputedStyle(element);
        return [part, { left: box.left - rect.left, top: box.top - rect.top, width: box.width, height: box.height, lineHeight: style.lineHeight, fontSize: style.fontSize }];
      }));
      const message = card.closest('.message-assistant');
      const messageContinuous = message ? message.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity && animation.effect.target instanceof Element && visible(animation.effect.target)).map((animation) => ({ name: animation.animationName, target: animation.effect.target.className, pseudo: animation.effect.pseudoElement })) : [];
      return { title: card.querySelector('.artifact-card-title')?.textContent, subtitle: card.querySelector('.artifact-card-subtitle')?.textContent, titleHint: card.title, generating: card.classList.contains('is-generating'), activeText: Boolean(card.closest('[data-message-streaming="true"]')), markerCount: card.querySelectorAll('[data-streaming-caret]').length, cardVisible: visible(card), animations, visibleContinuous: visible(card) ? animations.filter((animation) => animation.continuous && animation.state === 'running').length : 0, messageContinuous, bounds: { width: rect.width, height: rect.height }, geometry, rootText: root?.textContent };
    });
    report.measurements.push({ name, ...measurement });
    return measurement;
  };
  const capture = async (name) => { const path = artifact(`${name}.png`); await page.screenshot({ path, scale: 'css', style: 'nextjs-portal{visibility:hidden!important}' }); report.captures.push(path); };
  const live = await sample('artifact-card-live');
  await capture('artifact-card-live');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const reduced = await sample('artifact-card-reduced');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.locator('.sidebar-new-row').click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'new');
  const hidden = await sample('artifact-card-actual-new-hidden');
  await page.getByRole('button', { name: 'Activity fixture activity', exact: true }).first().click();
  await page.waitForFunction(() => new URLSearchParams(location.search).get('view') !== 'new');
  await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: markdown } }]);
  await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
  const ended = await sample('artifact-card-text-ended-message-still-busy');
  await capture('artifact-card-text-ended');
  const narrative = 'Generated next active text after artifact.';
  await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 1 } }, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 1, delta: narrative } }]);
  await page.waitForFunction((narrative) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(narrative), narrative);
  const handoff = await sample('artifact-card-next-text-active');
  await page.locator('button.composer-abort-button:visible').first().click();
  await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
  const stopped = await sample('artifact-card-stopped');
  await capture('artifact-card-stopped');
  assert.equal(live.activeText, true);
  assert.equal(live.markerCount, 1, 'Live mounted artifact consumes its terminal text presentation marker');
  assert.equal(live.messageContinuous.length, 1, 'The whole live assistant message has one continuous indicator');
  assert.equal(handoff.messageContinuous.length, 1, 'The next active text owns the message indicator after artifact handoff');
  assert.equal(stopped.messageContinuous.length, 0, 'Stop removes continuous presentation throughout the assistant message');
  assert.notEqual(ended.subtitle, 'Generating…'); assert.notEqual(stopped.subtitle, 'Generating…');
  assert.equal(ended.titleHint, title, 'An incomplete artifact after text_end retains its actual title rather than claiming readiness');
  assert.equal(stopped.titleHint, title, 'Stop leaves an incomplete artifact hint truthful to its actual title');
  assert.equal(live.visibleContinuous, 1, 'Live mounted artifact has one continuous presentation owner');
  assert.equal(reduced.animations.filter((animation) => animation.state === 'running').length, 0, 'Reduced motion stops card activity animations');
  assert.equal(hidden.animations.filter((animation) => animation.state === 'running').length, 0, 'Actual New stops hidden card animation work');
  assert.equal(ended.animations.filter((animation) => animation.state === 'running').length, 0, 'text_end stops artifact animation while its assistant message remains busy');
  assert.equal(handoff.animations.filter((animation) => animation.state === 'running').length, 0, 'A later active text block does not animate the earlier artifact');
  assert.equal(stopped.animations.filter((animation) => animation.state === 'running').length, 0, 'Stop leaves the artifact static');
  report.checks.push('Mounted artifact activity is unique, reduced/hidden-safe, ends with its indexed text, and remains static through text handoff and Stop');
  // A card source copy remains sourced from the artifact publisher, not its
  // presentation labels or caret. Opening only changes the local UI.
  await page.locator('.artifact-card').filter({ hasText: title }).first().click();
  const code = page.locator('.artifact-panel .markdown-code-block code').first();
  await code.waitFor();
  assert.equal(await code.textContent(), source, 'Publisher retains exact generated artifact source');
  await page.locator('.artifact-panel').getByRole('button', { name: 'Copy', exact: true }).first().click();
  assert.equal(await page.evaluate(() => window.__generatedCaretCopies.at(-1)), source, 'Actual artifact panel Copy receives exact source without presentation caret or labels');
  message.content.push({ type: 'text', text: narrative });
  state.messages.push({ ...message, stopReason: 'aborted' }); state.entryIds.push('artifact-caret-answer'); state.running = false; state.revision++;
  await emit([{ type: 'message_end', message: { ...message, stopReason: 'aborted' } }, { type: 'agent_end' }, { type: 'agent_settled' }]);
  const completeTitle = 'Generated completing artifact card';
  const openMarkdown = `:::artifact{identifier="generated-completing-card" type="code" title="${completeTitle}"}\n\`\`\`javascript\n${source}`;
  const completeUser = { role: 'user', content: 'Generated artifact completion turn.', timestamp: stamp + 3000 };
  const completeMessage = assistant([{ type: 'text', text: openMarkdown }], stamp + 4000);
  state.running = true; state.messages.push(completeUser); state.entryIds.push('artifact-complete-user'); state.revision++;
  await emit([{ type: 'agent_start' }, { type: 'message_end', message: completeUser }, { type: 'message_start', message: assistant([], stamp + 4000) }, { type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 0 } }, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: openMarkdown } }]);
  const completeCard = page.locator('.message-streaming-caret .artifact-card').filter({ hasText: completeTitle });
  await completeCard.waitFor();
  const closure = '\n```\n:::';
  await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 0, delta: closure } }]);
  await page.waitForFunction((title) => [...document.querySelectorAll('.artifact-card')].some((card) => card.textContent.includes(title) && card.classList.contains('artifact-ready')), completeTitle);
  const completion = await completeCard.evaluate((card) => ({ activeText: Boolean(card.closest('[data-message-streaming="true"]')), ready: card.classList.contains('artifact-ready'), subtitle: card.querySelector('.artifact-card-subtitle').textContent, markerCount: card.querySelectorAll('[data-streaming-caret]').length, continuous: card.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity).map((animation) => animation.animationName) }));
  report.measurements.push({ name: 'artifact-business-complete-while-text-active', ...completion });
  assert.equal(completion.ready, true, 'Existing completion effect still marks the completed artifact ready');
  assert.equal(completion.activeText, true); assert.equal(completion.markerCount, 1); assert.deepEqual(completion.continuous, ['activity-caret'], 'Completed artifact keeps one indexed text caret until text_end');
  assert.notEqual(completion.subtitle, 'Generating…', 'Business-complete artifact does not claim it is still generating');
  const panel = page.locator('.artifact-panel').filter({ hasText: completeTitle });
  await panel.waitFor();
  await panel.getByRole('button', { name: 'Copy', exact: true }).first().click();
  assert.equal(await page.evaluate(() => window.__generatedCaretCopies.at(-1)), source, 'Existing completion auto-open retains exact copied source despite highlighted line-number presentation');
  await capture('artifact-card-completed-text-active');
  const completedMarkdown = openMarkdown + closure;
  await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: completedMarkdown } }]);
  await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
  completeMessage.content[0].text = completedMarkdown; state.messages.push(completeMessage); state.entryIds.push('artifact-complete-answer'); state.running = false; state.revision++;
  await emit([{ type: 'message_end', message: completeMessage }, { type: 'agent_end' }, { type: 'agent_settled' }]);
  report.checks.push('Closing the same artifact while text stays active preserves publisher/completion auto-open and one caret until text_end');
}

async function inspectFormula(page, report, artifact, emit, start, finish) {
  const markdown = '$$\nx = 1\n$$';
  const tex = 'x = 1';
  // Chromium exposes the actual generated ::after box through the existing
  // Playwright page's CDP session. No probe element or measuring CSS is added.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('DOM.enable');
  const sample = async (name, source = tex) => {
    const measurement = await page.evaluate((source) => {
      const formula = [...document.querySelectorAll('.message-assistant .katex')].find((element) => element.querySelector('annotation')?.textContent === source);
      if (!formula) throw new Error(`Generated formula missing: ${source}`);
      const root = formula.closest('.markdown-body'), message = formula.closest('.message-assistant');
      const visual = formula.querySelector('.katex-html'), accessible = formula.querySelector('.katex-mathml'), tag = visual.querySelector(':scope > .katex-tag');
      const box = (rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height });
      const visible = (element) => element.getClientRects().length > 0 && !element.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility === 'visible';
      const glyphs = [], walker = document.createTreeWalker(visual, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        if (!node.textContent.trim()) continue;
        const range = document.createRange(); range.selectNodeContents(node);
        for (const rect of range.getClientRects()) if (rect.width && rect.height) glyphs.push(box(rect));
      }
      const visualBounds = glyphs.length ? box({ left: Math.min(...glyphs.map((rect) => rect.left)), right: Math.max(...glyphs.map((rect) => rect.right)), top: Math.min(...glyphs.map((rect) => rect.top)), bottom: Math.max(...glyphs.map((rect) => rect.bottom)), get width() { return this.right - this.left; }, get height() { return this.bottom - this.top; } }) : null;
      const pseudo = getComputedStyle(formula, '::after');
      const continuous = message.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running' && animation.effect.getTiming().iterations === Infinity && animation.effect.target instanceof Element && visible(animation.effect.target)).map((animation) => ({ name: animation.animationName, target: animation.effect.target.className, pseudo: animation.effect.pseudoElement }));
      const rootBounds = box(root.getBoundingClientRect()), formulaBounds = box(formula.getBoundingClientRect());
      return { formulaVisible: visible(formula), activeText: Boolean(formula.closest('[data-message-streaming="true"]')), markerCount: message.querySelectorAll('[data-streaming-caret]').length, formulaMarked: formula.hasAttribute('data-streaming-caret'), nestedMarkers: formula.querySelectorAll('[data-streaming-caret]').length, annotation: formula.querySelector('annotation')?.textContent, accessibleHtml: accessible.outerHTML, visualHtml: visual.outerHTML, rootText: root.textContent, rootBounds, formulaBounds, visualBounds, tagBounds: tag ? box(tag.getBoundingClientRect()) : null, lastGlyph: glyphs.at(-1), visualAriaHidden: visual.getAttribute('aria-hidden'), accessibleBounds: box(accessible.getBoundingClientRect()), pseudo: { display: pseudo.display, position: pseudo.position, content: pseudo.content, width: pseudo.width, height: pseudo.height, marginLeft: pseudo.marginLeft, animation: pseudo.animationName, opacity: Number(pseudo.opacity) }, continuous, ratios: { formulaToRootWidth: rootBounds.width ? formulaBounds.width / rootBounds.width : null, formulaToRootHeight: rootBounds.height ? formulaBounds.height / rootBounds.height : null } };
    }, source);
    measurement.nativePseudoBox = null;
    if (measurement.formulaVisible && !['none', 'normal'].includes(measurement.pseudo.content)) {
      const { result } = await cdp.send('Runtime.evaluate', { expression: `Array.from(document.querySelectorAll('.message-assistant .katex')).find(element => element.querySelector('annotation')?.textContent === ${JSON.stringify(source)})`, objectGroup: 'generated-formula-caret' });
      try {
        const { node } = await cdp.send('DOM.describeNode', { objectId: result.objectId, depth: 1 });
        const after = node.pseudoElements?.find((element) => element.pseudoType === 'after');
        if (after) {
          const { model } = await cdp.send('DOM.getBoxModel', { backendNodeId: after.backendNodeId });
          const x = model.border.filter((_, index) => index % 2 === 0), y = model.border.filter((_, index) => index % 2 === 1);
          measurement.nativePseudoBox = { left: Math.min(...x), right: Math.max(...x), top: Math.min(...y), bottom: Math.max(...y), width: Math.max(...x) - Math.min(...x), height: Math.max(...y) - Math.min(...y) };
        }
      } finally {
        await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'generated-formula-caret' });
      }
    }
    if (measurement.nativePseudoBox && measurement.lastGlyph) {
      measurement.caretGap = measurement.nativePseudoBox.left - measurement.lastGlyph.right;
      measurement.verticalOverlap = Math.min(measurement.nativePseudoBox.bottom, measurement.lastGlyph.bottom) - Math.max(measurement.nativePseudoBox.top, measurement.lastGlyph.top);
      measurement.ratios.caretToVisualHeight = measurement.nativePseudoBox.height / measurement.visualBounds.height;
    }
    report.measurements.push({ name, ...measurement });
    return measurement;
  };
  const capture = async (name) => { const path = artifact(`${name}.png`); await page.screenshot({ path, scale: 'css', style: 'nextjs-portal{visibility:hidden!important}' }); report.captures.push(path); };
  try {
    const message = await start('formula', markdown);
    await page.locator('[data-message-streaming="true"] .katex').waitFor();
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => Number(getComputedStyle(document.querySelector('.message-streaming-caret .katex'), '::after').opacity) > .85);
    const live = await sample('formula-live');
    await capture('formula-live');
    const frames = await page.evaluate(async () => {
      const frames = [], start = performance.now();
      while (performance.now() - start < 650) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        frames.push({ ms: performance.now() - start, opacity: Number(getComputedStyle(document.querySelector('.message-streaming-caret .katex'), '::after').opacity) });
      }
      return frames;
    });
    report.measurements.push({ name: 'formula-native-opacity', frames });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const reduced = await sample('formula-reduced');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.locator('.sidebar-new-row').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'new');
    const hidden = await sample('formula-actual-new-hidden');
    await page.getByRole('button', { name: 'Activity fixture activity', exact: true }).first().click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') !== 'new' && document.querySelector('.message-streaming-caret .katex')?.getClientRects().length > 0);
    const returned = await sample('formula-actual-new-return');
    await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: markdown } }]);
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
    const ended = await sample('formula-text-ended-message-busy');
    await capture('formula-text-ended');
    const narrative = 'Generated next active text after formula.';
    await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_start', contentIndex: 1 } }, { type: 'message_update', assistantMessageEvent: { type: 'text_delta', contentIndex: 1, delta: narrative } }]);
    await page.waitForFunction((narrative) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(narrative), narrative);
    const handoff = await sample('formula-next-text-active');
    message.content.push({ type: 'text', text: narrative });
    await finish('formula', message);
    await page.locator('.message-assistant').filter({ has: page.locator('.katex') }).first().getByRole('button', { name: 'Copy message', exact: true }).click();
    const copied = await page.evaluate(() => window.__generatedCaretCopies.at(-1));
    report.measurements.push({ name: 'formula-actual-copy', expected: `${markdown}\n${narrative}`, copied });
    const stopMarkdown = '$$\ny = 2\n$$';
    const stoppedMessage = await start('formula-stop', stopMarkdown);
    await page.waitForFunction(() => [...document.querySelectorAll('[data-message-streaming="true"] .katex annotation')].some((element) => element.textContent === 'y = 2'));
    const beforeStop = await sample('formula-before-stop', 'y = 2');
    await page.locator('button.composer-abort-button:visible').first().click();
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
    const stopped = await sample('formula-stopped', 'y = 2');
    await capture('formula-stopped');
    await finish('formula-stop', { ...stoppedMessage, stopReason: 'aborted' });
    // Tagged layouts are deliberately outside the caret adapter. Their existing
    // full-width number placement must not change while the text is active.
    const taggedTex = String.raw`x = 1 \tag{1}`;
    const taggedMarkdown = `$$\n${taggedTex}\n$$`;
    const taggedMessage = await start('formula-tag-layout-guard', taggedMarkdown);
    await page.waitForFunction((source) => [...document.querySelectorAll('[data-message-streaming="true"] .katex annotation')].some((element) => element.textContent === source), taggedTex);
    const taggedLive = await sample('formula-tag-live-layout-guard', taggedTex);
    await capture('formula-tag-live-layout-guard');
    await emit([{ type: 'message_update', assistantMessageEvent: { type: 'text_end', contentIndex: 0, content: taggedMarkdown } }]);
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"]'));
    const taggedEnded = await sample('formula-tag-ended-layout-guard', taggedTex);
    await finish('formula-tag-layout-guard', taggedMessage);
    assert.equal(live.activeText, true); assert.equal(live.formulaMarked, true); assert.equal(live.markerCount, 1); assert.equal(live.nestedMarkers, 0);
    assert.equal(live.annotation, tex); assert.equal(live.visualAriaHidden, 'true');
    assert.deepEqual(live.accessibleHtml, ended.accessibleHtml, 'Activity leaves accessible MathML and original TeX unchanged');
    assert.deepEqual(live.visualHtml, ended.visualHtml, 'Activity leaves KaTeX visual glyph markup unchanged');
    assert.equal(live.rootText, ended.rootText, 'Caret never appends source or accessible text');
    assert.equal(copied, `${markdown}\n${narrative}`, 'Actual Copy message receives exact original Markdown without a caret character');
    assert.equal(live.continuous.length, 1); assert.equal(live.continuous[0].name, 'activity-caret');
    assert.ok(frames.length > 1 && Math.max(...frames.map((frame) => frame.opacity)) - Math.min(...frames.map((frame) => frame.opacity)) > .1, 'Formula caret uses the native animation timeline');
    assert.equal(reduced.formulaMarked, true); assert.equal(reduced.pseudo.animation, 'none'); assert.equal(reduced.continuous.length, 0);
    assert.equal(hidden.formulaVisible, false); assert.equal(hidden.continuous.length, 0);
    assert.equal(returned.formulaMarked, true); assert.equal(returned.continuous.length, 1);
    assert.equal(ended.formulaMarked, false); assert.equal(ended.continuous.length, 0);
    assert.equal(handoff.formulaMarked, false); assert.equal(handoff.continuous.length, 1); assert.equal(handoff.markerCount, 1);
    assert.equal(beforeStop.formulaMarked, true); assert.equal(beforeStop.continuous.length, 1);
    assert.equal(stopped.formulaMarked, false); assert.equal(stopped.continuous.length, 0);
    report.checks.push('Formula-only caret preserves accessible MathML, original TeX and actual Copy; indexed end/handoff, reduced motion, actual New/return and Stop preserve one activity owner');
    assert.ok(live.nativePseudoBox, 'The actual CSS ::after has native Chromium box geometry');
    assert.ok(live.verticalOverlap > live.nativePseudoBox.height * .3, 'Formula caret shares the final visual glyph line');
    assert.ok(live.caretGap >= 0 && live.caretGap <= 8, 'Formula caret follows the visual formula tail rather than a full-width wrapper');
    assert.ok(Math.abs(live.rootBounds.height - ended.rootBounds.height) <= 1, 'The active formula adds no extra rendered line');
    assert.ok(Math.abs(live.visualBounds.left - ended.visualBounds.left) <= 1 && Math.abs(live.visualBounds.top - ended.visualBounds.top) <= 1, 'Activity preserves the formula visual alignment');
    report.checks.push('Native formula/pseudo/glyph boxes share one line with no added formula row or changed visual alignment; parent proportions recorded');
    assert.ok(taggedLive.tagBounds && taggedEnded.tagBounds, 'The generated tagged formula uses the existing KaTeX number layout');
    assert.equal(taggedLive.formulaMarked, true); assert.equal(taggedLive.pseudo.content, 'none'); assert.equal(taggedLive.continuous.length, 0, 'Unsupported tagged math adds no misplaced caret');
    assert.equal(taggedEnded.formulaMarked, false);
    for (const part of ['formulaBounds', 'visualBounds', 'tagBounds', 'rootBounds']) {
      for (const dimension of ['left', 'top', 'width', 'height']) assert.ok(Math.abs(taggedLive[part][dimension] - taggedEnded[part][dimension]) <= 1, `Active tagged math preserves ${part}.${dimension}`);
    }
    assert.ok(Math.abs(taggedLive.formulaBounds.width - taggedLive.rootBounds.width) <= 1, 'Tagged formula retains its full-width layout anchor');
    assert.deepEqual(taggedLive.accessibleHtml, taggedEnded.accessibleHtml); assert.deepEqual(taggedLive.visualHtml, taggedEnded.visualHtml);
    report.checks.push('Tagged display formula retains its existing full-width number alignment while active and ended; its unsupported caret remains absent');
  } finally {
    await cdp.detach();
  }
}

export async function runStreamingCaretBoundaries() {
  const out = new URL(`../test-results/pilaude/streaming-caret-boundaries/run-${Date.now()}/`, import.meta.url);
  await mkdir(out, { recursive: true });
  const artifact = (name) => fileURLToPath(new URL(name, out));
  const report = { status: "running", base, checks: [], captures: [], measurements: [], findings: [], apiRequests: [], thinkingRequests: [], interceptedWrites: [], externalRequests: [], pageErrors: [], consoleErrors: [] };
  let browser, page;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: "light", reducedMotion: "no-preference", serviceWorkers: "block" });
    const state = await installActivityFixture(context, report);
    if (process.env.E2E_CARET_ARTIFACT_ONLY === '1' || process.env.E2E_CARET_FORMULA_ONLY === '1') await context.addInitScript(() => {
      window.__generatedCaretCopies = [];
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text) => { window.__generatedCaretCopies.push(text); } } });
    });
    // Only the Stop command in this generated fixture is acknowledged. Every API
    // boundary stays intercepted; no command reaches a model/runtime/backend.
    await context.route("**/api/agent/activity", async (route) => {
      if (route.request().method() !== "POST" || route.request().postDataJSON()?.type !== "abort") return route.fallback();
      report.interceptedWrites.push({ method: "POST", path: "/api/agent/activity", body: route.request().postData() });
      await route.fulfill({ json: {} });
    });
    page = await context.newPage(); page.setDefaultTimeout(15000);
    page.on("pageerror", (error) => report.pageErrors.push(error.message));
    page.on("console", (message) => { if (message.type() === "error") report.consoleErrors.push(message.text()); });
    await page.goto(`${base}/?session=activity`, { waitUntil: "domcontentloaded", timeout: 90000 });
    await page.getByText("Historical answer stays outside the process group.", { exact: true }).waitFor();
    if (await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().isVisible()) await page.locator('.right-panel-container.right-panel-open .workspace-pane-close').first().click();
    if (await page.locator('.pilaude-context-toggle[aria-pressed="true"]').count()) await page.locator('.pilaude-context-toggle[aria-pressed="true"]').click();
    const emit = (events) => page.evaluate((events) => window.__activityEvents(events), events);
    if (process.env.E2E_CARET_ARTIFACT_ONLY === '1') {
      await inspectArtifactCard(page, state, report, artifact, emit);
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
      assert.ok(report.interceptedWrites.every((request) => request.path.endsWith('/lease') || request.path === '/api/agent/activity' && JSON.parse(request.body).type === 'abort'), 'Artifact fixture attempts only intercepted lease/Stop writes');
      report.status = 'passed';
      return report;
    }
    let sequence = 0;
    const start = async (name, markdown) => {
      const timestamp = stamp + sequence++ * 10000;
      const user = { role: "user", content: `Generated caret ${name} turn.`, timestamp };
      const message = assistant([{ type: "text", text: markdown }], timestamp + 1000);
      state.running = true; state.messages.push(user); state.entryIds.push(`caret-${name}-user`); state.revision++;
      await emit([{ type: "agent_start" }, { type: "message_end", message: user }, { type: "message_start", message: assistant([], timestamp + 1000) }, { type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 0 } }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta: markdown } }]);
      await page.waitForFunction(() => document.querySelector('[data-message-streaming="true"] .markdown-body')?.textContent.length > 0);
      await page.locator('[data-message-streaming="true"]').scrollIntoViewIfNeeded();
      // The composer overlays the bottom of the scrollport; place the actual
      // streamed text above that dock using the test's user-scroll boundary.
      await page.locator('[data-message-streaming="true"]').evaluate((element) => {
        const scroll = element.closest('.chat-scroll-container');
        const rect = element.getBoundingClientRect(), viewport = scroll.getBoundingClientRect();
        const dockTop = document.querySelector('textarea.chat-input-textarea')?.getBoundingClientRect().top ?? viewport.bottom;
        scroll.scrollTop += rect.top - viewport.top - Math.max(20, (Math.min(dockTop, viewport.bottom) - viewport.top - rect.height) / 2);
        scroll.dispatchEvent(new Event('scroll'));
      });
      return message;
    };
    const finish = async (name, message) => {
      const contentIndex = message.content.length - 1;
      await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex, content: message.content[contentIndex].text } }]);
      await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
      state.messages.push(message); state.entryIds.push(`caret-${name}-answer`); state.running = false; state.revision++;
      await emit([{ type: "message_end", message }, { type: "agent_end" }, { type: "agent_settled" }]);
    };
    if (process.env.E2E_CARET_FORMULA_ONLY === '1') {
      await inspectFormula(page, report, artifact, emit, start, finish);
      assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
      assert.ok(report.interceptedWrites.every((request) => request.path.endsWith('/lease') || request.path === '/api/agent/activity' && JSON.parse(request.body).type === 'abort'), 'Formula fixture attempts only intercepted lease/Stop writes');
      report.status = 'passed';
      return report;
    }
    for (const example of examples) {
      const message = await start(example.name, example.markdown);
      await page.waitForFunction((tail) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(tail), example.tail);
      const measurement = await measureCaret(page, example.tail);
      report.measurements.push({ name: example.name, ...measurement });
      assert.equal(measurement.activeText, 1, `${example.name}: only active text owns caret state`);
      assert.equal(measurement.carets.length, 1, `${example.name}: exactly one visible caret host`);
      assert.ok(measurement.textEnd, `${example.name}: rendered source tail has native text geometry`);
      const caret = measurement.carets[0];
      // Pseudo boxes have no DOMRect API. A root host after a block-level ending
      // is a concrete structural fallback: CSS creates an extra line after it.
      assert.equal(caret.root, false, `${example.name}: caret belongs to the terminal text container, never the Markdown root after a block`);
      if (caret.estimatedCaret.top >= measurement.textEnd.bottom + 3) report.findings.push({ name: example.name, kind: "estimated-caret-following-line-inspect-screenshot", distance: caret.estimatedCaret.top - measurement.textEnd.bottom });
      // Capture a native bright phase without modifying the caret animation.
      await page.waitForFunction(() => [...document.querySelectorAll('.message-streaming-caret, .message-streaming-caret *')].some((element) => {
        const style = getComputedStyle(element, '::after');
        return !['none', 'normal'].includes(style.content) && style.display !== 'none' && Number(style.opacity) > .85;
      }));
      const path = artifact(`caret-${example.name}.png`);
      await page.screenshot({ path, scale: "css", style: "nextjs-portal{visibility:hidden!important}" }); report.captures.push(path);
      if (example.name === "paragraph") {
        const prior = message.content[0].text;
        const next = "Generated second active text block caret end";
        await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex: 0, content: prior } }, { type: "message_update", assistantMessageEvent: { type: "text_start", contentIndex: 1 } }, { type: "message_update", assistantMessageEvent: { type: "text_delta", contentIndex: 1, delta: next } }]);
        await page.waitForFunction((next) => document.querySelector('[data-message-streaming="true"]')?.textContent.includes(next), next);
        const indexed = await measureCaret(page, next);
        report.measurements.push({ name: "indexed-next-text-block", ...indexed });
        assert.equal(indexed.activeText, 1); assert.equal(indexed.carets.length, 1);
        assert.ok(await page.getByText(prior, { exact: true }).isVisible(), "Earlier text block stays visible while the next block owns the sole caret");
        await emit([{ type: "message_update", assistantMessageEvent: { type: "text_end", contentIndex: 1, content: next } }]);
        message.content.push({ type: "text", text: next });
      }
      await finish(example.name, message);
    }
    report.checks.push("Paragraph, heading, inline, list, nested list, table, fence and quote endings measured through actual indexed streaming DOM; text_end removes caret before message_end");
    const reduced = await start("reduced-hidden", "Generated reduced and hidden caret end");
    const liveFrames = await page.evaluate(async () => {
      const frames = [], start = performance.now();
      while (performance.now() - start < 650) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const host = [...document.querySelectorAll('.message-streaming-caret, .message-streaming-caret *')].find((element) => { const style = getComputedStyle(element, '::after'); return !['none', 'normal'].includes(style.content) && style.display !== 'none'; });
        if (host) frames.push({ ms: performance.now() - start, opacity: Number(getComputedStyle(host, '::after').opacity), animation: getComputedStyle(host, '::after').animationName });
      }
      return frames;
    });
    report.measurements.push({ name: "normal-caret-native-opacity", frames: liveFrames });
    assert.ok(liveFrames.length > 1 && Math.max(...liveFrames.map((frame) => frame.opacity)) - Math.min(...liveFrames.map((frame) => frame.opacity)) > .1, "Normal caret opacity changes on the native animation timeline");
    await page.emulateMedia({ reducedMotion: "reduce" });
    const reducedMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "reduced", ...reducedMeasure });
    assert.equal(reducedMeasure.carets.length, 1); assert.equal(reducedMeasure.carets[0].animation, "none", "Reduced motion keeps the caret static");
    assert.equal(reducedMeasure.animations.filter((animation) => animation.playState === 'running').length, 0, "Reduced motion has no running caret animation");
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await page.locator(".chat-window").evaluate((element) => { element.hidden = true; });
    const hiddenMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "supplemental-dom-hidden", ...hiddenMeasure }); assert.equal(hiddenMeasure.carets.length, 0, "Supplemental DOM hidden ancestor exposes no visible caret");
    if (hiddenMeasure.animations.some((animation) => animation.playState === 'running')) report.findings.push({ name: 'supplemental-dom-hidden', kind: 'hidden-caret-animation-still-running', animations: hiddenMeasure.animations });
    await page.locator(".chat-window").evaluate((element) => { element.hidden = false; });
    await page.locator('.sidebar-new-row').click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') === 'new');
    const newMeasure = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "actual-new-hidden-chat", ...newMeasure });
    assert.equal(newMeasure.carets.length, 0, "Actual New hides the existing chat caret");
    if (newMeasure.animations.some((animation) => animation.playState === 'running')) report.findings.push({ name: 'actual-new-hidden-chat', kind: 'hidden-caret-animation-still-running', animations: newMeasure.animations });
    await page.getByRole('button', { name: 'Activity fixture activity', exact: true }).first().click();
    await page.waitForFunction(() => new URLSearchParams(location.search).get('view') !== 'new' && document.querySelector('[data-message-streaming="true"]')?.getClientRects().length > 0);
    const returned = await measureCaret(page, "Generated reduced and hidden caret end");
    report.measurements.push({ name: "actual-new-return-live-chat", ...returned });
    assert.equal(returned.carets.length, 1, "Returning from New restores the same live stream's sole caret");
    await finish("reduced-hidden", reduced);
    const stopped = await start("stop", "Generated stop caret end");
    const stop = page.locator("button.composer-abort-button:visible").first();
    await stop.click();
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
    await finish("stop", { ...stopped, stopReason: "aborted" });
    const failed = await start("error", "Generated error caret end");
    await emit([{ type: "prompt_error", errorMessage: "Generated fixture error" }]);
    await page.waitForFunction(() => !document.querySelector('[data-message-streaming="true"], .message-streaming-caret'));
    await finish("error", { ...failed, stopReason: "error", errorMessage: "Generated fixture error" });
    report.checks.push("Reduced motion has no running caret animation; supplemental hidden and actual New/return visibility measured; actual Stop/error remove active caret state immediately");
    assert.deepEqual(report.pageErrors, []); assert.deepEqual(report.consoleErrors, []); assert.deepEqual(report.externalRequests, []);
    assert.ok(report.interceptedWrites.every((request) => request.path.endsWith("/lease") || request.path === "/api/agent/activity" && JSON.parse(request.body).type === "abort"));
    report.status = report.findings.length ? "findings" : "passed";
  } catch (error) {
    report.status = "failed"; report.failure = { message: error.message, stack: error.stack };
    if (page && !page.isClosed()) await page.screenshot({ path: artifact("failure.png"), scale: "css" }).catch(() => {});
    console.error(error.stack); process.exitCode = 1;
  } finally {
    await writeFile(artifact("results.json"), JSON.stringify(report, null, 2));
    await browser?.close(); console.log(`Streaming caret boundaries ${report.status}: ${artifact("results.json")}`);
  }
  return report;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await runStreamingCaretBoundaries();
