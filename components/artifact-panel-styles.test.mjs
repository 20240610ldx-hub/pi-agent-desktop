import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const css = await readFile(new URL("../app/native-theme.css", import.meta.url), "utf8");

// Upstream caps an inline Mermaid preview at min(600px, 60dvh) for the chat
// column (app/globals.css). The artifact panel reuses MermaidBlock but scrolls
// by itself, so that cap cut tall diagrams off with free space below them.
test("the artifact panel lifts upstream's Mermaid preview height cap", () => {
  assert.match(css, /\.artifact-panel-body \.mermaid-preview-button\s*\{\s*max-height:\s*none;/);
});
