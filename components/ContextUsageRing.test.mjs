import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ContextUsageRing } = await jiti.import("./ContextUsageRing.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const render = (contextUsage, sessionStats) => renderToStaticMarkup(React.createElement(I18nProvider, null,
  React.createElement(ContextUsageRing, { contextUsage, sessionStats, onOpenStats() {} })));
const usage = (percent, contextWindow = 200000) => ({ percent, contextWindow, tokens: null });
const stats = (total, cost) => ({ tokens: { input: 10, output: 10, cacheRead: 0, cacheWrite: 0, total }, cost });
const arc = (html) => {
  const [filled, remainder] = /stroke-dasharray="([^"]+)"/.exec(html)[1].split(" ").map(Number);
  assert.ok(Number.isFinite(filled) && filled >= 0);
  assert.ok(Number.isFinite(remainder) && remainder >= 0);
  assert.ok(Math.abs(filled + remainder - 12 * Math.PI) < 1e-10);
  return filled;
};

test("empty context stays hidden while compaction's unknown ratio retains its known window", () => {
  assert.equal(render(undefined), "");
  assert.equal(render(null), "");
  const html = render(usage(null));
  assert.ok(html.includes('title="— / 200k"'));
  assert.ok(html.includes('opacity="0.35"'));
  assert.equal(arc(html), 0);
});

test("nonfinite and negative context ratios render as unknown instead of invalid SVG or percentages", () => {
  for (const percent of [NaN, Infinity, -Infinity, -1]) {
    const html = render(usage(percent));
    assert.equal(arc(html), 0);
    assert.ok(html.includes('title="— / 200k"'));
    assert.ok(html.includes('stroke="var(--text-dim)"'));
    assert.ok(html.includes('opacity="0.35"'));
    assert.doesNotMatch(html, /NaN|Infinity|-1\.0%/);
  }
});

test("valid SDK ratios retain the ninety-percent threshold and only the arc clamps at capacity", () => {
  for (const percent of [0, 80, 89.9, 90, 100, 123.4]) {
    const html = render(usage(percent));
    assert.ok(Math.abs(arc(html) - 12 * Math.PI * Math.min(100, percent) / 100) < 1e-10);
    assert.ok(html.includes(`${percent.toFixed(1)}% ctx / 200k`));
    assert.ok(html.includes(`stroke="var(--${percent >= 90 ? "danger" : "accent"})"`));
    assert.ok(html.includes('aria-haspopup="dialog"'));
  }
});

test("invalid windows and cumulative statistics never become tooltip denominators or fake zero values", () => {
  for (const value of [NaN, Infinity, -Infinity, -1, 0]) {
    const known = render(usage(25, value), stats(value, value));
    assert.ok(known.includes('title="25.0% ctx"'));
    assert.doesNotMatch(known, /NaN|Infinity| tok|\$| ctx \/ /);
    const unknown = render(usage(null, value), stats(value, value));
    assert.equal(arc(unknown), 0);
    assert.ok(!/\stitle=/.test(unknown));
    assert.ok(unknown.includes('aria-label="Context usage"'));
  }
});

test("cumulative cache warming changes billing text without changing the current context arc", () => {
  const first = render(usage(14, 1000000), stats(143200, 0.125));
  const secondStats = stats(999999999, 19.5);
  secondStats.tokens.cacheRead = 500000000;
  secondStats.tokens.cacheWrite = 300000000;
  const second = render(usage(14, 1000000), secondStats);
  const svg = html => /<svg[\s\S]*<\/svg>/.exec(html)[0];
  assert.equal(svg(first), svg(second));
  assert.ok(first.includes('title="14.0% ctx · 143k tok · $0.125"'));
  assert.ok(second.includes('$19.500'));
  const unknown = render(usage(null, 1000000), secondStats);
  assert.equal(arc(unknown), 0);
  assert.ok(unknown.includes('— / 1.0M'));
});
