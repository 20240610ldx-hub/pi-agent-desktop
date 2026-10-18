import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Script } from "node:vm";
import ts from "typescript";
import { isImeComposing } from "../lib/ime.ts";

const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const dialogSource = source.slice(source.indexOf("function ExtensionDialog"));
const customSource = source.slice(source.indexOf("function ExtensionCustomPanel"));

// Exercise the real JSX callbacks, as ChatInput.test.mjs does, without mounting
// ChatWindow's session/transport hooks. Browser coverage checks actual bubbling.
function dialogKeyHandler(option, scope) {
  const ast = ts.createSourceFile("ChatWindow.tsx", dialogSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function find(node) {
    if (ts.isJsxAttribute(node) && node.name.getText(ast) === "onKeyDown") {
      const isOption = node.parent.properties.some((attribute) => attribute.name?.getText(ast) === "data-extension-option");
      if (isOption === option) return node.initializer.expression;
    }
    return ts.forEachChild(node, find);
  }
  const callback = find(ast);
  assert.ok(callback, "dialog keyboard handler exists");
  return new Script(ts.transpileModule(`(${callback.getText(ast)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText).runInNewContext({ isImeComposing, ...scope });
}

function keyEvent(key, nativeEvent = {}) {
  return {
    key,
    nativeEvent,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
  };
}

test("select options leave IME Enter and Space to composition, then respond normally", () => {
  const request = { id: "select-ime", method: "select", options: ["First", "Second"] };
  const responses = [];
  const handler = dialogKeyHandler(true, {
    request,
    option: "Second",
    onRespond(receivedRequest, response) { responses.push({ request: receivedRequest, ...response }); },
  });
  for (const key of ["Enter", " "]) {
    for (const nativeEvent of [{ isComposing: true }, { isComposing: false, keyCode: 229 }]) {
      const event = keyEvent(key, nativeEvent);
      handler(event);
      assert.equal(responses.length, 0, `IME ${JSON.stringify(key)} must not answer the request`);
      assert.equal(event.defaultPrevented, false, "the IME retains its default key behavior");
    }
  }
  for (const key of ["Enter", " "]) {
    const event = keyEvent(key);
    handler(event);
    assert.equal(event.defaultPrevented, true);
  }
  assert.deepEqual(responses, [{ request, value: "Second" }, { request, value: "Second" }]);
});

test("dialog owns IME Escape without cancelling; ordinary Escape cancels once", () => {
  const request = { id: "escape-ime", method: "select", options: ["First"] };
  const responses = [];
  const handler = dialogKeyHandler(false, {
    request,
    onRespond(receivedRequest, response) { responses.push({ request: receivedRequest, ...response }); },
  });
  for (const nativeEvent of [{ isComposing: true }, { isComposing: false, keyCode: 229 }]) {
    const event = keyEvent("Escape", nativeEvent);
    handler(event);
    assert.equal(responses.length, 0, "IME Escape must not cancel the request");
    assert.equal(event.propagationStopped, true, "IME Escape must not reach global Stop");
    assert.equal(event.defaultPrevented, false, "the IME can still dismiss its candidate window");
  }
  const event = keyEvent("Escape");
  handler(event);
  assert.equal(event.propagationStopped, true);
  assert.equal(event.defaultPrevented, true);
  assert.deepEqual(responses, [{ request, cancelled: true }]);
});

test("confines extension overlays to the content region above the composer", () => {
  assert.doesNotMatch(source, /function ExtensionRequestSheet/);
  assert.match(
    source,
    /ref={chatContentRegionRef} className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"[\s\S]*?<ExtensionDialog[\s\S]*?<ExtensionCustomPanel[\s\S]*?ref={composerOverlayRef}[\s\S]*?{chatInputElement}/,
  );
  assert.match(dialogSource, /position: "absolute"[\s\S]*?inset: 0/);
  assert.match(dialogSource, /pointerEvents: "none"/);
  assert.match(dialogSource, /pointerEvents: "auto"/);
  assert.match(customSource, /position: "absolute"[\s\S]*?inset: 0/);
  // The composer floats over the content region; overlays stop at its top edge.
  assert.match(dialogSource, /bottom: "var\(--chat-composer-inset, 0px\)"/);
  assert.match(customSource, /bottom: "var\(--chat-composer-inset, 0px\)"/);
  assert.match(customSource, /pointerEvents: "none"/);
  assert.doesNotMatch(source, /z-\[100\]|zIndex: 100/);
  assert.match(customSource, /maxHeight: "min\(760px, 100%\)"/);
});

test("adds collapse without replacing cancel", () => {
  assert.match(dialogSource, /setCollapsed\(true\)/);
  assert.match(dialogSource, /chat\.extensionCollapse/);
  assert.match(dialogSource, /chat\.cancel/);
  assert.doesNotMatch(dialogSource, /chat\.extensionSkip/);
});

test("renders extension confirmation and options as markdown", () => {
  assert.match(source, /import \{ MarkdownBody \} from "\.\/MarkdownBody"/);
  assert.match(dialogSource, /<MarkdownBody>\{request\.message\}<\/MarkdownBody>/);
  assert.match(dialogSource, /role="button"[\s\S]*?data-extension-option[\s\S]*?<div inert>[\s\S]*?<MarkdownBody>\{option\}<\/MarkdownBody>/);
  assert.match(dialogSource, /ref=\{index === 0 \? focusFirstOption : undefined\}/);
});

test("preserves title newlines like pi's TUI and keeps long titles from hiding the body", () => {
  const header = dialogSource.slice(dialogSource.indexOf('role="dialog"'), dialogSource.indexOf("{request.method === \"confirm\""));
  assert.match(header, /whiteSpace: "pre-wrap", overflowWrap: "anywhere" \}\}>\{request\.title\}/);
  // The dialog's own height is content-driven (only max-height is set), so a percentage
  // cap on the header never resolves and a non-shrinkable header grows to its full text
  // height, pushing the option list and the footer past the dialog's overflow edge (#890).
  // The cap has to be viewport-based and the header has to be allowed to shrink and scroll.
  assert.match(header, /flexShrink: 1, minHeight: 0,[\s\S]*?maxHeight: "50vh", overflowY: "auto" \}\}>[\s\S]*?\{request\.title\}/);
  assert.doesNotMatch(header, /maxHeight: "50%"/);
});

test("resets collapse state when a new extension request arrives", () => {
  assert.match(source, /<ExtensionDialog key=\{extensionDialog.id\}/);
  assert.match(source, /<ExtensionCustomPanel key=\{extensionCustomUi.id\}/);
  assert.match(customSource, /if \(!collapsed\) inputRef.current\?\.focus\(\);\s*}, \[collapsed\]\)/);
});

test("MCP OAuth input exposes the authorization URL as a one-click action", () => {
  assert.match(dialogSource, /extractMcpAuthorizationUrl/);
  assert.match(dialogSource, /mcp\.openAuthorization/);
  assert.match(dialogSource, /target="_blank"\s+rel="noreferrer noopener"/);
});

test("shows how many extension requests wait behind the one on screen", () => {
  const expandedHeader = dialogSource.slice(dialogSource.indexOf('role="dialog"'), dialogSource.indexOf("{request.method === \"confirm\""));
  const collapsedButton = dialogSource.slice(dialogSource.indexOf("{collapsed ? ("), dialogSource.indexOf('role="dialog"'));
  const customCollapsed = customSource.slice(customSource.indexOf("{collapsed ? ("), customSource.indexOf('role="dialog"'));
  const customExpanded = customSource.slice(customSource.indexOf('role="dialog"'));
  const waitingSource = source.slice(source.indexOf("function ExtensionWaitingCount"), source.indexOf("function ExtensionDialog("));

  assert.match(source, /<ExtensionDialog key=\{extensionDialog.id\} request=\{extensionDialog\} waitingCount=\{waitingExtensionDialogCount\}/);
  assert.match(source, /<ExtensionCustomPanel key=\{extensionCustomUi.id\} request=\{extensionCustomUi\} waitingCount=\{waitingExtensionCustomUiCount\}/);
  assert.match(waitingSource, /if \(count <= 0\) return null;[\s\S]*?t\("chat\.extensionMoreWaiting", \{ count \}\)/);
  assert.match(expandedHeader, /chat\.extensionRequest"\)\}<\/span>\s+<ExtensionWaitingCount count=\{waitingCount\} \/>\s+\{countdown\}/);
  assert.match(collapsedButton, /<ExtensionWaitingCount count=\{waitingCount\} \/>\s+\{countdown\}/);
  assert.match(customCollapsed, /<ExtensionWaitingCount count=\{waitingCount\} \/>\s+<span[^>]*>\s+\{t\("chat\.extensionExpand"\)\}/);
  assert.match(customExpanded, /chat\.extensionPanel"\)\}<\/div>\s+<div[^>]*>\s+<ExtensionWaitingCount count=\{waitingCount\} \/>/);
});
