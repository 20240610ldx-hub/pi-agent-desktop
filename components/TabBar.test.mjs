import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { TabBar } = await jiti.import("./TabBar.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const render = (tabs) => renderToStaticMarkup(React.createElement(I18nProvider, null,
  React.createElement(TabBar, { tabs, activeTabId: tabs[0]?.id ?? "", onSelectTab() {}, onCloseTab() {} })));

test("ordinary file tabs display a shrinking stem and separate extension with full accessible names", () => {
  const name = "项目👩🏽‍💻e\u0301-long-component.tsx";
  const path = `D:/project/${name}`;
  const html = render([{ id: "file-a", label: name, filePath: path }]);
  assert.match(html, /class="file-tab-label is-file-name"/);
  assert.ok(html.includes(`<span class="file-tab-stem">项目👩🏽‍💻e\u0301-long-component</span><span class="file-tab-extension">.tsx</span>`));
  assert.ok(html.includes(`aria-label="${name}"`));
  assert.ok(html.includes(`title="${path}"`));
  assert.ok(html.includes(`aria-label="Close ${name}"`));
  assert.ok(html.includes('data-tab-id="file-a"'));
});

test("terminal and artifact titles retain their existing single label and file-like text is escaped", () => {
  for (const kind of ["terminal", "artifact"]) {
    const html = render([{ id: kind, label: "report.v2.tsx", filePath: "item", kind }]);
    assert.match(html, /class="file-tab-label" title="item">report\.v2\.tsx<\/span>/);
    assert.doesNotMatch(html, /file-tab-stem|file-tab-extension|is-file-name/);
  }
  const html = render([{ id: "unsafe", label: "<img src=x>.html", filePath: "safe" }]);
  assert.ok(html.includes("&lt;img src=x&gt;"));
  assert.ok(!html.includes("<img"));
});
