"use client";

import { Fragment, useMemo, type CSSProperties, type ReactNode } from "react";
import { Decoration, Diff, Hunk, getChangeKey, type ChangeData, type RenderGutter } from "react-diff-view";
import { parseReviewDiff, preserveReviewEmptyLines, reviewChangeLine, reviewDiffSelection, tokenizeReviewDiff } from "@/lib/review-diff-renderer";
import type { ReviewSelectionState, ReviewSide } from "@/lib/git-review-display";
import type { GitReviewContext, GitReviewFile, GitReviewPatch } from "@/lib/git-review-types";

export interface ReviewDiffWords {
  feedback: string; old: string; new: string; selectedLines: string; selectionGap: string;
  feedbackHint: string; cancel: string; sendingFeedback: string; addDraft: string;
  binary: string; tooLarge: string; metadata: string; noPatch: string; patchTruncated: string;
  unchanged: string; fullContext: string; context: string; noFinalNewline: string;
}
export interface ReviewDiffProps {
  file: GitReviewFile; data: GitReviewPatch; words: ReviewDiffWords;
  split: boolean; wrap: boolean; highlight: boolean; context: GitReviewContext;
  onMore: () => void; selection: ReviewSelectionState | null;
  onSelectLine: (side: ReviewSide, line: number, extend: boolean, anchor?: Record<ReviewSide, number>) => void;
  feedback: string; pending: boolean; setFeedback: (text: string) => void;
  onCancel: () => void; onSubmit: (selected: { start: number; end: number; snippet: string }) => Promise<void>;
}

/** Git identity, selection and feedback belong to the host; the library owns diff rendering. */
export function ReviewDiff({ file, data, words, split, wrap, highlight, context, onMore, selection, onSelectLine, feedback, pending, setFeedback, onCancel, onSubmit }: ReviewDiffProps) {
  const parsed = useMemo(() => parseReviewDiff(data.patch), [data.patch]);
  const hunks = useMemo(() => parsed?.hunks ?? [], [parsed]);
  const displayedHunks = useMemo(() => split ? parseReviewDiff(data.patch, true)?.hunks ?? hunks : hunks, [split, data.patch, hunks]);
  const changes = useMemo(() => hunks.flatMap(hunk => hunk.changes), [hunks]);
  const tokens = useMemo(() => preserveReviewEmptyLines(hunks, tokenizeReviewDiff(hunks, file.path, highlight, file.oldPath)), [hunks, file.path, file.oldPath, highlight]);
  const selected = selection ? reviewDiffSelection(hunks, selection.side, selection.start, selection.end) : null;
  const inSelection = (side: ReviewSide, line: number | null) => selection?.side === side && line !== null && line >= Math.min(selection.start, selection.end) && line <= Math.max(selection.start, selection.end);
  const selectedChanges = selection ? changes.filter(change => !(split && change.type === "normal") && inSelection(selection.side, reviewChangeLine(change, selection.side))).map(getChangeKey) : [];
  const lineDigits = changes.reduce((digits, change) => Math.max(digits, String(reviewChangeLine(change, "old") ?? "").length, String(reviewChangeLine(change, "new") ?? "").length), 3);
  const anchor = selection ? changes.find(change => reviewChangeLine(change, selection.side) === Math.max(selection.start, selection.end)) : undefined;
  const renderGutter: RenderGutter = ({ change, side: renderedSide }) => {
    // Unified keeps one visible column. The other library gutter is hidden by CSS.
    if (!split && renderedSide === "old") return null;
    const side = !split ? change.type === "delete" ? "old" : change.type === "insert" ? "new" : selection?.side ?? "new" : renderedSide;
    const line = reviewChangeLine(change, side);
    if (line === null) return null;
    const contextAnchor = !split && change.type === "normal" ? { old: change.oldLineNumber, new: change.newLineNumber } : undefined;
    return <button type="button" className={`changes-line-number${inSelection(side, line) ? " is-selected" : ""}`} data-review-side={side} data-review-line={line} aria-label={`${words.feedback}: ${side === "old" ? words.old : words.new} ${line}`} title={`${words.feedback} · ${side === "old" ? words.old : words.new} ${line}`} aria-pressed={inSelection(side, line) || false} onClick={event => onSelectLine(side, line, event.shiftKey, contextAnchor)}>{line}</button>;
  };
  const editor = <div className="changes-feedback" role="group" aria-label={words.feedback}>
    <div className="changes-feedback-label">{words.selectedLines}: {selection?.side === "old" ? words.old : words.new} {selection && Math.min(selection.start, selection.end)}{selection && selection.start !== selection.end ? `–${Math.max(selection.start, selection.end)}` : ""}<span>{file.path}</span></div>
    {!selected && <p className="changes-feedback-error">{words.selectionGap}</p>}
    <textarea autoFocus disabled={pending} value={feedback} aria-label={words.feedback} placeholder={words.feedbackHint} rows={3} onChange={event => setFeedback(event.target.value)} onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && selected && feedback.trim()) { event.preventDefault(); void onSubmit(selected); }
    }} />
    <div className="changes-feedback-actions"><button type="button" onClick={onCancel}>{words.cancel}</button><button type="button" disabled={pending || !selected || !feedback.trim()} onClick={() => { if (selected) void onSubmit(selected); }}>{pending ? words.sendingFeedback : words.addDraft}</button></div>
  </div>;
  const contextButton = (label: string) => <button type="button" className="changes-context-button" disabled={context === "all" || data.truncated} onClick={onMore} title={context === 20 ? words.fullContext : words.context}><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>{label}</button>;
  if (!data.supported) return <div className="changes-file-state">{data.reason === "binary" ? words.binary : data.reason === "too-large" ? words.tooLarge : words.metadata}</div>;
  if (!parsed || !changes.length) return <div className="changes-file-state">{words.noPatch}</div>;
  // The library uses the new side for unified context. Preserve old-side multiline syntax when selected.
  const displayTokens = !split && selection?.side === "old" && tokens ? { ...tokens, new: Object.assign([], tokens.new) } : tokens;
  if (displayTokens && displayTokens !== tokens) for (const change of changes) if (change.type === "normal") displayTokens.new[change.newLineNumber - 1] = tokens!.old[change.oldLineNumber - 1];
  const widgets: Record<string, ReactNode> = anchor ? { [getChangeKey(anchor)]: editor } : {};
  const oldEof = parsed.type !== "add" && !parsed.oldEndingNewLine;
  const newEof = parsed.type !== "delete" && !parsed.newEndingNewLine;
  const eofSide = oldEof && newEof ? "both" : oldEof ? "old" : "new";
  const eofLabel = oldEof && newEof ? `${words.old} / ${words.new}` : oldEof ? words.old : words.new;
  const rowClass = ({ changes: row, defaultGenerate }: { changes: ChangeData[]; defaultGenerate: () => string }) => {
    const contextSelected = split && selection && row.some(change => change?.type === "normal" && inSelection(selection.side, reviewChangeLine(change, selection.side)));
    return `${defaultGenerate()}${contextSelected ? ` review-selected-${selection.side}` : ""}`;
  };
  return <div className={`changes-diff changes-library-diff${split ? " is-split" : ""}${wrap ? " is-wrapped" : ""}`} style={{ "--changes-line-digits": lineDigits } as CSSProperties} data-diff-renderer="react-diff-view">
    {data.truncated && <div className="changes-notice">{words.patchTruncated}</div>}
    {split && <div className="changes-library-revisions">{parsed.type !== "add" && <span>{words.old}</span>}{parsed.type !== "delete" && <span>{words.new}</span>}</div>}
    <Diff diffType={parsed.type} hunks={displayedHunks} viewType={split ? "split" : "unified"} className="changes-library-table" lineClassName="changes-code-row" codeClassName="changes-code" gutterClassName="changes-gutter" renderGutter={renderGutter} selectedChanges={selectedChanges} tokens={displayTokens} widgets={widgets} generateLineClassName={rowClass}>
      {items => items.map((hunk, index) => {
        const previous = items[index - 1];
        const oldEnd = previous ? previous.oldStart + previous.oldLines : 1;
        const newEnd = previous ? previous.newStart + previous.newLines : 1;
        const omitted = Math.max(0, Math.min(hunk.oldStart - oldEnd, hunk.newStart - newEnd));
        return <Fragment key={`${hunk.oldStart}:${hunk.newStart}`}><Decoration className="changes-library-hunk">{contextButton(omitted ? `${omitted} ${words.unchanged}` : hunk.content)}</Decoration><Hunk hunk={hunk} /></Fragment>;
      })}
    </Diff>
    {selection && !anchor && editor}
    {(oldEof || newEof) && <div className="changes-eof-note" data-review-side={eofSide}>{eofLabel}: {words.noFinalNewline}</div>}
    {context !== "all" && !data.truncated && <div className="changes-more-context">{contextButton(context === 20 ? words.fullContext : words.context)}</div>}
  </div>;
}
