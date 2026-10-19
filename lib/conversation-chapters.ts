import type { AgentMessage, AssistantContentBlock, CustomMessage } from "./types";

export const CHAPTER_TOOL_NAME = "mark_chapter";
export const CHAPTER_CUSTOM_TYPE = "pi-web:chapter";
export const CHAPTER_TITLE_MAX_LENGTH = 120;

export interface ConversationChapter {
  version: 1;
  chapterId: string;
  title: string;
}

export interface ConversationChapterLocation extends ConversationChapter {
  index: number;
  messageIndex: number;
  entryId?: string;
}

export function normalizeChapterTitle(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const title = value.trim();
  return title.length > 0 && title.length <= CHAPTER_TITLE_MAX_LENGTH && !/[\r\n\u0000-\u001f]/u.test(title) ? title : null;
}

export function readChapterData(value: unknown): ConversationChapter | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const title = normalizeChapterTitle(data.title);
  if (data.version !== 1 || typeof data.chapterId !== "string" || !data.chapterId.trim() || !title) return null;
  return { version: 1, chapterId: data.chapterId, title };
}

export function readConversationChapter(message: AgentMessage): ConversationChapter | null {
  return message.role === "custom" && message.customType === CHAPTER_CUSTOM_TYPE && message.display
    ? readChapterData(message.details) : null;
}

export function chapterEntryMessage(entry: { type?: string; customType?: string; data?: unknown; timestamp?: string }): CustomMessage | null {
  if (entry.type !== "custom" || entry.customType !== CHAPTER_CUSTOM_TYPE) return null;
  const chapter = readChapterData(entry.data);
  if (!chapter) return null;
  const timestamp = entry.timestamp ? Date.parse(entry.timestamp) : NaN;
  return { role: "custom", customType: CHAPTER_CUSTOM_TYPE, content: chapter.title, display: true, details: chapter,
    ...(Number.isFinite(timestamp) ? { timestamp } : {}),
  };
}

export function getConversationChapters(messages: readonly AgentMessage[], entryIds: readonly string[] = []): ConversationChapterLocation[] {
  const seen = new Set<string>();
  const chapters: ConversationChapterLocation[] = [];
  messages.forEach((message, messageIndex) => {
    const chapter = readConversationChapter(message);
    if (!chapter || seen.has(chapter.chapterId)) return;
    seen.add(chapter.chapterId);
    chapters.push({ ...chapter, index: chapters.length, messageIndex, ...(entryIds[messageIndex] ? { entryId: entryIds[messageIndex] } : {}) });
  });
  return chapters;
}

export function isRecordedChapterToolCall(block: AssistantContentBlock, chapterIds: ReadonlySet<string>): boolean {
  return block.type === "toolCall" && block.toolName === CHAPTER_TOOL_NAME && chapterIds.has(block.toolCallId);
}
