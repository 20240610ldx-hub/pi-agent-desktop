import { APP_PREF_KEYS, getPrefJson, setPrefJson } from "./app-prefs.ts";
import type { GitReviewContext, GitReviewScope } from "./git-review-types.ts";
import type { ReviewSelectionState } from "./git-review-display.ts";

/** View metadata only. Git patches and chat drafts never belong to this record. */
export interface ChangesViewState {
  version: 1;
  scope: GitReviewScope;
  /** Selection coordinates are valid only for this exact backend comparison. */
  comparisonId: string;
  base: string;
  commit: string;
  selectedPath: string;
  openPaths: string[];
  closedFolders: string[];
  contexts: Record<string, GitReviewContext>;
  showFiles: boolean;
  commitsOpen: boolean;
  groupFolders: boolean;
  separate: boolean;
  split: boolean;
  wrap: boolean;
  highlight: boolean;
  ignoreWhitespace: boolean;
  selection: ReviewSelectionState | null;
  feedback: string;
  scrollTop: number;
}

interface ChangesWindowView {
  id: string;
  cwd: string;
  targetId?: string;
  sessionId?: string;
  updatedAt: number;
  state: ChangesViewState;
}

const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const MAX_VIEWS = 8;
const MAX_STATE_BYTES = 96 * 1024;
const MAX_PATHS = 128;
const jsonBytes = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;
const isRecord = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const validText = (value: unknown, max: number): value is string => typeof value === "string" && value.length <= max && !/[\0\r\n]/.test(value);
const validPath = (value: unknown): value is string => validText(value, 4096) && Boolean(value) && !/^(?:[A-Za-z]:|[\\/])/.test(value) && !value.split(/[\\/]/).includes("..");
export const isChangesViewId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);

function pathCount(value: unknown): number {
  if (!isRecord(value)) return 0;
  return new Set([
    ...(Array.isArray(value.openPaths) ? value.openPaths : []),
    ...(Array.isArray(value.closedFolders) ? value.closedFolders : []),
    ...Object.keys(isRecord(value.contexts) ? value.contexts : {}),
    value.selectedPath, isRecord(value.selection) ? value.selection.path : undefined,
  ].filter(validPath)).size;
}

/** Whitelist unknown input, including localStorage written by an earlier version. */
export function normalizeChangesViewState(value: unknown): ChangesViewState {
  const source = isRecord(value) && value.version === 1 ? value : {};
  const paths = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter(validPath))].slice(0, MAX_PATHS) : [];
  const contexts: Record<string, GitReviewContext> = {};
  if (isRecord(source.contexts)) for (const [path, context] of Object.entries(source.contexts).slice(0, MAX_PATHS)) {
    if (validPath(path) && (context === 3 || context === 20 || context === "all")) Object.defineProperty(contexts, path, { value: context, enumerable: true });
  }
  const rawSelection = source.selection;
  let selection: ReviewSelectionState | null = null;
  if (isRecord(rawSelection) && validPath(rawSelection.path) && (rawSelection.side === "old" || rawSelection.side === "new")
    && Number.isSafeInteger(rawSelection.start) && Number.isSafeInteger(rawSelection.end)
    && (rawSelection.start as number) > 0 && (rawSelection.end as number) > 0
    && Math.max(rawSelection.start as number, rawSelection.end as number) <= 100_000_000
    && Math.abs((rawSelection.start as number) - (rawSelection.end as number)) < 500) {
    selection = { path: rawSelection.path, side: rawSelection.side, start: rawSelection.start as number, end: rawSelection.end as number };
    const anchor = rawSelection.inlineContextAnchor;
    if (isRecord(anchor) && Number.isSafeInteger(anchor.old) && Number.isSafeInteger(anchor.new) && (anchor.old as number) > 0 && (anchor.new as number) > 0) selection.inlineContextAnchor = { old: anchor.old as number, new: anchor.new as number };
  }
  const bool = (key: string, fallback: boolean) => typeof source[key] === "boolean" ? source[key] as boolean : fallback;
  return {
    version: 1,
    scope: source.scope === "uncommitted" || source.scope === "commit" ? source.scope : "all",
    comparisonId: validText(source.comparisonId, 256) ? source.comparisonId : "",
    base: validText(source.base, 1024) ? source.base : "",
    commit: typeof source.commit === "string" && /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/i.test(source.commit) ? source.commit : "",
    selectedPath: validPath(source.selectedPath) ? source.selectedPath : "",
    openPaths: paths(source.openPaths), closedFolders: paths(source.closedFolders), contexts,
    showFiles: bool("showFiles", true), commitsOpen: bool("commitsOpen", true),
    groupFolders: bool("groupFolders", true), separate: bool("separate", true),
    split: bool("split", false), wrap: bool("wrap", true), highlight: bool("highlight", true), ignoreWhitespace: bool("ignoreWhitespace", false),
    selection,
    feedback: typeof source.feedback === "string" ? source.feedback.slice(0, 16_384) : "",
    scrollTop: typeof source.scrollTop === "number" && Number.isFinite(source.scrollTop) ? Math.max(0, Math.min(10_000_000, source.scrollTop)) : 0,
  };
}

function records(now = Date.now()): ChangesWindowView[] {
  const stored = getPrefJson<unknown>(APP_PREF_KEYS.changesWindowViews);
  if (!Array.isArray(stored)) return [];
  return stored.filter((entry): entry is ChangesWindowView => isRecord(entry) && isChangesViewId(entry.id)
    && validText(entry.cwd, 32_768) && Boolean(entry.cwd.trim())
    && (entry.targetId === undefined || validText(entry.targetId, 256))
    && (entry.sessionId === undefined || validText(entry.sessionId, 256))
    && typeof entry.updatedAt === "number" && entry.updatedAt <= now + 1000 && entry.updatedAt > now - MAX_AGE_MS
    && isRecord(entry.state) && entry.state.version === 1 && pathCount(entry.state) <= MAX_PATHS && jsonBytes(entry) <= MAX_STATE_BYTES).slice(-MAX_VIEWS);
}

function boundedState(state: unknown): ChangesViewState {
  if (pathCount(state) > MAX_PATHS) throw new Error("This Changes view has too many paths to open in a new window.");
  const normalized = normalizeChangesViewState(state);
  if (jsonBytes(normalized) > MAX_STATE_BYTES) throw new Error("This Changes view has too much state to open in a new window.");
  return normalized;
}

/** Creating a view must fail honestly if private-mode/quota storage cannot hold it. */
export function createChangesWindowView({ cwd, targetId, sessionId, state }: { cwd: string; targetId?: string; sessionId?: string; state: unknown }): string {
  if (!validText(cwd, 32_768) || !cwd.trim() || (targetId !== undefined && !validText(targetId, 256)) || (sessionId !== undefined && (!validText(sessionId, 256) || !targetId))) throw new Error("Invalid Changes view owner.");
  const id = crypto.randomUUID();
  const entry: ChangesWindowView = { id, cwd, targetId, sessionId, updatedAt: Date.now(), state: boundedState(state) };
  if (jsonBytes(entry) > MAX_STATE_BYTES) throw new Error("This Changes view has too much state to open in a new window.");
  setPrefJson(APP_PREF_KEYS.changesWindowViews, [...records(), entry].slice(-MAX_VIEWS));
  if (!readChangesWindowView(id, cwd, targetId)) throw new Error("Cannot preserve this Changes view because local storage is unavailable.");
  return id;
}

export function readChangesWindowView(id: string, cwd: string, targetId?: string): ChangesWindowView | null {
  if (!isChangesViewId(id)) return null;
  const entry = records().find(view => view.id === id && view.cwd === cwd && view.targetId === targetId);
  return entry ? { ...entry, state: normalizeChangesViewState(entry.state) } : null;
}

export function updateChangesWindowView(id: string, cwd: string, targetId: string | undefined, state: unknown): void {
  const entry = readChangesWindowView(id, cwd, targetId);
  if (!entry) return;
  const updated = { ...entry, state: boundedState(state), updatedAt: Date.now() };
  if (jsonBytes(updated) > MAX_STATE_BYTES) throw new Error("This Changes view has too much state to open in a new window.");
  setPrefJson(APP_PREF_KEYS.changesWindowViews, [...records().filter(view => view.id !== id), updated]);
}
