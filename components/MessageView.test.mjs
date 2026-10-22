import assert from "node:assert/strict";
import test from "node:test";
import { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const {
  MessageView,
  ThinkingBlock,
  getModelDisplayName,
  getTokenEstimateText,
  getToolCallInputText,
  replaceUserMessageText,
  formatRelativeMessageTime,
} = await jiti.import("./MessageView.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { splitFinalAssistantBlocks, isMessageRunAnchor } = await jiti.import("@/lib/message-display");

function renderMessage(message, props = {}) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(MessageView, { message, ...props }),
    ),
  );
}

// Real MessageView + project CSS in Chromium. Only the OS clipboard and the
// parent fork callback are controlled boundaries; this is not a Pi session.
let browserFixture;
after(async () => { if (browserFixture) await (await browserFixture).browser.close(); });
async function assistantFixture(config = {}) {
  browserFixture ??= (async () => {
    const bundle = (await build({
      stdin: { contents: `import React from "react";
        import {createRoot} from "react-dom/client";
        import {I18nProvider} from "./hooks/useI18n";
        import {MessageView} from "./components/MessageView";
        function Harness() {
          const [text,setText] = React.useState(window.config.text ?? "First paragraph.\\n\\nSecond paragraph.");
          const [forking,setForking] = React.useState(false);
          window.setText = setText;
          window.setForking = setForking;
          return <I18nProvider><div className="app-shell" style={{display:'block',height:'100vh',overflow:'auto'}}>
            <button id="before">Before answer</button>
            <MessageView message={{role:'assistant',content:[{type:'text',text}]}} entryId="reply"
              forking={forking} onFork={(...args)=>{window.forks.push(args);setForking(true);}}/>
            <button id="after">After answer</button>
          </div></I18nProvider>;
        }
        createRoot(document.getElementById('root')).render(<React.StrictMode><Harness/></React.StrictMode>);`,
        resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "tsx" },
      bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent",
    })).outputFiles[0].text;
    const css = (await Promise.all(["app/globals.css", "app/settings.css", "vendor/open-claude-ui/cds-theme.css", "app/native-theme.css"].map(name => readFile(new URL(`../${name}`, import.meta.url), "utf8")))).join("\n").replace(/^@import[^;]*;/gm, "");
    return { bundle, css, browser: await chromium.launch({ headless: true }) };
  })();
  const { browser, bundle, css } = await browserFixture;
  const page = await browser.newPage({ viewport: { width: config.width ?? 900, height: 720 }, hasTouch: config.touch ?? false });
  page.setDefaultTimeout(3000);
  await page.addInitScript(config => {
    window.config = config;
    window.forks = [];
    window.writes = [];
    Object.defineProperty(navigator, "clipboard", { value: { writeText: text => {
      window.writes.push(text);
      return new Promise((resolve, reject) => { window.finishCopy = ok => ok ? resolve() : reject(new Error("clipboard denied")); });
    } } });
    document.execCommand = () => {
      document.querySelector("textarea")?.focus();
      return window.fallbackOk ?? false;
    };
  }, config);
  await page.route("**/*", route => route.request().url() === "https://assistant.fixture/"
    ? route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>` }) : route.abort());
  await page.goto("https://assistant.fixture/");
  await page.locator(".message-copy-action").waitFor();
  return page;
}

test("assistant inline code uses the C12 theme colors without changing C13 code blocks", async () => {
  const page = await assistantFixture({ text: "Inline `token`.\n\n```txt\nblock\n```" });
  try {
    for (const [theme, expected] of [["light", "rgb(142, 38, 38)"], ["dark", "rgb(236, 126, 126)"]]) {
      await page.evaluate(value => document.documentElement.classList.toggle("dark", value === "dark"), theme);
      assert.equal(await page.locator(".markdown-inline-code").evaluate(el => getComputedStyle(el).color), expected);
      assert.equal(await page.locator(".c13-code-content").evaluate(el => getComputedStyle(el).color), theme === "dark" ? "rgb(229, 231, 235)" : "rgb(32, 32, 32)");
    }
  } finally { await page.close(); }
});

test("assistant copy reports pending, failure and recovery without losing fallback focus", async () => {
  const page = await assistantFixture();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    const copy = page.locator(".message-copy-action");
    await copy.focus();
    await copy.press("Enter");
    assert.equal(await copy.getAttribute("aria-busy"), "true");
    await copy.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.writes), ["First paragraph.\n\nSecond paragraph."]);
    await page.evaluate(() => window.finishCopy(false));
    await page.getByRole("status").filter({ hasText: "Could not copy. Try again." }).waitFor();
    assert.equal(await copy.evaluate(el => el === document.activeElement), true);
    assert.equal(await copy.getAttribute("aria-busy"), "false");
    await copy.press("Enter");
    await page.evaluate(() => { window.fallbackOk = true; window.finishCopy(false); });
    await page.getByRole("status").filter({ hasText: "Copied" }).waitFor();
    assert.equal(await copy.evaluate(el => el === document.activeElement), true);
    assert.deepEqual(errors, []);
  } finally { await page.close(); }
});

test("assistant copy ignores stale completion and does not steal focus moved by the reader", async () => {
  const page = await assistantFixture();
  try {
    const copy = page.locator(".message-copy-action");
    await copy.focus();
    await copy.press("Enter");
    await page.evaluate(() => { window.setText("A different answer."); });
    await page.locator(".markdown-body").filter({ hasText: "A different answer." }).waitFor();
    await page.locator("#after").focus();
    await page.evaluate(() => window.finishCopy(true));
    await page.waitForFunction(() => document.querySelector(".message-copy-action").getAttribute("aria-busy") === "false");
    assert.equal(await page.getByRole("status").filter({ hasText: "Copied" }).count(), 0);
    assert.equal(await page.locator("#after").evaluate(el => el === document.activeElement), true);
  } finally { await page.close(); }
});

test("assistant fork stays focused during parent pending and sends the exact after-entry boundary once", async () => {
  const page = await assistantFixture();
  try {
    const fork = page.getByRole("button", { name: "Fork from here", exact: true });
    await fork.focus();
    await fork.press("Enter");
    assert.equal(await fork.getAttribute("aria-busy"), "true");
    assert.equal(await fork.evaluate(el => el === document.activeElement), true);
    await fork.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.forks), [["reply", "after"]]);
    await page.evaluate(() => window.setForking(false));
    assert.equal(await fork.evaluate(el => el === document.activeElement), true);
    await fork.press("Enter");
    assert.deepEqual(await page.evaluate(() => window.forks), [["reply", "after"], ["reply", "after"]]);
  } finally { await page.close(); }
});

test("assistant actions reveal by hover, Tab and touch without shifting a long answer", async () => {
  for (const touch of [false, true]) {
    const page = await assistantFixture({ width: 390, touch, text: "A readable long answer.\n\n".repeat(80) });
    try {
      const footer = page.locator(".message-assistant-footer");
      const copy = page.locator(".message-copy-action");
      if (touch) {
        assert.equal(await footer.evaluate(el => getComputedStyle(el).opacity), "1");
        await copy.tap();
      } else {
        assert.equal(await footer.evaluate(el => getComputedStyle(el).opacity), "0");
        await footer.hover();
        await page.waitForFunction(() => getComputedStyle(document.querySelector(".message-assistant-footer")).opacity === "1");
        await page.mouse.move(389, 0);
        await page.locator("#before").focus();
        await page.keyboard.press("Tab");
        assert.equal(await copy.evaluate(el => el === document.activeElement), true);
        await copy.press("Enter");
      }
      const before = await page.locator(".app-shell").evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight }));
      await page.evaluate(() => window.finishCopy(false));
      await page.getByRole("status").filter({ hasText: "Could not copy. Try again." }).waitFor();
      assert.deepEqual(await page.locator(".app-shell").evaluate(el => ({ top: el.scrollTop, height: el.scrollHeight })), before);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    } finally { await page.close(); }
  }
});

test("validated chapter records render a literal bold anchor without an extension inspector", () => {
  const chapter = { role: "custom", customType: "pi-web:chapter", display: true, content: "Validation <tag> & **literal**", details: { version: 1, chapterId: "chapter-unique", title: "Validation <tag> & **literal**" } };
  const html = renderMessage(chapter);
  assert.match(html, /data-conversation-chapter="chapter-unique"/);
  assert.match(html, /<strong>Validation &lt;tag&gt; &amp; \*\*literal\*\*<\/strong>/);
  assert.doesNotMatch(html, /markdown-custom-message|Pi Web:chapter|<tag>/);
  assert.doesNotMatch(renderMessage({ ...chapter, details: { ...chapter.details, version: 2 } }), /data-conversation-chapter=/);
  assert.doesNotMatch(renderMessage({ role: "assistant", content: [{ type: "text", text: "**Ordinary bold text**" }] }), /data-conversation-chapter=/);
});

test("recorded successful chapter controls keep original search indices and failed controls stay reachable", () => {
  const call = { type: "toolCall", toolCallId: "chapter-call", toolName: "mark_chapter", input: { title: "Verification" } };
  const thinking = { type: "thinking", thinking: "Historical reasoning", deferred: true };
  const message = { role: "assistant", content: [call, thinking, { type: "text", text: "Visible response." }] };
  const result = { role: "toolResult", toolCallId: "chapter-call", content: [{ type: "text", text: "Recorded" }], isError: false };
  const props = { chapterIds: new Set(["chapter-call"]), toolResults: new Map([["chapter-call", result]]), searchBlock: thinking };
  const html = renderMessage(message, props);
  assert.doesNotMatch(html, /data-tool-call-id="chapter-call"/);
  assert.match(html, /data-search-target="true"/);
  assert.match(html, /Historical reasoning/);
  assert.match(renderMessage(message, { ...props, toolResults: new Map([["chapter-call", { ...result, isError: true }]]) }), /data-tool-call-id="chapter-call"/);
  assert.equal(MessageView.compare({ message, ...props }, { message, ...props, chapterIds: new Set() }), false);
  assert.equal(MessageView.compare({ message, ...props }, { message, ...props, chapterIds: new Set(["chapter-call", "unrelated"]) }), true);
});

test("completed responses expose a fork action, while streaming responses cannot fork", () => {
  const message = { role: "assistant", content: [{ type: "text", text: "A completed response." }] };
  const props = { entryId: "reply", onFork() {} };
  assert.match(renderMessage(message, props), /aria-label="Fork from here"/);
  assert.doesNotMatch(renderMessage(message, { ...props, isStreaming: true }), /aria-label="Fork from here"/);
});

test("relative message times respect locale, elapsed minutes and invalid clocks", () => {
  assert.equal(typeof formatRelativeMessageTime, "function");
  const now = Date.UTC(2026, 9, 18, 2);
  assert.equal(formatRelativeMessageTime(now - 180_000, "en", now), "3 minutes ago");
  assert.equal(formatRelativeMessageTime(now - 7_200_000, "en", now), "2 hours ago");
  assert.equal(formatRelativeMessageTime(now - 180_000, "zh-CN", now), "3分钟前");
  assert.equal(formatRelativeMessageTime(now + 60_000, "en", now), "now");
  assert.equal(formatRelativeMessageTime(NaN, "en", now), null);
});

test("updates a reused message when its written files change", () => {
  const props = { message: { role: "assistant", content: [] } };
  assert.equal(MessageView.compare(props, props), true);
  assert.equal(MessageView.compare(props, { ...props, writtenFiles: [{ path: "/tmp/result.txt" }] }), false);
});

test("rerenders when active block metadata changes but ignores unrelated running tools", () => {
  const message = { role: "assistant", content: [
    { type: "thinking", thinking: "Reasoning" },
    { type: "toolCall", toolCallId: "current", toolName: "read", input: {} },
  ] };
  const props = { message, isStreaming: true, activeThinkingIndex: 0, runningToolCallIds: new Set(), activeToolCallId: null };
  assert.equal(MessageView.compare(props, { ...props, activeThinkingIndex: null }), false);
  assert.equal(MessageView.compare(props, { ...props, activeToolCallId: "current" }), false);
  assert.equal(MessageView.compare(props, { ...props, runningToolCallIds: new Set(["current"]) }), false);
  assert.equal(MessageView.compare(props, { ...props, runningToolCallIds: new Set(["another-message"]) }), true);
});

test("matches response model aliases and otherwise includes the provider", () => {
  const names = {
    "gateway:claude-sonnet-5": "Sonnet 5",
    "custom-api:GLM-5.3": "GLM 5.3",
  };

  assert.equal(getModelDisplayName("gateway", "anthropic/claude-sonnet-5", names), "Sonnet 5");
  assert.equal(getModelDisplayName("CUSTOM-API", "glm-5.3", names), "GLM 5.3");
  assert.equal(getModelDisplayName("gateway", "unknown-model", names), "gateway/unknown-model");
});

test("previews the first thinking line and reveals the full text with the saved default", () => {
  const previousWindow = globalThis.window;
  try {
    for (const expanded of [false, true]) {
      globalThis.window = { localStorage: { getItem: () => String(expanded) } };
      const html = renderToStaticMarkup(React.createElement(
        I18nProvider,
        null,
        React.createElement(ThinkingBlock, {
          block: { type: "thinking", thinking: "**Independent reasoning**\n\nDetailed second line." },
          blockIndex: 2,
          duration: 3,
        }),
      ));
      assert.match(html, new RegExp(`aria-expanded="${expanded}"`));
      assert.equal((html.match(/>[^<]*Independent reasoning[^<]*</g) ?? []).length, 1);
      assert.equal(html.includes("Detailed second line."), expanded);
      assert.match(html, /aria-label="Thinking: /);
      assert.match(html, /3s/);
    }
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test("only the explicitly active thinking block shimmers while the message streams", () => {
  const message = { role: "assistant", content: [
    { type: "thinking", thinking: "" },
    { type: "thinking", thinking: "Completed reasoning" },
    { type: "thinking", thinking: "Active reasoning" },
  ] };
  const html = renderMessage(message, { isStreaming: true, activeThinkingIndex: 2 });
  assert.match(html, /class="activity-shimmer" data-active="true">Active reasoning/);
  assert.doesNotMatch(html, /class="activity-shimmer"[^>]*>Completed reasoning/);
  assert.doesNotMatch(renderMessage(message, { isStreaming: true }), /class="activity-shimmer"/);
  assert.doesNotMatch(renderMessage(message, { isStreaming: false, activeThinkingIndex: 2 }), /class="activity-shimmer"/);
});

test("shows deferred thinking previews without loading the full content", () => {
  const html = renderMessage({
    role: "assistant",
    content: [{ type: "thinking", thinking: "Historical first line", deferred: true }],
  });
  assert.match(html, />Historical first line<\/span>/);
  assert.match(html, /aria-expanded="false"/);
});

test("marks the matched thinking block for scrolling without changing its saved expansion", () => {
  const matched = { type: "thinking", thinking: "Matched reasoning" };
  const html = renderMessage({ role: "assistant", content: [
    { type: "thinking", thinking: "" }, matched, { type: "text", text: "Answer" },
  ] }, { searchBlock: matched });
  assert.equal((html.match(/data-search-target="true"/g) ?? []).length, 1);
  assert.match(html, /class="thinking-disclosure"[^>]*data-search-target="true"/);
  assert.match(html, /aria-label="Thinking: Matched reasoning"/);
  assert.match(html, /aria-expanded="false"/);
});

test("marks only the matched text block after splitting thinking and the final answer", () => {
  const message = {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "" },
      { type: "thinking", thinking: "Thinking about the result" },
      { type: "text", text: "Process text" },
      { type: "toolCall", toolCallId: "read-1", toolName: "read", input: {} },
      { type: "text", text: "First answer" },
      { type: "text", text: "Matched pi-cwd-spark answer" },
    ],
  };
  const { processBlocks, answerBlocks } = splitFinalAssistantBlocks(message);
  for (const index of [2, 4, 5]) {
    const searchBlock = message.content[index];
    for (const content of [processBlocks, answerBlocks]) {
      const html = renderMessage({ ...message, content }, { searchBlock });
      assert.equal((html.match(/data-search-target="true"/g) ?? []).length, content.includes(searchBlock) ? 1 : 0);
      if (content.includes(searchBlock)) {
        assert.match(html, new RegExp(`data-search-target="true">(?:(?!data-message-text)[\\s\\S])*${searchBlock.text}`));
      }
    }
  }
});

test("keeps streamed tool input out of collapsed markup while counting it", () => {
  const block = {
    type: "toolCall",
    toolCallId: "call-write-1",
    toolName: "write",
    input: {},
    rawInput: '{"path":"/tmp/file","content":"secret-stream-fragment',
  };
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, { isStreaming: true });

  assert.match(html, /write/);
  assert.match(html, /Generating parameters/);
  assert.doesNotMatch(html, /secret-stream-fragment/);
  assert.equal(getToolCallInputText(block), block.rawInput);
  assert.equal(getTokenEstimateText(block), block.rawInput);
});

test("a persisted tool with partial output stays running and only the primary tool shimmers", () => {
  const first = { type: "toolCall", toolCallId: "parallel-first", toolName: "read", input: { path: "a" } };
  const primary = { type: "toolCall", toolCallId: "parallel-primary", toolName: "bash", input: { command: "long-command" } };
  const message = { role: "assistant", content: [first, primary] };
  const props = {
    isStreaming: false,
    runningToolCallIds: new Set([first.toolCallId, primary.toolCallId]),
    activeToolCallId: primary.toolCallId,
    toolResults: new Map([[primary.toolCallId, {
      role: "toolResult", toolCallId: primary.toolCallId, content: [{ type: "text", text: "Partial output" }],
    }]]),
  };
  const html = renderMessage(message, props);
  assert.equal((html.match(/data-status="running"/g) ?? []).length, 2);
  assert.match(html, /class="activity-shimmer" data-active="true">bash/);
  assert.equal((html.match(/class="activity-shimmer"/g) ?? []).length, 1);
  assert.doesNotMatch(html, /data-status="success"|data-status="cancelled"/);
  assert.doesNotMatch(renderMessage(message, { ...props, activeToolCallId: "not-running" }), /activity-shimmer/);
});

test("publishing a chapter keeps sibling tools in the current live run while historical siblings stay cancelled", () => {
  const chapterCall = { type: "toolCall", toolCallId: "chapter-call", toolName: "mark_chapter", input: { title: "Verification" } };
  const running = { type: "toolCall", toolCallId: "running", toolName: "read", input: { path: "a.txt" } };
  const queued = { type: "toolCall", toolCallId: "queued", toolName: "read", input: { path: "b.txt" } };
  const batch = { role: "assistant", content: [chapterCall, running, queued] };
  const chapter = { role: "custom", customType: "pi-web:chapter", display: true, content: "Verification", details: { version: 1, chapterId: "chapter-call", title: "Verification" } };
  const messages = [{ role: "user", content: "Verify this." }, batch, chapter];
  const props = { chapterIds: new Set(["chapter-call"]), toolResults: new Map([["chapter-call", { role: "toolResult", toolCallId: "chapter-call", content: [], isError: false }]]), runningToolCallIds: new Set(["running"]), activeToolCallId: "running", isStreaming: false };
  const liveTurn = 1 >= messages.findLastIndex(isMessageRunAnchor);
  const html = renderMessage(batch, { ...props, liveTurn });
  assert.match(html, /data-status="pending" data-tool-call-id="queued"/);
  messages.push({ role: "user", content: "Next request." });
  assert.match(renderMessage(batch, { ...props, liveTurn: 1 >= messages.findLastIndex(isMessageRunAnchor) }), /data-status="cancelled" data-tool-call-id="queued"/);
});

test("queued tools stay pending after the live turn's assistant message finishes streaming", () => {
  const first = { type: "toolCall", toolCallId: "sequential-first", toolName: "read", input: { path: "a" } };
  const queued = { type: "toolCall", toolCallId: "sequential-queued", toolName: "read", input: { path: "b" } };
  const message = { role: "assistant", content: [first, queued] };
  const props = { message, isStreaming: false, liveTurn: true, runningToolCallIds: new Set([first.toolCallId]), activeToolCallId: first.toolCallId };
  const html = renderMessage(message, props);
  assert.match(html, /data-status="running" data-tool-call-id="sequential-first"/);
  assert.match(html, /data-status="pending" data-tool-call-id="sequential-queued"/);
  assert.doesNotMatch(html, /data-status="cancelled"/);
  assert.match(renderMessage(message, { ...props, liveTurn: false }), /data-status="cancelled" data-tool-call-id="sequential-queued"/);
  assert.equal(MessageView.compare(props, { ...props, liveTurn: false }), false);
});

test("a stopped partial result cannot present success or a completion duration", () => {
  const block = { type: "toolCall", toolCallId: "stopped-partial", toolName: "bash", input: { command: "long-command" } };
  const props = {
    runningToolCallIds: new Set(), partialToolCallIds: new Set([block.toolCallId]), activeToolCallId: block.toolCallId,
    toolResults: new Map([[block.toolCallId, { role: "toolResult", toolCallId: block.toolCallId, timestamp: 11_000, content: [{ type: "text", text: "Progress" }] }]]),
  };
  const message = { role: "assistant", timestamp: 1_000, content: [block] };
  const html = renderMessage(message, props);
  assert.match(html, /data-status="cancelled"/);
  assert.doesNotMatch(html, /activity-shimmer|>10s</);
  assert.match(renderMessage(message, { ...props, isStreaming: true }), /data-status="pending"/);
  const base = { message, partialToolCallIds: new Set() };
  assert.equal(MessageView.compare(base, { ...base, partialToolCallIds: props.partialToolCallIds }), false);
});

test("the streaming caret belongs only to the explicitly active last text block", () => {
  const message = { role: "assistant", content: [{ type: "text", text: "Earlier" }, { type: "text", text: "Current" }] };
  const props = { isStreaming: true, activeTextIndex: 1 };
  const html = renderMessage(message, props);
  assert.equal((html.match(/data-message-streaming="true"/g) ?? []).length, 1);
  assert.match(html, /data-message-streaming="true"[\s\S]*Current/);
  assert.doesNotMatch(renderMessage(message, { ...props, activeThinkingIndex: 0 }), /data-message-streaming="true"/);
  assert.doesNotMatch(renderMessage(message, { ...props, activeToolCallId: "call" }), /data-message-streaming="true"/);
  assert.doesNotMatch(renderMessage(message, { ...props, isStreaming: false }), /data-message-streaming="true"/);
  assert.doesNotMatch(renderMessage(message, { isStreaming: true }), /data-message-streaming="true"/);
  assert.equal(MessageView.compare({ message, activeTextIndex: 0 }, { message, activeTextIndex: 1 }), false);
});

test("local shell execution uses actual running, cancelled and failed states", () => {
  const base = { role: "bashExecution", command: "long-command", timestamp: 24_000 };
  assert.match(renderMessage({ ...base, output: "" }), /data-status="running"/);
  assert.match(renderMessage({ ...base, output: "Partial output" }), /data-status="running"/);
  assert.match(renderMessage({ ...base, output: "Partial output", cancelled: true }), /data-status="cancelled"/);
  const failed = renderMessage({ ...base, output: "exit failed", exitCode: 1 });
  assert.match(failed, /data-status="error"/);
  assert.match(failed, /class="tool-call-trigger"[^>]*aria-expanded="true"/);
  assert.match(failed, /exit failed/);
  assert.match(renderMessage({ ...base, output: "done", exitCode: 0 }), /data-status="success"/);
});

test("tool rows expose honest pending, generating, completed, failed and cancelled states", () => {
  const block = { type: "toolCall", toolCallId: "status-call", toolName: "read", input: { path: "secret-body" } };
  const result = { role: "toolResult", toolCallId: block.toolCallId, content: [{ type: "text", text: "done" }] };
  const cases = [
    { status: "pending", props: { isStreaming: true } },
    { status: "generating", block: { ...block, rawInput: "" }, props: { isStreaming: true, activeToolCallId: block.toolCallId } },
    { status: "success", props: { toolResults: new Map([[block.toolCallId, result]]) } },
    { status: "error", props: { toolResults: new Map([[block.toolCallId, { ...result, isError: true }]]) } },
    { status: "cancelled", props: {} },
  ];
  for (const item of cases) {
    const html = renderMessage({ role: "assistant", content: [item.block ?? block] }, item.props);
    assert.match(html, new RegExp(`class="tool-call-row" data-status="${item.status}"`));
    assert.match(html, /class="tool-call-status-icon"/);
    assert.doesNotMatch(html, /border:1px solid rgba\(34,197,94,0\.25\)/);
    if (item.status === "pending") assert.doesNotMatch(html, /activity-shimmer/);
  }
});

test("tool disclosure is a linked native button with no collapsed argument body", () => {
  const block = { type: "toolCall", toolCallId: "linked-call", toolName: "write", input: { path: "/tmp/file", content: "hidden-secret-content" } };
  const html = renderMessage({ role: "assistant", content: [block] }, { isStreaming: true });
  assert.match(html, /<button type="button"[^>]*class="tool-call-trigger"[^>]*aria-expanded="false"/);
  const bodyId = html.match(/class="tool-call-trigger"[^>]*aria-controls="([^"]+)"/)[1];
  assert.ok(html.includes(`id="${bodyId}" class="disclosure-body tool-call-grid"`));
  assert.match(html, /class="disclosure-body tool-call-grid"[^>]*aria-hidden="true"[^>]*inert=""/);
  assert.doesNotMatch(html, /hidden-secret-content/);
});

test("errors reveal their result automatically while ordinary success remains collapsed", () => {
  const block = { type: "toolCall", toolCallId: "auto-error", toolName: "read", input: { path: "/missing" } };
  const result = { role: "toolResult", toolCallId: block.toolCallId, isError: true, content: [{ type: "text", text: "File missing" }] };
  const message = { role: "assistant", content: [block] };
  const html = renderMessage(message, { toolResults: new Map([[block.toolCallId, result]]) });
  assert.match(html, /class="tool-call-trigger"[^>]*aria-expanded="true"/);
  assert.match(html, /File missing/);
  assert.match(html, /class="markdown-code-action markdown-code-copy"/);
  const success = renderMessage(message, { toolResults: new Map([[block.toolCallId, { ...result, isError: false }]]) });
  assert.match(success, /class="tool-call-trigger"[^>]*aria-expanded="false"/);
  assert.doesNotMatch(success, /File missing/);
});

test("renders subagents as standard tool calls with only an extra session button", () => {
  const block = {
    type: "toolCall",
    toolCallId: "call-agent-1",
    toolName: "Agent",
    input: {
      subagent_type: "Explore",
      prompt: "Find the parser",
      description: "Find parser",
    },
  };
  const result = {
    role: "toolResult",
    toolCallId: block.toolCallId,
    content: [{ type: "text", text: "Parser is in lib/parser.ts" }],
    details: {
      kind: "pi-web-subagent",
      sessionId: "child-session",
      profile: "Explore",
      description: "Find parser",
      status: "completed",
      runInBackground: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, {
    toolResults: new Map([[block.toolCallId, result]]),
    onOpenSession() {},
  });

  assert.match(html, /class="tool-call-row" data-status="success"/);
  assert.match(html, />Agent</);
  assert.match(html, />Explore</);
  assert.match(html, /aria-label="Open sub-agent session"/);
  assert.doesNotMatch(html, />completed</);
  assert.doesNotMatch(html, />Find parser</);

  const ordinaryHtml = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [{ ...block, toolCallId: "call-extension-1", toolName: "extension_tool" }],
  }, {
    toolResults: new Map(),
    onOpenSession() {},
  });
  assert.doesNotMatch(ordinaryHtml, /Open sub-agent session/);
});

const COMPLETE_SKILL_EXPANSION = `<skill name="review" location="/skills/review/SKILL.md">
References are relative to /skills/review.

Review the supplied files.
</skill>

src/main.ts`;

test("renders a provider error when the assistant message has no content", () => {
  const html = renderMessage({
    role: "assistant",
    provider: "openai",
    model: "gpt-test",
    content: [],
    stopReason: "error",
    errorMessage: "OpenAI API error (403): <html>request forbidden</html>",
  });

  assert.match(html, /role="alert"/);
  assert.match(html, /Request failed/);
  assert.match(html, /OpenAI API error \(403\)/);
  assert.match(html, /&lt;html&gt;request forbidden&lt;\/html&gt;/);
});

test("renders a truncation notice for stopReason length", () => {
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [{ type: "thinking", thinking: "Long reasoning chain" }],
    stopReason: "length",
  });

  assert.match(html, /role="alert"/);
  assert.match(html, /output limit was reached before an answer/i);
  assert.doesNotMatch(html, /follow-up/i);
});

test("keeps the follow-up hint when a truncated response already has text", () => {
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [{ type: "text", text: "Partial answer" }],
    stopReason: "length",
  });

  assert.match(html, /Partial answer/);
  assert.match(html, /follow-up/i);
  assert.doesNotMatch(html, /Compact context/);
});

test("offers compaction on an unanswered truncation and keeps its error with the reply", () => {
  let compacted = 0;
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [],
    stopReason: "length",
  }, {
    onCompact: () => { compacted += 1; },
    compactError: "Summarization failed: generation hit the token cap",
  });

  assert.match(html, /Compact context/);
  assert.match(html, /generation hit the token cap/);
  assert.equal(compacted, 0);
});

test("renders partial assistant content before the provider error", () => {
  const html = renderMessage({
    role: "assistant",
    provider: "openai",
    model: "gpt-test",
    content: [{ type: "text", text: "Partial response" }],
    stopReason: "error",
    errorMessage: "Connection closed",
  });

  assert.match(html, /Partial response/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Connection closed/);
  assert.ok(html.indexOf("Partial response") < html.indexOf("Connection closed"));
});

test("marks persisted assistant messages with their source entry", () => {
  const html = renderMessage({
    role: "assistant",
    provider: "openai",
    model: "gpt-test",
    content: [{ type: "text", text: "Select this response" }],
  }, { entryId: "assistant-entry" });

  assert.match(html, /data-message-role="assistant"/);
  assert.match(html, /data-entry-id="assistant-entry"/);
});

test("renders a complete SDK skill expansion as a compact command", () => {
  const html = renderMessage({
    role: "user",
    content: COMPLETE_SKILL_EXPANSION,
  });

  assert.match(html, /\/skill:review/);
  assert.match(html, /src\/main\.ts/);
  assert.match(html, /aria-expanded="false"/);
  assert.doesNotMatch(html, /Review the supplied files/);
});

test("does not collapse incomplete skill-looking user text", () => {
  const html = renderMessage({
    role: "user",
    content: '<skill name="review" location="/skills/review/SKILL.md">\nordinary user text',
  });

  assert.match(html, /ordinary user text/);
  assert.doesNotMatch(html, /aria-expanded/);
});

test("shows every line of pasted plain text in a user message (#680)", () => {
  const lines = [
    "第1题（看门狗）",
    "嵌入式系统中，看门狗（WatchDog）的基本工作原理是（ ）",
    "A. 监控系统温度，过热时自动降频",
    "B. 计数器自动计数，程序定期将其重置；若程序跑飞计数器溢出，则系统复位重启",
  ];
  const expected = `<p>${lines.join("<br/>")}</p>`;

  for (const lineEnding of ["\n", "\r\n", "\r"]) {
    const html = renderMessage({ role: "user", content: lines.join(lineEnding) });
    assert.ok(html.includes(expected), JSON.stringify(lineEnding));
    assert.doesNotMatch(html, /\r/);
  }

  const listHtml = renderMessage({
    role: "user",
    content: [{ type: "text", text: "1. 看门狗的原理是（ ）\nA. 监控温度\nB. 计数器" }],
  });
  assert.match(listHtml, /<li>看门狗的原理是（ ）<br\/>A\. 监控温度<br\/>B\. 计数器<\/li>/);
});

test("keeps assistant soft line breaks as Markdown paragraphs", () => {
  const html = renderMessage({ role: "assistant", content: [{ type: "text", text: "one\ntwo" }] });

  assert.match(html, /<p>one\ntwo<\/p>/);
  assert.doesNotMatch(html, /<br/);
});

test("renders lone carriage returns in compact command arguments as line breaks", () => {
  const html = renderMessage({
    role: "user",
    content: COMPLETE_SKILL_EXPANSION.replace("src/main.ts", "src/main.ts\rsrc/app.ts"),
  });

  assert.match(html, /\/skill:review/);
  assert.match(html, /src\/main\.ts\nsrc\/app\.ts/);
  assert.doesNotMatch(html, /\r/);
});

test("keeps attached images when restoring a compact command for editing", () => {
  const image = {
    type: "image",
    source: { type: "base64", media_type: "image/png", data: "QUJDRA==" },
  };
  const restored = replaceUserMessageText({
    role: "user",
    content: [{ type: "text", text: COMPLETE_SKILL_EXPANSION }, image],
  }, "/skill:review src/main.ts");

  assert.deepEqual(restored.content, [
    { type: "text", text: "/skill:review src/main.ts" },
    image,
  ]);
});

test("renders user-message images as buttons that open a larger preview", () => {
  const html = renderMessage({
    role: "user",
    content: [
      { type: "text", text: "inspect this" },
      { type: "image", data: "YWJj", mimeType: "image/png" },
    ],
    timestamp: Date.now(),
  });

  assert.match(html, /<button[^>]+aria-label="Preview image"[^>]*>/);
  assert.match(html, /<img[^>]+src="data:image\/png;base64,YWJj"/);
});

test("sent images retain upload order and use an uncapped wrapping image message", () => {
  const images = Array.from({ length: 12 }, (_, index) => ({
    type: "image", data: Buffer.from(`image-${index}`).toString("base64"), mimeType: "image/png",
  }));
  const html = renderMessage({ role: "user", content: images, timestamp: Date.now() });
  const rendered = [...html.matchAll(/<img[^>]*class="message-user-image"[^>]*src="data:image\/png;base64,([^"]+)"/g)];
  assert.deepEqual(rendered.map((match) => match[1]), images.map((image) => image.data));
  assert.match(html, /class="message-user-content has-images"/);
  assert.match(html, /class="message-user-images"/);
  assert.doesNotMatch(html, /class="message-user-bubble/);
  assert.doesNotMatch(html, /max-height:\d+px|overflow-y:auto/);
  const textOnly = renderMessage({ role: "user", content: "long text", timestamp: Date.now() });
  assert.doesNotMatch(textOnly, /class="message-user-content has-images"/);
  assert.match(textOnly, /max-height:300px;overflow-y:auto/);
});

test("mixed text and compact commands render one text bubble beside the image grid", () => {
  const image = { type: "image", data: "YWJj", mimeType: "image/png" };
  for (const text of ["Text following the images", COMPLETE_SKILL_EXPANSION]) {
    const html = renderMessage({ role: "user", content: [image, { type: "text", text }] });
    assert.equal([...html.matchAll(/class="message-user-images"/g)].length, 1);
    assert.equal([...html.matchAll(/class="message-user-bubble"/g)].length, 1);
    assert.match(html, /<div class="message-user-images">[\s\S]*?<\/button><\/div><div class="message-user-bubble"/);
    assert.match(html, /max-height:300px;overflow-y:auto/);
    if (text === COMPLETE_SKILL_EXPANSION) {
      assert.match(html, /\/skill:review/);
      assert.match(html, /aria-expanded="false"/);
    } else {
      assert.match(html, /Text following the images/);
    }
  }
  assert.doesNotMatch(renderMessage({ role: "user", content: [] }), /class="message-user-bubble/);
});

test("marks apply_patch returned failures as errors even when isError is unset", () => {
  const block = {
    type: "toolCall",
    toolCallId: "call-patch-1",
    toolName: "apply_patch",
    input: {
      input: "*** Begin Patch\n*** Update File: src/a.ts\n-old\n+new\n*** End Patch",
    },
  };
  const failed = {
    role: "toolResult",
    toolCallId: block.toolCallId,
    content: [{ type: "text", text: "apply_patch failed.\nRecovery: MUST read src/a.ts before retrying." }],
    details: {
      result: { appliedFiles: [], failures: [{ filePath: "src/a.ts", message: "context mismatch" }] },
    },
  };
  const html = renderMessage({
    role: "assistant",
    provider: "openai",
    model: "gpt-test",
    content: [block],
  }, { toolResults: new Map([[block.toolCallId, failed]]) });

  assert.match(html, /class="tool-call-row" data-status="error"/);
  assert.match(html, />apply_patch</);
  assert.match(html, /aria-expanded="true"/);
});

test("renders custom-message images as buttons that open a larger preview", () => {
  const html = renderMessage({
    role: "custom",
    customType: "extension",
    content: [{ type: "image", data: "YWJj", mimeType: "image/png" }],
    timestamp: Date.now(),
  });

  assert.match(html, /<button[^>]+aria-label="Preview image"[^>]*>/);
  assert.match(html, /<img[^>]+src="data:image\/png;base64,YWJj"/);
});

test("shows tool-result images while the tool details stay collapsed", () => {
  const block = {
    type: "toolCall",
    toolCallId: "call-shot-1",
    toolName: "page_screenshot",
    input: { tabId: 7 },
  };
  const result = {
    role: "toolResult",
    toolCallId: block.toolCallId,
    content: [
      { type: "text", text: "captured-1280x720" },
      { type: "image", data: "YWJj", mimeType: "image/png" },
    ],
  };
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, { toolResults: new Map([[block.toolCallId, result]]) });

  assert.match(html, /<button[^>]+aria-label="Preview image"[^>]*>/);
  assert.match(html, /<img[^>]+src="data:image\/png;base64,YWJj"/);
  assert.doesNotMatch(html, /captured-1280x720/);
  assert.doesNotMatch(html, /"tabId"/);
});

test("uses the unanswered truncation notice for an empty length reply", () => {
  // A nearly full context can clamp the output so far that nothing, not even
  // thinking, comes back; the notice must not blame thinking alone.
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [],
    stopReason: "length",
  });

  assert.match(html, /output limit was reached before an answer/i);
  assert.match(html, /nearly full context/i);
  assert.doesNotMatch(html, /follow-up/i);
});

const { setToolCallExpanded } = await jiti.import("@/lib/tool-call-expansion");

test("completed command-only shell inputs render exact command text without JSON wrappers", (t) => {
  for (const toolName of ["bash", "powershell"]) {
    const command = 'git -C "D:/generated/activity-fixture" diff --numstat fixture-base -- src/example.mjs\r\n';
    const block = { type: "toolCall", toolCallId: `compact-${toolName}`, toolName, input: { command } };
    const result = { role: "toolResult", toolCallId: block.toolCallId, content: [{ type: "text", text: "147\t27\tsrc/example.mjs\r\n" }] };
    setToolCallExpanded(block.toolCallId, true);
    t.after(() => setToolCallExpanded(block.toolCallId, false));
    const html = renderMessage({ role: "assistant", content: [block] }, { toolResults: new Map([[block.toolCallId, result]]) });
    const firstPre = html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)?.[1];
    assert.equal(textOf(firstPre), command, "The shell payload is neither trimmed nor newline-normalized");
    assert.match(html, /data-command-layout="compact"/);
    assert.doesNotMatch(firstPre, /&quot;command&quot;/);
    assert.equal(getToolCallInputText(block), JSON.stringify(block.input, null, 2), "The generic full-input contract remains intact");
  }
});

test("shell arguments with timeout, extension fields, invalid command or partial input keep full JSON", (t) => {
  const cases = [
    { toolName: "bash", input: { command: "generated", timeout: 3 } },
    { toolName: "powershell", input: { command: "generated", cwd: "D:/generated/other" } },
    { toolName: "bash", input: { command: 17 } },
    { toolName: "bash", input: { command: "" } },
    { toolName: "mcp__fixture__bash", input: { command: "generated" } },
    { toolName: "bash", input: { command: "generated" }, rawInput: '{"command":"part' },
  ];
  cases.forEach((item, index) => {
    const block = { type: "toolCall", toolCallId: `generic-shell-${index}`, ...item };
    setToolCallExpanded(block.toolCallId, true); t.after(() => setToolCallExpanded(block.toolCallId, false));
    const result = { role: "toolResult", toolCallId: block.toolCallId, content: [{ type: "text", text: "Generated output" }] };
    const html = renderMessage({ role: "assistant", content: [block] }, { toolResults: new Map([[block.toolCallId, result]]) });
    assert.equal(textOf(html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)[1]), item.rawInput ?? JSON.stringify(item.input, null, 2));
    assert.doesNotMatch(html, /data-command-layout="compact"/);
  });
});

function textOf(html) {
  return html.replace(/<[^>]+>/g, "").replace(/&quot;/g, "\"").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
}

function codemodeCall(toolCallId, code) {
  return { type: "toolCall", toolCallId, toolName: "codemode", input: { code } };
}

function renderCodemode(block, result, props = {}) {
  return renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, { toolResults: new Map(result ? [[block.toolCallId, result]] : []), ...props });
}

const CODEMODE_SCRIPT = "// @options: {\"timeoutMs\": 5000}\nconst files = await tools.ls({ path: \".\" });\nreturn files.length;";

test("collapses a codemode call to its first script line and call count", (t) => {
  const block = codemodeCall("call-codemode-collapsed", CODEMODE_SCRIPT);
  t.after(() => setToolCallExpanded(block.toolCallId, false));
  const html = renderCodemode(block, {
    role: "toolResult",
    toolCallId: block.toolCallId,
    content: [{ type: "text", text: "Script completed\nWall time 0.1 seconds\nOutput:\n" }, { type: "text", text: "3" }],
    details: {
      calls: [
        { id: "call-codemode-collapsed/1", name: "ls", args: "{\"path\":\".\"}", status: "ok", durationMs: 4 },
        { id: "call-codemode-collapsed/2", name: "read", args: "{\"path\":\"a\"}", status: "ok", durationMs: 2 },
      ],
    },
  });
  const text = textOf(html);
  assert.match(text, /codemode/);
  assert.match(text, /const files = await tools\.ls\(\{ path: "\." \}\);/);
  assert.match(text, /2 calls/);
  assert.doesNotMatch(text, /@options/);
  assert.doesNotMatch(text, /"code"/);
  assert.doesNotMatch(text, /Tool calls/);
});

test("expands a codemode call into its script, its calls, and the output without the header", (t) => {
  const block = codemodeCall("call-codemode-expanded", CODEMODE_SCRIPT);
  setToolCallExpanded(block.toolCallId, true);
  t.after(() => setToolCallExpanded(block.toolCallId, false));
  const calls = Array.from({ length: 23 }, (_, index) => ({
    id: `call-codemode-expanded/${index + 1}`,
    name: index === 22 ? "bash" : "read",
    args: `{"path":"file-${index + 1}"}`,
    status: index === 22 ? "error" : "ok",
    durationMs: 1500,
    ...(index === 22 ? { error: "exit code 2" } : {}),
  }));
  calls.push(
    { id: "call-codemode-expanded/24", name: "models.classify", args: "", status: "ok", cost: 0.004 },
    { id: "call-codemode-expanded/25", name: "models.classify", args: "", status: "ok", cost: 0.006 },
  );
  const html = renderCodemode(block, {
    role: "toolResult",
    toolCallId: block.toolCallId,
    isError: true,
    content: [
      { type: "text", text: "Script failed\nWall time 4.2 seconds\nOutput:\n" },
      { type: "text", text: "Script error:\nError: exit code 2" },
    ],
    details: { calls },
  });
  const text = textOf(html);

  // The script sits in the plain box any tool's input uses, not a highlighted code block.
  assert.doesNotMatch(html, /markdown-code-block/);
  assert.equal(textOf(html.match(/<pre[^>]*>([\s\S]*?)<\/pre>/)[1]), CODEMODE_SCRIPT);
  assert.match(text, /Tool calls/);
  assert.match(text, /Show 5 earlier calls/);
  // The newest 20 of 25 calls are listed; the 5 oldest are folded.
  assert.doesNotMatch(text, /"file-5"/);
  assert.match(text, /"file-6"/);
  assert.match(text, /bash\{"path":"file-23"\}1\.5s/);
  assert.match(text, /exit code 2/);
  assert.match(html, /aria-label="Failed"/);
  assert.match(text, /Model calls: \$0\.01/);
  assert.match(text, /Script error:\nError: exit code 2/);
  assert.doesNotMatch(text, /Wall time/);
  assert.doesNotMatch(text, /"code":/);
});

test("shows a running script's calls without an empty output", (t) => {
  const block = codemodeCall("call-codemode-running", "await tools.read({ path: \"a\" })");
  setToolCallExpanded(block.toolCallId, true);
  t.after(() => setToolCallExpanded(block.toolCallId, false));
  const html = renderCodemode(block, {
    role: "toolResult",
    toolCallId: block.toolCallId,
    content: [],
    details: {
      calls: [{ id: "call-codemode-running/201", name: "read", args: "{\"path\":\"a\"}", status: "running" }],
      omittedCalls: 200,
    },
  }, { runningToolCallIds: new Set([block.toolCallId]), partialToolCallIds: new Set([block.toolCallId]) });
  const text = textOf(html);
  assert.match(text, /201 calls/);
  assert.match(text, /200 earlier calls not shown/);
  assert.match(html, /aria-label="Running"/);
  assert.doesNotMatch(text, /No output/i);
});

test("a completed codemode call with empty output shows the empty state", (t) => {
  const block = codemodeCall("empty-completed-codemode", "return undefined;");
  setToolCallExpanded(block.toolCallId, true);
  t.after(() => setToolCallExpanded(block.toolCallId, false));
  const result = { role: "toolResult", toolCallId: block.toolCallId, content: [] };
  const html = renderCodemode(block, result);
  assert.match(textOf(html), /No output/i);
  assert.match(html, /data-status="success"/);
});

test("keeps the generic view for a codemode call whose input is still streaming or has no script", (t) => {
  const streaming = { ...codemodeCall("call-codemode-streaming", ""), input: {}, rawInput: "{\"code\":\"const secret" };
  setToolCallExpanded(streaming.toolCallId, true);
  t.after(() => setToolCallExpanded(streaming.toolCallId, false));
  const streamingText = textOf(renderCodemode(streaming));
  assert.match(streamingText, /Generating parameters/);
  assert.match(streamingText, /\{"code":"const secret/);
  assert.doesNotMatch(streamingText, /Tool calls/);

  const other = { type: "toolCall", toolCallId: "call-codemode-other", toolName: "codemode", input: { script: "x" } };
  setToolCallExpanded(other.toolCallId, true);
  t.after(() => setToolCallExpanded(other.toolCallId, false));
  assert.match(textOf(renderCodemode(other)), /"script": "x"/);
});

test("labels an MCP call server/tool and indents a JSON result", (t) => {
  const block = {
    type: "toolCall",
    toolCallId: "call-mcp-1",
    toolName: "mcp__docs_v2__search",
    input: { query: "codemode" },
  };
  setToolCallExpanded(block.toolCallId, true);
  t.after(() => setToolCallExpanded(block.toolCallId, false));
  const html = renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, {
    toolResults: new Map([[block.toolCallId, {
      role: "toolResult",
      toolCallId: block.toolCallId,
      content: [{ type: "text", text: "{\"hits\":[{\"title\":\"Code mode\"}]}" }],
      details: { server: "docs.v2", tool: "search" },
    }]]),
  });
  const text = textOf(html);
  assert.match(text, /docs\.v2\/search/);
  assert.match(html, /title="mcp__docs_v2__search"/);
  assert.match(text, /\{\n {2}"hits": \[\n {4}\{\n {6}"title": "Code mode"/);
});

test("keeps the registered name where no result names the server and tool", (t) => {
  // Sanitizing maps docs.v2/search.pages and docs_v2/search_pages to one name, so it is not split.
  const block = { type: "toolCall", toolCallId: "call-mcp-running", toolName: "mcp__docs_v2__search_pages", input: {} };
  const running = textOf(renderMessage({
    role: "assistant",
    provider: "anthropic",
    model: "claude-test",
    content: [block],
  }, { toolResults: new Map() }));
  assert.match(running, /mcp__docs_v2__search_pages/);
  assert.doesNotMatch(running, /docs_v2\//);

  // A codemode script's calls carry only that name, which is also what the script calls.
  const script = codemodeCall("call-codemode-mcp", "await tools.mcp__docs_v2__search_pages({})");
  setToolCallExpanded(script.toolCallId, true);
  t.after(() => setToolCallExpanded(script.toolCallId, false));
  const html = renderCodemode(script, {
    role: "toolResult",
    toolCallId: script.toolCallId,
    content: [{ type: "text", text: "Script completed\nWall time 0.1 seconds\nOutput:\n" }],
    details: { calls: [{ id: "call-codemode-mcp/1", name: "mcp__docs_v2__search_pages", args: "{}", status: "ok" }] },
  });
  assert.match(textOf(html), /mcp__docs_v2__search_pages\{\}/);
});
