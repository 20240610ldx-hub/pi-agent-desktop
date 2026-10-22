import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { chromium } from "playwright";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const hookSource = await readFile(new URL("../hooks/useAgentSession.ts", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

function elementBlock() {
  const start = source.indexOf("className={`chat-scroll-to-bottom");
  assert.notEqual(start, -1, "scroll-to-latest button not found");
  const buttonStart = source.lastIndexOf("<button", start);
  const buttonEnd = source.indexOf("</button>", start);
  assert.notEqual(buttonStart, -1);
  assert.notEqual(buttonEnd, -1);
  return source.slice(buttonStart, buttonEnd);
}

test("shows the scroll-to-latest button only when the viewport is detached from the tail", () => {
  assert.match(
    source,
    /className=\{`chat-scroll-to-bottom\$\{showScrollToBottom && !pendingScrollRestore \? " is-visible" : ""\}`\}/,
    "visibility must be a class toggle so the exit transition can play",
  );
});

test("floats the scroll-to-latest button above the composer, clear of the minimap", () => {
  const gate = source.indexOf("{!isEmptyNew && (");
  const marker = source.indexOf('className={`chat-scroll-to-bottom', gate);
  assert.notEqual(gate, -1);
  assert.notEqual(marker, -1);
  const container = source.slice(gate, marker);
  const block = elementBlock();

  assert.match(container, /position: "absolute"/);
  assert.match(container, /bottom: "100%"/);
  assert.match(container, /right: isMobile \? 0 : CHAT_MINIMAP_WIDTH/);
  assert.match(container, /justifyContent: "center"/);
  assert.match(container, /pointerEvents: "none"/);
  assert.match(cssSource, /\.chat-scroll-to-bottom\.is-visible \{[\s\S]*?pointer-events: auto;/);
  assert.match(cssSource, /\.chat-scroll-to-bottom:focus-visible \{[\s\S]*?outline: 2px solid var\(--accent\)/);
  assert.match(block, /onClick=\{\(\) => \{[^}]*prevScrollDistanceRef\.current = null;\s*scrollToLatest\(\);\s*\}\}/);
});

test("keeps the visible button faint until hover or focus", () => {
  const hidden = cssSource.slice(cssSource.indexOf(".chat-scroll-to-bottom {"));
  const visible = hidden.slice(hidden.indexOf(".chat-scroll-to-bottom.is-visible {"));
  const reveal = hidden.slice(hidden.indexOf(".chat-scroll-to-bottom.is-visible:hover"));

  assert.match(visible.slice(0, visible.indexOf("}")), /opacity: 0\.28;[\s\S]*?visibility: visible;[\s\S]*?transform: none;/);
  assert.match(reveal.slice(0, reveal.indexOf("}")), /opacity: 1;/);
  assert.match(
    cssSource,
    /\.chat-scroll-to-bottom\.is-visible:hover,\s*\.chat-scroll-to-bottom\.is-visible:focus-visible \{[\s\S]*?opacity: 1;/,
  );
});

test("fades the button in and out without motion when motion is reduced", () => {
  const hidden = cssSource.slice(cssSource.indexOf(".chat-scroll-to-bottom {"));

  assert.match(hidden.slice(0, hidden.indexOf("}")), /opacity: 0;[\s\S]*?visibility: hidden;[\s\S]*?transform: translateY\(4px\) scale\(0\.96\);/);
  assert.match(hidden.slice(0, hidden.indexOf("}")), /transition:[\s\S]*?opacity 0\.16s ease,[\s\S]*?transform 0\.16s ease,[\s\S]*?visibility 0s linear 0\.16s;/);
  assert.match(
    cssSource,
    /@media \(prefers-reduced-motion: reduce\) \{\s*\.chat-scroll-to-bottom,\s*\.chat-scroll-to-bottom\.is-visible \{\s*transform: none;\s*transition:\s*opacity 0\.16s ease,/,
  );
});

test("jumps to the live tail with the shared smooth scroll helper", () => {
  const block = elementBlock();

  assert.match(block, /aria-label=\{t\("chat.scrollToLatest"\)\}/);
  assert.match(source, /scrollToBottom, scrollToLatest, scrollToMessage,/);
});

test("exposes the detached-tail flag from the session hook without a ref read", () => {
  assert.match(hookSource, /const \[showScrollToBottom, setShowScrollToBottom\] = useState\(false\)/);
  assert.match(
    hookSource,
    /const detached = shouldShowScrollToLatest\(scrollTop, clientHeight, scrollHeight\);[\s\S]*?const shouldShow = revealScrollToLatest\(detached, isAgentRunning && isAttached\);\s*setShowScrollToBottom\(\(previous\) => \(previous === shouldShow \? previous : shouldShow\)\);/,
  );
  assert.match(hookSource, /promptAnchorActive,\s*showScrollToBottom,\s*\/\/ Refs/);
});

test("a prepend that lands after the jump to latest does not pull the view back up", () => {
  assert.match(hookSource, /if \(before && !latestIntentRef\.current\) isNearBottomRef\.current = false;/);
  assert.match(hookSource, /else if \(latestIntentRef\.current && isNearBottomRef\.current\) \{\s*\/\/[^\r\n]*\s*scrollToBottom\("auto"\);/);
});

// ── Browser: the real hook callbacks against real scroll geometry ──
// useAgentSession cannot be mounted without the app, so the callbacks that own
// scrolling are lifted out of the source and wired to a fixture page whose
// content grows like a streaming reply. Input is real Chromium wheel/click.
const hookFile = ts.createSourceFile("useAgentSession.ts", hookSource, ts.ScriptTarget.Latest, true);
function lift(name) {
  let result;
  (function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(hookFile) === name && node.initializer) {
      const init = ts.isCallExpression(node.initializer) ? node.initializer.arguments[0] : node.initializer;
      result = ts.transpileModule(`(${init.getText(hookFile)})`, { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText;
    }
    ts.forEachChild(node, visit);
  })(hookFile);
  assert.ok(result, `${name} not found in useAgentSession.ts`);
  return result;
}
async function libSource(path) {
  const text = await readFile(new URL(path, import.meta.url), "utf8");
  return ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } }).outputText.replace(/^export /gm, "");
}
const libs = `${await libSource("../lib/chat-lazy-load.ts")}\n${await libSource("../lib/cds-scroll.ts")}`;
const lifted = {
  scrollToBottom: lift("scrollToBottom"),
  scrollToLatest: lift("scrollToLatest"),
  handleScrollPositionChange: lift("handleScrollPositionChange"),
  markUserInput: lift("markUserInput"),
};

const FIXTURE = `<style>
  * { box-sizing: border-box } body { margin: 0 }
  #scroll { height: 400px; width: 600px; overflow-y: scroll; overflow-anchor: none }
  .row { height: 40px }
  #latest { visibility: hidden } #latest.is-visible { visibility: visible }
</style><div id="scroll"><div id="rows"></div></div><button id="latest">latest</button>`;

async function openFixture(browser, { running, rows = 120 }) {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await page.setContent(FIXTURE);
  await page.evaluate(({ libs, lifted, running, rows }) => {
    const container = document.querySelector("#scroll");
    const rowsEl = document.querySelector("#rows");
    const button = document.querySelector("#latest");
    const addRows = (n, where) => {
      for (let i = 0; i < n; i += 1) {
        const row = document.createElement("div");
        row.className = "row";
        row.textContent = "row";
        rowsEl.insertAdjacentElement(where, row);
      }
    };
    addRows(rows, "beforeend");
    const refs = {
      scrollContainerRef: { current: container }, liveFollowFrameRef: { current: null },
      isNearBottomRef: { current: true }, previousScrollTopRef: { current: 0 },
      lastUserScrollInputAtRef: { current: -Infinity }, latestIntentRef: { current: false },
      agentRunningRef: { current: running },
      setShowScrollToBottom: (next) => button.classList.toggle("is-visible", typeof next === "function" ? next(button.classList.contains("is-visible")) : next),
    };
    const build = (code, extra = {}) => new Function(...Object.keys(refs), ...Object.keys(extra), `${libs}\nreturn ${code}`)(...Object.values(refs), ...Object.values(extra));
    const scrollToBottom = build(lifted.scrollToBottom);
    const handleScrollPositionChange = build(lifted.handleScrollPositionChange, { scrollToBottom });
    const markUserInput = build(lifted.markUserInput);
    const scrollToLatest = build(lifted.scrollToLatest, { scrollToBottom });
    const canFollowStream = build("canFollowStream");
    for (const type of ["wheel", "touchstart", "keydown"]) container.addEventListener(type, markUserInput, { passive: true });
    container.addEventListener("scroll", handleScrollPositionChange, { passive: true });
    button.addEventListener("click", () => scrollToLatest());
    container.scrollTop = container.scrollHeight;
    refs.previousScrollTopRef.current = container.scrollTop;
    // Mirrors the live-follow block in the agent event handler.
    const grow = () => {
      addRows(1, "beforeend");
      if (refs.isNearBottomRef.current && canFollowStream(refs.lastUserScrollInputAtRef.current, performance.now()) && refs.liveFollowFrameRef.current === null) {
        refs.liveFollowFrameRef.current = requestAnimationFrame(() => {
          refs.liveFollowFrameRef.current = null;
          if (refs.isNearBottomRef.current) scrollToBottom("auto");
        });
      }
    };
    window.__fixture = {
      refs, container, addRows, scrollToBottom,
      startStream: () => { window.__fixture.timer = setInterval(grow, 30); },
      sample: () => ({ gap: container.scrollHeight - container.scrollTop - container.clientHeight, top: container.scrollTop, visible: button.classList.contains("is-visible") }),
    };
  }, { libs, lifted, running, rows });
  return page;
}

function launchBrowser() {
  return chromium.launch({ channel: process.platform === "win32" ? "msedge" : undefined, headless: true });
}

test("browser: back-to-latest during streaming lands on the tail, re-follows and hides the button", async () => {
  const browser = await launchBrowser();
  try {
    const page = await openFixture(browser, { running: true });
    await page.evaluate(() => window.__fixture.startStream());
    await page.waitForTimeout(300);
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, -1500);
    await page.waitForTimeout(500);
    const parked = await page.evaluate(() => window.__fixture.sample());
    assert.ok(parked.gap > 500 && parked.visible, `wheel up must detach and show the button: ${JSON.stringify(parked)}`);
    await page.waitForTimeout(300);
    const still = await page.evaluate(() => window.__fixture.sample());
    assert.ok(Math.abs(still.top - parked.top) <= 2, "a reader who scrolled up is not pulled back while streaming");

    await page.click("#latest");
    const samples = [];
    for (let i = 0; i < 40; i += 1) {
      await page.waitForTimeout(50);
      samples.push(await page.evaluate(() => window.__fixture.sample()));
    }
    const settled = samples.slice(2);
    assert.ok(settled.every((sample) => sample.gap <= 96), `stays within the reattach tolerance while streaming: max ${Math.max(...settled.map((sample) => sample.gap))}`);
    assert.ok(settled.every((sample) => !sample.visible), "the button stays hidden while the view follows the stream");
  } finally {
    await browser.close();
  }
});

test("browser: following the stream never flashes the back-to-latest button", async () => {
  const browser = await launchBrowser();
  try {
    const page = await openFixture(browser, { running: true });
    await page.evaluate(() => window.__fixture.startStream());
    let visible = 0;
    for (let i = 0; i < 100; i += 1) {
      await page.waitForTimeout(40);
      if ((await page.evaluate(() => window.__fixture.sample())).visible) visible += 1;
    }
    assert.equal(visible, 0);
  } finally {
    await browser.close();
  }
});

test("browser: back-to-latest on an idle session scrolls smoothly to the tail", async () => {
  const browser = await launchBrowser();
  try {
    const page = await openFixture(browser, { running: false });
    await page.mouse.move(300, 200);
    await page.mouse.wheel(0, -2000);
    await page.waitForTimeout(400);
    assert.ok((await page.evaluate(() => window.__fixture.sample())).visible);
    await page.click("#latest");
    await page.waitForTimeout(1500);
    const end = await page.evaluate(() => window.__fixture.sample());
    assert.ok(end.gap <= 1 && !end.visible, JSON.stringify(end));
  } finally {
    await browser.close();
  }
});

test("browser: a page of older history landing after the click does not undo back-to-latest", async () => {
  const browser = await launchBrowser();
  try {
    const page = await openFixture(browser, { running: false });
    await page.evaluate(() => { window.__fixture.container.scrollTop = 0; });
    await page.waitForTimeout(100);
    await page.click("#latest");
    await page.waitForTimeout(30);
    // The button handler has already dropped ChatWindow's captured distance; the
    // page now lands the way loadContext and the messages.length layout effect do.
    await page.evaluate(() => {
      const { refs, addRows, scrollToBottom } = window.__fixture;
      if (!refs.latestIntentRef.current) refs.isNearBottomRef.current = false;
      addRows(50, "afterbegin");
      if (refs.isNearBottomRef.current) scrollToBottom("auto");
    });
    await page.waitForTimeout(1500);
    const end = await page.evaluate(() => window.__fixture.sample());
    assert.ok(end.gap <= 1 && !end.visible, JSON.stringify(end));
  } finally {
    await browser.close();
  }
});
