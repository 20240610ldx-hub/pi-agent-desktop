import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { CompactCommandText } = await jiti.import("./CompactCommandText.tsx");
const render = (command, language) => renderToStaticMarkup(React.createElement(CompactCommandText, { command, language }));
const text = (html) => html.replace(/<[^>]*>/g, "").replaceAll("&lt;", "<").replaceAll("&gt;", ">").replaceAll("&quot;", '"').replaceAll("&#x27;", "'").replaceAll("&amp;", "&");

for (const language of ["bash", "powershell"]) {
  test(`${language} grammar highlights a quoted path while preserving literal source text`, () => {
    const command = 'git -C "D:/generated/<tag>& project" diff --numstat fixture-base -- src/example.mjs\r\n  generated-tail\r\n';
    const html = render(command, language);
    assert.match(html, /class="token string[^"]*"/);
    assert.equal(text(html), command);
    assert.match(html, /&lt;tag&gt;/);
    assert.doesNotMatch(html, /<tag>|<pre|<code|style="[^"]*(?:font-size|font-family|background-color)/);
  });
}

test("commands over the tokenization budget remain exact plain text without Prism token markup", () => {
  const command = 'generated-command "' + "<tag>& long value ".repeat(400) + '"\r\n';
  const html = render(command, "bash");
  assert.equal(text(html), command);
  assert.doesNotMatch(html, /class="token|prismjs/);
});

test("highlighting preserves empty lines, tabs, trailing spaces and a missing final newline", () => {
  for (const command of ["", "\t  ", 'echo "value"  \n\n\tlast', 'Write-Output "value"\r\n\r\n  ']) {
    assert.equal(text(render(command, "bash")), command);
    assert.equal(text(render(command, "powershell")), command);
  }
});
