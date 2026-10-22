import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { ChangesPane } = await jiti.import("./ChangesPane.tsx");

test("an independent Changes consumer starts at its retained commit and sidebar visibility", () => {
  const html = renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(ChangesPane, {
    cwd: "D:/project", visible: true, onAddFeedback() {},
    initialViewState: { version: 1, scope: "commit", commit: "abcdef12" + "0".repeat(32), showFiles: false, commitsOpen: false },
  })));
  assert.match(html, />abcdef12<\/span>/);
  assert.doesNotMatch(html, /changes-sidebar/);
});
