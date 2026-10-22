import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { build } from "esbuild";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { MermaidBlock, CodeBlock, downloadMermaidSvg, mermaidNaturalWidth } = await jiti.import("./MermaidBlock.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

// Simple sequenceDiagram for testing
const mermaidSrc = `sequenceDiagram
    Alice->>Bob: Hello
    Bob-->>Alice: Hi`;

function renderMermaid(props) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(MermaidBlock, props),
    ),
  );
}

test("MermaidBlock renders source by default", () => {
  const html = renderMermaid({ code: mermaidSrc });

  assert.match(html, />Preview</);
  assert.match(html, /Alice/);
  assert.doesNotMatch(html, /mermaid-block-loading/);
});

test("MermaidBlock can render preview by default", () => {
  const html = renderMermaid({ code: mermaidSrc, defaultPreview: true });

  assert.match(html, />Source</);
  assert.match(html, /mermaid-block-loading/);
  assert.doesNotMatch(html, /Alice/);
});

test("MermaidBlock with isStreaming falls back to source view", () => {
  const html = renderMermaid({ code: mermaidSrc, isStreaming: true, defaultPreview: true });

  assert.match(html, /disabled/);
  assert.match(html, />Preview</);
  assert.match(html, /Alice/);
  assert.match(html, /-&gt;&gt;/);
});

test("MermaidBlock renders empty graph without error", () => {
  const html = renderMermaid({ code: "graph TD", defaultPreview: true });

  assert.doesNotMatch(html, /mermaid-block-error/);
  assert.match(html, /mermaid-block-loading/);
});

function renderCode(props) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(CodeBlock, props),
    ),
  );
}

test("CodeBlock highlights code when not streaming", () => {
  const html = renderCode({ code: "const x = 1;", lang: "javascript" });

  assert.match(html, /class="token/);
  assert.match(html, /const/);
});

test("CodeBlock owns the pre background without a competing shorthand", () => {
  for (const isStreaming of [false, true]) {
    const html = renderCode({ code: "const x = 1;", lang: "javascript", isStreaming });
    const pre = html.match(/<pre\b[^>]*>/)?.[0];
    assert.ok(pre);
    assert.match(pre, /background-color:color-mix/);
    assert.doesNotMatch(pre, /(?:[;\"]|^)background:/);
  }
});

test("CodeBlock renders plain text without tokenization while streaming", () => {
  const html = renderCode({ code: "const x = 1;", lang: "javascript", isStreaming: true });

  assert.doesNotMatch(html, /class="token/);
  assert.match(html, /const x = 1;/);
});

test("MermaidBlock handles Chinese characters in diagram", () => {
  const chineseMermaid = `sequenceDiagram
    participant PC as PC客户端
    PC->>SV: 请求登录`;

  const html = renderMermaid({ code: chineseMermaid, defaultPreview: true });

  assert.doesNotMatch(html, /mermaid-block-error/);
  assert.match(html, /mermaid-block/);
});

test("downloadMermaidSvg downloads XML-serialized SVG and releases its URL", async () => {
  const originalDocument = globalThis.document;
  const originalXMLSerializer = globalThis.XMLSerializer;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;
  const svgElement = { nodeName: "svg" };
  const serializedSvg = '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml">first<br />second</div></foreignObject></svg>';
  const link = { href: "", download: "", clicked: false, click() { this.clicked = true; } };
  let downloadedBlob;
  globalThis.document = { createElement: () => link };
  globalThis.XMLSerializer = class {
    serializeToString(element) {
      assert.equal(element, svgElement);
      return serializedSvg;
    }
  };
  URL.createObjectURL = (blob) => {
    assert.equal(blob.type, "image/svg+xml;charset=utf-8");
    downloadedBlob = blob;
    return "blob:mermaid";
  };
  let revoked = null;
  URL.revokeObjectURL = (url) => { revoked = url; };

  try {
    downloadMermaidSvg(svgElement);
    assert.equal(await downloadedBlob.text(), serializedSvg);
    assert.equal(link.href, "blob:mermaid");
    assert.equal(link.download, "mermaid-diagram.svg");
    assert.equal(link.clicked, true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(revoked, "blob:mermaid");
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
    if (originalXMLSerializer === undefined) delete globalThis.XMLSerializer;
    else globalThis.XMLSerializer = originalXMLSerializer;
    URL.createObjectURL = originalCreateObjectURL;
    URL.revokeObjectURL = originalRevokeObjectURL;
  }
});

// Both dangerouslySetInnerHTML sinks render Mermaid's SVG output, and Mermaid's
// own strict mode is the only sanitizer on that path (it escapes HTML in labels
// and disables click callbacks). Pin it so a merge cannot loosen it silently.
test("mermaid renders in strict security mode", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile(new URL("./MermaidBlock.tsx", import.meta.url), "utf8");
  const inits = source.match(/mermaid\.initialize\(\{[\s\S]*?\}\);/g) ?? [];
  assert.ok(inits.length > 0, "mermaid.initialize call not found");
  for (const init of inits) assert.match(init, /securityLevel:\s*"strict"/);
  assert.doesNotMatch(source, /securityLevel:\s*"(loose|antiscript|sandbox)"/);
  assert.equal((source.match(/dangerouslySetInnerHTML/g) ?? []).length, 2, "a new HTML sink needs its own review");
});

test("reads a Mermaid diagram's natural width from its viewBox", () => {
  const svg = (viewBox) => `<svg id="m" width="100%" xmlns="http://www.w3.org/2000/svg" style="max-width: 616px;" viewBox="${viewBox}"><g/></svg>`;
  assert.equal(mermaidNaturalWidth(svg("0 0 616 305")), 616);
  assert.equal(mermaidNaturalWidth(svg("-8 -8 1689.875 205.5")), 1689.875);
  assert.equal(mermaidNaturalWidth(svg("0,0,320,200")), 320);
  assert.equal(mermaidNaturalWidth('<svg width="100%"><g/></svg>'), null);
  assert.equal(mermaidNaturalWidth(svg("0 0 0 0")), null);
  assert.equal(mermaidNaturalWidth("not an svg"), null);
});

test("fit mode stays off unless asked for", () => {
  const plain = renderMermaid({ code: mermaidSrc, defaultPreview: true });
  assert.doesNotMatch(plain, /mermaid-fit/);
});

test("code copy browser lifecycle preserves source, focus and the current attempt", async (t) => {
  const project = fileURLToPath(new URL("../", import.meta.url));
  const bundle = (await build({
    stdin: { contents: `import React from "react";
      import {createRoot} from "react-dom/client";
      import {I18nProvider} from "./hooks/useI18n";
      import {CodeBlock, MermaidBlock} from "./components/MermaidBlock";
      import {MarkdownBody} from "./components/MarkdownBody";
      function Harness(){const [code,setCode]=React.useState("\\tconst x = '中文';\\r\\n\\n");const [shown,setShown]=React.useState(true);
        window.changeCode=setCode;window.showCode=setShown;
        return <I18nProvider><button id="start">Start</button><div id="plain" className="markdown-body" style={{marginTop:80,width:318}}>{shown&&<CodeBlock code={code} lang="javascript"/>}</div>
          <div id="mermaid"><MermaidBlock code={"graph TD\\n  A --> B\\n"}/></div>
          <div id="markdown"><MarkdownBody>{"~~~text\\n  original\\n\\tline\\n\\n~~~"}</MarkdownBody></div></I18nProvider>;
      }createRoot(document.getElementById("root")).render(<React.StrictMode><Harness/></React.StrictMode>);`, resolveDir: project, loader: "tsx" },
    bundle: true, write: false, format: "iife", platform: "browser", jsx: "automatic", logLevel: "silent", tsconfig: `${project}/tsconfig.json`,
  })).outputFiles[0].text;
  const css = (await Promise.all(["app/globals.css", "app/settings.css", "vendor/open-claude-ui/cds-theme.css", "app/native-theme.css"].map(path => readFile(`${project}/${path}`, "utf8")))).join("\n").replace(/^@import[^;]*;/gm, "");
  const browser = await chromium.launch({ headless: true });
  try {
    async function fixture() {
      const context = await browser.newContext();
      await context.route("**/*", route => route.fulfill({ contentType: "text/html", body: `<style>${css}</style><div id="root"></div><script>${bundle.replaceAll("</script", "<\\/script")}</script>` }));
      const page = await context.newPage();
      page.setDefaultTimeout(3000);
      await page.addInitScript(() => {
        window.writes = [];
        Object.defineProperty(navigator, "clipboard", { value: { writeText: text => new Promise((resolve, reject) => window.writes.push({ text, resolve, reject })) }, configurable: true });
        document.execCommand = () => false;
      });
      await page.goto("https://code-copy.fixture");
      await page.locator("#plain .markdown-code-copy").waitFor();
      return { page, context, button: page.locator("#plain .markdown-code-copy") };
    }
    const settle = async (page, index, failed = false) => {
      await page.evaluate(({ index, failed }) => { const write = window.writes[index]; if (failed) write.reject(new Error("Clipboard denied")); else write.resolve(); }, { index, failed });
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
    };

    await t.test("keyboard copy exposes a tooltip, stays focused and admits one pending write", async () => {
      const { page, context, button } = await fixture();
      try {
        await page.locator("#start").focus();
        await page.keyboard.press("Tab");
        assert.equal(await button.getAttribute("aria-label"), "Copy code");
        assert.equal(await button.evaluate(el => el === document.activeElement), true);
        await page.getByRole("tooltip").waitFor({ state: "visible" });
        assert.equal(await page.getByRole("tooltip").evaluate(el => {
          const rect = el.getBoundingClientRect();
          for (let parent = el.parentElement; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
            if (/(auto|hidden|scroll)/.test(style.overflowY) && (rect.top < bounds.top || rect.bottom > bounds.bottom)) return false;
          }
          return true;
        }), true, "Tooltip must paint outside the first fence's Markdown scroll clip");
        await page.keyboard.press("Escape");
        await page.getByRole("tooltip").waitFor({ state: "hidden" });
        await page.keyboard.press("Enter");
        assert.equal(await button.getAttribute("aria-busy"), "true");
        await button.evaluate(el => { el.click(); el.click(); });
        assert.deepEqual(await page.evaluate(() => window.writes.map(write => write.text)), ["\tconst x = '中文';\r\n\n"]);
        await settle(page, 0);
        assert.equal(await button.getAttribute("aria-busy"), "false");
        assert.equal(await button.evaluate(el => el === document.activeElement), true);
        assert.equal(await page.locator("#plain [role=status]").textContent(), "Copied");
        await page.waitForTimeout(1500);
        await button.press("Enter");
        await settle(page, 1);
        await page.waitForTimeout(1200);
        assert.equal(await page.locator("#plain [role=status]").textContent(), "Copied", "Earlier expiry cannot clear a repeat copy");
        await page.waitForFunction(() => document.querySelector("#plain [role=status]").textContent === "");
      } finally { await context.close(); }
    });

    await t.test("clipboard fallback failure restores focus and can be retried", async () => {
      const { page, context, button } = await fixture();
      try {
        await page.locator("#plain").hover();
        await button.click();
        await settle(page, 0, true);
        assert.equal(await page.locator("#plain [role=status]").textContent(), "Could not copy. Try again.");
        assert.equal(await button.evaluate(el => el === document.activeElement), true);
        await page.getByRole("tooltip", { name: "Could not copy. Try again.", exact: true }).waitFor({ state: "visible" });
        await button.press("Enter");
        await settle(page, 1);
        assert.equal(await page.locator("#plain [role=status]").textContent(), "Copied");
        assert.equal(await button.evaluate(el => el === document.activeElement), true);
      } finally { await context.close(); }
    });

    await t.test("changed code and unmount invalidate late completion and failure", async () => {
      const { page, context, button } = await fixture();
      try {
        await page.locator("#plain").hover();
        await button.click();
        await page.evaluate(() => window.changeCode("current source"));
        await button.click();
        await settle(page, 0);
        assert.equal(await button.getAttribute("aria-busy"), "true");
        assert.equal(await page.locator("#plain [role=status]").textContent(), "");
        await settle(page, 1);
        await button.click();
        await page.evaluate(() => window.changeCode("next source"));
        await settle(page, 2, true);
        assert.equal(await page.locator("#plain [role=status]").textContent(), "");
        await button.click();
        await page.evaluate(() => window.showCode(false));
        await settle(page, 3);
        await page.evaluate(() => window.showCode(true));
        assert.equal(await page.locator("#plain [role=status]").textContent(), "");
      } finally { await context.close(); }
    });

    await t.test("Mermaid source and parsed fences copy their untouched payload", async () => {
      const { page, context } = await fixture();
      try {
        await page.locator("#mermaid").hover();
        await page.locator("#mermaid .markdown-code-copy").click();
        await settle(page, 0);
        await page.locator("#markdown").hover();
        await page.locator("#markdown .markdown-code-copy").click();
        await settle(page, 1);
        assert.deepEqual(await page.evaluate(() => window.writes.map(write => write.text)), ["graph TD\n  A --> B\n", "  original\n\tline\n"]);
        assert.equal(await page.locator("#plain .linenumber").count(), 0, "Copied text has no visual line-number column");
      } finally { await context.close(); }
    });
  } finally { await browser.close(); }
});
