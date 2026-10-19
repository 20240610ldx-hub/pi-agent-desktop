import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const { chapterEntryMessage, getConversationChapters, readConversationChapter } = await createJiti(import.meta.url).import("./conversation-chapters.ts");
const chapter = (chapterId, title) => ({ role: "custom", customType: "pi-web:chapter", content: title, display: true, details: { version: 1, chapterId, title } });

test("chapters come only from validated authored records, preserve duplicate titles and deduplicate stable IDs", () => {
  const messages = [
    { role: "user", content: "**User title**" },
    chapter("first-call", "Same title"),
    { role: "assistant", content: [{ type: "text", text: "## Heading\n**Bold title**" }] },
    chapter("second-call", "Same title"),
    chapter("first-call", "Same title"),
    { role: "toolResult", content: [{ type: "text", text: "**Tool output title**" }] },
  ];
  assert.deepEqual(getConversationChapters(messages, ["user", "entry-a", "answer", "entry-b", "duplicate", "result"]).map(({ chapterId, title, entryId, messageIndex }) => ({ chapterId, title, entryId, messageIndex })), [
    { chapterId: "first-call", title: "Same title", entryId: "entry-a", messageIndex: 1 },
    { chapterId: "second-call", title: "Same title", entryId: "entry-b", messageIndex: 3 },
  ]);
});

test("unknown versions, hidden messages, missing IDs, and invalid titles cannot become chapters", () => {
  for (const message of [
    { ...chapter("id", "Title"), customType: "other" },
    { ...chapter("id", "Title"), display: false },
    { ...chapter("id", "Title"), details: { version: 2, chapterId: "id", title: "Title" } },
    chapter("", "Title"), chapter("id", ""), chapter("id", "two\nlines"), chapter("id", "x".repeat(121)),
  ]) assert.equal(readConversationChapter(message), null);
  assert.equal(chapterEntryMessage({ type: "custom", customType: "other", data: { version: 1, chapterId: "id", title: "Title" } }), null);
});
