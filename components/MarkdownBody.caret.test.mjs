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
function render(markdown, active = true, props = {}) {
  return fromHtml(renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(MarkdownBody, { isStreaming: true, streamingCaret: active, className: active ? "message-streaming-caret" : undefined, ...props }, markdown))), { fragment: true });
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

test("active formula-only Markdown keeps one presentation caret outside its accessible and visual math subtrees", () => {
  const markdown = "$$\nx = 1\n$$";
  const tree = render(markdown);
  const inactive = render(markdown, false);
  const hasClass = (node, className) => node.properties?.className?.includes(className);
  const formulas = nodes(tree, (node) => hasClass(node, "katex"));
  assert.equal(formulas.length, 1, "The existing public renderer still produces one KaTeX formula");
  assert.equal(nodes(tree, (node) => hasClass(node, "katex-display")).length, 1);
  const targets = nodes(tree, (node) => node.properties?.dataStreamingCaret !== undefined);
  assert.equal(targets.length, 1, "The active formula owns its single presentation caret");
  assert.equal(targets[0], formulas[0], "The formula wrapper owns the caret without entering MathML, annotation or glyphs");
  const accessible = nodes(formulas[0], (node) => hasClass(node, "katex-mathml"));
  const visual = nodes(formulas[0], (node) => hasClass(node, "katex-html"));
  assert.equal(accessible.length, 1);
  assert.equal(visual.length, 1);
  assert.equal(nodes(accessible[0], (node) => node.properties?.dataStreamingCaret !== undefined).length, 0);
  assert.equal(nodes(visual[0], (node) => node.properties?.dataStreamingCaret !== undefined).length, 0);
  assert.equal(text(nodes(accessible[0], (node) => node.tagName === "annotation")[0]), "x = 1", "Original TeX remains available to the accessible formula");
  // HTML byte offsets move when the wrapper receives an attribute; they are
  // parser bookkeeping rather than accessible or visual formula content.
  const contentTree = (node) => JSON.parse(JSON.stringify(node, (key, value) => key === "position" ? undefined : value));
  assert.deepEqual(contentTree(accessible), contentTree(nodes(inactive, (node) => hasClass(node, "katex-mathml"))), "Accessible math is identical when activity ends");
  assert.deepEqual(contentTree(visual), contentTree(nodes(inactive, (node) => hasClass(node, "katex-html"))), "Activity does not alter the visual formula tree");
  assert.equal(text(tree), text(inactive), "The presentation marker never changes formula text or source");
  assert.equal(nodes(inactive, (node) => node.properties?.dataStreamingCaret !== undefined).length, 0);
});

test("inline math before a terminal image keeps the caret on the complete paragraph", () => {
  const markdown = "Result: $x$ ![diagram](generated.png)";
  const tree = render(markdown);
  const targets = nodes(tree, (node) => node.properties?.dataStreamingCaret !== undefined);
  assert.equal(nodes(tree, (node) => node.tagName === "img").length, 1);
  assert.equal(targets.length, 1);
  assert.equal(targets[0].tagName, "p", "The caret follows the paragraph's later image rather than stopping inside preceding inline math");
  assert.equal(nodes(targets[0], (node) => node.tagName === "img").length, 1);
  assert.equal(text(tree), text(render(markdown, false)), "The inline math and image keep their original text");
  assert.equal(nodes(render(markdown, false), (node) => node.properties?.dataStreamingCaret !== undefined).length, 0);
});

test("active terminal artifact forwards one presentation caret through the existing Markdown artifact source view", () => {
  // An unfinished artifact without a mounted panel opener uses the real
  // ArtifactCard -> InlineArtifact -> CodeBlock source route during SSR.
  const source = "const generatedArtifact = '<source> & exact';";
  const markdown = `:::artifact{identifier="generated-caret-artifact" type="code" title="Generated caret artifact"}\n\`\`\`javascript\n${source}`;
  const tree = render(markdown, true, { artifacts: true });
  const renderedCode = nodes(tree, (node) => node.tagName === "code");
  assert.equal(renderedCode.length, 1, "The existing artifact source renderer remains selected");
  assert.equal(text(renderedCode[0]), source, "Presentation never appends a caret character to source");
  assert.equal(nodes(tree, (node) => node.tagName === "iframe").length, 0, "An unfinished source artifact does not start a preview");
  const targets = nodes(tree, (node) => node.properties?.dataStreamingCaret !== undefined);
  assert.equal(targets.length, 1, "The terminal artifact keeps its active text's sole caret marker");
  assert.equal(targets[0], renderedCode[0]);
  assert.equal(text(tree), text(render(markdown, false, { artifacts: true })), "Active presentation does not change visible labels or exact source");
  assert.equal(nodes(render(markdown, false, { artifacts: true }), (node) => node.properties?.dataStreamingCaret !== undefined).length, 0, "Inactive artifact never owns a caret");
});
