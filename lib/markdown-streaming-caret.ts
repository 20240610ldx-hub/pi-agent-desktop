import type { Element, Root, RootContent } from "hast";
import type { Plugin } from "unified";

const textContainers = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th", "code"]);

/** Trusted presentation annotation after the existing sanitizer/renderer plugins.
 * The parsed Markdown grammar chooses the last text leaf; no source is appended.
 */
export const rehypeStreamingCaret: Plugin<[], Root> = () => (tree) => {
  let target: Element | undefined;
  const visit = (node: Root | RootContent, container?: Element) => {
    if (node.type === "text") {
      if (node.value.trim()) target = container;
      return;
    }
    if (node.type !== "element" && node.type !== "root") return;
    const next = node.type === "element" && textContainers.has(node.tagName) ? node : container;
    for (const child of node.children) visit(child, next);
  };
  visit(tree);
  if (target) target.properties.dataStreamingCaret = "true";
};
