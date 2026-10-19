import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const { getFinalSplit, getTurnWrittenFiles, findFinalAssistantIndex, getProcessState } = await jiti.import("./ChatWindow.tsx");
const source = await readFile(new URL("./ChatWindow.tsx", import.meta.url), "utf8");
const markdownSource = await readFile(new URL("./MarkdownBody.tsx", import.meta.url), "utf8");

// MessageView's memo compares `message` and `writtenFiles` by identity. The
// transcript loop re-runs on every streaming delta, so every finished turn must
// get the same derived objects back, or each token re-renders the whole history.

test("final answer and process messages are stable per assistant message", () => {
  const final = {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "plan" },
      { type: "toolCall", toolCallId: "t1", toolName: "write", input: { path: "a.txt", content: "x" } },
      { type: "text", text: "Done." },
    ],
    usage: { input: 1, output: 1 },
  };
  const first = getFinalSplit(final);
  const second = getFinalSplit(final);
  assert.equal(second, first);
  assert.equal(second.answerMessage, first.answerMessage);
  assert.equal(second.processMessage, first.processMessage);
  assert.deepEqual(first.answerMessage.content.map((block) => block.type), ["text"]);
  assert.equal(first.processMessage.usage, undefined, "usage belongs to the answer bubble");

  const errorOnly = { role: "assistant", content: [], stopReason: "error", errorMessage: "boom" };
  assert.ok(getFinalSplit(errorOnly).answerMessage, "an error-only final entry still renders its notice");
});

test("an empty answer prefix does not reset an in-flight process disclosure", () => {
  const message = { role: "assistant", content: [{ type: "thinking", thinking: "Live plan" }, { type: "text", text: "" }] };
  assert.equal(getFinalSplit(message).answerMessage, null, "text_start alone is not an available answer");
  assert.deepEqual(getFinalSplit(message).processMessage.content, [message.content[0]]);
  const answered = { ...message, content: [message.content[0], { type: "text", text: "Ready." }] };
  assert.deepEqual(getFinalSplit(answered).answerMessage.content, [answered.content[1]]);
});

test("only the latest assistant entry can supply a turn's final answer", () => {
  const messages = [
    { role: "user", content: "Check this." },
    { role: "assistant", content: [{ type: "text", text: "I will check the file." }] },
    { role: "assistant", content: [{ type: "toolCall", toolCallId: "t2", toolName: "read", input: { path: "a.txt" } }] },
    { role: "toolResult", toolCallId: "t2", content: [{ type: "text", text: "file" }] },
  ];
  const latest = findFinalAssistantIndex(messages, 0, messages.length);
  assert.equal(latest, 2, "an earlier narration is process when later tool work follows");
  assert.equal(getFinalSplit(messages[latest]).answerMessage, null, "a tool-only latest entry has no final answer");
  messages.push({ role: "assistant", content: [{ type: "text", text: "Checked." }] });
  assert.equal(findFinalAssistantIndex(messages, 0, messages.length), 4, "a later actual answer becomes the final bubble");
});

test("process status counts confirmed results and never treats partial live output as success", () => {
  const call = (id) => ({ role: "assistant", content: [{ type: "toolCall", toolCallId: id, toolName: "bash", input: {} }] });
  const turn = [call("a"), call("b")];
  const partial = { role: "toolResult", toolCallId: "a", content: [{ type: "text", text: "partial" }] };
  const live = getProcessState(turn, new Map([["a", partial]]), new Set(["a"]), true);
  assert.equal(live.status, "running");
  assert.equal(live.completedCount, 0);
  assert.equal(live.pendingCount, 1);
  const stopped = getProcessState(turn, new Map([["a", partial]]), new Set(), false, new Set(["a"]));
  assert.equal(stopped.completedCount, 0, "stopping a run cannot turn retained partial output into successful completion");
  assert.equal(stopped.status, "pending");
  const results = new Map([["a", { ...partial, isError: false }], ["b", { ...partial, toolCallId: "b", isError: true }]]);
  assert.deepEqual(getProcessState(turn, results, new Set(), false), { status: "error", toolCallCount: 2, completedCount: 2, failedCount: 1, pendingCount: 0 });
  assert.equal(getProcessState(turn, new Map(), new Set(), false).status, "pending", "missing results never imply completed success");
});

test("process counts exclude only confirmed recorded chapter controls and preserve genuine failures", () => {
  const turn = [{ role: "assistant", content: [
    { type: "toolCall", toolCallId: "chapter", toolName: "mark_chapter", input: { title: "Verification" } },
    { type: "toolCall", toolCallId: "read", toolName: "read", input: { path: "a.txt" } },
  ] }];
  const result = (toolCallId, isError) => ({ role: "toolResult", toolCallId, content: [], isError });
  const results = new Map([["chapter", result("chapter", false)], ["read", result("read", false)]]);
  assert.deepEqual(getProcessState(turn, results, new Set(), false, new Set(), new Set(["chapter"])), { status: "success", toolCallCount: 1, completedCount: 1, failedCount: 0, pendingCount: 0 });
  results.set("chapter", result("chapter", true));
  assert.deepEqual(getProcessState(turn, results, new Set(), false, new Set(), new Set(["chapter"])), { status: "error", toolCallCount: 2, completedCount: 2, failedCount: 1, pendingCount: 0 });
  assert.equal(getProcessState(turn, new Map(), new Set(), false, new Set(), new Set(["chapter"])).pendingCount, 2);
});

test("process summary recognizes a confirmed apply_patch partial failure", () => {
  const turn = [{ role: "assistant", content: [{ type: "toolCall", toolCallId: "patch", toolName: "apply_patch", input: {} }] }];
  const result = { role: "toolResult", toolCallId: "patch", isError: false, content: [], details: { result: { failures: [{ path: "a.txt", error: "context mismatch" }] } } };
  const state = getProcessState(turn, new Map([["patch", result]]), new Set(), false);
  assert.equal(state.status, "error", "a partial patch failure never receives a successful group checkmark");
  assert.equal(state.failedCount, 1);
  assert.equal(state.completedCount, 1);
});

test("a turn's written-files list keeps its identity until its inputs change", () => {
  const call = { role: "assistant", content: [{ type: "toolCall", toolCallId: "w1", toolName: "write", input: { path: "/p/out.txt", content: "x" } }] };
  const final = { role: "assistant", content: [{ type: "text", text: "ok" }] };
  const results = new Map([["w1", { role: "toolResult", toolCallId: "w1", toolName: "write", content: [], isError: false }]]);
  const files = getTurnWrittenFiles(final, [call, final], results, "/p");
  assert.deepEqual(files.map((file) => file.filePath), ["/p/out.txt"]);
  assert.equal(getTurnWrittenFiles(final, [call, final], results, "/p"), files);
  // A new (but equivalent) tool-results map must not invalidate the list.
  assert.equal(getTurnWrittenFiles(final, [call, final], new Map(results), "/p"), files);
});

test("the transcript loop reads the caches instead of re-deriving per render", () => {
  const loop = source.slice(source.indexOf("const rendered: ReactNode[] = [];"));
  assert.match(loop, /getFinalSplit\(finalAssistant\)/);
  assert.match(loop, /getTurnWrittenFiles\(finalAssistant,/);
  assert.doesNotMatch(loop, /splitFinalAssistantBlocks\(|withAssistantBlocks\(|extractTurnWrittenFiles\(/);
});

test("streaming markdown is throttled and the parsed element memoized", () => {
  assert.match(markdownSource, /const markdown = useStreamingThrottle\(children, Boolean\(isStreaming\)\);/);
  assert.match(markdownSource, /const body = useMemo\(\(\) => \(\s*<ReactMarkdown/);
});
