import { Type } from "@earendil-works/pi-ai";
import { defineTool, type InlineExtension } from "@earendil-works/pi-coding-agent";
import { CHAPTER_CUSTOM_TYPE, CHAPTER_TITLE_MAX_LENGTH, CHAPTER_TOOL_NAME, normalizeChapterTitle, readChapterData } from "./conversation-chapters";

export const CONVERSATION_CHAPTER_EXTENSION_NAME = "pi-web-chapters";
export const CONVERSATION_CHAPTER_GUIDE = "Use mark_chapter to begin a meaningful new phase of work with a short, specific title in the conversation's language. The app displays that title in bold and in conversation navigation. Call it before that phase's work. Multiple chapters may belong to one user request; do not create a chapter for every message or tool call. Plain bold text does not create navigation chapters.";

export function createConversationChapterExtension(): InlineExtension {
  return {
    name: CONVERSATION_CHAPTER_EXTENSION_NAME,
    hidden: true,
    factory: (pi) => {
      pi.registerTool(defineTool({
        name: CHAPTER_TOOL_NAME,
        label: "Mark chapter",
        description: "Create a named chapter at the current point in this conversation. The title appears as a bold transcript heading and a conversation navigation destination.",
        promptSnippet: "Mark a meaningful phase of work with a short conversation chapter title",
        promptGuidelines: [CONVERSATION_CHAPTER_GUIDE],
        exposure: "model-only",
        executionMode: "sequential",
        parameters: Type.Object({ title: Type.String({ minLength: 1, maxLength: CHAPTER_TITLE_MAX_LENGTH, description: "Short, specific, single-line chapter title in the conversation's language. Plain text only." }) }),
        async execute(toolCallId, params, signal, _onUpdate, ctx) {
          const title = normalizeChapterTitle(params.title);
          if (signal?.aborted) throw new Error("Chapter creation canceled");
          if (!toolCallId.trim() || !title) throw new Error("A chapter requires a stable tool call ID and a short single-line title");
          const existing = ctx.sessionManager.getBranch().find((entry) => entry.type === "custom" && entry.customType === CHAPTER_CUSTOM_TYPE && readChapterData(entry.data)?.chapterId === toolCallId);
          if (!existing) pi.appendEntry(CHAPTER_CUSTOM_TYPE, { version: 1, chapterId: toolCallId, title });
          const stored = ctx.sessionManager.getBranch().find((entry) => entry.type === "custom" && entry.customType === CHAPTER_CUSTOM_TYPE && readChapterData(entry.data)?.chapterId === toolCallId);
          if (!stored || stored.type !== "custom") throw new Error("Chapter was not appended to the session");
          const chapter = readChapterData(stored.data)!;
          return { content: [{ type: "text", text: `Chapter created: ${chapter.title}` }], details: undefined };
        },
      }));
    },
  };
}
