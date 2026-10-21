import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Script } from "node:vm";
import { createJiti } from "jiti";
import ts from "typescript";

const jiti = createJiti(import.meta.url, {
  jsx: { runtime: "automatic" },
  tsconfigPaths: true,
});
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { ChatInput, ModelErrorBanner, ModelScopeWarningBanner, canClearBuiltinCommandInput, canRestoreUserMessage, canRunBuiltinSlashCommandWhileStreaming, compressImageFile, cycleListIndex, filterModelOptions, getTopbarBoundary, getUpwardMenuMaxHeight, getUserMessageText, getUserMessageDraftImages, isExactSlashCommand, modelSupportsImageInput, replaceLinksWithMarkdown, shouldCompressImageFile, offersBuiltinSlashCommandWhileStreaming, submitsSlashCommandOnEnter} = await jiti.import("./ChatInput.tsx");

const { isBareMcpCommand } = await jiti.import("@/lib/mcp-command.ts");
const { composeMessageWithAttachedFiles } = await jiti.import("@/lib/chat-attachments.ts");
const { ModelSelector } = await jiti.import("./ModelSelector.tsx");
const { clearDraft, getDraft, mergeRestoredSubmissionDraft, mergeRestoredSubmissionText, rekeyDraft, setDraft } = await jiti.import("@/lib/draft-store");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");

function renderWithI18n(element) {
  return renderToStaticMarkup(React.createElement(I18nProvider, null, element));
}

test("renders the upstream model error", () => {
  const html = renderWithI18n(
    React.createElement(ModelErrorBanner, {
      error: "Invalid models.json schema:\nproviders.custom.models.0.id must not be empty",
    }),
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /Model error/);
  assert.match(html, /providers\.custom\.models\.0\.id must not be empty/);
});

test("does not render an empty model error", () => {
  assert.equal(renderWithI18n(React.createElement(ModelErrorBanner, { error: null })), "");
});

test("renders enabledModels scope warnings with a dismiss control", () => {
  const html = renderWithI18n(
    React.createElement(ModelScopeWarningBanner, {
      warnings: [
        { code: "no-match", pattern: "ghost-gateway/*", message: "No models match pattern \"ghost-gateway/*\"" },
      ],
      onDismiss() {},
      dismissLabel: "Dismiss",
    }),
  );

  assert.match(html, /Model scope warning/);
  assert.match(html, /No models match pattern/);
  assert.match(html, /ghost-gateway/);
  assert.match(html, /aria-label="Dismiss"/);
  // No configure entry for plain no-match warnings.
  assert.doesNotMatch(html, /Configure providers/);
  assert.equal(renderWithI18n(React.createElement(ModelScopeWarningBanner, { warnings: [] })), "");
  assert.equal(renderWithI18n(React.createElement(ModelScopeWarningBanner)), "");
});

test("rewords unauthenticated-provider warnings and offers the configure entry (#48)", () => {
  const html = renderWithI18n(
    React.createElement(ModelScopeWarningBanner, {
      warnings: [
        {
          code: "unauthenticated-provider",
          pattern: "acme-gateway/claude-opus-4-8",
          unauthenticatedProviders: ["acme-gateway"],
          message: "No models match pattern \"acme-gateway/claude-opus-4-8\"",
        },
      ],
      onDismiss() {},
      dismissLabel: "Dismiss",
      onOpenModelsConfig() {},
    }),
  );

  assert.match(html, /has no usable credentials/);
  assert.match(html, /acme-gateway/);
  // The raw resolver message must not leak through for classified warnings.
  assert.doesNotMatch(html, /No models match pattern/);
  assert.match(html, /Configure providers/);
  assert.match(html, /aria-label="Dismiss"/);
});

test("preserves pasted HTML links as Markdown without changing plain text layout", () => {
  const link = (label, href, occurrence = 0) => ({ label, href, occurrence });

  assert.equal(
    replaceLinksWithMarkdown(
      "Jobs:\nEngineer\nEngineer\nDone",
      [link("Engineer", "https://example.com/1"), link("Engineer", "https://example.com/2", 1)],
    ),
    "Jobs:\n[Engineer](https://example.com/1)\n[Engineer](https://example.com/2)\nDone",
  );
  assert.equal(
    replaceLinksWithMarkdown("Read [this]", [link("[this]", "https://example.com/a_(b)")]),
    "Read [\\[this\\]](https://example.com/a_\\(b\\))",
  );
  assert.equal(
    replaceLinksWithMarkdown("Engineer and Engineer", [link("Engineer", "https://example.com/job", 1)]),
    "Engineer and [Engineer](https://example.com/job)",
  );
  assert.equal(replaceLinksWithMarkdown("plain text", [link("missing", "https://example.com")]), null);
});

test("follow-up shortcuts preserve newline, IME, mobile and completion behavior", () => {
  const source = ts.createSourceFile("ChatInput.tsx", readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function findHandler(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleKeyDown") {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findHandler);
  }
  // Execute the component's actual callback without mounting the rest of the UI.
  const script = new Script(ts.transpileModule(findHandler(source).getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText);
  const cases = [
    ["Enter queues a follow-up", {}, {}, "followup"],
    ["Alt+Enter follows up", { altKey: true }, {}, "followup"],
    ["idle Alt+Enter sends", { altKey: true }, { isStreaming: false }, "send"],
    ["Shift+Enter inserts a newline", { shiftKey: true }, {}, "native"],
    ["Alt+Shift+Enter keeps native behavior", { altKey: true, shiftKey: true }, {}, "native"],
    ["composition ref blocks sending", { altKey: true }, { isComposingRef: { current: true } }, "native"],
    ["native composition blocks sending", { altKey: true, nativeEvent: { isComposing: true } }, {}, "native"],
    ["IME keyCode blocks sending", { altKey: true, nativeEvent: { keyCode: 229 } }, {}, "native"],
    ["composition grace blocks sending", { altKey: true }, { lastCompositionEndAtRef: { current: 950 } }, "prevented"],
    ["mobile Alt+Enter keeps native behavior", { altKey: true }, { isMobile: true }, "native"],
    ["mobile composition grace cannot send", { altKey: true }, { isMobile: true, lastCompositionEndAtRef: { current: 950 } }, "native"],
    ["mobile Ctrl+Alt+Enter follows up", { altKey: true, ctrlKey: true }, { isMobile: true }, "followup"],
    ["mobile Cmd+Alt+Enter follows up", { altKey: true, metaKey: true }, { isMobile: true }, "followup"],
    ["mobile modified Enter respects composition grace", { altKey: true, ctrlKey: true }, { isMobile: true, lastCompositionEndAtRef: { current: 950 } }, "prevented"],
    ["Enter falls back to follow-up", {}, { onSteer: undefined }, "followup"],
    ["Alt+Enter falls back to steer", { altKey: true }, { onFollowUp: undefined }, "steer"],
    ["slash completion takes priority", { altKey: true }, { slashMenuOpen: true, slashQuery: "help" }, "slash"],
    ["available built-in commands take priority", { altKey: true }, { slashMenuOpen: true, slashQuery: "copy", value: "/copy", displayedSlashCommands: [{ name: "copy", source: "builtin", availableWhileStreaming: true }] }, "send"],
    ["pi's built-in /mcp submits at once, also while streaming", {}, { slashMenuOpen: true, slashQuery: "mcp", value: "/mcp", displayedSlashCommands: [{ name: "mcp", source: "extension", sourceInfo: { path: "builtin:mcp" } }] }, "send"],
    ["another extension's /mcp completes first", {}, { slashMenuOpen: true, slashQuery: "mcp", value: "/mcp", displayedSlashCommands: [{ name: "mcp", source: "extension", sourceInfo: { path: "/ext/mcp.ts" } }] }, "slash"],
    ["file completion takes priority", { altKey: true }, { atMenuOpen: true, atQuery: {} }, "file"],
    ["history selection takes priority", { altKey: true }, { historyMenuOpen: true }, "history"],
    ["Ctrl+Enter mode: Enter inserts a newline", {}, { enterSendMode: "ctrlEnter", isStreaming: false }, "native"],
    ["Ctrl+Enter mode: Ctrl+Enter sends", { ctrlKey: true }, { enterSendMode: "ctrlEnter", isStreaming: false }, "send"],
    ["Ctrl+Enter mode: Cmd+Enter queues a follow-up", { metaKey: true }, { enterSendMode: "ctrlEnter" }, "followup"],
    ["Ctrl+Enter mode: composition grace blocks the newline", {}, { enterSendMode: "ctrlEnter", lastCompositionEndAtRef: { current: 950 } }, "prevented"],
    ["Ctrl+Enter mode: Enter picks a file", {}, { enterSendMode: "ctrlEnter", atMenuOpen: true, atQuery: {} }, "file"],
    ["Ctrl+Enter mode: Enter picks from history", {}, { enterSendMode: "ctrlEnter", historyMenuOpen: true }, "history"],
    ["Ctrl+Enter mode: Enter completes an exact slash command instead of sending it", {}, { enterSendMode: "ctrlEnter", isStreaming: false, slashMenuOpen: true, slashQuery: "copy", value: "/copy", displayedSlashCommands: [{ name: "copy", source: "builtin" }] }, "slash"],
    ["Ctrl+Enter mode: Ctrl+Enter sends an exact slash command", { ctrlKey: true }, { enterSendMode: "ctrlEnter", isStreaming: false, slashMenuOpen: true, slashQuery: "copy", value: "/copy", displayedSlashCommands: [{ name: "copy", source: "builtin" }] }, "send"],
    ["mobile ignores Ctrl+Enter mode for plain Enter", {}, { enterSendMode: "ctrlEnter", isMobile: true }, "native"],
  ];
  for (const [name, keys, state, expected] of cases) {
    let action = "native";
    const handler = script.runInNewContext({
      Date: { now: () => 1000 },
      COMPOSITION_END_ENTER_GRACE_MS: 100,
      isMobile: false, isStreaming: true, enterSendMode: "enter",
      isComposingRef: { current: false }, lastCompositionEndAtRef: { current: 0 },
      historyMenuOpen: false, inputHistory: ["previous"], historyActiveIndex: 0,
      slashMenuOpen: false, slashQuery: null, displayedSlashCommands: [{}], slashActiveIndex: 0,
      atMenuOpen: false, atQuery: null, atMatches: [{}], atActiveIndex: 0,
      hashMenuOpen: false, hashQuery: null, hashMatches: [{}], hashActiveIndex: 0, setHashMenuOpen() {},
      onSteer() {}, onFollowUp() {},
      sendQueued(mode) { action = mode; }, handleSend() { action = "send"; },
      applySlashCommand() { action = "slash"; },
      submitsSlashCommandOnEnter, value: "", setSlashMenuOpen() {},
      applyAtCompletion() { action = "file"; },
      applyHistoryInput() { action = "history"; },
      ...state,
    });
    handler({
      key: "Enter", shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
      nativeEvent: { isComposing: false, keyCode: 13 },
      preventDefault() { action = "prevented"; },
      ...keys,
    });
    assert.equal(action, expected, name);
  }
});

test("file mention arrows wrap around the match list", () => {
  const source = ts.createSourceFile("ChatInput.tsx", readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function findHandler(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleKeyDown") {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findHandler);
  }
  const script = new Script(ts.transpileModule(findHandler(source).getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText);

  function move(key, atActiveIndex, length) {
    let next = null;
    const handler = script.runInNewContext({
      Date: { now: () => 1000 },
      COMPOSITION_END_ENTER_GRACE_MS: 100,
      isMobile: false, isStreaming: false, enterSendMode: "enter",
      isComposingRef: { current: false }, lastCompositionEndAtRef: { current: 0 },
      historyMenuOpen: false, inputHistory: [], historyActiveIndex: 0,
      slashMenuOpen: false, slashQuery: null, displayedSlashCommands: [], slashActiveIndex: 0,
      atMenuOpen: true, atQuery: {}, atMatches: Array.from({ length }, () => ({})), atActiveIndex,
      hashMenuOpen: false, hashQuery: null, hashMatches: Array.from({ length }, () => ({})), hashActiveIndex: 0, setHashMenuOpen() {}, applyHashCompletion() {},
      onSteer() {}, onFollowUp() {},
      sendQueued() {}, handleSend() {},
      applySlashCommand() {},
      isExactSlashCommand() { return false; }, value: "@file",
      setSlashMenuOpen() {}, setAtMenuOpen() {},
      applyAtCompletion() {},
      applyHistoryInput() {},
      cycleListIndex,
      setAtActiveIndex(update) {
        next = typeof update === "function" ? update(atActiveIndex) : update;
      },
    });
    handler({
      key, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false,
      nativeEvent: { isComposing: false, keyCode: 0 },
      preventDefault() {},
    });
    return next;
  }

  assert.equal(move("ArrowDown", 0, 3), 1);
  assert.equal(move("ArrowDown", 2, 3), 0);
  assert.equal(move("ArrowUp", 0, 3), 2);
  assert.equal(move("ArrowUp", 1, 3), 0);
  assert.equal(move("ArrowDown", 0, 1), 0);
  assert.equal(move("ArrowDown", 0, 0), 0);
});

test("cycleListIndex wraps in both directions", () => {
  assert.equal(cycleListIndex(0, 3, 1), 1);
  assert.equal(cycleListIndex(2, 3, 1), 0);
  assert.equal(cycleListIndex(0, 3, -1), 2);
  assert.equal(cycleListIndex(1, 3, -1), 0);
  assert.equal(cycleListIndex(0, 1, 1), 0);
  assert.equal(cycleListIndex(4, 0, 1), 0);
  assert.equal(cycleListIndex(-1, 4, 1), 0);
});

test("streaming with an empty draft has one circular Stop and no competing send controls", () => {
  const html = renderWithI18n(React.createElement(ChatInput, {
    onSend() {}, onAbort() {}, onSteer() {}, onFollowUp() {}, isStreaming: true,
  }));
  assert.match(html, /data-action="stop"/);
  assert.equal((html.match(/aria-label="Stop agent"/g) || []).length, 1);
  assert.doesNotMatch(html, /composer-queue-button|composer-stop-button|Alt\+Enter/);
});

test("renders the upstream model error", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ModelErrorBanner, {
        error: "Invalid models.json schema:\nproviders.custom.models.0.id must not be empty",
      }),
    ),
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /Model error/);
  assert.match(html, /providers\.custom\.models\.0\.id must not be empty/);
});

test("does not render an empty model error", () => {
  assert.equal(
    renderToStaticMarkup(
      React.createElement(I18nProvider, null, React.createElement(ModelErrorBanner, { error: null })),
    ),
    "",
  );
});

test("renders enabledModels scope warnings", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ModelScopeWarningBanner, {
        warnings: [
          { code: "no-match", pattern: "ghost-gateway/*", message: 'No models match pattern "ghost-gateway/*"' },
        ],
      }),
    ),
  );
  assert.match(html, /ghost-gateway/);
  assert.match(html, /Model scope warning/);
});

test("keeps the model selector visible when a model error leaves no options", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        onModelChange() {},
        isStreaming: false,
        modelError: "Invalid models.json schema",
        modelList: [],
        modelNames: {},
      }),
    ),
  );

  assert.match(html, />No models</);
  assert.match(html, /title="No available models"/);
});

test("renders the read-only tool preset as the active selection", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        onToolPresetChange() {},
        isStreaming: false,
        toolPreset: "read-only",
      }),
    ),
  );

  assert.match(html, /title="Change tool preset: read-only"/);
  assert.match(html, />read-only<\/span>/);
});

test("renders the empty tool preset as Chat only", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        onToolPresetChange() {},
        isStreaming: false,
        toolPreset: "none",
      }),
    ),
  );

  assert.match(html, /title="Change tool preset: Chat only"/);
  assert.match(html, />Chat only<\/span>/);
});

test("renders the compact composer with the standard Send button and no session controls", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        isStreaming: false,
        compact: true,
      }),
    ),
  );

  assert.match(html, /<textarea/);
  assert.match(html, /class="native-primary-button"[^>]*aria-label="Send"/);
  assert.match(html, />Send<\/button>/);
  assert.equal((html.match(/<button\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /type="file"|Attach image|Change tool preset/);
});

test("shows and locks the optimistic model while a switch is pending", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        onModelChange() {},
        isStreaming: false,
        model: { provider: "deepseek", modelId: "deepseek-v4-flash" },
        modelList: [{ provider: "deepseek", id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" }],
        modelSwitching: true,
      }),
    ),
  );

  assert.match(html, /title="Switching model"/);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /disabled=""/);
  assert.match(html, />DeepSeek V4 Flash</);
  assert.match(html, /animation:spin 0\.8s linear infinite/);
});

test("filters model options by name and id", () => {
  const options = [
    { provider: "ollama", modelId: "qwen3:latest", name: "Qwen 3" },
    { provider: "anthropic", modelId: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { provider: "openai", modelId: "gpt-5.4", name: "GPT-5.4" },
  ];

  assert.deepEqual(filterModelOptions(options, "QWEN"), [options[0]]);
  assert.deepEqual(filterModelOptions(options, "claude-sonnet"), [options[1]]);
  assert.equal(filterModelOptions(options, "OpenAI").length, 0);
  assert.equal(filterModelOptions(options, "anthropic/claude").length, 0);
  assert.equal(filterModelOptions(options, "missing").length, 0);
  assert.equal(filterModelOptions(options, "  "), options);
});

test("renders the shared field model selector as a disabled gray control", () => {
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ModelSelector, {
        options: [{ provider: "openai", modelId: "gpt-5.6-sol", name: "GPT-5.6 Sol" }],
        value: null,
        onChange() {},
        onClear() {},
        emptyLabel: "Parent default",
        ariaLabel: "Model override",
        disabled: true,
        variant: "field",
      }),
    ),
  );

  assert.match(html, /aria-label="Model override"/);
  assert.match(html, /disabled=""/);
  assert.match(html, /background:var\(--bg-panel\)/);
  assert.match(html, />Parent default</);
});

test("caps an upward menu to the visible space above its anchor", () => {
  assert.equal(getUpwardMenuMaxHeight(343, 36), 299);
  assert.equal(getUpwardMenuMaxHeight(40, 36), 0);
  // Composer sitting under a 36px top bar with only ~160px of air: a 400px
  // file list would paint through the bar and hide the leading matches.
  assert.equal(getUpwardMenuMaxHeight(200, 36), 156);
  assert.ok(getUpwardMenuMaxHeight(200, 36) < 400);
});

test("an upward menu never opens underneath the app topbar (#63)", () => {
  const originals = { document: globalThis.document };
  const rect = (left, right, top, bottom) => ({ left, right, top, bottom });
  const element = {
    getBoundingClientRect: () => rect(100, 900, 500, 600),
  };
  const topbar = (left, right, top, bottom) => ({
    clientTop: 0,
    getBoundingClientRect: () => rect(left, right, top, bottom),
  });
  globalThis.document = {
    querySelectorAll: () => [topbar(0, 1280, 0, 52)],
  };
  try {
    // Horizontal overlap + topbar above the anchor: the boundary is its bottom.
    assert.equal(getTopbarBoundary(element), 52);
    // Topbar beside the anchor (no horizontal overlap): no boundary.
    globalThis.document = {
      querySelectorAll: () => [topbar(0, 80, 0, 52)],
    };
    assert.equal(getTopbarBoundary(element), 0);
    // Topbar drawn below the anchor must not shrink the menu.
    globalThis.document = {
      querySelectorAll: () => [topbar(0, 1280, 700, 752)],
    };
    assert.equal(getTopbarBoundary(element), 0);
    // No topbar in the tree (tests / detached use): no boundary.
    globalThis.document = { querySelectorAll: () => [] };
    assert.equal(getTopbarBoundary(element), 0);
  } finally {
    globalThis.document = originals.document;
  }
});

test("file mention menu applies the measured upward height cap", () => {
  const source = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  const start = source.indexOf("{atMenuOpen && atQuery !== null && (() => {");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 4000);
  assert.match(block, /ref=\{atMenuRef\}/);
  assert.match(block, /min\(48vh, 400px, \$\{atMenuMaxHeight\}px\)/);
  assert.match(block, /flexDirection: "column"/);
  assert.match(block, /minHeight: 0/);
  assert.equal(block.includes("maxHeight: \"min(48vh, 400px)\""), false);
});

test("file mention menu remeasures when its layout container shifts the anchor", () => {
  const source = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  const start = source.indexOf("function subscribeUpwardMenuMaxHeight");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1800);
  assert.match(block, /const layoutContainer = parent\?\.parentElement;/);
  assert.match(block, /anchorObserver\?\.observe\(layoutContainer\)/);
});

test("compresses large images while preserving small images and GIFs", async () => {
  assert.equal(shouldCompressImageFile({ size: 1024 * 1024, type: "image/png" }), false);
  assert.equal(shouldCompressImageFile({ size: 1024 * 1024 + 1, type: "image/png" }), true);
  assert.equal(shouldCompressImageFile({ size: 2 * 1024 * 1024, type: "image/gif" }), false);

  const originals = {
    FileReader: globalThis.FileReader,
    createImageBitmap: globalThis.createImageBitmap,
    document: globalThis.document,
  };
  let bitmapCalls = 0;
  let closed = false;
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ fillStyle: "", fillRect() {}, drawImage() {} }),
    toDataURL: () => "data:image/jpeg;base64,COMPRESSED",
  };

  globalThis.FileReader = class {
    readAsDataURL() {
      this.result = "data:image/png;base64,ORIGINAL";
      this.onload();
    }
  };
  globalThis.createImageBitmap = async () => {
    bitmapCalls += 1;
    return { width: 2048, height: 1024, close() { closed = true; } };
  };
  globalThis.document = { createElement: () => canvas };

  try {
    assert.deepEqual(await compressImageFile({ size: 1024, type: "image/png" }), {
      data: "ORIGINAL",
      mimeType: "image/png",
    });
    assert.deepEqual(await compressImageFile({ size: 2 * 1024 * 1024, type: "image/png" }), {
      data: "COMPRESSED",
      mimeType: "image/jpeg",
    });
    assert.equal(bitmapCalls, 1);
    assert.equal(canvas.width, 1024);
    assert.equal(canvas.height, 512);
    assert.equal(closed, true);
  } finally {
    globalThis.FileReader = originals.FileReader;
    globalThis.createImageBitmap = originals.createImageBitmap;
    globalThis.document = originals.document;
  }
});

test("recognizes exact slash commands for one-Enter submission", () => {
  const builtin = { name: "copy", description: "", source: "builtin" };
  assert.equal(isExactSlashCommand("/copy", builtin), true);
  assert.equal(isExactSlashCommand("  /copy  ", builtin), true);
  assert.equal(isExactSlashCommand("/co", builtin), false);
  assert.equal(isExactSlashCommand("/copy extra", builtin), false);
  assert.equal(isExactSlashCommand("/copy", { ...builtin, source: "extension" }), false);
});

test("clears a completed built-in only while its submitted input is unchanged", () => {
  assert.equal(canClearBuiltinCommandInput("/copy", 0, "/copy"), true);
  assert.equal(canClearBuiltinCommandInput("new follow-up", 0, "/copy"), false);
  assert.equal(canClearBuiltinCommandInput("/copy", 1, "/copy"), false);
});

test("locks built-in command submission until it settles", async () => {
  const sourceText = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("ChatInput.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function findCallback(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "runBuiltinCommand") {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findCallback);
  }
  const callback = new Script(ts.transpileModule(findCallback(source).getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText).runInNewContext({
    attachedImages: [],
    attachedFilesRef: { current: [] }, composeMessageWithAttachedFiles,
    attachedImagesRef: { current: [] },
    builtinCommandPendingRef: { current: false },
    canClearBuiltinCommandInput,
    consumeSubmission() {},
    submissionContextRef: { current: {} },
    onBuiltinCommand: async () => new Promise((resolve) => { callback.resolve = resolve; }),
    setBuiltinCommandPending(value) { callback.pendingStates.push(value); },
    valueRef: { current: "/reload" },
  });
  callback.pendingStates = [];

  const first = callback("/reload");
  assert.deepEqual(callback.pendingStates, [true]);
  assert.equal(await callback("/reload"), true);
  assert.deepEqual(callback.pendingStates, [true]);
  callback.resolve({ handled: true });
  assert.equal(await first, true);
  assert.deepEqual(callback.pendingStates, [true, false]);
  assert.match(sourceText, /<fieldset\s+disabled=\{builtinCommandPending\}\s+aria-busy=\{builtinCommandPending\}/);
});

test("keeps only read-only built-ins available while a run is active", () => {
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/copy"), true);
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/session"), true);
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/compact"), false);
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/auto-compact"), false);
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/reload"), false);
});

test("a bare /mcp reaches the built-in handler while a run is active", () => {
  assert.equal(offersBuiltinSlashCommandWhileStreaming("/mcp"), true);
  assert.equal(offersBuiltinSlashCommandWhileStreaming("/copy"), true);
  assert.equal(offersBuiltinSlashCommandWhileStreaming("/compact"), false);
  // Subcommands act on the session's connections and are queued like any message.
  assert.equal(offersBuiltinSlashCommandWhileStreaming("/mcp login docs"), false);
  assert.equal(offersBuiltinSlashCommandWhileStreaming("/mcp:1"), false);
  // The built-in list itself is unchanged: /mcp is not one of the composer's built-ins.
  assert.equal(canRunBuiltinSlashCommandWhileStreaming("/mcp"), false);
});

test("Enter on pi's built-in /mcp submits it at once; other extension commands still complete first", () => {
  const builtinMcp = { name: "mcp", source: "extension", sourceInfo: { path: "builtin:mcp", source: "builtin", scope: "temporary", origin: "top-level" } };
  const otherMcp = { ...builtinMcp, sourceInfo: { ...builtinMcp.sourceInfo, path: "/ext/mcp.ts" } };
  const copy = { name: "copy", description: "", source: "builtin", availableWhileStreaming: true };
  const compact = { name: "compact", description: "", source: "builtin" };

  assert.equal(submitsSlashCommandOnEnter("/mcp", builtinMcp, false), true);
  assert.equal(submitsSlashCommandOnEnter("/mcp", builtinMcp, true), true);
  assert.equal(submitsSlashCommandOnEnter("/mc", builtinMcp, false), false);
  assert.equal(submitsSlashCommandOnEnter("/mcp", otherMcp, false), false);
  assert.equal(submitsSlashCommandOnEnter("/deploy", { ...otherMcp, name: "deploy" }, false), false);
  // The composer's built-ins keep their rule: typed in full, and while streaming only those allowed then.
  assert.equal(submitsSlashCommandOnEnter("/copy", copy, true), true);
  assert.equal(submitsSlashCommandOnEnter("/compact", compact, false), true);
  assert.equal(submitsSlashCommandOnEnter("/compact", compact, true), false);
  assert.equal(submitsSlashCommandOnEnter("/co", copy, false), false);

  const sourceText = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  assert.match(sourceText, /if \(sendShortcut && submitsSlashCommandOnEnter\(value, selectedCommand, isStreaming\)\) \{/);
});

function chatInputCallback(name, context) {
  const submissionContext = {
    submissionContextRef: { current: {} },
    submissionPendingRef: { current: null },
    valueRef: { current: context.value ?? "" },
    attachedImagesRef: { current: context.attachedImages ?? [] },
    // Chats only: text files attached next to the images; none unless a test supplies them.
    attachedFilesRef: { current: [] },
    setAttachedFiles() {},
    composeMessageWithAttachedFiles,
    ...context,
  };
  if (name !== "beginSubmission" && !submissionContext.beginSubmission) {
    submissionContext.beginSubmission = chatInputCallback("beginSubmission", submissionContext);
  }
  submissionContext.consumeSubmission ??= submissionContext.clearInput ?? (() => {});
  const sourceText = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  const source = ts.createSourceFile("ChatInput.tsx", sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function findCallback(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findCallback);
  }
  return new Script(ts.transpileModule(findCallback(source).getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText).runInNewContext(submissionContext);
}

test("while a run streams, a bare /mcp opens Settings or is queued as before", async () => {
  const run = async (value, handled, { mode = "steer", images = [] } = {}) => {
    const calls = { builtin: [], prompts: [], cleared: 0 };
    const sendQueued = chatInputCallback("sendQueued", {
      value,
      attachedFilesRef: { current: [] }, composeMessageWithAttachedFiles,
      attachedImages: images,
      onAudioUnlock() {},
      clearInput() { calls.cleared += 1; },
      onBuiltinCommand: async () => ({ handled }),
      canRunBuiltinSlashCommandWhileStreaming,
      isBareMcpCommand,
      resolveSessionReferences: async (message) => message,
      sessionMentionTargetsRef: { current: new Map() },
      runBuiltinCommand: async (message) => { calls.builtin.push(message); return handled; },
      onPromptWithStreamingBehavior: (message, behavior, attached) => calls.prompts.push([message, behavior, attached?.length ?? 0]),
      onSteer() { throw new Error("slash messages are prompts"); },
      onFollowUp: (message, attached) => calls.prompts.push([message, "followUp", attached?.length ?? 0]),
    });
    sendQueued(mode);
    await new Promise((resolve) => setImmediate(resolve));
    return calls;
  };

  // Owned: Settings opened, nothing queued, the handler clears the input itself.
  assert.deepEqual(await run("/mcp", true), { builtin: ["/mcp"], prompts: [], cleared: 0 });
  // Another extension's /mcp: queued exactly as before.
  assert.deepEqual(await run("/mcp", false), { builtin: ["/mcp"], prompts: [["/mcp", "steer", 0]], cleared: 1 });
  assert.deepEqual(await run("/mcp", false, { mode: "followup" }), { builtin: ["/mcp"], prompts: [["/mcp", "followUp", 0]], cleared: 1 });
  // Subcommands and a /mcp with images never reach the handler.
  assert.deepEqual(await run("/mcp login docs", true), { builtin: [], prompts: [["/mcp login docs", "steer", 0]], cleared: 1 });
  assert.deepEqual(await run("/mcp", true, { images: [{}] }), { builtin: [], prompts: [["/mcp", "steer", 1]], cleared: 1 });
  // The composer's own built-ins are unchanged.
  assert.deepEqual(await run("/copy", true), { builtin: ["/copy"], prompts: [], cleared: 0 });
});

test("handleSend lets a handled /mcp through while streaming and sends an unowned one when idle", async () => {
  const run = async (value, { isStreaming, handled }) => {
    const calls = { builtin: [], sent: [] };
    const handleSend = chatInputCallback("handleSend", {
      value,
      attachedFilesRef: { current: [] }, composeMessageWithAttachedFiles,
      attachedImages: [],
      onAudioUnlock() {},
      isStreaming,
      workspaceUnavailable: null,
      offersBuiltinSlashCommandWhileStreaming,
      resolveSessionReferences: async (message) => message,
      sessionMentionTargetsRef: { current: new Map() },
      runBuiltinCommand: async (message) => { calls.builtin.push(message); return handled; },
      clearInput() {},
      onSend: (message) => calls.sent.push(message),
    });
    await handleSend();
    return calls;
  };
  assert.deepEqual(await run("/mcp", { isStreaming: true, handled: true }), { builtin: ["/mcp"], sent: [] });
  assert.deepEqual(await run("/mcp", { isStreaming: false, handled: true }), { builtin: ["/mcp"], sent: [] });
  assert.deepEqual(await run("/mcp", { isStreaming: false, handled: false }), { builtin: ["/mcp"], sent: ["/mcp"] });
  // Streaming without steer handlers keeps any other message in the composer, as before.
  assert.deepEqual(await run("/mcp login", { isStreaming: true, handled: false }), { builtin: [], sent: [] });
});

test("restores text and base64 images when editing a user message", () => {
  const message = {
    role: "user",
    content: [
      { type: "text", text: "Review this image @src/example.ts " },
      { type: "image", source: { type: "base64", media_type: "image/png", data: "AQID" } },
    ],
  };

  assert.equal(getUserMessageText(message), "Review this image @src/example.ts ");
  assert.deepEqual(getUserMessageDraftImages(message), [
    { data: "AQID", mimeType: "image/png" },
  ]);
});

test("restores legacy flat image entries when editing a user message", () => {
  const message = {
    role: "user",
    content: [
      { type: "image", data: "AQID", mimeType: "image/jpeg" },
    ],
  };

  assert.deepEqual(getUserMessageDraftImages(message), [
    { data: "AQID", mimeType: "image/jpeg" },
  ]);
});

function imageReadHarness() {
  const reads = new Map();
  const created = [];
  const revoked = [];
  const context = {
    compact: false,
    MAX_ATTACHED_IMAGES: 12,
    MAX_ATTACHED_IMAGE_BYTES: 10 * 1024 * 1024,
    attachedImagesRef: { current: [] },
    pendingImageCountRef: { current: 0 },
    imageReadQueueRef: { current: Promise.resolve() },
    submissionContextRef: { current: {} },
    compressImageFile(file) {
      const read = deferred();
      reads.set(file.name, read);
      return read.promise;
    },
    URL: { createObjectURL(file) { created.push(file.name); return `blob:${file.name}`; } },
    revokeImagePreview(image) { revoked.push(image.previewUrl); },
    setAttachedImages(images) { context.images = images; },
  };
  context.appendAttachedImages = chatInputCallback("appendAttachedImages", context);
  return {
    context, reads, created, revoked,
    process: chatInputCallback("processImageFiles", context),
    resolve(name) { reads.get(name).resolve({ data: name, mimeType: "image/png" }); },
    order() { return Array.from(context.attachedImagesRef.current, (image) => image.data); },
    visit() {
      context.submissionContextRef.current = {};
      context.pendingImageCountRef.current = 0;
      context.imageReadQueueRef.current = Promise.resolve();
      context.attachedImagesRef.current = [];
    },
  };
}

function imageFiles(...names) {
  return names.map((name) => ({ name, type: "image/png", size: 100 }));
}

test("image reads keep file and batch selection order despite reversed completion", async () => {
  const harness = imageReadHarness();
  const first = harness.process(imageFiles("one", "two", "three"));
  const second = harness.process(imageFiles("four", "five"));
  assert.equal(harness.context.pendingImageCountRef.current, 5);
  for (const name of ["five", "four", "three", "two"]) harness.resolve(name);
  await Promise.resolve();
  assert.deepEqual(harness.order(), []);
  harness.resolve("one");
  await Promise.all([first, second]);
  assert.deepEqual(harness.order(), ["one", "two", "three", "four", "five"]);
  assert.deepEqual(harness.created, harness.order());
  assert.equal(harness.context.pendingImageCountRef.current, 0);
});

test("a failed image read releases its slot and retains the remaining selected order", async () => {
  const harness = imageReadHarness();
  const pending = harness.process(imageFiles("one", "bad", "three"));
  harness.resolve("three");
  harness.reads.get("bad").reject(new Error("unreadable file"));
  harness.resolve("one");
  await pending;
  assert.deepEqual(harness.order(), ["one", "three"]);
  assert.equal(harness.context.pendingImageCountRef.current, 0);
  const next = harness.process(imageFiles("four"));
  harness.resolve("four");
  await next;
  assert.deepEqual(harness.order(), ["one", "three", "four"]);
  assert.deepEqual(harness.revoked, []);
});

test("old image reads cannot enter another visit, return visit, or unmounted composer", async () => {
  for (const unmount of [false, true]) {
    const harness = imageReadHarness();
    const old = harness.process(imageFiles("old"));
    harness.visit();
    harness.visit(); // A -> B -> A must also use a fresh visit token.
    const current = harness.process(imageFiles("current"));
    harness.resolve("current");
    await current; // The new visit never waits for the obsolete queue.
    assert.deepEqual(harness.order(), ["current"]);
    const newer = harness.process(imageFiles("newer"));
    if (unmount) harness.context.submissionContextRef.current = null;
    harness.resolve("old");
    await old;
    assert.deepEqual(harness.order(), ["current"]);
    assert.deepEqual(harness.created, ["current"]);
    assert.equal(harness.context.pendingImageCountRef.current, 1);
    harness.resolve("newer");
    await newer;
    assert.deepEqual(harness.order(), unmount ? ["current"] : ["current", "newer"]);
  }
});

test("overlapping image batches reserve at most twelve slots before React flushes", async () => {
  const harness = imageReadHarness();
  const names = Array.from({ length: 14 }, (_, index) => `image-${index}`);
  const first = harness.process(imageFiles(...names.slice(0, 8)));
  const second = harness.process(imageFiles(...names.slice(8)));
  assert.equal(harness.context.pendingImageCountRef.current, 12);
  assert.equal(harness.reads.size, 12);
  for (const name of names.slice(0, 12).reverse()) harness.resolve(name);
  await Promise.all([first, second]);
  assert.deepEqual(harness.order(), names.slice(0, 12));
  assert.equal(harness.context.pendingImageCountRef.current, 0);
  await harness.process(imageFiles("over-cap"));
  assert.equal(harness.reads.has("over-cap"), false);
});

test("removing an image keeps its neighbors ordered before the next upload or send", async () => {
  const harness = imageReadHarness();
  const pending = harness.process(imageFiles("one", "two", "three"));
  for (const name of ["one", "two", "three"]) harness.resolve(name);
  await pending;
  chatInputCallback("removeImage", harness.context)(1);
  assert.deepEqual(harness.order(), ["one", "three"]);
  assert.deepEqual(harness.revoked, ["blob:two"]);
  const later = harness.process(imageFiles("four"));
  harness.resolve("four");
  await later;
  assert.deepEqual(harness.order(), ["one", "three", "four"]);
  const submission = chatInputCallback("beginSubmission", {
    ...harness.context, valueRef: { current: "" }, submissionPendingRef: { current: null },
  })();
  assert.deepEqual(Array.from(submission.images, (image) => image.data), ["one", "three", "four"]);
});

test("composer markup preserves all twelve draft images in their original order", () => {
  const key = "new:/tmp/attachment-order";
  const images = Array.from({ length: 12 }, (_, index) => ({
    data: Buffer.from(`image-${index}`).toString("base64"), mimeType: "image/png",
  }));
  setDraft(key, { value: "", images });
  try {
    const html = renderWithI18n(React.createElement(ChatInput, {
      draftKey: key, onSend() {}, onAbort() {}, isStreaming: false,
    }));
    const rendered = [...html.matchAll(/<img[^>]*class="composer-attachment-image"[^>]*src="data:image\/png;base64,([^"]+)"/g)];
    assert.deepEqual(rendered.map((match) => match[1]), images.map((image) => image.data));
    assert.equal([...html.matchAll(/class="composer-attachment-remove"/g)].length, 12);
  } finally {
    clearDraft(key);
  }
});

test("does not restore a historical message over a pending image attachment", () => {
  assert.equal(canRestoreUserMessage("", 0, 0), true);
  assert.equal(canRestoreUserMessage("", 1, 0), false);
  assert.equal(canRestoreUserMessage("", 0, 1), false);
  assert.equal(canRestoreUserMessage("draft", 0, 0), false);
});

test("restores a cleared submission using the queued React state", () => {
  let value = "failed submission";
  const updates = [
    () => "",
    (current) => mergeRestoredSubmissionText("failed submission", current),
  ];

  for (const update of updates) value = update(value);

  assert.equal(value, "failed submission");
  assert.equal(
    mergeRestoredSubmissionText("failed submission", "new draft"),
    "failed submission\n\nnew draft",
  );
  assert.equal(
    mergeRestoredSubmissionText("failed submission", "failed submission"),
    "failed submission\n\nfailed submission",
  );
});

test("keeps a failed first submission recoverable across a composer remount", () => {
  const image = { data: "AQID", mimeType: "image/png" };
  const restored = mergeRestoredSubmissionDraft(
    "failed submission",
    [image],
    "",
    [],
  );

  assert.deepEqual(restored, {
    value: "failed submission",
    images: [image],
  });
  assert.deepEqual(
    mergeRestoredSubmissionDraft("failed submission", [image], "new draft", []),
    {
      value: "failed submission\n\nnew draft",
      images: [image],
    },
  );
});

test("preserves duplicate image attachments when restoring a submission", () => {
  const image = { data: "AQID", mimeType: "image/png" };
  const restored = mergeRestoredSubmissionDraft("", [image, image], "", [image]);

  assert.deepEqual(restored.images, [image, image, image]);
});

test("moves a provisional new-session draft to the real session key", () => {
  const provisionalKey = "new:/tmp/rekey-test";
  const sessionKey = "session-rekey-test";
  clearDraft(provisionalKey);
  clearDraft(sessionKey);
  setDraft(provisionalKey, { value: "queued while preflight ran", images: [] });

  assert.deepEqual(rekeyDraft(provisionalKey, sessionKey), {
    value: "queued while preflight ran",
    images: [],
  });
  assert.equal(getDraft(provisionalKey), null);
  assert.deepEqual(getDraft(sessionKey), {
    value: "queued while preflight ran",
    images: [],
  });

  clearDraft(sessionKey);
});

test("rekey keeps a synchronously restored draft when React state is still empty", () => {
  const provisionalKey = "new:/tmp/rekey-race";
  const sessionKey = "session-rekey-race";
  clearDraft(provisionalKey);
  clearDraft(sessionKey);
  setDraft(provisionalKey, { value: "restored before state flush", images: [] });

  assert.deepEqual(
    rekeyDraft(provisionalKey, sessionKey, { value: "", images: [] }),
    { value: "restored before state flush", images: [] },
  );
  assert.equal(getDraft(provisionalKey), null);
  assert.deepEqual(getDraft(sessionKey), {
    value: "restored before state flush",
    images: [],
  });

  clearDraft(sessionKey);
});

test("renders compact errors above the input as a wrapping alert", () => {
  const error = "Compaction failed: OpenAI API error (403): <html>request forbidden</html>";
  const html = renderToStaticMarkup(
    React.createElement(
      I18nProvider,
      null,
      React.createElement(ChatInput, {
        onSend() {},
        onAbort() {},
        onCompact() {},
        isStreaming: false,
        compactError: error,
      }),
    ),
  );

  assert.match(html, /role="alert"/);
  assert.match(html, /Compaction failed: OpenAI API error/);
  assert.match(html, /&lt;html&gt;request forbidden&lt;\/html&gt;/);
  assert.match(html, /white-space:pre-wrap/);
  assert.ok(html.indexOf('role="alert"') < html.indexOf("<textarea"));
});

test("modelSupportsImageInput warns only when modality info is known and lacks image", () => {
  const modelList = [
    { id: "text-only", name: "Text Only", provider: "ollama", input: ["text"] },
    { id: "vision", name: "Vision", provider: "anthropic", input: ["text", "image"] },
    { id: "unknown", name: "Unknown", provider: "custom", input: undefined },
  ];

  assert.equal(modelSupportsImageInput({ provider: "ollama", modelId: "text-only" }, modelList), false);
  assert.equal(modelSupportsImageInput({ provider: "anthropic", modelId: "vision" }, modelList), true);
  // Unknown modality info never blocks the user.
  assert.equal(modelSupportsImageInput({ provider: "custom", modelId: "unknown" }, modelList), true);
  // Model missing from the list is treated as unknown.
  assert.equal(modelSupportsImageInput({ provider: "x", modelId: "missing" }, modelList), true);
  assert.equal(modelSupportsImageInput(null, modelList), true);
  assert.equal(modelSupportsImageInput({ provider: "ollama", modelId: "text-only" }, undefined), true);
});

test("renders image warnings for known text-only defaults without an explicit model selection", () => {
  const draftKey = "new:/tmp/image-warning-default";
  const modelList = [
    { id: "text-only", name: "Text Only", provider: "custom", input: ["text"] },
    { id: "vision", name: "Vision", provider: "custom", input: ["text", "image"] },
    { id: "unknown", name: "Unknown", provider: "custom" },
  ];
  setDraft(draftKey, {
    value: "Describe this image",
    images: [{ data: "aW1hZ2U=", mimeType: "image/png" }],
  });

  try {
    for (const [modelId, warningExpected] of [["text-only", true], ["vision", false], ["unknown", false], [null, false]]) {
      const html = renderToStaticMarkup(
        React.createElement(
          I18nProvider,
          null,
          React.createElement(ChatInput, {
            onSend() {},
            onAbort() {},
            isStreaming: false,
            isAutoModelSelection: true,
            model: modelId ? { provider: "custom", modelId } : null,
            modelList,
            draftKey,
          }),
        ),
      );

      assert.match(html, /<img/);
      assert.equal(html.includes("Images may not be sent"), warningExpected, `default model: ${modelId}`);
      if (warningExpected) {
        assert.match(html, /The selected model \(Text Only\) does not support image input/);
        assert.ok(html.indexOf('role="alert"') < html.indexOf("<textarea"));
      }
    }
  } finally {
    clearDraft(draftKey);
  }
});

test("handleSend sends exactly once and routes builtin commands through the pending guard", async () => {
  const source = ts.createSourceFile("ChatInput.tsx", readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function findHandler(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === "handleSend") {
      return node.initializer.arguments[0];
    }
    return ts.forEachChild(node, findHandler);
  }
  const script = new Script(ts.transpileModule(findHandler(source).getText(source), {
    compilerOptions: { target: ts.ScriptTarget.ES2020 },
  }).outputText);

  function run({ value = "hello", attachedImages = [], builtinHandled = false, resolved = null, workspaceUnavailable = null }) {
    let sends = 0;
    let cleared = 0;
    let builtinCalls = 0;
    const submissionContextRef = { current: {} };
    const submissionPendingRef = { current: null };
    const attachedFilesRef = { current: [] };
    const handler = script.runInNewContext({
      value, attachedImages, isStreaming: false, workspaceUnavailable,
      submissionContextRef, submissionPendingRef,
      attachedFilesRef, composeMessageWithAttachedFiles,
      beginSubmission: chatInputCallback("beginSubmission", { value, attachedImages, attachedFilesRef, submissionContextRef, submissionPendingRef }),
      onAudioUnlock() {},
      runBuiltinCommand: async () => {
        builtinCalls += 1;
        return builtinHandled;
      },
      resolveSessionReferences: async (msg) => resolved ?? msg,
      sessionMentionTargetsRef: { current: new Map() },
      onSend(message, images) { sends += 1; handler.sent = { message, images }; },
      consumeSubmission() { cleared += 1; },
    });
    return handler().then(() => ({ sends, cleared, builtinCalls, sent: handler.sent }));
  }

  // Plain message: one send of the resolved text, one clear, no double-send.
  const plain = await run({ value: "  hello " });
  assert.equal(plain.sends, 1);
  assert.equal(plain.sent.message, "hello");
  assert.equal(plain.cleared, 1);

  // Session mentions resolve before sending; the raw text is never sent.
  const mentioned = await run({ value: "see #abc123", resolved: "see /path/to/abc123.jsonl" });
  assert.equal(mentioned.sends, 1);
  assert.equal(mentioned.sent.message, "see /path/to/abc123.jsonl");

  // Handled builtin command stops before onSend; unhandled falls through.
  const builtin = await run({ value: "/compact", builtinHandled: true });
  assert.equal(builtin.builtinCalls, 1);
  assert.equal(builtin.sends, 0);
  assert.equal(builtin.cleared, 0);
  const passthrough = await run({ value: "/unknown", builtinHandled: false });
  assert.equal(passthrough.sends, 1);

  // A deleted workspace blocks the prompt and keeps the draft; local commands still run.
  const gone = { cwd: "/gone", availability: "missing" };
  const blocked = await run({ value: "hello", workspaceUnavailable: gone });
  assert.equal(blocked.sends, 0);
  assert.equal(blocked.cleared, 0);
  const local = await run({ value: "/copy", builtinHandled: true, workspaceUnavailable: gone });
  assert.equal(local.builtinCalls, 1);
});

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function submissionHarness({ value = 'ask #"Reference"', images = [], isStreaming = false, resolveReferences = async (text) => text, onSend, onBuiltinCommand } = {}) {
  const calls = [];
  const drafts = new Map();
  const revoked = [];
  let imageState = images;
  const context = {
    valueRef: { current: value },
    attachedImagesRef: { current: images },
    submissionContextRef: { current: {} },
    submissionPendingRef: { current: null },
    draftKeyRef: { current: "session-a" },
    textareaRef: { current: null },
    sessionMentionTargetsRef: { current: new Map([["Reference", "reference-a"]]) },
    builtinCommandPendingRef: { current: false },
    attachedImages: images,
    isStreaming,
    workspaceUnavailable: null,
    onAudioUnlock() {},
    setAtQuery() {}, setHashQuery() {}, setHistoryMenuOpen() {}, setBuiltinCommandPending() {},
    setValue(value) { context.valueRef.current = typeof value === "function" ? value(context.valueRef.current) : value; },
    setAttachedImages(update) {
      imageState = typeof update === "function" ? update(imageState) : update;
      context.attachedImagesRef.current = imageState;
    },
    setDraft(key, draft) { drafts.set(key, draft); },
    imageToDraftImage: ({ data, mimeType }) => ({ data, mimeType }),
    revokeImagePreview(image) { revoked.push(image); },
    resolveSessionReferences: resolveReferences,
    offersBuiltinSlashCommandWhileStreaming, canRunBuiltinSlashCommandWhileStreaming, isBareMcpCommand, canClearBuiltinCommandInput,
    onSend: onSend ?? ((...args) => calls.push(["send", ...args])),
    onSteer: (...args) => calls.push(["steer", ...args]),
    onFollowUp: (...args) => calls.push(["followup", ...args]),
    onBuiltinCommand,
  };
  context.beginSubmission = chatInputCallback("beginSubmission", context);
  context.consumeSubmission = chatInputCallback("consumeSubmission", context);
  context.runBuiltinCommand = chatInputCallback("runBuiltinCommand", context);
  return {
    context, calls, drafts, revoked,
    send: chatInputCallback("handleSend", context),
    queue: chatInputCallback("sendQueued", context),
  };
}

test("delayed queue resolution submits once across repeated Enter and buttons", async () => {
  for (const mode of ["steer", "followup"]) {
    const resolution = deferred();
    let lookups = 0;
    const harness = submissionHarness({ isStreaming: true, resolveReferences: () => { lookups += 1; return resolution.promise; } });
    const first = harness.queue(mode);
    await harness.queue(mode);
    await harness.queue(mode === "steer" ? "followup" : "steer");
    await harness.send();
    assert.equal(lookups, 1);
    assert.equal(harness.context.valueRef.current, 'ask #"Reference"');
    resolution.resolve("expanded reference");
    await first;
    assert.deepEqual(harness.calls, [[mode, "expanded reference", undefined]]);
    assert.equal(harness.context.valueRef.current, "");
    assert.equal(harness.context.submissionPendingRef.current, null);
  }
});

test("delayed send consumes its snapshot and preserves newer text and attachments", async () => {
  for (const queue of [false, true]) {
    const resolution = deferred();
    const started = deferred();
    const submittedImage = { data: "AQID", mimeType: "image/png", previewUrl: "blob:submitted" };
    const newImage = { data: "BAUG", mimeType: "image/png", previewUrl: "blob:new" };
    let selectedTargets;
    const harness = submissionHarness({ images: [submittedImage], isStreaming: queue,
      resolveReferences: (_text, targets) => { selectedTargets = targets; started.resolve(); return resolution.promise; } });
    const pending = queue ? harness.queue("steer") : harness.send();
    await started.promise;
    harness.context.valueRef.current = "new draft typed while waiting";
    harness.context.setAttachedImages([submittedImage, newImage]);
    harness.context.sessionMentionTargetsRef.current.set("Reference", "reference-b");
    resolution.resolve("expanded original reference");
    await pending;
    assert.equal(selectedTargets.get("Reference"), "reference-a");
    assert.equal(harness.calls.length, 1);
    assert.equal(harness.calls[0][1], "expanded original reference");
    assert.deepEqual([...harness.calls[0][2]], [submittedImage]);
    assert.equal(harness.context.valueRef.current, "new draft typed while waiting");
    assert.deepEqual([...harness.context.attachedImagesRef.current], [newImage]);
    assert.deepEqual(harness.revoked, [submittedImage]);
    const saved = harness.drafts.get("session-a");
    assert.equal(saved.value, "new draft typed while waiting");
    assert.equal(saved.images.length, 1);
    assert.equal(saved.images[0].data, newImage.data);
  }
});

test("switching composer visits or unmounting cancels delayed sends without touching another draft", async () => {
  for (const queue of [false, true]) {
    for (const destination of ["session-b", "session-a", null]) {
      const resolution = deferred();
      const started = deferred();
      const harness = submissionHarness({ isStreaming: queue, resolveReferences: () => { started.resolve(); return resolution.promise; } });
      const pending = queue ? harness.queue("followup") : harness.send();
      await started.promise;
      // New visit token even for A -> B -> A; null models the layout cleanup.
      harness.context.submissionContextRef.current = destination === null ? null : {};
      harness.context.draftKeyRef.current = destination;
      harness.context.valueRef.current = "destination draft";
      harness.context.attachedImagesRef.current = [{ data: "BAUG", mimeType: "image/png" }];
      resolution.resolve("late reference");
      await pending;
      assert.deepEqual(harness.calls, []);
      assert.equal(harness.context.valueRef.current, "destination draft");
      assert.equal(harness.context.attachedImagesRef.current.length, 1);
      assert.equal(harness.drafts.size, 0);
    }
  }
});

test("clear precedes synchronous rejection recovery and a failed lookup unlocks retry", async () => {
  let harness;
  harness = submissionHarness({ value: "rejected message", onSend() {
    assert.equal(harness.context.valueRef.current, "");
    harness.context.valueRef.current = "restored rejected message";
  } });
  await harness.send();
  assert.equal(harness.context.valueRef.current, "restored rejected message");

  const resolution = deferred();
  const failing = submissionHarness({ isStreaming: true, resolveReferences: () => resolution.promise });
  const pending = failing.queue("steer");
  resolution.reject(new Error("reference failed"));
  await assert.rejects(pending, /reference failed/);
  assert.equal(failing.context.submissionPendingRef.current, null);
  assert.equal(failing.context.valueRef.current, 'ask #"Reference"');
  assert.deepEqual(failing.calls, []);
});

test("delayed built-ins cannot clear a different composer containing the same command", async () => {
  const result = deferred();
  const harness = submissionHarness({ value: "/copy", onBuiltinCommand: () => result.promise });
  const pending = harness.send();
  harness.context.submissionContextRef.current = {};
  harness.context.draftKeyRef.current = "session-b";
  result.resolve({ handled: true });
  await pending;
  assert.equal(harness.context.valueRef.current, "/copy");
  assert.equal(harness.drafts.size, 0);
  assert.deepEqual(harness.calls, []);
});

test("a missing workspace replaces the model error and disables Send", () => {
  const source = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  assert.match(source, /workspaceUnavailable\s*\?\s*<WorkspaceUnavailableBanner[\s\S]*?:\s*<ModelErrorBanner error=\{modelError\} \/>/);
  assert.match(source, /const canSend = canQueueStreamingMessage && !workspaceUnavailable;/);
  assert.match(source, /disabled=\{!showStop && \(!canSend/);
});

test("chat-only composer keeps shell, file and session mentions out of the input", () => {
  const html = renderWithI18n(
    React.createElement(ChatInput, {
      onSend() {},
      onAbort() {},
      isStreaming: false,
      chatOnly: true,
      cwd: "/repo",
      toolPreset: "none",
      onThinkingLevelChange() {},
    }),
  );

  assert.match(html, /accept="image\/\*"/);
  assert.match(html, /aria-label="Attach image"/);
  assert.match(html, /Chat · \/ commands · images &amp; text files/);
  assert.doesNotMatch(html, /@ files/);
  assert.doesNotMatch(html, /# sessions/);
  assert.doesNotMatch(html, />Shell</);

  const source = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  assert.match(source, /const bashMode = !chatOnly && attachedImages\.length === 0/);
  assert.match(source, /if \(chatOnly \|\| !cwd\) \{\s*setAtQuery\(null\)/);
  assert.match(source, /useSessionMentionPalette\(\{ cwd: chatOnly \? null : cwd/);
  assert.match(source, /\{chatOnly && \([\s\S]*?t\("chat\.chatOnlyDescription"\)/);
});

test("only the chat composer offers saving a default model or reasoning level", () => {
  const chatInputSource = readFileSync(new URL("./ChatInput.tsx", import.meta.url), "utf8");
  const agentsConfigSource = readFileSync(new URL("./AgentsConfig.tsx", import.meta.url), "utf8");
  assert.match(chatInputSource, /<ModelSelector[\s\S]*?defaultValue=\{defaultModel\}[\s\S]*?onSetDefault=\{onSetDefaultModel\}/);
  // "auto" means "use the default", so it never gets a star of its own.
  assert.match(chatInputSource, /star=\{onSetDefaultThinkingLevel && lvl !== "auto"/);
  // A subagent profile's model is not the default for new chats.
  assert.doesNotMatch(agentsConfigSource, /onSetDefault/);
});

test("selector rows expose a plain default star separate from the selected option", async () => {
  const { SelectorRow } = await jiti.import("./SelectorRow.tsx");
  const star = (isDefault) => ({ isDefault, saveLabel: "Save as default", defaultLabel: "Default", onSave: () => {} });
  const row = (props) => renderToStaticMarkup(React.createElement(SelectorRow, {
    active: false,
    onSelect: () => {},
    ...props,
  }, "Alpha"));

  const savable = row({ star: star(false) });
  assert.match(savable, /role="option"/);
  assert.match(savable, /aria-label="Save as default"/);
  // The unfilled star stays available to pointer, keyboard and touch input.
  assert.match(savable, /class="app-default-star"/);
  assert.doesNotMatch(savable, /opacity:0|tabindex="-1"|box-shadow/);
  assert.match(savable, /padding:7px 36px 7px 12px/);
  assert.doesNotMatch(savable, /aria-label="Default"/);

  // The default row shows a static marker in the same spot and no button.
  const saved = row({ star: star(true) });
  assert.match(saved, /role="img" aria-label="Default"/);
  assert.match(saved, /fill="currentColor"/);
  assert.doesNotMatch(saved, /Save as default/);

  const plain = row({});
  assert.doesNotMatch(plain, /Save as default|aria-label="Default"/);
  assert.match(plain, /padding:7px 12px/);
  // Rows without a star still line up with starred ones in the same menu.
  assert.match(row({ gutter: true }), /padding:7px 36px 7px 12px/);

  const active = row({ active: true });
  assert.match(active, /aria-selected="true"/);
  assert.match(active, /data-selected="true"/);
  assert.doesNotMatch(active, /polyline/);
  assert.doesNotMatch(active, /border-left/);
});
