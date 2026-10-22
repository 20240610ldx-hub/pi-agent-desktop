import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { chromium } from "playwright";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const {
  DEFAULT_EXPANDED_WIDGET_LINES,
  ExtensionWidgets,
  formatExtensionWidgetContent,
  getNextExpandedWidgetKey,
  getUpdatedExtensionWidgetKeys,
  snapshotExtensionWidgetContents,
} = await jiti.import("./ExtensionWidgets.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

function renderWidgets(props) {
  return renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ExtensionWidgets, props),
    ),
  );
}

test("renders short extension widgets without a truncation marker", () => {
  const html = renderWidgets({
    widgets: [{ key: "short", lines: ["first", "second"], placement: "aboveEditor" }],
  });

  assert.match(html, /first\nsecond/);
  assert.doesNotMatch(html, /widget truncated/);
  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /data-direction="up"/);
  assert.doesNotMatch(html, /[\u2191\u2193]/);
});

test("collapses long widgets by default", () => {
  const lines = Array.from(
    { length: 12 },
    (_, index) => `line-${index + 1}`,
  );
  const html = renderWidgets({
    widgets: [{ key: "long", lines, placement: "belowEditor" }],
  });

  assert.ok(lines.length > DEFAULT_EXPANDED_WIDGET_LINES);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /data-direction="down"/);
  assert.doesNotMatch(html, /<pre/);
  assert.doesNotMatch(html, /line-1/);
  assert.doesNotMatch(html, /line-10/);
  assert.doesNotMatch(html, /line-12/);
});

test("keeps all widget lines available for the scrollable expanded panel", () => {
  const lines = Array.from(
    { length: 12 },
    (_, index) => `line-${index + 1}`,
  );
  const content = formatExtensionWidgetContent(lines);

  assert.match(content, /line-10/);
  assert.match(content, /line-12/);
  assert.doesNotMatch(content, /widget truncated/);
});

test("keeps compact widgets expanded by default", () => {
  const lines = Array.from(
    { length: DEFAULT_EXPANDED_WIDGET_LINES },
    (_, index) => `line-${index + 1}`,
  );
  const html = renderWidgets({
    widgets: [{ key: "compact", lines, placement: "aboveEditor" }],
  });

  assert.match(html, /aria-expanded="true"/);
  assert.match(html, /<pre/);
});

test("expands at most one compact widget", () => {
  const html = renderWidgets({
    widgets: [
      { key: "first", lines: ["one", "two"], placement: "aboveEditor" },
      { key: "second", lines: ["three", "four"], placement: "belowEditor" },
    ],
  });

  assert.equal((html.match(/aria-expanded="true"/g) ?? []).length, 1);
  assert.equal((html.match(/<section/g) ?? []).length, 1);
  assert.match(html, /aria-labelledby="[^"]*trigger-0"/);
  assert.doesNotMatch(html, /aria-labelledby="[^"]*trigger-1"/);
});

test("switching widgets closes the previously expanded widget", () => {
  assert.equal(getNextExpandedWidgetKey(null, "first"), "first");
  assert.equal(getNextExpandedWidgetKey("first", "second"), "second");
  assert.equal(getNextExpandedWidgetKey("second", "second"), null);
});

test("detects only existing widgets whose line content changed", () => {
  const previous = snapshotExtensionWidgetContents([
    { key: "changed", lines: ["one"], placement: "aboveEditor" },
    { key: "same", lines: ["ready"], placement: "belowEditor" },
    { key: "removed", lines: ["gone"], placement: "belowEditor" },
  ]);
  const next = snapshotExtensionWidgetContents([
    { key: "same", lines: ["ready"], placement: "aboveEditor" },
    { key: "changed", lines: ["one", "two"], placement: "belowEditor" },
    { key: "added", lines: ["new"], placement: "aboveEditor" },
  ]);

  assert.deepEqual(getUpdatedExtensionWidgetKeys(previous, next), ["changed"]);
  assert.deepEqual(getUpdatedExtensionWidgetKeys(null, next), []);
});

test("compares widget lines without delimiter collisions", () => {
  const previous = new Map([["status", ["one", "two"]]]);
  const next = new Map([["status", ["one\ntwo"]]]);

  assert.deepEqual(getUpdatedExtensionWidgetKeys(previous, next), ["status"]);
});

test("keeps one-line widgets compact but expandable", () => {
  const html = renderWidgets({
    widgets: [{ key: "single-line-widget", lines: ["ready"], placement: "belowEditor" }],
  });

  assert.match(html, /extension-widget-triggers/);
  assert.match(html, /<svg[^>]*extension-widget-placement-icon/);
  assert.match(html, /data-direction="down"/);
  assert.doesNotMatch(html, /[\u2191\u2193]/);
  assert.match(html, /Below editor widget/);
  assert.match(html, /<button[^>]*class="extension-widget-trigger/);
  assert.match(html, /aria-expanded="false"/);
  assert.match(html, /title="single-line-widget - Below editor widget - Expand"/);
  assert.match(html, /extension-widget-key/);
  assert.match(html, /extension-widget-update-pulse/);
  assert.doesNotMatch(html, /extension-widget-preview/);
  assert.doesNotMatch(html, /extension-widget-line-count/);
  assert.doesNotMatch(html, />ready</);
  assert.doesNotMatch(html, /<pre/);
});

test("powerline primary is immediately visible while another widget keeps its expansion", () => {
  const html = renderWidgets({ widgets: [
    { key: "powerline-top", lines: ["\u001b[38;2;215;135;175mPrimary A\u001b[0m · ◫ ?/200k"], placement: "aboveEditor" },
    { key: "other", lines: ["first", "second"], placement: "aboveEditor" },
  ] });
  assert.match(html, /class="extension-widget-primary"/);
  assert.match(html, />Primary A</);
  assert.match(html, /\?\/200k/);
  assert.match(html, /first\nsecond/);
  assert.match(html, /aria-expanded="true"/);
  assert.doesNotMatch(html, /powerline-top - Above editor widget - Expand/);
});

test("primary-only content has no empty trigger row or presentation animation", () => {
  const html = renderWidgets({ widgets: [{ key: "powerline-top", lines: ["Primary B · 12.5k/64k (19.5%)"], placement: "aboveEditor" }] });
  assert.match(html, /Primary B · 12.5k\/64k \(19.5%\)/);
  assert.doesNotMatch(html, /<button|extension-widget-triggers|extension-widget-update-pulse/);
});

test("the visible primary paints an opaque surface above transcript content with the actual theme CSS", async () => {
  const css = (await Promise.all(["../app/globals.css", "../vendor/open-claude-ui/cds-theme.css", "../app/native-theme.css"].map(path => readFile(new URL(path, import.meta.url), "utf8")))).join("\n");
  const html = renderWidgets({ widgets: [{ key: "powerline-top", lines: ["Visible model · ?/64k"], placement: "aboveEditor" }] });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(`<style>${css}</style>${html}`);
    const surface = await page.locator(".extension-widget-primary").evaluate(element => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, opacity: style.opacity, text: element.textContent };
    });
    assert.doesNotMatch(surface.background, /rgba\([^)]*,\s*0\)|transparent/, "primary must not blend with transcript text behind the composer overlay");
    assert.equal(surface.opacity, "1");
    assert.equal(surface.text, "Visible model · ?/64k");
  } finally { await browser.close(); }
});

test("keeps empty widgets non-interactive", () => {
  const html = renderWidgets({
    widgets: [{ key: "empty-widget", lines: [], placement: "aboveEditor" }],
  });

  assert.match(html, /<div class="extension-widget-trigger/);
  assert.doesNotMatch(html, /<button/);
  assert.doesNotMatch(html, /aria-expanded/);
  assert.match(html, /title="empty-widget - Above editor widget"/);
});
