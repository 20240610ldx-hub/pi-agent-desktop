import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { RecommendedPiExtensions } = await jiti.import("./RecommendedPiExtensions.tsx");
const { RECOMMENDED_PI_EXTENSIONS } = await jiti.import("@/lib/recommended-pi-extensions");
const { getLocalePlugin } = await jiti.import("@/lib/i18n/registry");

test("desktop catalogue shows eight reviewed packages and offers only four optional source choices", () => {
  let selected = 0;
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(RecommendedPiExtensions, { busy: false, onSelectSource() { selected++; } })));
  assert.equal((html.match(/data-extension-id=/g) ?? []).length, 8);
  assert.equal((html.match(/Use this version/g) ?? []).length, 4);
  for (const item of RECOMMENDED_PI_EXTENSIONS) assert.ok(html.includes(item.id));
  assert.ok(html.includes("Desktop adapter required"));
  assert.ok(html.includes("Existing desktop capability"));
  assert.ok(!html.includes("plugins.recommended."));
  assert.equal(selected, 0, "rendering cannot select, install, or activate packages");
});

test("catalogue descriptions and limitations are translated in every supported locale", () => {
  for (const locale of ["en", "zh-CN", "zh-TW"]) {
    const messages = getLocalePlugin(locale).messages;
    for (const item of RECOMMENDED_PI_EXTENSIONS) for (const key of [item.nameKey, item.descriptionKey, item.reasonKey, `plugins.recommended.status.${item.status}`]) {
      assert.ok(messages[key], `${locale}: ${key}`);
    }
  }
});
