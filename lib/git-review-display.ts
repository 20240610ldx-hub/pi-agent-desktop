import type { SplitDiffCell, SplitDiffRow } from "./patch.ts";

export type ReviewSide = "old" | "new";
export type ReviewFileGroup = "source" | "tests" | "generated";

export interface ReviewKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  isComposing?: boolean;
  keyCode?: number;
  editable?: boolean;
  defaultPrevented?: boolean;
}

function preserveReviewKey(event: ReviewKey): boolean {
  return Boolean(event.editable || event.isComposing || event.keyCode === 229 || event.defaultPrevented || event.altKey);
}

/** Return a list destination only for unmodified navigation owned by its chrome. */
export function reviewNavigationIndex(event: ReviewKey, current: number, count: number): number | null {
  if (preserveReviewKey(event) || event.ctrlKey || event.metaKey || event.shiftKey || count <= 0 || current < 0) return null;
  if (event.key === "Home") return 0;
  if (event.key === "End") return count - 1;
  if (event.key === "ArrowDown") return Math.min(count - 1, current + 1);
  if (event.key === "ArrowUp") return Math.max(0, current - 1);
  return null;
}

/** The pane calls this only for events that bubbled from inside its own boundary. */
export function reviewPaneShortcut(event: ReviewKey): "finder" | "files" | null {
  if (preserveReviewKey(event) || !(event.ctrlKey || event.metaKey)) return null;
  if (!event.shiftKey && event.key.toLowerCase() === "p") return "finder";
  if (event.shiftKey && event.key.toLowerCase() === "y") return "files";
  return null;
}

export function reviewFileGroup(path: string): ReviewFileGroup {
  if (/(^|\/)(?:node_modules|dist|build|out|coverage|target|\.next|vendor|generated|__generated__)(\/|$)|(?:\.min\.[cm]?js|\.map|\.lock|lock\.json|\.generated\.[^/]+)$/i.test(path)) return "generated";
  if (/(^|\/)(?:tests?|__tests__|e2e|fixtures?|specs?)(\/|$)|\.(?:test|spec)\.[^/]+$/i.test(path)) return "tests";
  return "source";
}

export function shortReviewRef(ref: string | null | undefined): string {
  return (ref ?? "").replace(/^refs\/(?:heads|remotes)\//, "");
}

export type InlineReviewRow =
  | { type: "hunk"; text: string; omitted: number }
  | { type: "line"; oldLine: number | null; newLine: number | null; cell: SplitDiffCell; paired?: SplitDiffCell };

/** Reconstruct Git's delete-block/add-block order from the parser's aligned rows. */
export function inlineReviewRows(rows: SplitDiffRow[]): InlineReviewRow[] {
  const result: InlineReviewRow[] = [];
  let changes: Extract<SplitDiffRow, { type: "line" }>[] = [];
  let oldEnd = 1;
  let newEnd = 1;
  const flush = () => {
    for (const row of changes) {
      if (row.left.type !== "empty") result.push({ type: "line", oldLine: row.left.lineNo, newLine: null, cell: row.left, paired: row.right });
    }
    for (const row of changes) {
      if (row.right.type !== "empty") result.push({ type: "line", oldLine: null, newLine: row.right.lineNo, cell: row.right, paired: row.left });
    }
    changes = [];
  };
  for (const row of rows) {
    if (row.type === "hunk") {
      flush();
      const match = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(row.text);
      let omitted = 0;
      if (match) {
        const oldStart = Number(match[1]);
        const newStart = Number(match[3]);
        omitted = Math.max(0, Math.min(oldStart - oldEnd, newStart - newEnd));
        oldEnd = oldStart + Number(match[2] ?? 1);
        newEnd = newStart + Number(match[4] ?? 1);
      }
      result.push({ type: "hunk", text: row.text, omitted });
    } else if (row.left.type === "context" && row.right.type === "context") {
      flush();
      result.push({ type: "line", oldLine: row.left.lineNo, newLine: row.right.lineNo, cell: row.right });
    } else changes.push(row);
  }
  flush();
  return result;
}

export interface ReviewWordPart { text: string; changed: boolean }
const MAX_WORD_LINE = 4096;
const MAX_WORD_TOKENS = 160;

/** Bounded token LCS: whitespace and punctuation stay lossless; long lines stay plain. */
export function reviewWordParts(before: string, after: string): { old: ReviewWordPart[]; new: ReviewWordPart[] } {
  const plain = () => ({ old: [{ text: before, changed: false }], new: [{ text: after, changed: false }] });
  if (before === after || before.length > MAX_WORD_LINE || after.length > MAX_WORD_LINE) return plain();
  const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{N}_]+|[^\s\p{L}\p{N}_]/gu) ?? [];
  const left = tokenize(before);
  const right = tokenize(after);
  if (left.length > MAX_WORD_TOKENS || right.length > MAX_WORD_TOKENS) return plain();
  const width = right.length + 1;
  const grid = new Uint16Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--) {
    for (let j = right.length - 1; j >= 0; j--) {
      grid[i * width + j] = left[i] === right[j]
        ? grid[(i + 1) * width + j + 1] + 1
        : Math.max(grid[(i + 1) * width + j], grid[i * width + j + 1]);
    }
  }
  const oldChanged = left.map(() => true);
  const newChanged = right.map(() => true);
  let i = 0;
  let j = 0;
  while (i < left.length && j < right.length) {
    if (left[i] === right[j]) { oldChanged[i++] = false; newChanged[j++] = false; }
    else if (grid[(i + 1) * width + j] >= grid[i * width + j + 1]) i++;
    else j++;
  }
  const merge = (tokens: string[], flags: boolean[]): ReviewWordPart[] => {
    const parts: ReviewWordPart[] = [];
    tokens.forEach((text, index) => {
      const last = parts.at(-1);
      if (last?.changed === flags[index]) last.text += text;
      else parts.push({ text, changed: flags[index] });
    });
    return parts;
  };
  return { old: merge(left, oldChanged), new: merge(right, newChanged) };
}

/** Only real, displayed source lines are eligible for feedback. */
export function reviewSelection(rows: SplitDiffRow[], side: ReviewSide, start: number, end: number): { start: number; end: number; snippet: string } | null {
  const first = Math.min(start, end);
  const last = Math.max(start, end);
  if (!Number.isInteger(first) || first < 1 || last - first > 499) return null;
  const lines = new Map<number, string>();
  for (const row of rows) {
    if (row.type !== "line") continue;
    const cell = side === "old" ? row.left : row.right;
    if (cell.lineNo !== null && cell.lineNo >= first && cell.lineNo <= last) lines.set(cell.lineNo, cell.text);
  }
  const snippet: string[] = [];
  for (let line = first; line <= last; line++) {
    if (!lines.has(line)) return null;
    snippet.push(lines.get(line)!);
  }
  return { start: first, end: last, snippet: snippet.join("\n") };
}

export function formatReviewFeedback(input: {
  path: string;
  oldPath?: string;
  comparisonId: string;
  oldRevision: string;
  newRevision: string;
  side: ReviewSide;
  start: number;
  end: number;
  snippet: string;
  comment: string;
}): string {
  const runs = input.snippet.match(/`+/g) ?? [];
  const fence = "`".repeat(Math.max(3, ...runs.map((run) => run.length + 1)));
  const path = input.side === "old" ? input.oldPath ?? input.path : input.path;
  const range = input.start === input.end ? `${input.start}` : `${input.start}-${input.end}`;
  return [
    `Review feedback for ${JSON.stringify(path)} (${input.side} lines ${range})`,
    `Comparison: ${input.comparisonId}`,
    `Old revision: ${input.oldRevision}`,
    `New revision: ${input.newRevision}`,
    input.oldPath && input.oldPath !== input.path ? `Renamed: ${JSON.stringify(input.oldPath)} → ${JSON.stringify(input.path)}` : "",
    `${fence}\n${input.snippet}\n${fence}`,
    input.comment.trim(),
  ].filter(Boolean).join("\n\n");
}
