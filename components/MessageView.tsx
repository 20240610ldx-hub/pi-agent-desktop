"use client";

import { memo, useState, useRef, useEffect, useLayoutEffect, useMemo, useId } from "react";
import ReactMarkdown from "react-markdown";
import { MarkdownBody } from "./MarkdownBody";
import { ImagePreview } from "./ImagePreview";
import { ThinkingDisclosure } from "./ThinkingDisclosure";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/hooks/useI18n";
import { useTranscriptExpansion } from "@/hooks/useTranscriptExpansion";
import { useMeasuredOverflow } from "@/hooks/useMeasuredOverflow";
import { parseCompactionSummary } from "@/lib/compaction-summary";
import { getAssistantErrorMessage, getThinkingPreview, hasAssistantAnswer, isAssistantTruncated, isDisplayableAssistantBlock } from "@/lib/message-display";
import { readConversationChapter } from "@/lib/conversation-chapters";
import { isThinkingExpandedByDefault, THINKING_EXPANDED_EVENT } from "@/lib/thinking-expansion-preference";
import { TurnWrittenFiles } from "./TurnWrittenFiles";
import type { WrittenFile } from "@/lib/turn-written-files";
import { skillExpansionToCommand } from "@/lib/slash-display";
import { splitAttachedFiles } from "@/lib/chat-attachments";
import { AttachedFileList } from "./AttachedFileList";
import type {
  AgentMessage,
  UserMessage,
  AssistantMessage,
  CustomMessage,
  ToolResultMessage,
  BashExecutionMessage,
  AssistantContentBlock,
  TextContent,
  ImageContent,
  ToolCallContent,
  ThinkingContent,
} from "@/lib/types";
import { imageSource } from "@/lib/result-image";
import { BashExecutionView, ToolCallBlock } from "./ToolStepView";
export { getToolCallInputText } from "./ToolStepView";

// CJK chars ~1 token each (GLM/DeepSeek/GPT-o200k); other chars ~4 chars/token.
const CJK_PATTERN = /[\u3000-\u30ff\u3400-\u9fff\uf900-\ufaff\u{20000}-\u{2fa1f}\uac00-\ud7af]/u;
function estimateTokens(text: string): number {
  let cjk = 0;
  let rest = 0;
  for (const ch of text) {
    if (CJK_PATTERN.test(ch)) cjk++;
    else rest++;
  }
  return cjk + rest / 4;
}

interface TokenEstimateCacheEntry {
  text: string;
  tokens: number;
}

export function getTokenEstimateText(block: AssistantContentBlock): string | null {
  if (block.type === "text") return block.text;
  if (block.type === "thinking") return block.thinking;
  if (block.type === "toolCall") return block.rawInput ?? JSON.stringify(block.input ?? {}) ?? "";
  return null;
}

function isHighSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xd800 && codeUnit <= 0xdbff;
}

function isLowSurrogate(codeUnit: number): boolean {
  return codeUnit >= 0xdc00 && codeUnit <= 0xdfff;
}

function estimateUpdatedTokens(previous: TokenEstimateCacheEntry | undefined, text: string): number {
  if (!previous || !text.startsWith(previous.text)) return estimateTokens(text);

  let baseTokens = previous.tokens;
  let suffixStart = previous.text.length;
  // A streamed delta can complete a surrogate pair that was counted as two
  // non-CJK code points in the previous update.
  if (
    suffixStart > 0
    && suffixStart < text.length
    && isHighSurrogate(previous.text.charCodeAt(suffixStart - 1))
    && isLowSurrogate(text.charCodeAt(suffixStart))
  ) {
    baseTokens -= 1 / 4;
    suffixStart--;
  }
  return baseTokens + estimateTokens(text.slice(suffixStart));
}

const MAX_THINKING_CACHE_ENTRIES = 100;
const thinkingContentCache = new Map<string, Promise<string>>();

// Messages larger than this skip markdown rendering entirely. react-markdown +
// KaTeX + syntax highlighting on multi-hundred-KB payloads (e.g. pasted HAR or
// log dumps) freezes the browser main thread.
const MAX_MARKDOWN_CHARS = 100_000;

function formatMessageBytes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} MB`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} KB`;
  return `${n} B`;
}

/**
 * MarkdownBody with an oversized-content guard: huge messages render as a
 * click-to-reveal plain-text <pre> instead of running the markdown pipeline.
 */
function SafeMarkdownBody({ children, className, ...props }: React.ComponentProps<typeof MarkdownBody>) {
  const { t } = useI18n();
  const [showRaw, setShowRaw] = useState(false);

  if (children.length <= MAX_MARKDOWN_CHARS) {
    return <MarkdownBody className={className} {...props}>{children}</MarkdownBody>;
  }
  if (!showRaw) {
    return (
      <button
        onClick={() => setShowRaw(true)}
        style={{
          display: "block",
          width: "100%",
          margin: "4px 0",
          padding: "7px 10px",
          border: "var(--hairline) solid var(--border)",
          borderRadius: 6,
          background: "var(--bg-panel)",
          color: "var(--text-muted)",
          cursor: "pointer",
          fontSize: 12,
          textAlign: "left",
        }}
      >
        ⚠ {t("i18n.largeMessageReveal", { size: formatMessageBytes(children.length) })}
      </button>
    );
  }
  return (
    <div className={className} style={{ maxHeight: 420, overflow: "auto", fontSize: "calc(12px + var(--chat-font-size-offset, 0px))", lineHeight: 1.5 }}>
      <pre
        style={{
          margin: 0,
          padding: "8px 10px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "var(--font-mono)",
          color: "var(--text-muted)",
        }}
      >
        {children}
      </pre>
    </div>
  );
}

// Cap the user "sent" bubble's height so an abnormally long message does not
// push the conversation off screen; overflow scrolls inside the bubble.
const USER_BUBBLE_MAX_HEIGHT = 300;

function loadThinkingContent(sessionId: string, entryId: string, blockIndex: number): Promise<string> {
  const key = `${sessionId}:${entryId}:${blockIndex}`;
  const cached = thinkingContentCache.get(key);
  if (cached) {
    thinkingContentCache.delete(key);
    thinkingContentCache.set(key, cached);
    return cached;
  }

  const request = fetch(
    `/api/sessions/${encodeURIComponent(sessionId)}/entries/${encodeURIComponent(entryId)}/thinking?blockIndex=${blockIndex}`,
  ).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as { thinking?: unknown };
    if (typeof data.thinking !== "string") throw new Error("Invalid thinking response");
    return data.thinking;
  }).catch((error) => {
    thinkingContentCache.delete(key);
    throw error;
  });

  thinkingContentCache.set(key, request);
  if (thinkingContentCache.size > MAX_THINKING_CACHE_ENTRIES) {
    const oldestKey = thinkingContentCache.keys().next().value;
    if (oldestKey) thinkingContentCache.delete(oldestKey);
  }
  return request;
}

interface Props {
  message: AgentMessage;
  isStreaming?: boolean;
  liveTurn?: boolean;
  activeThinkingIndex?: number | null;
  activeTextIndex?: number | null;
  partialToolCallIds?: ReadonlySet<string>;
  runningToolCallIds?: ReadonlySet<string>;
  activeToolCallId?: string | null;
  toolResults?: Map<string, ToolResultMessage>;
  chapterIds?: ReadonlySet<string>;
  modelNames?: Record<string, string>;
  cwd?: string;
  onOpenFile?: (filePath: string, page?: number) => void;
  onOpenSession?: (sessionId: string) => void;
  onOpenModelsConfig?: () => void;
  entryId?: string;
  searchBlock?: AssistantContentBlock;
  onFork?: (entryId: string, position?: "after") => void;
  forking?: boolean;
  onEditContent?: (message: UserMessage, entryId: string) => void;
  /** Shared with MessageView so the disabled reason can travel with the button. */
  editDisabled?: boolean;
  onCancelEdit?: () => void;
  isEditing?: boolean;
  showTimestamp?: boolean;
  prevTimestamp?: number;
  sessionId?: string;
  /**
   * Files this turn wrote, derived by the caller from the whole turn's
   * successful write/edit tool calls. ChatWindow computes this because the
   * saved-message path splits tool calls into their own entries, leaving the
   * final answer text-only.
   */
  writtenFiles?: WrittenFile[];
  onCompact?: () => void;
  isCompacting?: boolean;
  compactError?: string | null;
}

export function getModelDisplayName(
  provider: string,
  responseModel: string,
  modelNames?: Record<string, string>,
): string {
  const normalizedProvider = provider.toLowerCase();
  const normalizedResponse = responseModel.toLowerCase();
  const configured = Object.entries(modelNames ?? {}).flatMap(([key, name]) => {
    const separator = key.indexOf(":");
    return separator > 0 && key.slice(0, separator).toLowerCase() === normalizedProvider
      ? [{ id: key.slice(separator + 1).toLowerCase(), name }]
      : [];
  });
  return configured.find((model) => model.id === normalizedResponse)?.name
    ?? configured.find((model) => normalizedResponse.endsWith(`/${model.id}`))?.name
    ?? Object.entries(modelNames ?? {}).find(([key]) => key.toLowerCase() === normalizedResponse)?.[1]
    ?? `${provider}/${responseModel}`;
}

function formatTime(ts?: number): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  const now = new Date();
  const isToday = d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (isToday) return time;
  const date = d.toLocaleDateString([], { month: "short", day: "numeric", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
  return `${date} ${time}`;
}

export function formatRelativeMessageTime(timestamp: number, locale: string, now = Date.now()): string | null {
  if (!Number.isFinite(timestamp) || !Number.isFinite(new Date(timestamp).getTime())) return null;
  const elapsed = Math.max(0, Math.floor((now - timestamp) / 1000));
  const [divisor, unit] = elapsed >= 86400 ? [86400, "day"] as const
    : elapsed >= 3600 ? [3600, "hour"] as const
    : elapsed >= 60 ? [60, "minute"] as const : [1, "second"] as const;
  return new Intl.RelativeTimeFormat(locale, { numeric: "auto" }).format(-Math.floor(elapsed / divisor), unit);
}

function ResponseTime({ timestamp }: { timestamp: number }) {
  const { locale } = useI18n();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);
  const label = formatRelativeMessageTime(timestamp, locale, now);
  return label ? <time className="message-response-time" dateTime={new Date(timestamp).toISOString()} title={formatTime(timestamp) ?? undefined}>{label}</time> : null;
}

export function replaceUserMessageText(message: UserMessage, text: string): UserMessage {
  if (typeof message.content === "string") return { ...message, content: text };

  const content: Array<TextContent | ImageContent> = [];
  let replaced = false;
  for (const block of message.content) {
    if (block.type !== "text") {
      content.push(block);
      continue;
    }
    if (!replaced) {
      content.push({ ...block, text });
      replaced = true;
    }
  }
  if (!replaced) content.unshift({ type: "text", text });
  return { ...message, content };
}

function haveSameRelevantToolResults(
  message: AgentMessage,
  previous: Map<string, ToolResultMessage> | undefined,
  next: Map<string, ToolResultMessage> | undefined,
): boolean {
  if (previous === next || message.role !== "assistant") return true;
  for (const block of (message as AssistantMessage).content ?? []) {
    if (block.type === "toolCall" && previous?.get(block.toolCallId) !== next?.get(block.toolCallId)) {
      return false;
    }
  }
  return true;
}

function haveSameRelevantRunningTools(message: AgentMessage, previous?: ReadonlySet<string>, next?: ReadonlySet<string>): boolean {
  if (previous === next || message.role !== "assistant") return true;
  return (message as AssistantMessage).content.every(block => block.type !== "toolCall"
    || Boolean(previous?.has(block.toolCallId)) === Boolean(next?.has(block.toolCallId)));
}

export const MessageView = memo(function MessageView({ message, isStreaming, liveTurn, activeThinkingIndex, activeTextIndex, partialToolCallIds, runningToolCallIds, activeToolCallId, toolResults, chapterIds, modelNames, cwd, onOpenFile, onOpenSession, onOpenModelsConfig, entryId, searchBlock, onFork, forking, onEditContent, editDisabled, onCancelEdit, isEditing, showTimestamp, prevTimestamp, sessionId, writtenFiles, onCompact, isCompacting, compactError }: Props) {
  if (message.role === "user") {
    return <UserMessageView message={message as UserMessage} cwd={cwd} onOpenFile={onOpenFile} entryId={entryId} onFork={onFork} forking={forking} onEditContent={onEditContent} editDisabled={editDisabled} onCancelEdit={onCancelEdit} isEditing={isEditing} />;
  }
  if (message.role === "assistant") {
    return <AssistantMessageView message={message as AssistantMessage} isStreaming={isStreaming} liveTurn={liveTurn} activeThinkingIndex={activeThinkingIndex} activeTextIndex={activeTextIndex} partialToolCallIds={partialToolCallIds} runningToolCallIds={runningToolCallIds} activeToolCallId={activeToolCallId} toolResults={toolResults} chapterIds={chapterIds} modelNames={modelNames} cwd={cwd} onOpenFile={onOpenFile} onOpenSession={onOpenSession} onOpenModelsConfig={onOpenModelsConfig} showTimestamp={showTimestamp} prevTimestamp={prevTimestamp} sessionId={sessionId} entryId={entryId} onFork={onFork} forking={forking} searchBlock={searchBlock} writtenFiles={writtenFiles} onCompact={onCompact} isCompacting={isCompacting} compactError={compactError} />;
  }
  if (message.role === "toolResult") {
    // Rendered inline under its toolCall — skip standalone rendering if paired
    return null;
  }
  if (message.role === "custom") {
    const chapter = readConversationChapter(message);
    if (chapter) return <div data-conversation-chapter={chapter.chapterId} className="conversation-chapter"><strong>{chapter.title}</strong></div>;
    if ((message as CustomMessage).customType === "compaction") {
      return <CompactionMessageView message={message as CustomMessage} />;
    }
    if ((message as CustomMessage).customType === "branch_summary") {
      return <CompactionMessageView message={message as CustomMessage} kind="branch_summary" />;
    }
    return <CustomMessageView message={message as CustomMessage} cwd={cwd} onOpenFile={onOpenFile} />;
  }
  if (message.role === "bashExecution") {
    return <BashExecutionView message={message as BashExecutionMessage} sessionId={sessionId} />;
  }
  return null;
}, (prev, next) => {
  return prev.message === next.message
    && prev.isStreaming === next.isStreaming
    && prev.liveTurn === next.liveTurn
    && prev.activeThinkingIndex === next.activeThinkingIndex
    && prev.activeTextIndex === next.activeTextIndex
    && haveSameRelevantRunningTools(prev.message, prev.partialToolCallIds, next.partialToolCallIds)
    && prev.activeToolCallId === next.activeToolCallId
    && haveSameRelevantRunningTools(prev.message, prev.runningToolCallIds, next.runningToolCallIds)
    && haveSameRelevantToolResults(prev.message, prev.toolResults, next.toolResults)
    && haveSameRelevantRunningTools(prev.message, prev.chapterIds, next.chapterIds)
    && prev.modelNames === next.modelNames
    && prev.cwd === next.cwd
    && prev.onOpenFile === next.onOpenFile
    && prev.onOpenSession === next.onOpenSession
    && prev.onOpenModelsConfig === next.onOpenModelsConfig
    && prev.entryId === next.entryId
    && prev.searchBlock === next.searchBlock
    && prev.onFork === next.onFork
    && prev.forking === next.forking
    && prev.onEditContent === next.onEditContent
    && prev.editDisabled === next.editDisabled
    && prev.onCancelEdit === next.onCancelEdit
    && prev.isEditing === next.isEditing
    && prev.showTimestamp === next.showTimestamp
    && prev.prevTimestamp === next.prevTimestamp
    && prev.writtenFiles === next.writtenFiles
    && prev.sessionId === next.sessionId
    && prev.onCompact === next.onCompact
    && prev.isCompacting === next.isCompacting
    && prev.compactError === next.compactError;
});

function UserMessageView({ message, cwd, onOpenFile, entryId, onFork, forking, onEditContent, editDisabled, onCancelEdit, isEditing }: {
  message: UserMessage;
  cwd?: string;
  onOpenFile?: (filePath: string, page?: number) => void;
  entryId?: string;
  onFork?: (entryId: string, position?: "after") => void;
  forking?: boolean;
  onEditContent?: (message: UserMessage, entryId: string) => void;
  editDisabled?: boolean;
  onCancelEdit?: () => void;
  isEditing?: boolean;
}) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Session files can hold `\r\n` or lone `\r` line endings (#680). Chrome renders
  // a lone `\r` as a space even in the pre-wrap command-args and raw-text views.
  // Copy uses this text too; the session file keeps the original endings.
  const content = (
    typeof message.content === "string"
      ? message.content
      : message.content
          .filter((b): b is TextContent => b.type === "text")
          .map((b) => b.text)
          .join("\n")
  ).replace(/\r\n?/g, "\n");

  const imageBlocks: ImageContent[] =
    typeof message.content === "string"
      ? []
      : message.content.filter((b): b is ImageContent => b.type === "image");

  // Files attached in a chat travel inside the text; show them as chips, not a wall of text.
  const { text: bodyText, files: attachedFiles } = splitAttachedFiles(content);

  const commandText = skillExpansionToCommand(content);
  const commandSeparator = commandText?.search(/\s/) ?? -1;
  const commandName = commandText
    ? commandSeparator === -1 ? commandText : commandText.slice(0, commandSeparator)
    : "";
  const commandArgs = commandText && commandSeparator !== -1
    ? commandText.slice(commandSeparator + 1)
    : "";

  const time = formatTime(message.timestamp);
  const canFork = !!entryId && !!onFork;
  const copyTarget = commandText ?? content;
  const editTarget = commandText ? replaceUserMessageText(message, commandText) : message;

  const imageBlocksNode = imageBlocks.length > 0 && (
    <div className="message-user-images">
      {imageBlocks.map((img, i) => {
        const src = imageSource(img);
        return (
          <ImagePreview key={i} src={src} className="message-user-image-preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="message-user-image" src={src} alt="" />
          </ImagePreview>
        );
      })}
    </div>
  );
  const canEdit = !!entryId && !!onEditContent;
  const editBlocked = canEdit && editDisabled;
  const editTitle = editBlocked
    ? t("i18n.editFromHereBusyTitle")
    : t("i18n.editFromHereTitle");
  const canCancelEdit = !!isEditing && !!onCancelEdit;

  const copyContent = () => {
    copyText(copyTarget).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      className="message-user"
      style={{ marginBottom: 16, display: "flex", flexDirection: "column", alignItems: "flex-end" }}
    >
      <div
        className={imageBlocks.length ? "message-user-content has-images" : "message-user-content"}
        style={{ display: "flex", flexDirection: imageBlocks.length ? "column" : undefined, alignItems: "flex-end", gap: 6, maxWidth: imageBlocks.length ? undefined : "min(78%, 660px)" }}
      >
        {imageBlocksNode}
        {content && <div
          className={`message-user-bubble${isEditing ? " is-editing" : ""}`}
          style={{
            flex: 1,
            minWidth: 0,
            maxHeight: USER_BUBBLE_MAX_HEIGHT,
            overflowY: "auto",
          }}
        >
          {commandText ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => setExpanded((prev) => !prev)}
                  title={expanded ? t("i18n.collapse") : t("i18n.expand")}
                  aria-expanded={expanded}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    flexShrink: 0,
                    padding: 0,
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--accent)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "calc(13px + var(--chat-font-size-offset, 0px))",
                    textAlign: "left",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {commandName}
                  </span>
                  <svg
                    width="11"
                    height="11"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0, opacity: 0.75, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}
                    aria-hidden="true"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {commandArgs && (
                  <span style={{
                    color: "var(--text)",
                    fontSize: "calc(14px + var(--chat-font-size-offset, 0px))",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    minWidth: 0,
                    flex: 1,
                  }}>
                    {commandArgs}
                  </span>
                )}
              </div>
              {expanded && (
                <MarkdownBody className="markdown-user-message" keepLineBreaks cwd={cwd} onOpenFile={onOpenFile}>{content}</MarkdownBody>
              )}
            </div>
          ) : (
            <>
              {attachedFiles.length > 0 && <AttachedFileList files={attachedFiles} />}
              {bodyText && <CollapsibleUserText text={bodyText} cwd={cwd} onOpenFile={onOpenFile} />}
            </>
          )}
        </div>}
      </div>

      {/* Bottom row: action buttons + timestamp */}
      {(time || canFork || canEdit || true) && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "flex-end",
          gap: 6, marginTop: 3,
        }}>
          <div className="message-copy-actions">
            <button
              onClick={copyContent}
               title={t("i18n.copyMessage")}
              aria-live="polite"
              style={{
                display: "flex", alignItems: "center", gap: 4,
                padding: "3px 8px", height: 22,
                background: "none", border: "none",
                borderRadius: 5,
                color: copied ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                fontSize: 11, fontWeight: 400,
                whiteSpace: "nowrap",
                transition: "color 0.12s",
              }}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = "var(--accent)"; }}
              onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = "var(--text-dim)"; }}
            >
              {copied ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
               {copied ? t("i18n.copied") : t("i18n.copy")}
            </button>
          </div>
          {(canFork || canEdit || canCancelEdit) && (
            <div
              className="user-msg-actions"
              style={{ opacity: forking || canCancelEdit ? 1 : undefined }}
            >
              {canEdit && !canCancelEdit && (
                <button
                  onClick={() => onEditContent!(editTarget, entryId!)}
                  disabled={editBlocked}
                  aria-disabled={editBlocked || undefined}
                  title={editTitle}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", height: 22,
                    background: "none", border: "none",
                    borderRadius: 5,
                    color: "var(--text-dim)",
                    cursor: editBlocked ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 400,
                    whiteSpace: "nowrap",
                    transition: "color 0.12s",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 10 20 15 15 20" />
                    <path d="M4 4v7a4 4 0 0 0 4 4h12" />
                  </svg>
                   {t("i18n.editFromHere")}
                </button>
              )}
              {canCancelEdit && (
                <button
                  type="button"
                  onClick={onCancelEdit}
                  title={t("i18n.cancel")}
                  aria-label={t("i18n.cancel")}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", height: 22,
                    background: "none", border: "none",
                    borderRadius: 5,
                    color: "var(--accent)",
                    cursor: "pointer",
                    fontSize: 11, fontWeight: 500,
                    whiteSpace: "nowrap",
                  }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                  {t("i18n.cancel")}
                </button>
              )}
              {canFork && (
                <button
                  onClick={() => { onFork!(entryId!); }}
                  disabled={forking}
                   title={forking ? t("i18n.creatingSession") : t("i18n.newSessionTitle")}
                  style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", height: 22,
                    background: "none", border: "none",
                    borderRadius: 5,
                    color: forking ? "var(--accent)" : "var(--text-dim)",
                    cursor: forking ? "not-allowed" : "pointer",
                    fontSize: 11, fontWeight: 400,
                    whiteSpace: "nowrap",
                    transition: "color 0.12s",
                  }}
                  onMouseEnter={(e) => { if (!forking) e.currentTarget.style.color = "var(--accent)"; }}
                  onMouseLeave={(e) => { if (!forking) e.currentTarget.style.color = "var(--text-dim)"; }}
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                   {forking ? t("i18n.creating") : t("i18n.newSession")}
                </button>
              )}
            </div>
          )}
          {time && <span className="message-meta" style={{ fontSize: 10, color: "var(--text-dim)" }}>{time}</span>}
        </div>
      )}
    </div>
  );
}

function AssistantMessageView({
  message,
  isStreaming,
  liveTurn,
  activeThinkingIndex,
  activeTextIndex,
  partialToolCallIds,
  runningToolCallIds,
  activeToolCallId,
  toolResults,
  chapterIds,
  modelNames,
  cwd,
  onOpenFile,
  onOpenSession,
  onOpenModelsConfig,
  showTimestamp,
  prevTimestamp,
  sessionId,
  entryId,
  onFork,
  forking,
  searchBlock,
  writtenFiles,
  onCompact,
  isCompacting,
  compactError,
}: {
  message: AssistantMessage;
  isStreaming?: boolean;
  liveTurn?: boolean;
  activeThinkingIndex?: number | null;
  activeTextIndex?: number | null;
  partialToolCallIds?: ReadonlySet<string>;
  runningToolCallIds?: ReadonlySet<string>;
  activeToolCallId?: string | null;
  toolResults?: Map<string, ToolResultMessage>;
  chapterIds?: ReadonlySet<string>;
  modelNames?: Record<string, string>;
  cwd?: string;
  onOpenFile?: (filePath: string, page?: number) => void;
  onOpenSession?: (sessionId: string) => void;
  onOpenModelsConfig?: () => void;
  showTimestamp?: boolean;
  prevTimestamp?: number;
  sessionId?: string;
  entryId?: string;
  onFork?: (entryId: string, position?: "after") => void;
  forking?: boolean;
  searchBlock?: AssistantContentBlock;
  writtenFiles?: WrittenFile[];
  onCompact?: () => void;
  isCompacting?: boolean;
  compactError?: string | null;
}) {
  const { t } = useI18n();
  const time = showTimestamp ? formatTime(message.timestamp) : null;
  const blockItems = useMemo(() => (message.content ?? [])
    .map((block, originalIndex) => ({ block, originalIndex }))
    .filter(({ block }) => isDisplayableAssistantBlock(block, { isStreaming, chapterIds, toolResults, runningToolCallIds, partialToolCallIds })), [message.content, isStreaming, chapterIds, toolResults, runningToolCallIds, partialToolCallIds]);
  const blocks = useMemo(() => blockItems.map(({ block }) => block), [blockItems]);
  const lastTextIndex = blockItems.findLast(item => item.block.type === "text")?.originalIndex;
  const providerError = getAssistantErrorMessage(message, { isStreaming });
  const truncated = isAssistantTruncated(message, { isStreaming });
  const unansweredTruncation = truncated && !hasAssistantAnswer(message);
  const [copyState, setCopyState] = useState<"idle" | "pending" | "copied" | "failed">("idle");
  const copyRequest = useRef<{ attempt: number; pending: boolean; timer: ReturnType<typeof setTimeout> | null }>({ attempt: 0, pending: false, timer: null });
  const copied = copyState === "copied";
  const copyFeedback = copyState === "failed" ? t("pilaude.codeCopyFailed")
    : copied ? t("i18n.copied") : copyState === "pending" ? t("i18n.loading") : "";
  const streamStartRef = useRef<number | null>(null);
  const [tps, setTps] = useState<number | null>(null);
  const blockItemsRef = useRef(blockItems);
  blockItemsRef.current = blockItems;
  const tokenEstimateCacheRef = useRef<Map<number, TokenEstimateCacheEntry>>(new Map());
  const estimatedTokens = useMemo(() => {
    if (!isStreaming) {
      tokenEstimateCacheRef.current = new Map();
      return 0;
    }
    const nextCache = new Map<number, TokenEstimateCacheEntry>();
    let total = 0;
    for (const { block, originalIndex } of blockItems) {
      const text = getTokenEstimateText(block);
      if (text === null) continue;
      const tokens = estimateUpdatedTokens(tokenEstimateCacheRef.current.get(originalIndex), text);
      nextCache.set(originalIndex, { text, tokens });
      total += tokens;
    }
    tokenEstimateCacheRef.current = nextCache;
    return total;
  }, [blockItems, isStreaming]);
  const estimatedTokensRef = useRef(estimatedTokens);
  estimatedTokensRef.current = estimatedTokens;

  // Streaming-based timing for thinking blocks
  const blockStartTimesRef = useRef<Map<number, number>>(new Map());
  const [streamingDurations, setStreamingDurations] = useState<Map<number, number>>(new Map());

  // Thinking duration derived from file timestamps: time from prev message end to this message end
  // This is the total generation time (thinking + any text before first tool call)
  const thinkingDurationFromFile = useMemo<number | undefined>(() => {
    if (!message.timestamp || !prevTimestamp) return undefined;
    const secs = Math.round((message.timestamp - prevTimestamp) / 1000);
    return secs > 0 ? secs : undefined;
  }, [message.timestamp, prevTimestamp]);

  // Tool call durations derived from session file timestamps (accurate for completed messages)
  // assistant message timestamp = when generation ended = when tools started running
  // toolResult timestamp = when tool execution finished
  const toolCallDurations = useMemo<Map<string, number>>(() => {
    const map = new Map<string, number>();
    if (!toolResults || !message.timestamp) return map;
    for (const [callId, result] of toolResults) {
      if (result.timestamp && message.timestamp) {
        const secs = Math.round((result.timestamp - message.timestamp) / 1000);
        if (secs > 0) map.set(callId, secs);
      }
    }
    return map;
  }, [toolResults, message.timestamp]);

  const textContent = blocks
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  useLayoutEffect(() => {
    const request = copyRequest.current;
    setCopyState("idle");
    request.pending = false;
    return () => {
      request.attempt++;
      if (request.timer !== null) clearTimeout(request.timer);
      request.timer = null;
    };
  }, [textContent, entryId]);

  const copyContent = async (event: React.MouseEvent<HTMLButtonElement>) => {
    const request = copyRequest.current;
    if (request.pending) return;
    request.pending = true;
    const button = event.currentTarget;
    const hadFocus = document.activeElement === button;
    const current = ++request.attempt;
    if (request.timer !== null) clearTimeout(request.timer);
    request.timer = null;
    setCopyState("pending");
    try {
      await copyText(textContent);
      if (current !== request.attempt) return;
      setCopyState("copied");
      request.timer = setTimeout(() => {
        request.timer = null;
        setCopyState("idle");
      }, 1500);
    } catch {
      if (current === request.attempt) {
        setCopyState("failed");
        request.timer = setTimeout(() => {
          request.timer = null;
          setCopyState("idle");
        }, 4000);
      }
    } finally {
      if (current === request.attempt) {
        request.pending = false;
        // The clipboard fallback selects a temporary textarea. Restore only
        // focus it lost, without scrolling or taking focus from another field.
        if (hadFocus && button.isConnected && document.activeElement === document.body) {
          button.focus({ preventScroll: true });
        }
      }
    }
  };

  useEffect(() => {
    if (!isStreaming) {
      // Finalise any un-finished thinking block durations on stream end
      const now = new Date().getTime();
      setStreamingDurations((prev: Map<number, number>) => {
        const next = new Map(prev);
        for (const [idx, start] of blockStartTimesRef.current) {
          if (!next.has(idx)) next.set(idx, Math.round((now - start) / 1000));
        }
        return next;
      });
      streamStartRef.current = null;
      setTps(null);
      return;
    }
    const tick = () => {
      const items = blockItemsRef.current;
      const now = Date.now();

      // Record start time for each block the first time we see it
      items.forEach(({ originalIndex }) => {
        if (!blockStartTimesRef.current.has(originalIndex)) blockStartTimesRef.current.set(originalIndex, now);
      });

      // When a non-last block has a successor already started, finalise its duration
      setStreamingDurations((prev: Map<number, number>) => {
        let changed = false;
        const next = new Map(prev);
        for (let i = 0; i < items.length - 1; i++) {
          const originalIndex = items[i].originalIndex;
          const nextOriginalIndex = items[i + 1].originalIndex;
          if (!next.has(originalIndex) && blockStartTimesRef.current.has(originalIndex)) {
            const start = blockStartTimesRef.current.get(originalIndex)!;
            const nextStart = blockStartTimesRef.current.get(nextOriginalIndex) ?? now;
            next.set(originalIndex, Math.round((nextStart - start) / 1000));
            changed = true;
          }
        }
        return changed ? next : prev;
      });

      const tokens = estimatedTokensRef.current;
      if (tokens === 0) return;
      if (streamStartRef.current === null) streamStartRef.current = now;
      const elapsed = (now - streamStartRef.current) / 1000;
      if (elapsed > 0.5) setTps(tokens / elapsed);
    };
    const id = setInterval(tick, 300);
    return () => clearInterval(id);
  }, [isStreaming]);

  if (blocks.length === 0 && !isStreaming && !providerError && !truncated) return null;

  return (
    <div
      className="message-assistant"
      data-message-role="assistant"
      data-entry-id={entryId}
      style={{ marginBottom: 16 }}
    >
      {/* Model label */}
      <div
        className="message-assistant-model"
        style={{
          fontSize: 11,
          color: "var(--text-dim)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        {message.provider && (
          <span>{getModelDisplayName(message.provider, message.model, modelNames)}</span>
        )}
        {isStreaming && (() => {
          const est = Math.round(estimatedTokens);
          return (
            <>

              {est > 0 && (
                <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text)" }} title={t("i18n.estimatedTokens")}>
                  <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 11, fontWeight: 400 }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="5" y1="1.5" x2="5" y2="8.5" /><polyline points="2 6 5 8.5 8 6" />
                    </svg>
                    {est}
                  </span>
                  {tps !== null && (() => {
                    const bg = tps >= 50 ? "#53b3cb" : tps >= 30 ? "#9bc53d" : tps >= 15 ? "#f9c22e" : "#e01a4f";
                    return (
                      <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 4, background: bg, color: "#fff", fontSize: 11, fontWeight: 400 }}>
                        {tps.toFixed(1)} t/s
                      </span>
                    );
                  })()}
                </span>
              )}
            </>
          );
        })()}
      </div>

      <div className="message-assistant-content" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {blockItems.map(({ block, originalIndex }) => (
          <BlockView key={`${entryId ?? "stream"}-${originalIndex}`} block={block} searchTarget={block === searchBlock} toolResults={toolResults} isStreaming={isStreaming} liveTurn={liveTurn} activeThinking={Boolean(isStreaming && originalIndex === activeThinkingIndex)} activeText={Boolean(isStreaming && originalIndex === activeTextIndex && originalIndex === lastTextIndex && activeThinkingIndex == null && activeToolCallId == null)} partialToolCallIds={partialToolCallIds} runningToolCallIds={runningToolCallIds} activeToolCallId={activeToolCallId} streamingDuration={streamingDurations.get(originalIndex) ?? (block.type === "thinking" ? thinkingDurationFromFile : undefined)} toolCallDurations={toolCallDurations} cwd={cwd} onOpenFile={onOpenFile} onOpenSession={onOpenSession} sessionId={sessionId} entryId={entryId} blockIndex={originalIndex} />
        ))}
      </div>

      {providerError && (
        <div className="pilaude-provider-error" role="alert">
          <div className="pilaude-provider-error-heading"><span aria-hidden="true">◉</span>{t("pilaude.requestFailed")}</div>
          <div className="pilaude-provider-error-body">{providerError}</div>
          {onOpenModelsConfig && <div className="pilaude-provider-error-actions"><button type="button" className="native-button" onClick={onOpenModelsConfig}>{t("pilaude.modelSettings")}</button></div>}
        </div>
      )}

      {truncated && (
        <div
          role="alert"
          style={{
            marginTop: blocks.length > 0 || providerError ? 8 : 0,
            padding: "7px 10px",
            border: "var(--hairline) solid rgba(234,179,8,0.3)",
            borderRadius: 6,
            background: "rgba(234,179,8,0.07)",
            color: "#ca8a04",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
          }}
        >
          {t(unansweredTruncation ? "chat.truncatedWithoutAnswer" : "chat.truncatedByOutputLimit")}
          {unansweredTruncation && onCompact && (
            <button
              type="button"
              onClick={onCompact}
              disabled={isCompacting}
              style={{
                display: "block",
                marginTop: 8,
                padding: "3px 8px",
                border: "var(--hairline) solid currentColor",
                borderRadius: 5,
                background: "transparent",
                color: "inherit",
                cursor: isCompacting ? "default" : "pointer",
                font: "inherit",
              }}
            >
              {t(isCompacting ? "chat.compacting" : "chat.compactContext")}
            </button>
          )}
          {unansweredTruncation && compactError && (
            <div style={{ marginTop: 8, color: "#ef4444", whiteSpace: "pre-wrap" }}>{compactError}</div>
          )}
        </div>
      )}

      {writtenFiles && writtenFiles.length > 0 && (
        <TurnWrittenFiles files={writtenFiles} onOpenFile={onOpenFile} />
      )}

      <div className="message-assistant-footer" aria-busy={copyState === "pending" || !!forking}>
        {message.usage && !isStreaming && (
          <div className="message-meta" style={{ fontSize: 11, color: "var(--text-dim)" }}>
            {formatUsage(message.usage)}
          </div>
        )}
        {textContent && !isStreaming && (
          <button
            type="button"
            onClick={copyContent}
            aria-label={t("i18n.copyMessage")}
            className="message-copy-action"
            aria-busy={copyState === "pending"}
            aria-disabled={copyState === "pending"}
            data-copy-state={copyState}
          >
            {copied ? (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            <span className="pilaude-action-tooltip" aria-hidden="true">{copyFeedback || t("i18n.copy")}</span>
          </button>
        )}
        {textContent && !isStreaming && entryId && onFork && (
          <button
            type="button"
            aria-label={t("pilaude.forkFromHere")}
            aria-disabled={!!forking}
            aria-busy={!!forking}
            onClick={() => { if (!forking) onFork(entryId, "after"); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M4 12h6m0 0 8-8m-8 8 8 8M14 4h4v4m-4 12h4v-4" />
            </svg>
            <span className="pilaude-action-tooltip pilaude-action-tooltip--description" aria-hidden="true">
              <strong>{t(forking ? "i18n.creatingSession" : "pilaude.forkFromHere")}</strong>
              <span>{t("pilaude.forkDescription")}</span>
            </span>
          </button>
        )}
        <span role="status" className="c12-copy-status">{copyFeedback}</span>
        {time && !isStreaming && <ResponseTime timestamp={message.timestamp!} /> }
      </div>
    </div>
  );
}

function BlockView({ block, searchTarget, toolResults, isStreaming, liveTurn, activeThinking, activeText, partialToolCallIds, runningToolCallIds, activeToolCallId, streamingDuration, toolCallDurations, cwd, onOpenFile, onOpenSession, sessionId, entryId, blockIndex }: { block: AssistantContentBlock; searchTarget?: boolean; toolResults?: Map<string, ToolResultMessage>; isStreaming?: boolean; liveTurn?: boolean; activeThinking?: boolean; activeText?: boolean; partialToolCallIds?: ReadonlySet<string>; runningToolCallIds?: ReadonlySet<string>; activeToolCallId?: string | null; streamingDuration?: number; toolCallDurations?: Map<string, number>; cwd?: string; onOpenFile?: (filePath: string, page?: number) => void; onOpenSession?: (sessionId: string) => void; sessionId?: string; entryId?: string; blockIndex: number }) {
  if (block.type === "text") {
    return <div data-message-text data-message-streaming={activeText || undefined} data-search-target={searchTarget || undefined}><TextBlock block={block as TextContent} isStreaming={isStreaming} activeText={activeText} cwd={cwd} onOpenFile={onOpenFile} /></div>;
  }
  if (block.type === "thinking") {
    return <ThinkingBlock block={block as ThinkingContent} searchTarget={searchTarget} active={activeThinking} duration={streamingDuration} sessionId={sessionId} entryId={entryId} blockIndex={blockIndex} />;
  }
  if (block.type === "toolCall") {
    const tc = block as ToolCallContent;
    const result = toolResults?.get(tc.toolCallId);
    const running = runningToolCallIds?.has(tc.toolCallId) ?? false;
    const partial = partialToolCallIds?.has(tc.toolCallId) ?? false;
    const duration = !partial && !running ? toolCallDurations?.get(tc.toolCallId) : undefined;
    return <ToolCallBlock block={tc} result={result} duration={duration} onOpenSession={onOpenSession} running={running} partial={partial} live={isStreaming || liveTurn} active={tc.toolCallId === activeToolCallId && (running || tc.rawInput !== undefined)} aborted={!liveTurn && !isStreaming && !result && !running} />;
  }
  return null;
}

function TextBlock({ block, isStreaming, activeText, cwd, onOpenFile }: { block: TextContent; isStreaming?: boolean; activeText?: boolean; cwd?: string; onOpenFile?: (filePath: string, page?: number) => void }) {
  return <SafeMarkdownBody className={activeText ? "message-streaming-caret" : undefined} isStreaming={isStreaming} streamingCaret={activeText} cwd={cwd} onOpenFile={onOpenFile} artifacts>{block.text}</SafeMarkdownBody>;
}

export function ThinkingBlock({ block, searchTarget, active, duration, sessionId, entryId, blockIndex }: {
  block: ThinkingContent;
  searchTarget?: boolean;
  active?: boolean;
  duration?: number;
  sessionId?: string;
  entryId?: string;
  blockIndex: number;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useTranscriptExpansion(isThinkingExpandedByDefault, "thinking");
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tRef = useRef(t);
  tRef.current = t;
  const preview = getThinkingPreview(block.thinking);

  // Keep already-mounted blocks in sync when the preference changes.
  useEffect(() => {
    const onChange = () => setExpanded(isThinkingExpandedByDefault());
    window.addEventListener(THINKING_EXPANDED_EVENT, onChange);
    return () => window.removeEventListener(THINKING_EXPANDED_EVENT, onChange);
  }, [setExpanded]);

  // Load deferred history content whenever the block is expanded.
  // loadThinkingContent() memoizes in-flight promises and drops failed ones
  // from its cache, so re-running this effect is cheap and a failed load can
  // be retried by collapsing and expanding the block again.
  useEffect(() => {
    if (!expanded || !block.deferred || content !== null) return;
    if (!sessionId || !entryId) {
      setError(tRef.current("i18n.thinkingUnavailable"));
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadThinkingContent(sessionId, entryId, blockIndex)
      .then((value) => {
        if (!cancelled) {
          setContent(value);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [expanded, block.deferred, content, sessionId, entryId, blockIndex]);

  const previewLabel = expanded ? t("i18n.thinking") : preview ? <ReactMarkdown allowedElements={[]} unwrapDisallowed skipHtml>{preview}</ReactMarkdown> : "...";
  return <ThinkingDisclosure
    searchTarget={searchTarget}
    expanded={expanded}
    onToggle={() => setExpanded(value => !value)}
    label={`${t("i18n.thinking")}${preview ? `: ${preview}` : ""}`}
    title={t("i18n.thinking")}
    preview={active ? <span className="activity-shimmer" data-active="true">{previewLabel}</span> : previewLabel}
    metadata={duration !== undefined ? `${duration}s` : undefined}
    error={Boolean(error)}
  >{loading ? t("i18n.loadingThinking") : error ?? (block.deferred ? content : block.thinking)}</ThinkingDisclosure>;
}

const USER_TEXT_COLLAPSE_HEIGHT = 220;
function CollapsibleUserText({ text, cwd, onOpenFile }: {
  text: string;
  cwd?: string;
  onOpenFile?: (filePath: string) => void;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  // Small slack so content barely over the limit is not worth collapsing.
  const { bodyRef, overflowing } = useMeasuredOverflow(text, USER_TEXT_COLLAPSE_HEIGHT + 60);
  const bodyId = useId();

  const collapsed = overflowing && !expanded;
  const fade = "linear-gradient(to bottom, black calc(100% - 48px), transparent 100%)";

  return (
    <div>
      <div
        ref={bodyRef}
        id={bodyId}
        style={collapsed ? {
          maxHeight: USER_TEXT_COLLAPSE_HEIGHT,
          overflow: "hidden",
          maskImage: fade,
          WebkitMaskImage: fade,
        } : undefined}
      >
        <MarkdownBody className="markdown-user-message" keepLineBreaks cwd={cwd} onOpenFile={onOpenFile}>{text}</MarkdownBody>
      </div>
      {overflowing && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls={bodyId}
          className="user-text-disclosure-toggle"
          onClick={() => setExpanded((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            marginTop: 2,
            padding: "2px 0",
            background: "none",
            border: "none",
            color: "var(--text-muted)",
            cursor: "pointer",
            fontSize: 11,
          }}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            <polyline points="2 3.5 5 6.5 8 3.5" />
          </svg>
          {expanded ? t("i18n.collapse") : t("i18n.expand")}
        </button>
      )}
    </div>
  );
}

function CompactionMessageView({ message, kind = "compaction" }: { message: CustomMessage; kind?: "compaction" | "branch_summary" }) {
  const { t } = useI18n();
  const summary = getMessageText(message.content);
  const parsedSummary = useMemo(() => parseCompactionSummary(summary), [summary]);
  const time = formatTime(message.timestamp);

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          border: "var(--hairline) solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: "var(--bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderBottom: "var(--hairline) solid var(--border)",
            background: "var(--bg-panel)",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 650 }}>
            {kind === "branch_summary" ? "branch summary" : "compaction"}
          </span>
          {time && <span className="message-meta" style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 10 }}>{time}</span>}
        </div>

        <div style={{ padding: "11px 13px 12px" }}>
          <div style={{ color: "var(--text)", fontSize: "calc(15px + var(--chat-font-size-offset, 0px))", fontWeight: 700, lineHeight: 1.35 }}>
             {t(kind === "branch_summary" ? "i18n.branchSummaryTitle" : "i18n.conversationCompacted")}
          </div>
          <div style={{ marginTop: 3, marginBottom: 10, color: "var(--text)", fontSize: "calc(14px + var(--chat-font-size-offset, 0px))", lineHeight: 1.5 }}>
             {t(kind === "branch_summary" ? "i18n.branchSummaryDescription" : "i18n.compactionDescription")}
          </div>
          {parsedSummary.body ? (
            <MarkdownBody className="markdown-compaction-message">{parsedSummary.body}</MarkdownBody>
          ) : (
             <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("i18n.noSummary")}</span>
          )}
          <CompactionFileMetadata readFiles={parsedSummary.readFiles} modifiedFiles={parsedSummary.modifiedFiles} />
        </div>
      </div>
    </div>
  );
}

function CompactionFileMetadata({ readFiles, modifiedFiles }: { readFiles: string[]; modifiedFiles: string[] }) {
  const { t } = useI18n();
  const total = readFiles.length + modifiedFiles.length;
  if (total === 0) return null;

  const parts = [];
  if (readFiles.length > 0) parts.push(`${readFiles.length} read`);
  if (modifiedFiles.length > 0) parts.push(`${modifiedFiles.length} modified`);

  return (
    <details className="compaction-file-details">
       <summary>{t("i18n.fileContext", { details: parts.join(", ") })}</summary>
       {modifiedFiles.length > 0 && <CompactionFileList title={t("i18n.modifiedFiles")} files={modifiedFiles} />}
       {readFiles.length > 0 && <CompactionFileList title={t("i18n.readFiles")} files={readFiles} />}
    </details>
  );
}

function CompactionFileList({ title, files }: { title: string; files: string[] }) {
  return (
    <div className="compaction-file-section">
      <div className="compaction-file-title">{title}</div>
      <ul className="compaction-file-list">
        {files.map((file) => (
          <li key={file}>{file}</li>
        ))}
      </ul>
    </div>
  );
}

function CustomMessageView({ message, cwd, onOpenFile }: { message: CustomMessage; cwd?: string; onOpenFile?: (filePath: string, page?: number) => void }) {
  const { t } = useI18n();
  const isHiddenDisplay = message.display === false;
  const [contentExpanded, setContentExpanded] = useState(!isHiddenDisplay);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const text = getMessageText(message.content);
  const images = getMessageImages(message.content);
  const hasDetails = message.details !== undefined;
  const detailsText = hasDetails ? safeJson(message.details) : "";
  const title = formatCustomType(message.customType);
  const time = formatTime(message.timestamp);

  const copyContent = () => {
    copyText(text || detailsText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          border: "var(--hairline) solid var(--border)",
          borderRadius: 8,
          overflow: "hidden",
          background: isHiddenDisplay ? "var(--bg-subtle)" : "var(--bg)",
          opacity: isHiddenDisplay && !contentExpanded ? 0.82 : 1,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 10px",
            borderBottom: "var(--hairline) solid var(--border)",
            background: "var(--bg-panel)",
            color: "var(--text-muted)",
            fontSize: 12,
          }}
        >
          <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 650 }}>
            {title}
          </span>
          {isHiddenDisplay && <span style={{ color: "var(--text-dim)", fontSize: 11 }}>{t("i18n.hiddenExtensionMessage")}</span>}
          {time && <span className="message-meta" style={{ marginLeft: "auto", color: "var(--text-dim)", fontSize: 10 }}>{time}</span>}
        </div>

        {contentExpanded ? (
          <div style={{ padding: "6px 9px" }}>
            {images.length > 0 && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: text ? 8 : 0 }}>
                {images.map((img, i) => {
                  const src = imageSource(img);
                  if (!src) return null;
                  return (
                    <ImagePreview key={i} src={src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt=""
                        style={{ maxWidth: 240, maxHeight: 240, borderRadius: 6, objectFit: "contain", display: "block", border: "var(--hairline) solid var(--border)" }}
                      />
                    </ImagePreview>
                  );
                })}
              </div>
            )}
             {text ? <MarkdownBody className="markdown-custom-message" cwd={cwd} onOpenFile={onOpenFile}>{text}</MarkdownBody> : <span style={{ color: "var(--text-dim)", fontSize: 12 }}>{t("i18n.noMessage")}</span>}
          </div>
        ) : (
          <button
            onClick={() => setContentExpanded(true)}
            style={{
              display: "block",
              width: "100%",
              padding: "8px 10px",
              border: "none",
              background: "transparent",
              color: "var(--text-dim)",
              cursor: "pointer",
              fontSize: 12,
              textAlign: "left",
            }}
          >
             {text ? previewText(text) : t("i18n.showExtensionMessage")}
          </button>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "4px 9px",
            borderTop: "var(--hairline) solid var(--border)",
            background: "var(--bg-subtle)",
          }}
        >
          {text || detailsText ? (
            <button
              onClick={copyContent}
              style={{
                padding: "3px 7px",
                border: "none",
                background: "none",
                color: copied ? "var(--accent)" : "var(--text-dim)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
               {copied ? t("i18n.copied") : t("i18n.copy")}
            </button>
          ) : null}
          {(hasDetails || isHiddenDisplay) && (
            <button
              onClick={() => {
                if (isHiddenDisplay) setContentExpanded((v) => !v);
                else setDetailsExpanded((v) => !v);
              }}
              style={{
                marginLeft: "auto",
                padding: "3px 7px",
                border: "none",
                background: "none",
                color: "var(--text-dim)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              {isHiddenDisplay
                 ? (contentExpanded ? t("i18n.collapse") : t("i18n.expand"))
                 : (detailsExpanded ? t("i18n.hideDetails") : t("i18n.showDetails"))}
            </button>
          )}
        </div>

        {hasDetails && ((isHiddenDisplay && contentExpanded) || (!isHiddenDisplay && detailsExpanded)) && (
          <pre
            style={{
              margin: 0,
              padding: "9px 10px",
              borderTop: "var(--hairline) solid var(--border)",
              background: "var(--bg)",
              color: "var(--text-muted)",
              fontSize: "calc(12px + var(--chat-font-size-offset, 0px))",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              maxHeight: 360,
              overflow: "auto",
              fontFamily: "var(--font-mono)",
            }}
          >
            {detailsText}
          </pre>
        )}
      </div>
    </div>
  );
}

function getMessageText(content: CustomMessage["content"] | UserMessage["content"]): string {
  if (typeof content === "string") return content;
  return content
    .filter((b): b is TextContent => b.type === "text")
    .map((b) => b.text)
    .join("\n");
}

function getMessageImages(content: CustomMessage["content"] | UserMessage["content"]): ImageContent[] {
  if (typeof content === "string") return [];
  return content.filter((b): b is ImageContent => b.type === "image");
}

function safeJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function formatCustomType(type: string): string {
  return type || "extension";
}

function previewText(text: string): string {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return "Show extension message";
  return normalized.length > 140 ? `${normalized.slice(0, 140)}...` : normalized;
}


function formatUsage(usage: {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: { total: number };
}): string {
  const parts = [];
  if (usage.input) parts.push(`${usage.input.toLocaleString()} in`);
  if (usage.output) parts.push(`${usage.output.toLocaleString()} out`);
  if (usage.cacheRead) parts.push(`${usage.cacheRead.toLocaleString()} cache R`);
  if (usage.cacheWrite) parts.push(`${usage.cacheWrite.toLocaleString()} cache W`);
  if (usage.cost?.total) parts.push(`$${usage.cost.total.toFixed(4)}`);
  return parts.join(" · ");
}
