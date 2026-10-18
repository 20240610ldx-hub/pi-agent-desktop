export type ReviewSide = "old" | "new";
export type ReviewFileGroup = "source" | "tests" | "generated";

export interface ReviewSelectionState {
  path: string;
  side: ReviewSide;
  start: number;
  end: number;
  inlineContextAnchor?: Record<ReviewSide, number>;
}

/** Inline context can anchor either revision; explicit split gutters never remap it. */
export function nextReviewSelection(
  current: ReviewSelectionState | null,
  { path, side, line, extend, inlineContextAnchor }: {
    path: string;
    side: ReviewSide;
    line: number;
    extend: boolean;
    inlineContextAnchor?: Record<ReviewSide, number>;
  },
  split: boolean,
): ReviewSelectionState {
  const start = current?.side === side ? current.start : !split ? current?.inlineContextAnchor?.[side] : undefined;
  return extend && current?.path === path && start !== undefined
    ? { ...current, side, start, end: line }
    : { path, side, start: line, end: line, ...(inlineContextAnchor ? { inlineContextAnchor } : {}) };
}

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
