import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ThinkingBlock, MessageView } = await jiti.import("./MessageView.tsx");
const { TranscriptViewProvider } = await jiti.import("@/components/TranscriptViewContext");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

function thinking(mode) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(TranscriptViewProvider, { mode },
      React.createElement(ThinkingBlock, { block: { type: "thinking", thinking: "Reasoning source" }, blockIndex: 2 }),
    ),
  ));
}

test("Thinking transcript view expands reasoning through the existing controller", () => {
  assert.match(thinking("normal"), /aria-expanded="false"/);
  assert.match(thinking("thinking"), /aria-expanded="true"/);
  assert.match(thinking("thinking"), /thinking-disclosure-content[^>]*>Reasoning source</);
});

test("Verbose transcript view additionally reveals tool arguments and results", () => {
  const message = { role: "assistant", content: [{ type: "toolCall", toolCallId: "mode-tool", toolName: "bash", input: { command: "printf mode-fixture" } }] };
  const toolResults = new Map([["mode-tool", { role: "toolResult", toolCallId: "mode-tool", toolName: "bash", content: [{ type: "text", text: "Exact mode output" }], isError: false }]]);
  const render = (mode) => renderToStaticMarkup(React.createElement(I18nProvider, null,
    React.createElement(TranscriptViewProvider, { mode }, React.createElement(MessageView, { message, toolResults })),
  ));
  assert.match(render("thinking"), /aria-expanded="false"/);
  assert.match(render("verbose"), /aria-expanded="true"/);
  assert.match(render("verbose"), /Exact mode output/);
});
