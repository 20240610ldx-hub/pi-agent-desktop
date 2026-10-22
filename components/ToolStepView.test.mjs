import assert from "node:assert/strict";
import test, { after } from "node:test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { ToolCallBlock, getToolCallInputText } = await jiti.import("./ToolStepView.tsx");

function render(block, result, props = {}) {
  return renderToStaticMarkup(React.createElement(
    I18nProvider,
    null,
    React.createElement(ToolCallBlock, { block, result, defaultExpanded: true, ...props }),
  ));
}

const block = (toolCallId, command) => ({
  type: "toolCall",
  toolCallId,
  toolName: "bash",
  input: { command },
});

test("extracted tool step renders exact completed command and result in compact layout", () => {
  const command = 'printf "a\\tb"\r\n';
  const call = block("compact-call", command);
  const result = { role: "toolResult", toolCallId: call.toolCallId, content: [{ type: "text", text: "a\tb  \r\n" }], isError: false };
  const html = render(call, result);
  assert.match(html, /data-command-layout="compact"/);
  assert.match(html, /class="tool-call-command-line"/);
  assert.match(html, /class="tool-call-command-result"/);
  assert.equal(getToolCallInputText(call), JSON.stringify(call.input, null, 2));
  assert.match(html, /data-status="success"/);
});

test("running and cancelled shell calls keep the rich inspector instead of compacting", () => {
  const running = block("running-call", "long-command");
  const runningHtml = render(running, undefined, { running: true, partial: true, live: true });
  assert.match(runningHtml, /data-status="running"/);
  assert.doesNotMatch(runningHtml, /data-command-layout="compact"/);

  const cancelled = block("cancelled-call", "long-command");
  const cancelledHtml = render(cancelled, undefined, { aborted: true });
  assert.match(cancelledHtml, /data-status="cancelled"/);
  assert.doesNotMatch(cancelledHtml, /data-command-layout="compact"/);
});

test("failed shell calls retain error status and expose their result", () => {
  const call = block("failed-call", "false");
  const result = { role: "toolResult", toolCallId: call.toolCallId, content: [{ type: "text", text: "failed\r\n" }], isError: true };
  const html = render(call, result);
  assert.match(html, /data-status="error"/);
  assert.match(html, /failed/);
});

let browserFixture;
after(async () => { if (browserFixture) await (await browserFixture).browser.close(); });

test("compact tool step keeps measured geometry in desktop and narrow viewports", async () => {
  browserFixture ??= (async () => {
    const bundle = (await build({
      stdin: { contents: `import React from "react";
        import { createRoot } from "react-dom/client";
        import { I18nProvider } from "./hooks/useI18n";
        import { ToolCallBlock } from "./components/ToolStepView";
        const block = { type: "toolCall", toolCallId: "visual", toolName: "bash", input: { command: "node scripts/relay.mjs claim PIL-0197 --owner claude:sonnet-high:impl 2>&1|tail -1; node scripts/relay.mjs start PIL-0197 2>&1|grep worktree" } };
        const result = { role: "toolResult", toolCallId: "visual", content: [{ type: "text", text: "worktree: D:/pilaude/wt/PIL-0197\\nready" }], isError: false };
        createRoot(document.getElementById("root")).render(<I18nProvider><div className="app-shell" style={{width:"min(615px, 100vw)"}}><div className="message-assistant-content"><ToolCallBlock block={block} result={result} defaultExpanded /></div></div></I18nProvider>);`, resolveDir: fileURLToPath(new URL("../", import.meta.url)), loader: "tsx" },
      bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent",
    })).outputFiles[0].text;
    const css = (await Promise.all(["app/globals.css", "app/settings.css", "vendor/open-claude-ui/cds-theme.css", "app/native-theme.css"].map(name => readFile(new URL(`../${name}`, import.meta.url), "utf8")))).join("\n").replace(/^@import[^;]*;/gm, "");
    return { bundle, css, browser: await chromium.launch({ headless: true }) };
  })();
  const { browser, bundle, css } = await browserFixture;
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.setContent(`<!doctype html><style>${css}</style><div id="root"></div><script>${bundle}</script>`);
  await page.locator(".tool-call-command-line").waitFor();
  for (const width of [1200, 390]) {
    await page.setViewportSize({ width, height: 800 });
    const metrics = await page.evaluate(() => {
      const card = document.querySelector(".tool-call-body").getBoundingClientRect();
      const command = document.querySelector(".tool-call-command-line").getBoundingClientRect();
      const text = document.querySelector(".tool-call-command-text").getBoundingClientRect();
      const row = document.querySelector(".tool-call-row");
      return { width: card.width, commandHeight: command.height, commandLeft: command.left - card.left, commandRight: card.right - command.right, textTop: text.top - command.top, textLeft: text.left - command.left, overflow: row.scrollWidth - row.clientWidth };
    });
    console.log(`ToolStepView geometry at viewport ${width}px: ${JSON.stringify(metrics)}`);
    // 3.1623 native 06-tool-group (dark), original px / 1.5: command box 44.0 high (66px / 1.5), 7.3 from the card edge.
    if (width === 1200) {
      assert.ok(Math.abs(metrics.commandHeight - 44.0) <= 1, `command box height ${metrics.commandHeight}`);
      assert.ok(Math.abs(metrics.commandLeft - 7.3) <= 1, `command box inset ${metrics.commandLeft}`);
      assert.ok(Math.abs(metrics.commandRight - 7.3) <= 1, `command box inset ${metrics.commandRight}`);
      assert.ok(Math.abs(metrics.textLeft - 23.3) <= 1, `command text inset ${metrics.textLeft}`);
    }
    assert.ok(metrics.overflow <= 1, `horizontal overflow at ${width}px: ${metrics.overflow}px`);
  }
  await page.close();
});

