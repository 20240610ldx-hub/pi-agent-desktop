import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { createElement: h } = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { PilaudeWelcome } = await jiti.import("./PilaudeWelcome");

test("first launch provides direct project and provider setup actions", () => {
  const html = renderToStaticMarkup(h(I18nProvider, null, h(PilaudeWelcome, {
    onOpenProject() {}, onOpenModels() {},
  })));
  assert.match(html, /Pilaude/);
  assert.match(html, /Open a project/);
  assert.match(html, /Connect a model/);
  assert.match(html, /cds-button/);
  assert.doesNotMatch(html, /pointer-events:none/);
});
