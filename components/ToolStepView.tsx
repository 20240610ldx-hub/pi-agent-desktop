"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { useTranscriptExpansion } from "@/hooks/useTranscriptExpansion";
import { useDiffViewMode } from "@/hooks/useDiffViewMode";
import { DisclosureBody } from "./DisclosureBody";
import { CodeCopyButton } from "./CodeCopyButton";
import { CompactCommandText } from "./CompactCommandText";
import { ImagePreview } from "./ImagePreview";
import { SavedFileCard, isSavedFileInfo } from "./SavedFileCard";
import { CODEMODE_TOOL_NAME, codemodeCalls, codemodeScript, codemodeScriptPreview, stripCodemodeHeader } from "@/lib/codemode-view";
import { CodemodeCallList } from "./CodemodeToolView";
import { imageSource, resultImageFileName } from "@/lib/result-image";
import { mcpToolLabel, prettyMcpResultText } from "@/lib/mcp-tool-display";
import { isApplyPatchToolName, isEditToolName } from "@/lib/tool-names";
import { isToolCallExpanded, setToolCallExpanded } from "@/lib/tool-call-expansion";
import { applyPatchPreviewToFiles, applyPatchResultHasFailures, extractApplyPatchPaths, getApplyPatchInputText, parseApplyPatchInput } from "@/lib/apply-patch";
import { parseUnifiedPatch, type SplitDiffCell, type SplitDiffFile } from "@/lib/patch";
import type { SubagentToolDetails } from "@/lib/subagent-extension";
import type { BashExecutionMessage, ImageContent, ToolCallContent, ToolResultMessage } from "@/lib/types";

function getMessageImages(content: ToolResultMessage["content"]): ImageContent[] {
  return content.filter((block): block is ImageContent => block.type === "image");
}

function imageMediaType(image: ImageContent): string | undefined {
  return image.source?.media_type ?? (image as unknown as { mimeType?: string }).mimeType;
}

function isSubagentToolDetails(value: unknown): value is SubagentToolDetails {
  if (!value || typeof value !== "object") return false;
  const details = value as Partial<SubagentToolDetails>;
  return details.kind === "pi-web-subagent" && typeof details.sessionId === "string";
}

type ToolCallStatus = "pending" | "running" | "generating" | "success" | "error" | "cancelled";
const dismissedToolErrors = new Set<string>();

export function ToolCallBlock({ block, result, duration, running, partial, live, active, aborted, defaultExpanded, onOpenSession }: { block: ToolCallContent; result?: ToolResultMessage; duration?: number; running?: boolean; partial?: boolean; live?: boolean; active?: boolean; aborted?: boolean; defaultExpanded?: boolean; onOpenSession?: (sessionId: string) => void }) {
  const { t } = useI18n();
  const isError = (result?.isError ?? false)
    || (isApplyPatchToolName(block.toolName) && applyPatchResultHasFailures(result?.details));
  const autoExpandError = isError && !dismissedToolErrors.has(block.toolCallId);
  const [expanded, setExpanded] = useTranscriptExpansion(() => autoExpandError || (defaultExpanded ?? isToolCallExpanded(block.toolCallId)), "tool");
  const [previousIsError, setPreviousIsError] = useState(isError);
  if (isError !== previousIsError) {
    setPreviousIsError(isError);
    if (isError) setExpanded(true);
  }
  useEffect(() => {
    if (!isError) dismissedToolErrors.delete(block.toolCallId);
  }, [isError, block.toolCallId]);
  const toggleExpanded = () => {
    const next = !expanded;
    if (isError) {
      if (next) dismissedToolErrors.delete(block.toolCallId);
      else dismissedToolErrors.add(block.toolCallId);
    }
    setToolCallExpanded(block.toolCallId, next);
    setExpanded(next);
  };
  const inputStr = getToolCallInputText(block);
  const isStreamingInput = block.rawInput !== undefined;
  const isEditTool = isEditToolName(block.toolName);
  const resultDiff = result && !result.isError ? getResultDiff(result) : null;
  const patchFiles = getApplyPatchFiles(block, result);
  const patchLabel = isApplyPatchToolName(block.toolName)
    ? summarizeApplyPatchInput(block)
    : null;
  // A script and the calls it made, instead of the input JSON. Streamed input is
  // still incomplete JSON and keeps the generic view.
  const codemodeCode = block.toolName === CODEMODE_TOOL_NAME && !isStreamingInput ? codemodeScript(block.input) : null;
  const codemode = codemodeCode === null ? null : { code: codemodeCode, ...codemodeCalls(result?.details) };
  // Progress is identified by live metadata; a final empty result is still complete.
  const codemodeRunning = codemode !== null && (running || partial);

  // `server/tool` instead of the registered `mcp__server__tool`, as pi's TUI shows it.
  const mcpLabel = mcpToolLabel(block.toolName, result?.details);

  // Result display
  const resultContent = result ? (codemode ? stripCodemodeHeader(result.content) : result.content) : [];
  const joinedResultText = result
    ? resultContent.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text).join("\n")
    : null;
  const resultText = mcpLabel && joinedResultText !== null ? prettyMcpResultText(joinedResultText) : joinedResultText;
  const resultImages = getMessageImages(resultContent);
  const resultIsEmpty = resultText === null ? false : (resultText.trim() === "(no output)" || resultText.trim() === "");
  const subagent = isSubagentToolDetails(result?.details) ? result.details : null;
  // Only the built-in command-only shape has an equivalent compact shell view.
  // Timeout/extension fields and unfinished input retain the full JSON inspector.
  const shellCommand = (block.toolName === "bash" || block.toolName === "powershell")
    && !isStreamingInput && !running && !partial && result && !resultDiff && !patchFiles && !subagent && resultImages.length === 0
    && block.input && !Array.isArray(block.input) && Object.keys(block.input).length === 1
    && Object.prototype.hasOwnProperty.call(block.input, "command") && typeof block.input.command === "string" && block.input.command.trim()
      ? block.input.command : null;
  const savedFile = block.toolName === "save_to_downloads" && !isError && isSavedFileInfo(result?.details)
    ? result.details
    : null;
  const codemodeCallCount = codemode ? codemode.calls.length + codemode.omitted : 0;
  // Progress snapshots are paired results too; execution metadata wins until end.
  const status: ToolCallStatus = running ? "running"
    : partial ? (live ? "pending" : "cancelled")
    : aborted ? "cancelled"
    : result ? (isError ? "error" : "success")
    : isStreamingInput ? "generating"
    : live ? "pending" : "cancelled";
  const statusLabel = t(status === "pending" ? "chat.toolPending"
    : status === "running" ? "chat.toolRunning"
    : status === "generating" ? "chat.generatingToolInput"
    : status === "success" ? "chat.toolSuccess"
    : status === "error" ? "chat.toolError" : "chat.toolCancelled");
  const disclosureId = useId();

  return (
    <div className="tool-call-row" data-status={status} data-tool-call-id={block.toolCallId} data-command-layout={shellCommand !== null ? "compact" : undefined}>
      {/* ── Tool call header ── */}
      <div className="tool-call-header" style={{ display: "flex", alignItems: "stretch", minWidth: 0 }}>
        <button
          type="button"
          id={`${disclosureId}-toggle`}
          className="tool-call-trigger"
          aria-expanded={expanded}
          aria-controls={`${disclosureId}-body`}
          aria-label={`${mcpLabel ? `${mcpLabel.server}/${mcpLabel.tool}` : block.toolName}: ${statusLabel}`}
          onClick={toggleExpanded}
        >
          <svg className="tool-call-status-icon" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {status === "success" ? <path d="m3 8 3.2 3.2L13 4.5" />
              : status === "error" ? <path d="m4 4 8 8M12 4l-8 8" />
              : status === "cancelled" ? <rect x="4" y="4" width="8" height="8" rx="1" />
              : <circle cx="8" cy="8" r={status === "running" ? 3 : 4.5} fill={status === "running" ? "currentColor" : "none"} />}
          </svg>
          <span className="tool-call-name" title={mcpLabel ? block.toolName : undefined}>
            {active ? <span className="activity-shimmer" data-active="true">{mcpLabel ? `${mcpLabel.server}/${mcpLabel.tool}` : block.toolName}</span>
              : mcpLabel ? <><span style={{ fontWeight: 500, opacity: 0.75 }}>{mcpLabel.server}/</span>{mcpLabel.tool}</> : block.toolName}
          </span>
          {aborted && (
            <span title={t("chat.toolCancelled")} style={{ flexShrink: 0, fontSize: 10, color: "var(--text-dim)", border: "var(--hairline) solid var(--border)", borderRadius: 4, padding: "1px 5px" }}>
              {t("chat.toolCancelled")}
            </span>
          )}
          <span className="tool-call-preview">
            {isStreamingInput
              ? t("chat.generatingToolInput")
              : (patchLabel ?? (codemode ? codemodeScriptPreview(codemode.code) : getToolPreview(block)))}
          </span>
          {codemodeCallCount > 0 && (
            <span className="tool-call-metadata" style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
              {codemodeCallCount === 1 ? t("codemode.callCountOne") : t("codemode.callCount", { count: codemodeCallCount })}
            </span>
          )}
          {duration !== undefined && (
            <span className="tool-call-metadata" style={{ fontSize: 11, color: "var(--text-dim)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>{duration}s</span>
          )}
          <svg className="tool-call-chevron" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="3.5 2 6.5 5 3.5 8" />
          </svg>
        </button>
        {subagent && onOpenSession && (
          <button
            type="button"
            onClick={() => onOpenSession(subagent.sessionId)}
            title={t("subagent.open")}
            aria-label={t("subagent.open")}
            style={{ width: 32, display: "grid", placeItems: "center", border: "none", borderLeft: "var(--hairline) solid var(--border)", background: "none", color: "var(--text-muted)", cursor: "pointer", flexShrink: 0 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /></svg>
          </button>
        )}
      </div>

      {/* Result images stay visible even when the argument/result disclosure is closed. */}
      {resultImages.length > 0 && <ResultImages images={resultImages} isError={isError} />}
      {/* A file the chat saved to Downloads stays visible as well. */}
      {savedFile && <SavedFileCard file={savedFile} />}
      <DisclosureBody id={`${disclosureId}-body`} labelledBy={`${disclosureId}-toggle`} expanded={expanded} className="tool-call-grid" contentClassName="tool-call-body">
      {/* A validated completed shell call needs one command pill and plain output,
          with the existing exact-payload copy controls retained for each. */}
      {shellCommand !== null && <>
        <div className="tool-call-command-line"><span className="tool-call-command-prompt" aria-hidden="true">$</span><pre className="tool-call-input tool-call-command-text"><CompactCommandText command={shellCommand} language={block.toolName as "bash" | "powershell"} /></pre><CodeCopyButton code={shellCommand} /></div>
        <div className="tool-call-command-result"><CodeCopyButton code={resultText ?? ""} /><pre className="tool-call-command-output">{resultIsEmpty ? t("i18n.noOutput") : resultText}</pre></div>
      </>}
      {/* ── Expanded: input args (only when no richer view exists); a codemode script in place of its JSON ── */}
      {shellCommand === null && (isStreamingInput || !isEditTool) && !patchFiles && (
        <>
        <CodeCopyButton code={codemode ? codemode.code : inputStr} />
        <pre
          className="tool-call-input"
          style={{
            margin: 0,
            padding: "8px 10px",
            color: "var(--text-muted)",
            fontSize: "calc(12px + var(--chat-font-size-offset, 0px))",
            lineHeight: 1.5,
            overflow: "auto",
            background: "var(--bg-subtle)",
            fontFamily: "var(--font-mono)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
          }}
        >
          {codemode ? codemode.code.replace(/\r/g, "").trimEnd() : inputStr}
        </pre>
        </>
      )}

      {/* ── Expanded: the calls a codemode script made ── */}
      {codemode && (
        <CodemodeCallList calls={codemode.calls} omitted={codemode.omitted} isError={isError} />
      )}

      {/* ── Expanded: applied-patch split diff ── */}
      {patchFiles && (
        <div style={{ borderTop: "var(--hairline) solid rgba(34,197,94,0.15)", background: "var(--bg)" }}>
          <ApplyPatchDiffView files={patchFiles} />
        </div>
      )}

      {/* ── Paired result — only shown when expanded ── */}
      {result && patchFiles && isError && (
        <PairedResult
          text={resultText ?? ""}
          isEmpty={resultIsEmpty}
          isError={isError}
        />
      )}
      {shellCommand === null && result && !patchFiles && !codemodeRunning && (
        resultDiff ? (
          <PairedDiffResult
            diff={resultDiff}
          />
        ) : (!resultIsEmpty || resultImages.length === 0) && (
          <PairedResult
            text={resultText ?? ""}
            isEmpty={resultIsEmpty}
            isError={isError}
          />
        )
      )}
      </DisclosureBody>
    </div>
  );
}

interface ResultDiff {
  text: string;
}

function PairedDiffResult({ diff }: {
  diff: ResultDiff;
}) {
  return (
    <div
      style={{
        borderTop: "var(--hairline) solid rgba(34,197,94,0.15)",
        background: "var(--bg)",
      }}
    >
      <SplitPatchView text={diff.text} />
    </div>
  );
}

function ApplyPatchDiffView({ files }: { files: SplitDiffFile[] }) {
  const { mode } = useDiffViewMode();
  return <SplitFilesView files={files} mode={mode} />;
}

function SplitPatchView({ text }: { text: string }) {
  const { mode } = useDiffViewMode();
  const files = useMemo(() => parseUnifiedPatch(text), [text]);
  if (!files) return <PatchTextView text={text} />;
  return <SplitFilesView files={files} mode={mode} />;
}

function SplitFilesView({ files, mode = "split" }: { files: SplitDiffFile[]; mode?: "split" | "unified" }) {
  const { t } = useI18n();
  const showFileHeaders = files.length > 1;
  const unified = mode === "unified";

  return (
    <div style={{ maxHeight: 560, overflowY: "auto", overflowX: "hidden", background: "var(--bg)" }}>
      {files.map((file, fileIndex) => (
        <div
          key={fileIndex}
          style={{
            minWidth: 0,
            borderTop: fileIndex === 0 ? "none" : "1px solid var(--border)",
            fontFamily: "var(--font-mono)",
            fontSize: "calc(12px + var(--chat-font-size-offset, 0px))",
            lineHeight: 1.55,
          }}
        >
          {showFileHeaders && (
            unified ? (
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--bg-panel)",
                  borderBottom: "var(--hairline) solid var(--border)",
                }}
              >
                <SplitDiffHeader title={file.newPath || file.oldPath || t("i18n.after")} side="right" />
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  background: "var(--bg-panel)",
                  borderBottom: "var(--hairline) solid var(--border)",
                }}
              >
                 <SplitDiffHeader title={file.oldPath || t("i18n.before")} side="left" />
                 <SplitDiffHeader title={file.newPath || t("i18n.after")} side="right" />
              </div>
            )
          )}

          {unified ? (
            <div>
              {file.rows.flatMap((row, rowIndex) => {
                if (row.type === "hunk") return [];
                const cells = [];
                const { left, right } = row;
                if (left.type === "removed") {
                  cells.push(<UnifiedDiffLine key={`${rowIndex}-l`} cell={left} />);
                }
                if (right.type === "added") {
                  cells.push(<UnifiedDiffLine key={`${rowIndex}-r`} cell={right} />);
                }
                if (left.type === "context" && right.type === "context") {
                  cells.push(<UnifiedDiffLine key={`${rowIndex}-c`} cell={right} />);
                }
                return cells;
              })}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)" }}>
              {file.rows.map((row, rowIndex) => {
                if (row.type === "hunk") {
                  return null;
                }

                return (
                  <div key={rowIndex} style={{ display: "contents" }}>
                    <SplitDiffCellView cell={row.left} side="left" />
                    <SplitDiffCellView cell={row.right} side="right" />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function UnifiedDiffLine({ cell }: { cell: SplitDiffCell }) {
  const bg =
    cell.type === "added"
      ? "rgba(34,197,94,0.12)"
      : cell.type === "removed"
      ? "rgba(248,113,113,0.13)"
      : "transparent";
  const marker =
    cell.type === "added" ? "+" : cell.type === "removed" ? "-" : " ";
  const markerColor =
    cell.type === "added" ? "var(--success)" : cell.type === "removed" ? "var(--danger)" : "var(--text-dim)";

  return (
    <div style={{ display: "flex", minWidth: 0, background: bg }}>
      <span
        style={{
          width: 42,
          padding: "0 6px",
          textAlign: "right",
          color: "var(--text-dim)",
          userSelect: "none",
          background: "var(--bg-panel)",
          borderRight: "var(--hairline) solid var(--border)",
          flexShrink: 0,
        }}
      >
        {cell.lineNo ?? ""}
      </span>
      <span
        style={{
          width: 18,
          padding: "0 5px",
          color: markerColor,
          userSelect: "none",
          fontWeight: cell.type === "context" ? 400 : 700,
          flexShrink: 0,
        }}
      >
        {marker}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          padding: "0 10px 0 0",
          color: "var(--text)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {cell.text || " "}
      </span>
    </div>
  );
}

function SplitDiffHeader({ title, side }: { title: string; side: "left" | "right" }) {
  return (
    <div
      title={title}
      style={{
        padding: "5px 10px",
        color: "var(--text-dim)",
        borderRight: side === "left" ? "1px solid var(--border)" : "none",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {title}
    </div>
  );
}

function SplitDiffCellView({ cell, side }: { cell: SplitDiffCell; side: "left" | "right" }) {
  const bg =
    cell.type === "added"
      ? "rgba(34,197,94,0.12)"
      : cell.type === "removed"
      ? "rgba(248,113,113,0.13)"
      : cell.type === "empty"
      ? "var(--bg-subtle)"
      : "transparent";
  const marker =
    cell.type === "added" ? "+" : cell.type === "removed" ? "-" : " ";
  const markerColor =
    cell.type === "added" ? "var(--success)" : cell.type === "removed" ? "var(--danger)" : "var(--text-dim)";

  return (
    <div
      style={{
        display: "flex",
        minWidth: 0,
        background: bg,
        borderRight: side === "left" ? "1px solid var(--border)" : "none",
      }}
    >
      <span
        style={{
          width: 42,
          padding: "0 6px",
          textAlign: "right",
          color: "var(--text-dim)",
          userSelect: "none",
          background: "var(--bg-panel)",
          borderRight: "var(--hairline) solid var(--border)",
          flexShrink: 0,
        }}
      >
        {cell.lineNo ?? ""}
      </span>
      <span
        style={{
          width: 18,
          padding: "0 5px",
          color: markerColor,
          userSelect: "none",
          fontWeight: cell.type === "context" || cell.type === "empty" ? 400 : 700,
          flexShrink: 0,
        }}
      >
        {marker}
      </span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          padding: "0 10px 0 0",
          color: cell.type === "empty" ? "var(--text-dim)" : "var(--text)",
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
        }}
      >
        {cell.text || "\u00a0"}
      </span>
    </div>
  );
}

function PatchTextView({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);

  return (
    <div style={{ maxHeight: 520, overflowY: "auto", overflowX: "hidden", fontFamily: "var(--font-mono)", fontSize: "calc(12px + var(--chat-font-size-offset, 0px))", lineHeight: 1.55, minWidth: 0 }}>
      {lines.map((line, i) => {
        const kind =
          line.startsWith("@@") ? "hunk" :
          line.startsWith("+") && !line.startsWith("+++") ? "added" :
          line.startsWith("-") && !line.startsWith("---") ? "removed" :
          "context";
        const bg =
          kind === "added" ? "rgba(34,197,94,0.12)" :
          kind === "removed" ? "rgba(248,113,113,0.13)" :
          kind === "hunk" ? "rgba(96,165,250,0.12)" :
          "transparent";
        const color =
          kind === "added" ? "var(--success)" :
          kind === "removed" ? "var(--danger)" :
          kind === "hunk" ? "var(--accent)" :
          "var(--text)";

        return (
          <div
            key={i}
            style={{
              display: "flex",
              background: bg,
              borderLeft: kind === "added"
                ? "3px solid var(--success)"
                : kind === "removed"
                ? "3px solid var(--danger)"
                : kind === "hunk"
                ? "3px solid var(--accent)"
                : "3px solid transparent",
            }}
          >
            <span
              style={{
                width: 48,
                padding: "0 8px",
                color: "var(--text-dim)",
                background: "var(--bg-panel)",
                borderRight: "var(--hairline) solid var(--border)",
                textAlign: "right",
                userSelect: "none",
                flexShrink: 0,
              }}
            >
              {i + 1}
            </span>
            <span style={{ padding: "0 10px", whiteSpace: "pre-wrap", overflowWrap: "anywhere", color }}>
              {line || "\u00a0"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Split diff rows for an apply_patch-style tool call.
 *
 * Prefers parsing the V4A patch document from the call input. The extension's
 * applied result preview contains the complete old/new file with unchanged
 * lines, so it is only used as a fallback when the call input is unavailable.
 * A single call may contain several file operations — each becomes its own
 * file section.
 */
function getApplyPatchFiles(block: ToolCallContent, result?: ToolResultMessage): SplitDiffFile[] | null {
  if (!isApplyPatchToolName(block.toolName)) return null;

  const fromInput = parseApplyPatchInput(getApplyPatchInputText(block.input, block.rawInput));
  if (fromInput) return fromInput;

  const details = result && !result.isError ? (result as ToolResultMessage & { details?: unknown }).details : undefined;
  if (isRecord(details)) {
    const fromPreview = applyPatchPreviewToFiles(details.preview);
    if (fromPreview) return fromPreview;
  }

  return null;
}

/** Header label listing the files targeted by an apply_patch call. */
function summarizeApplyPatchInput(block: ToolCallContent): string | null {
  const paths = extractApplyPatchPaths(getApplyPatchInputText(block.input, block.rawInput));
  if (paths.length === 0) return null;
  return paths.join(", ").slice(0, 120);
}

function getResultDiff(result: ToolResultMessage): ResultDiff | null {
  const details = (result as ToolResultMessage & { details?: unknown }).details;
  if (!isRecord(details)) return null;

  const patch = typeof details.patch === "string" ? details.patch : null;
  if (patch) return { text: patch };

  const diff = typeof details.diff === "string" ? details.diff : null;
  if (diff) return { text: diff };

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Images a tool returned — including ones a codemode script generated with an image model,
// which pi never writes to disk — so each one can be saved.
function ResultImages({ images, isError }: { images: ImageContent[]; isError: boolean }) {
  const { t } = useI18n();
  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        padding: "10px",
        background: "var(--bg)",
        borderTop: `1px solid ${isError ? "rgba(248,113,113,0.3)" : "rgba(34,197,94,0.15)"}`,
      }}
    >
      {images.map((image, index) => {
        const src = imageSource(image);
        if (!src) return null;
        return (
          <div key={index} className="result-image" style={{ maxWidth: "100%" }}>
            <ImagePreview src={src} style={{ maxWidth: "100%" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                loading="lazy"
                style={{
                  display: "block",
                  maxWidth: "min(100%, 720px)",
                  maxHeight: 520,
                  borderRadius: 6,
                  objectFit: "contain",
                  border: "var(--hairline) solid var(--border)",
                }}
              />
            </ImagePreview>
            <button
              type="button"
              className="result-image-save"
              onClick={() => {
                void import("@/lib/desktop-native")
                  .then(({ downloadUrlAsFile }) => downloadUrlAsFile(src, resultImageFileName(imageMediaType(image), index)))
                  .catch((error: unknown) => console.error("Failed to save image:", error));
              }}
            >
              {t("chat.saveImage")}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function PairedResult({ text, isEmpty, isError }: {
  text: string;
  isEmpty: boolean;
  isError: boolean;
}) {
  const { t } = useI18n();
  return (
    <div
      style={{
        borderTop: `1px solid ${isError ? "rgba(248,113,113,0.3)" : "rgba(34,197,94,0.15)"}`,
        background: isError ? "rgba(248,113,113,0.04)" : "var(--bg-subtle)",
      }}
    >
      {!isEmpty && <CodeCopyButton code={text} />}
      <pre
        style={{
          margin: 0,
          padding: "8px 10px",
          color: isError ? "var(--danger)" : (isEmpty ? "var(--text-dim)" : "var(--text-muted)"),
          fontSize: "calc(12px + var(--chat-font-size-offset, 0px))",
          lineHeight: 1.5,
          overflow: "auto",
          maxHeight: 400,
        }}
      >
        {isEmpty ? t("i18n.noOutput") : text}
      </pre>
    </div>
  );
}

export function getToolCallInputText(block: ToolCallContent): string {
  return block.rawInput ?? JSON.stringify(block.input, null, 2);
}

function getToolPreview(block: ToolCallContent): string {
  const input = block.input;
  if (!input || typeof input !== "object") return "";
  const keys = Object.keys(input);
  if (keys.length === 0) return "";

  // Common tool input patterns
  if ("command" in input) return String(input.command).slice(0, 120);
  if ("path" in input) return String(input.path).slice(0, 120);
  if ("file_path" in input) return String(input.file_path).slice(0, 120);
  if ("pattern" in input) return String(input.pattern).slice(0, 120);
  if ("query" in input) return String(input.query).slice(0, 120);

  const first = input[keys[0]];
  return String(first).slice(0, 120);
}

export function BashExecutionView({ message, sessionId }: { message: BashExecutionMessage; sessionId?: string }) {
  const [fullOutput, setFullOutput] = useState<string | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [fullError, setFullError] = useState<string | null>(null);

  const isRunning = message.exitCode === undefined && !message.cancelled;
  // No output yet while running → keep the pending spinner; once chunks have
  // streamed in (bash_execution_update), show them as a partial result so a
  // long `!command` explains itself instead of looking stuck.
  const isPending = isRunning && !message.output;
  const isError = message.cancelled || (message.exitCode !== undefined && message.exitCode !== 0);
  const fullOutputUrl = sessionId && message.fullOutputPath
    ? `/api/agent/${encodeURIComponent(sessionId)}/bash-output?path=${encodeURIComponent(message.fullOutputPath)}`
    : null;
  const showFullButton = message.truncated && fullOutputUrl && fullOutput === null;
  const displayOutput = fullOutput ?? message.output;

  async function loadFullOutput() {
    if (!fullOutputUrl) return;
    setLoadingFull(true);
    setFullError(null);
    try {
      const res = await fetch(fullOutputUrl);
      const d = await res.json() as { success?: boolean; data?: { output?: string }; error?: string };
      if (d.success) {
        setFullOutput(d.data?.output ?? "");
      } else {
        setFullError(d.error ?? "failed");
      }
    } catch (e) {
      setFullError(String(e));
    } finally {
      setLoadingFull(false);
    }
  }

  // Reuse the existing ToolCallBlock so user-run bash looks identical to an
  // agent-run bash tool call: same header, collapse behavior, result pane.
  // Synthesize an equivalent ToolCallContent + ToolResultMessage pair.
  const toolName = message.excludeFromContext ? "bash (local)" : "bash";
  const block: ToolCallContent = {
    type: "toolCall",
    toolCallId: `bash-${message.timestamp ?? ""}`,
    toolName,
    input: { command: message.command },
  };
  const result: ToolResultMessage | undefined = isPending
    ? undefined
    : {
        role: "toolResult",
        toolCallId: block.toolCallId,
        toolName,
        content: displayOutput ? [{ type: "text", text: isRunning ? `${displayOutput}\n…` : displayOutput }] : [],
        isError,
        timestamp: message.timestamp,
      };
  return (
    <div style={{ margin: "6px 0" }}>
      <ToolCallBlock block={block} result={result} running={isRunning} partial={isRunning} aborted={message.cancelled} defaultExpanded={isRunning} />
      {message.truncated && fullOutputUrl && (
        <div style={{ padding: "4px 10px", fontSize: 11, marginTop: -1 }}>
          {showFullButton && (
            <button
              onClick={loadFullOutput}
              disabled={loadingFull}
              style={{ background: "none", border: "none", color: "var(--accent)", cursor: loadingFull ? "default" : "pointer", fontSize: 11, padding: 0, textDecoration: "underline" }}
            >
              {loadingFull ? "loading…" : "view full output"}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              void import("@/lib/desktop-native").then(({ downloadUrlAsFile }) =>
                downloadUrlAsFile(`${fullOutputUrl}&download=1`, "bash-output.log"),
              );
            }}
            style={{
              marginLeft: showFullButton ? 10 : 0,
              background: "none",
              border: "none",
              padding: 0,
              color: "var(--accent)",
              fontSize: 11,
              textDecoration: "underline",
              cursor: "pointer",
            }}
          >
            download full output
          </button>
          {fullError && <span style={{ marginLeft: 6, color: "var(--text-dim)", fontSize: 11 }}>({fullError})</span>}
        </div>
      )}
    </div>
  );
}
