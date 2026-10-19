import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall, getCurrentTools } from "@earendil-works/pi-ai";
import { createAgentSessionFromServices, createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { createConversationChapterExtension } = await jiti.import("./conversation-chapter-extension.ts");
const { getConversationChapters } = await jiti.import("./conversation-chapters.ts");
const { buildSessionContext } = await jiti.import("./session-reader.ts");
const { toClientAgentEvent } = await jiti.import("./agent-event-wire.ts");
const { createAgentEventStream } = await jiti.import("./agent-event-stream.ts");

test("an aborted chapter execution appends no record", async () => {
  const manager = SessionManager.inMemory("D:/generated/chapter-cancel");
  let definition;
  createConversationChapterExtension().factory({
    registerTool(tool) { definition = tool; },
    appendEntry(type, data) { manager.appendCustomEntry(type, data); },
  });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(definition.execute("canceled-call", { title: "Never stored" }, controller.signal, undefined, { sessionManager: manager }), /canceled/);
  assert.equal(manager.getEntries().some((entry) => entry.customType === "pi-web:chapter"), false);
});

test("real model-issued chapter tools persist distinct chapters and deduplicate retries through live/history navigation", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-chapter-tool-"));
  let session;
  const streamAbort = new AbortController();
  try {
    const faux = fauxProvider({ models: [{ id: "chapter-test" }] });
    const modelRuntime = await ModelRuntime.create({ authPath: join(dir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    modelRuntime.registerNativeProvider(faux.provider);
    const services = await createAgentSessionServices({
      cwd: dir, agentDir: dir, modelRuntime, settingsManager: SettingsManager.inMemory(),
      resourceLoaderOptions: { noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [createConversationChapterExtension()] },
    });
    const manager = SessionManager.create(dir, dir);
    ({ session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("chapter-test") }));
    const sse = createAgentEventStream(new Request("http://localhost/generated-chapters", { signal: streamAbort.signal }), "chapter-test-session", Promise.resolve({
      isStreaming: false, streamingMessage: undefined, onEvent: (listener) => session.subscribe(listener),
    }));
    const reader = sse.getReader();
    await reader.read(); // Opening comment.
    await reader.read(); // Connected snapshot provenance.
    const wireMessages = [];
    const collectWire = (async () => {
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) return;
        const text = decoder.decode(chunk.value);
        if (text.startsWith("data: ")) wireMessages.push(JSON.parse(text.slice(6)));
      }
    })();
    const live = [];
    let persistedBeforeSuccess = false;
    session.subscribe((event) => {
      const projected = toClientAgentEvent(event);
      if (projected?.type === "message_end" && projected.message?.role === "custom") live.push(projected.message);
      if (event.type === "tool_execution_end" && event.toolName === "mark_chapter" && !event.isError) {
        persistedBeforeSuccess = manager.getEntries().some((entry) => entry.type === "custom" && entry.customType === "pi-web:chapter");
      }
    });
    let declared;
    faux.setResponses([
      (context) => {
        declared = getCurrentTools(context.messages).find((tool) => tool.name === "mark_chapter");
        return fauxAssistantMessage([fauxToolCall("mark_chapter", { title: "Inspect the parser" }, { id: "chapter-first" })], { stopReason: "toolUse" });
      },
      fauxAssistantMessage([fauxToolCall("mark_chapter", { title: "Inspect the parser" }, { id: "chapter-second" })], { stopReason: "toolUse" }),
      fauxAssistantMessage([fauxToolCall("mark_chapter", { title: "Ignored retry title" }, { id: "chapter-second" })], { stopReason: "toolUse" }),
      fauxAssistantMessage([fauxText("Work continues.")]),
    ]);
    await session.prompt("Inspect and then update the parser.");
    streamAbort.abort();
    await collectWire;
    const stored = manager.getEntries().filter((entry) => entry.type === "custom" && entry.customType === "pi-web:chapter");
    assert.equal(stored.length, 2, "two distinct model calls in one user request are two chapters; retrying an ID is not a third");
    assert.equal(persistedBeforeSuccess, true);
    assert.ok(declared, "the real provider request declares mark_chapter");
    const definition = session.getAllTools().find((tool) => tool.name === "mark_chapter");
    assert.equal(definition.exposure, "model-only");
    assert.equal(session.getCallableToolNames().includes("mark_chapter"), false, "codemode and nested tools cannot author chapters");
    assert.ok(definition.promptGuidelines.some((line) => line.includes("meaningful new phase")));
    const call = session.agent.state.messages.flatMap((message) => message.role === "assistant" ? message.content : []).find((block) => block.type === "toolCall" && block.name === "mark_chapter");
    assert.equal(stored[0].data.chapterId, call.id);
    const reopened = SessionManager.open(manager.getSessionFile());
    const context = buildSessionContext(reopened.getEntries());
    const historyChapters = getConversationChapters(context.messages, context.entryIds);
    const liveChapters = getConversationChapters(live);
    assert.equal(historyChapters.length, 2);
    assert.deepEqual(historyChapters.map(({ chapterId, title }) => [chapterId, title]), [
      ["chapter-first", "Inspect the parser"], ["chapter-second", "Inspect the parser"],
    ]);
    assert.equal(historyChapters[0].chapterId, call.id);
    assert.equal(historyChapters[0].title, "Inspect the parser");
    assert.equal(liveChapters[0].chapterId, historyChapters[0].chapterId);
    assert.equal(liveChapters[0].title, historyChapters[0].title);
    assert.deepEqual(getConversationChapters(wireMessages.filter((event) => event.type === "message_end").map((event) => event.message)).map((chapter) => chapter.chapterId), ["chapter-first", "chapter-second"], "actual SSE sends both durable chapter records exactly once");
    assert.equal(getConversationChapters([{ role: "user", content: "**Fake chapter**" }, { role: "assistant", content: [{ type: "text", text: "**Not a chapter**" }] }]).length, 0);
    const chapterEntries = manager.getEntries().filter((entry) => entry.type === "custom" && entry.customType === "pi-web:chapter");
    const firstBranch = buildSessionContext(reopened.getEntries(), chapterEntries[0].id);
    assert.deepEqual(getConversationChapters(firstBranch.messages).map((chapter) => chapter.chapterId), ["chapter-first"]);
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall("mark_chapter", { title: "Invalid\nmultiline" }, { id: "invalid-chapter" })], { stopReason: "toolUse" }),
      fauxAssistantMessage([fauxText("Invalid chapter was refused.")]),
    ]);
    await session.prompt("Generated invalid chapter test");
    assert.equal(manager.getEntries().filter((entry) => entry.type === "custom" && entry.customType === "pi-web:chapter").length, 2);
    assert.equal(session.agent.state.messages.find((message) => message.role === "toolResult" && message.toolCallId === "invalid-chapter")?.isError, true);
  } finally {
    streamAbort.abort();
    session?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
