import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { fromHtml } from "hast-util-from-html";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { MarkdownBody } = await jiti.import("./MarkdownBody.tsx");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const nodes = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.children ?? []).flatMap((child) => nodes(child, predicate))];
const text = (node) => node.type === "text" ? node.value : (node.children ?? []).map(text).join("");
const examples = [
  ["paragraph", "Generated paragraph", "p"],
  ["heading", "### Generated heading", "h3"],
  ["inline", "Generated **strong** and `inline ending`", "code"],
  ["list", "- First\n- Last list item", "li"],
  ["nested list", "1. Outer\n   - Nested ending", "li"],
  ["table", "| Key | Value |\n| --- | --- |\n| row | Table ending |", "td"],
  ["blockquote", "> Quoted ending", "p"],
  ["fence", "```text\nconst generated = 1;\n```", "code"],
];
function render(markdown, active = true) {
  return fromHtml(renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(MarkdownBody, { isStreaming: true, streamingCaret: active, className: active ? "message-streaming-caret" : undefined }, markdown))), { fragment: true });
}

for (const [name, markdown, tag] of examples) {
  test(`active Markdown ${name} places one presentation caret on its terminal text container`, () => {
    const tree = render(markdown);
    const targets = nodes(tree, (node) => node.properties?.dataStreamingCaret !== undefined);
    assert.equal(targets.length, 1);
    assert.equal(targets[0].tagName, tag);
    assert.equal(text(tree), text(render(markdown, false)), "Caret marker never changes rendered or copied source text");
    assert.equal(nodes(render(markdown, false), (node) => node.properties?.dataStreamingCaret !== undefined).length, 0);
  });
}
