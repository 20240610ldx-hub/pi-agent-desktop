import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { fromHtml } from "hast-util-from-html";
const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ThinkingDisclosure } = await jiti.import("./ThinkingDisclosure.tsx");
const nodes = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.children ?? []).flatMap(child => nodes(child, predicate))];
const text = node => node.type === "text" ? node.value : (node.children ?? []).map(text).join("");
const hasClass = (node, name) => node.properties?.className?.includes(name);
function render(expanded) {
  return fromHtml(renderToStaticMarkup(React.createElement(ThinkingDisclosure, {
    expanded, onToggle() {}, label: "Thinking: Preview", title: "Thinking", preview: "Preview", metadata: "3s",
  }, "Exact body\n\t中文 <source>")), { fragment: true });
}

test("controlled thinking presentation keeps its body absent until expanded and links its disclosure", () => {
  const closed = render(false);
  const button = nodes(closed, node => node.tagName === "button")[0];
  const panel = nodes(closed, node => hasClass(node, "thinking-disclosure-grid"))[0];
  assert.equal(button.properties.ariaExpanded, "false");
  assert.deepEqual(button.properties.ariaControls, [panel.properties.id]);
  assert.equal(panel.properties.ariaHidden, "true");
  assert.ok(Object.hasOwn(panel.properties, "inert"));
  assert.ok(!text(panel).includes("Exact body"));
  assert.ok(text(button).includes("Preview"));
  assert.ok(text(button).includes("3s"));
});

test("expanded thinking preserves exact plain source in a labelled region without synthetic live state", () => {
  const tree = render(true);
  const button = nodes(tree, node => node.tagName === "button")[0];
  const panel = nodes(tree, node => hasClass(node, "thinking-disclosure-grid"))[0];
  assert.equal(button.properties.ariaExpanded, "true");
  assert.equal(panel.properties.ariaHidden, "false");
  assert.equal(Object.hasOwn(panel.properties, "inert"), false);
  assert.deepEqual(panel.properties.ariaLabelledBy, [button.properties.id]);
  assert.equal(text(panel), "Exact body\n\t中文 <source>");
  assert.equal(nodes(tree, node => hasClass(node, "timeline-quiet-dots")).length, 0);
});
