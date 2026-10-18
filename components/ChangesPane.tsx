"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { WorkspaceControlButton } from "./WorkspacePaneControls";
import { useI18n } from "@/hooks/useI18n";
import { parseUnifiedPatch, type SplitDiffCell, type SplitDiffRow } from "@/lib/patch";
import { filterFileEntries } from "@/lib/file-fuzzy";
import { buildSearchTree, type SearchTreeNode } from "@/lib/search-tree";
import { formatReviewFeedback, inlineReviewRows, reviewFileGroup, reviewSelection, reviewWordParts, shortReviewRef, type ReviewSide } from "@/lib/git-review-display";
import type { GitReviewContext, GitReviewFile, GitReviewOptions, GitReviewPatch, GitReviewScope, GitReviewSnapshot } from "@/lib/git-review-types";

export interface ChangesPaneProps {
  cwd: string;
  visible: boolean;
  onAddFeedback: (text: string) => void | boolean | Promise<void | boolean>;
  onOpenWindow?: () => void;
  onExpand?: () => void;
  onClose?: () => void;
  expanded?: boolean;
  headerExtra?: ReactNode;
  headerDragProps?: HTMLAttributes<HTMLElement>;
}

const copy = {
  en: {
    changes: "Changes", showFiles: "Show files", find: "Go to file", settings: "Changes settings", openWindow: "Open in new window", expand: "Expand", restore: "Restore", close: "Close", all: "All changes", uncommitted: "Uncommitted changes", compare: "Compare against", commits: "Commits", branches: "Search branches", default: "default", group: "Group files by folder", separate: "Separate test, build, and generated files", collapseAll: "Collapse all files", expandAll: "Expand all files", split: "Side by side", wrap: "Word wrap", words: "Highlight changed words", whitespace: "Hide whitespace changes", refresh: "Refresh", large: "Files are collapsed for large diffs. Select a file to expand it.", largeExpand: "Expand all is unavailable for large diffs. Expand individual files to keep the review responsive.", finder: "Search changed files", more: "more files. Keep typing to narrow.", emptySearch: "No matching files", noBranches: "No matching branches", noCommits: "No commits in this comparison", loading: "Loading changes…", loadingPatch: "Loading diff…", empty: "No changes in this comparison", retry: "Try again", stale: "The repository changed. Refresh to review the current comparison.", binary: "Binary file. A text diff is unavailable.", tooLarge: "This file is too large to display.", metadata: "Only file metadata changed; there is no text diff.", noPatch: "No text changes to display.", truncated: "Some results were omitted because this comparison reached the review limit.", patchTruncated: "This diff is incomplete. Only the available lines are shown.", context: "Show more lines", fullContext: "Show all unchanged lines", unchanged: "unchanged lines", feedback: "Add feedback", feedbackHint: "Describe the change you want on these lines…", addDraft: "Add to draft", cancel: "Cancel", selectedLines: "Selected lines", old: "Old", new: "New", source: "Source files", tests: "Test files", generated: "Build and generated files", back: "Back", files: "files", statusAdded: "Added", statusModified: "Modified", statusDeleted: "Deleted", statusRenamed: "Renamed", statusCopied: "Copied", statusUntracked: "Untracked", statusConflict: "Conflict", statusTypechange: "File type changed", selectionGap: "Select up to 500 consecutive displayed lines on one side.", feedbackAdded: "Feedback added to draft", feedbackFailed: "Feedback could not be added. Your text is kept here so you can try again.", sendingFeedback: "Adding to draft…", workingTree: "Working tree", expandFile: "Expand file", collapseFile: "Collapse file",
  },
  "zh-CN": {
    changes: "更改", showFiles: "显示文件", find: "转到文件", settings: "更改设置", openWindow: "在新窗口中打开", expand: "展开", restore: "还原", close: "关闭", all: "所有更改", uncommitted: "未提交的更改", compare: "比较分支", commits: "提交", branches: "搜索分支", default: "默认", group: "按文件夹分组", separate: "分开显示测试、构建和生成的文件", collapseAll: "折叠所有文件", expandAll: "展开所有文件", split: "并排显示", wrap: "自动换行", words: "突出显示更改的单词", whitespace: "隐藏空白更改", refresh: "刷新", large: "大型差异的文件已折叠。选择文件以展开。", largeExpand: "大型差异无法一次展开所有文件。请逐个展开文件以保持流畅。", finder: "搜索更改的文件", more: "个其他文件。继续输入以缩小范围。", emptySearch: "没有匹配的文件", noBranches: "没有匹配的分支", noCommits: "此比较中没有提交", loading: "正在加载更改…", loadingPatch: "正在加载差异…", empty: "此比较中没有更改", retry: "重试", stale: "仓库已更改。请刷新以查看当前比较。", binary: "二进制文件，无法显示文本差异。", tooLarge: "此文件过大，无法显示。", metadata: "仅文件元数据发生更改，没有文本差异。", noPatch: "没有可显示的文本更改。", truncated: "此比较已达到查看上限，部分结果已省略。", patchTruncated: "此差异不完整，仅显示可用行。", context: "显示更多行", fullContext: "显示所有未更改的行", unchanged: "行未更改", feedback: "添加反馈", feedbackHint: "描述你希望对这些行进行的更改…", addDraft: "添加到草稿", cancel: "取消", selectedLines: "所选行", old: "旧版本", new: "新版本", source: "源文件", tests: "测试文件", generated: "构建和生成的文件", back: "返回", files: "个文件", statusAdded: "已添加", statusModified: "已修改", statusDeleted: "已删除", statusRenamed: "已重命名", statusCopied: "已复制", statusUntracked: "未跟踪", statusConflict: "冲突", statusTypechange: "文件类型已更改", selectionGap: "请选择同一侧已显示的连续行，最多 500 行。", feedbackAdded: "反馈已添加到草稿", feedbackFailed: "无法添加反馈。文本已保留，你可以重试。", sendingFeedback: "正在添加到草稿…", workingTree: "工作区", expandFile: "展开文件", collapseFile: "折叠文件",
  },
  "zh-TW": {
    changes: "變更", showFiles: "顯示檔案", find: "前往檔案", settings: "變更設定", openWindow: "在新視窗中開啟", expand: "展開", restore: "還原", close: "關閉", all: "所有變更", uncommitted: "未提交的變更", compare: "比較分支", commits: "提交", branches: "搜尋分支", default: "預設", group: "依資料夾分組", separate: "分開顯示測試、建置與產生的檔案", collapseAll: "摺疊所有檔案", expandAll: "展開所有檔案", split: "並排顯示", wrap: "自動換行", words: "醒目顯示變更的單字", whitespace: "隱藏空白變更", refresh: "重新整理", large: "大型差異的檔案已摺疊。選擇檔案以展開。", largeExpand: "大型差異無法一次展開所有檔案。請逐一展開檔案以保持流暢。", finder: "搜尋變更的檔案", more: "個其他檔案。繼續輸入以縮小範圍。", emptySearch: "沒有符合的檔案", noBranches: "沒有符合的分支", noCommits: "此比較中沒有提交", loading: "正在載入變更…", loadingPatch: "正在載入差異…", empty: "此比較中沒有變更", retry: "重試", stale: "儲存庫已變更。請重新整理以檢視目前的比較。", binary: "二進位檔案，無法顯示文字差異。", tooLarge: "此檔案過大，無法顯示。", metadata: "僅檔案中繼資料變更，沒有文字差異。", noPatch: "沒有可顯示的文字變更。", truncated: "此比較已達到檢視上限，部分結果已省略。", patchTruncated: "此差異不完整，僅顯示可用行。", context: "顯示更多行", fullContext: "顯示所有未變更的行", unchanged: "行未變更", feedback: "新增回饋", feedbackHint: "描述你希望對這些行進行的變更…", addDraft: "加入草稿", cancel: "取消", selectedLines: "所選行", old: "舊版本", new: "新版本", source: "原始檔", tests: "測試檔案", generated: "建置與產生的檔案", back: "返回", files: "個檔案", statusAdded: "已新增", statusModified: "已修改", statusDeleted: "已刪除", statusRenamed: "已重新命名", statusCopied: "已複製", statusUntracked: "未追蹤", statusConflict: "衝突", statusTypechange: "檔案類型已變更", selectionGap: "請選擇同一側已顯示的連續行，最多 500 行。", feedbackAdded: "回饋已加入草稿", feedbackFailed: "無法加入回饋。文字已保留，你可以重試。", sendingFeedback: "正在加入草稿…", workingTree: "工作區", expandFile: "展開檔案", collapseFile: "摺疊檔案",
  },
};
type Words = typeof copy.en;
type MenuName = "comparison" | "settings" | "finder";
type Selection = { path: string; side: ReviewSide; start: number; end: number };
type PatchState = { state: "loading" } | { state: "ready"; data: GitReviewPatch } | { state: "error"; message: string; stale?: boolean };

function Icon({ name, size }: { name: string; size?: number }) {
  // Header glyphs have individually measured painted bounds; their button boxes
  // stay 28.8px. Explicit sizes on tree rows, gutters and menus remain unchanged.
  const headerSizes: Record<string, number> = { tree: 18, search: 20, more: 18.5, window: 20, expand: 20, close: 15 };
  const glyphSize = size ?? headerSizes[name] ?? 16;
  const paths: Record<string, ReactNode> = {
    tree: <><path d="M9 5h11M9 12h11M9 19h11" /><path d="M3 5h.01M3 12h.01M3 19h.01" strokeWidth="3" /></>,
    search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 4.5 4.5" /></>,
    more: <><circle cx="12" cy="5.7" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="18.3" r="1" /></>,
    window: <><rect x="8" y="4.7" width="13" height="10.4" rx="1.5" /><path d="M16 8.7H3v10.6h13V8.7" /></>,
    expand: <><path d="M14 4.2h7v6M21 4.2l-8 7M10 19.8H3v-6m0 6 8-7" /></>,
    restore: <><path d="M21 10h-7V3m0 7 7-7M3 14h7v7m0-7-7 7" /></>,
    close: <path d="m5 5 14 14M19 5 5 19" />,
    down: <path d="m6 9 6 6 6-6" />,
    right: <path d="m9 6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    code: <><path d="m7 8-4 4 4 4m10-8 4 4-4 4M14 5l-4 14" /></>,
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    plus: <path d="M12 5v14M5 12h14" />,
  };
  return <svg width={glyphSize} height={glyphSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name]}</svg>;
}

function Counts({ file }: { file: { additions: number; deletions: number } }) {
  return <span className="changes-counts"><span className="changes-added">+{file.additions}</span><span className="changes-removed">−{file.deletions}</span></span>;
}

function reviewUrl(options: GitReviewOptions): string {
  const params = new URLSearchParams({ cwd: options.cwd, scope: options.scope ?? "all" });
  if (options.base) params.set("base", options.base);
  if (options.commit) params.set("commit", options.commit);
  if (options.path) params.set("path", options.path);
  if (options.ignoreWhitespace) params.set("ignoreWhitespace", "1");
  if (options.context) params.set("context", String(options.context));
  return `/api/git/review?${params}`;
}

async function readReview<T extends { error?: string }>(options: GitReviewOptions, signal: AbortSignal): Promise<T> {
  const response = await fetch(reviewUrl(options), { signal, cache: "no-store" });
  const data = await response.json() as T;
  if (!response.ok || data.error) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

/** No polling. Hidden panes abort all requests; reopening takes one fresh snapshot. */
function useReview(cwd: string, visible: boolean, scope: GitReviewScope, base: string, commit: string, ignoreWhitespace: boolean, refresh: number) {
  const key = JSON.stringify([cwd, scope, base, commit, ignoreWhitespace, refresh]);
  const [result, setResult] = useState<{ key: string; snapshot?: GitReviewSnapshot; error?: string }>({ key: "" });
  useEffect(() => {
    if (!visible || !cwd) return;
    const controller = new AbortController();
    let current = true;
    void readReview<GitReviewSnapshot>({ cwd, scope, base, commit: scope === "commit" ? commit : undefined, ignoreWhitespace }, controller.signal)
      .then((snapshot) => { if (current) setResult({ key, snapshot }); })
      .catch((error: unknown) => { if (current && !controller.signal.aborted) setResult({ key, error: error instanceof Error ? error.message : String(error) }); });
    return () => { current = false; controller.abort(); };
  }, [cwd, visible, scope, base, commit, ignoreWhitespace, key]);
  return { snapshot: result.key === key ? result.snapshot : undefined, error: result.key === key ? result.error : undefined };
}

function useLazyPatches(snapshot: GitReviewSnapshot | undefined, options: GitReviewOptions, visible: boolean, open: Set<string>, contexts: Record<string, GitReviewContext>, refresh: number) {
  const cache = useRef(new Map<string, PatchState>());
  const controllers = useRef(new Map<string, AbortController>());
  const generation = useRef(0);
  const [revision, bump] = useState(0);
  const { cwd, scope, base, commit, ignoreWhitespace } = options;
  const identity = `${cwd}\0${snapshot?.comparisonId ?? ""}\0${ignoreWhitespace}\0${refresh}`;
  const activeIdentity = useRef("");
  const keyFor = (path: string) => `${identity}\0${path}\0${contexts[path] ?? 3}`;
  useEffect(() => {
    ++generation.current;
    const pending = controllers.current;
    pending.forEach((controller) => controller.abort());
    pending.clear();
    cache.current.clear();
    activeIdentity.current = identity;
    return () => {
      // Each setup invalidates every prior generation before starting work.
      pending.forEach((controller) => controller.abort());
      pending.clear();
    };
  }, [identity, visible]);
  useEffect(() => {
    if (!visible || !snapshot || activeIdentity.current !== identity) return;
    const version = generation.current;
    // Drop cached patches for closed files once the cache reaches 48 entries.
    // Open files stay cached so expanding a list never evicts its own pending work.
    if (cache.current.size > 48) {
      for (const [key, value] of cache.current) {
        if (value.state !== "loading" && ![...open].some((path) => key === keyFor(path))) cache.current.delete(key);
        if (cache.current.size <= 48) break;
      }
    }
    for (const path of open) {
      if (controllers.current.size >= 3) break;
      const key = keyFor(path);
      if (cache.current.has(key)) continue;
      const controller = new AbortController();
      controllers.current.set(key, controller);
      cache.current.set(key, { state: "loading" });
      void readReview<GitReviewPatch>({ cwd, scope, base, commit, ignoreWhitespace, path, context: contexts[path] ?? 3 }, controller.signal)
        .then((data) => {
          if (generation.current !== version || controller.signal.aborted) return;
          cache.current.set(key, data.comparisonId === snapshot.comparisonId && data.path === path
            ? { state: "ready", data }
            : { state: "error", message: "", stale: true });
        })
        .catch((error: unknown) => {
          if (generation.current === version && !controller.signal.aborted) cache.current.set(key, { state: "error", message: error instanceof Error ? error.message : String(error) });
        })
        .finally(() => {
          if (generation.current !== version) return;
          controllers.current.delete(key);
          bump((value) => value + 1);
        });
    }
  // revision drains the queue when a request settles. Options are primitives, not an unstable object.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, visible, snapshot, cwd, scope, base, commit, ignoreWhitespace, open, contexts, revision]);
  return {
    get: (path: string): PatchState | undefined => activeIdentity.current === identity ? cache.current.get(keyFor(path)) : undefined,
    retry: (path: string) => { cache.current.delete(keyFor(path)); bump((value) => value + 1); },
  };
}

/** Adapted from useClaudeRovingFocus: one tab stop, arrows/Home/End, Tab exits. */
function rove(event: KeyboardEvent<HTMLElement>) {
  if (event.nativeEvent.isComposing || event.keyCode === 229 || !["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[data-roving]:not(:disabled)")];
  if (!items.length) return;
  const index = items.indexOf(document.activeElement as HTMLElement);
  if (index < 0) return;
  const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)));
  event.preventDefault();
  event.stopPropagation();
  items.forEach((item, i) => { item.tabIndex = i === next ? 0 : -1; });
  items[next].focus({ preventScroll: true });
  items[next].scrollIntoView({ block: "nearest" });
}

/** ScrollFadeContainer's two-pixel edge detector, also observes changing content. */
function FadedScroll({ children, className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => {
      element.style.setProperty("--changes-fade-top", element.scrollTop > 2 ? "16px" : "0px");
      element.style.setProperty("--changes-fade-bottom", element.scrollTop + element.clientHeight < element.scrollHeight - 2 ? "16px" : "0px");
    };
    update();
    element.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    if (element.firstElementChild) observer.observe(element.firstElementChild);
    return () => { element.removeEventListener("scroll", update); observer.disconnect(); };
  }, [children]);
  return <div {...props} ref={ref} className={`changes-faded-scroll ${className}`}>{children}</div>;
}

function Popover({ anchor, width, label, onClose, children, role = "menu" }: { anchor: RefObject<HTMLButtonElement | null>; width: number; label: string; onClose: (restore?: boolean) => void; children: ReactNode; role?: "menu" | "dialog" }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<CSSProperties>({ visibility: "hidden" });
  useEffect(() => {
    const update = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      const actualWidth = Math.min(width, Math.max(180, window.innerWidth - 16));
      const height = Math.min(ref.current?.scrollHeight ?? 400, 560, window.innerHeight - 16);
      const below = window.innerHeight - rect.bottom - 8;
      const top = below >= Math.min(height, 220) ? rect.bottom + 6 : Math.max(8, rect.top - height - 6);
      setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - actualWidth - 8)), top, width: actualWidth, maxHeight: Math.max(80, window.innerHeight - top - 8) });
    };
    update();
    const frame = requestAnimationFrame(() => { update(); ref.current?.querySelector<HTMLElement>("input, [data-roving]:not(:disabled)")?.focus({ preventScroll: true }); });
    const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose(false); };
    const focusOut = (event: FocusEvent) => { if (!ref.current?.contains(event.target as Node) && !anchor.current?.contains(event.target as Node)) onClose(false); };
    window.addEventListener("resize", update);
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", focusOut);
    return () => { cancelAnimationFrame(frame); window.removeEventListener("resize", update); document.removeEventListener("pointerdown", outside, true); document.removeEventListener("focusin", focusOut); };
  }, [anchor, onClose, width]);
  return createPortal(<div ref={ref} className="changes-popover" style={position} role={role} aria-label={label} onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onClose(); }
    else rove(event);
  }}>{children}</div>, document.body);
}

function MenuItem({ children, checked, disabled, onClick, hint, title }: { children: ReactNode; checked?: boolean; disabled?: boolean; onClick: () => void; hint?: ReactNode; title?: string }) {
  return <button type="button" role={checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={checked} disabled={disabled} className="changes-menu-item" data-roving tabIndex={-1} title={title} onClick={onClick}><span>{children}</span>{hint && <span className="changes-menu-hint">{hint}</span>}{checked && <Icon name="check" />}</button>;
}

function FileLabel({ file }: { file: GitReviewFile }) {
  const parts = file.path.split("/");
  const name = parts.pop();
  return <><Icon name="code" size={13} /><span className="changes-file-name">{name}</span>{parts.length > 0 && <span className="changes-file-directory">{parts.join("/")}</span>}</>;
}

export function ChangesPane({ cwd, visible, onAddFeedback, onOpenWindow, onExpand, onClose, expanded, headerExtra, headerDragProps }: ChangesPaneProps) {
  const { locale } = useI18n();
  const words = copy[locale as keyof typeof copy] ?? copy.en;
  const [scope, setScope] = useState<GitReviewScope>("all");
  const [base, setBase] = useState("");
  const [commit, setCommit] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [showFiles, setShowFiles] = useState(true);
  const [groupFolders, setGroupFolders] = useState(true);
  const [separate, setSeparate] = useState(true);
  const [split, setSplit] = useState(false);
  const [wrap, setWrap] = useState(true);
  const [highlight, setHighlight] = useState(true);
  const [ignoreWhitespace, setIgnoreWhitespace] = useState(false);
  const [open, setOpen] = useState(new Set<string>());
  const [contexts, setContexts] = useState<Record<string, GitReviewContext>>({});
  const [selectedPath, setSelectedPath] = useState("");
  const [menu, setMenu] = useState<MenuName | null>(null);
  const [submenu, setSubmenu] = useState<"branches" | "commits" | null>(null);
  const [query, setQuery] = useState("");
  const [finderIndex, setFinderIndex] = useState(0);
  const [commitsOpen, setCommitsOpen] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [feedback, setFeedback] = useState("");
  const [feedbackPending, setFeedbackPending] = useState(false);
  const feedbackPendingRef = useRef(false);
  const feedbackGeneration = useRef(0);
  const [notice, setNotice] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const sections = useRef(new Map<string, HTMLElement>());
  const comparisonButton = useRef<HTMLButtonElement>(null);
  const settingsButton = useRef<HTMLButtonElement>(null);
  const finderButton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const { snapshot, error } = useReview(cwd, visible, scope, base, commit, ignoreWhitespace, refresh);
  const patches = useLazyPatches(snapshot, { cwd, scope, base, commit: scope === "commit" ? commit : undefined, ignoreWhitespace }, visible, open, contexts, refresh);
  const files = useMemo(() => snapshot?.files ?? [], [snapshot]);
  const fileMap = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  const fileGroups = useMemo(() => {
    const groups = separate ? ["source", "tests", "generated"] as const : ["source"] as const;
    return groups.map((group) => ({ group, files: separate ? files.filter((file) => reviewFileGroup(file.path) === group) : files })).filter((group) => group.files.length);
  }, [files, separate]);
  const orderedFiles = useMemo(() => fileGroups.flatMap((group) => group.files), [fileGroups]);
  const finderFiles = useMemo(() => filterFileEntries(files.map((file) => ({ path: file.path, isDir: false })), query, 100_000), [files, query]);
  const visibleFinderFiles = finderFiles.slice(0, 12);
  const snapshotIdentity = `${cwd}\0${snapshot?.comparisonId ?? ""}`;

  useEffect(() => {
    feedbackGeneration.current++;
    setOpen(new Set(snapshot && !snapshot.large ? snapshot.files.slice(0, 8).map((file) => file.path) : []));
    setContexts({});
    setSelection(null);
    setSelectedPath("");
    setNotice("");
    scroller.current?.scrollTo({ top: 0 });
  // A new comparison resets selections; view preference changes do not.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshotIdentity]);
  useEffect(() => { setBase(""); setCommit(""); setScope("all"); setMenu(null); }, [cwd]);
  useEffect(() => {
    const token = feedbackGeneration;
    if (!visible) { token.current++; setMenu(null); setSelection(null); }
    return () => { token.current++; };
  }, [visible]);

  const anchorFor = useCallback((name: MenuName) => name === "comparison" ? comparisonButton : name === "settings" ? settingsButton : finderButton, []);
  const closeMenu = useCallback((restore = true) => {
    if (restore && menu) anchorFor(menu).current?.focus({ preventScroll: true });
    setMenu(null);
    setSubmenu(null);
    setQuery("");
  }, [anchorFor, menu]);
  const openMenu = (name: MenuName) => { setMenu((value) => value === name ? null : name); setSubmenu(null); setQuery(""); setFinderIndex(0); };
  const changeScope = (next: GitReviewScope, oid = "") => { setScope(next); setCommit(oid); closeMenu(); };
  const selectFile = (path: string) => {
    setOpen((current) => new Set(current).add(path));
    setSelectedPath(path);
    closeMenu(false);
    requestAnimationFrame(() => { sections.current.get(path)?.scrollIntoView({ block: "start" }); sections.current.get(path)?.querySelector<HTMLElement>(".changes-file-toggle")?.focus({ preventScroll: true }); });
  };
  const toggleFile = (path: string) => setOpen((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; });
  const selectLine = (file: GitReviewFile, side: ReviewSide, line: number, extend: boolean) => {
    feedbackGeneration.current++;
    const next = extend && selection?.path === file.path && selection.side === side ? { ...selection, end: line } : { path: file.path, side, start: line, end: line };
    setSelection(next); setFeedback(""); setNotice("");
  };
  const statusLabel = (file: GitReviewFile) => words[({ added: "statusAdded", modified: "statusModified", deleted: "statusDeleted", renamed: "statusRenamed", copied: "statusCopied", untracked: "statusUntracked", conflict: "statusConflict", typechange: "statusTypechange" } as const)[file.status]];
  const oldRevision = scope === "uncommitted" ? snapshot?.headOid ?? "HEAD" : snapshot?.baseOid ?? "";
  const newRevision = scope === "commit" ? commit : `${words.workingTree} (HEAD ${snapshot?.headOid ?? ""})`;
  const comparisonLabel = scope === "commit" ? snapshot?.commits.find((item) => item.oid === commit)?.subject ?? commit.slice(0, 8) : scope === "uncommitted" ? words.uncommitted : shortReviewRef(snapshot?.baseRef || base) || words.all;
  const branchLabel = snapshot?.currentBranch || snapshot?.headOid.slice(0, 8) || "";

  const submitFeedback = async (rows: SplitDiffRow[]) => {
    if (!selection || !snapshot || !feedback.trim() || feedbackPendingRef.current) return;
    const file = fileMap.get(selection.path);
    const selected = reviewSelection(rows, selection.side, selection.start, selection.end);
    if (!file || !selected) { setNotice(words.selectionGap); return; }
    const version = feedbackGeneration.current;
    feedbackPendingRef.current = true;
    setFeedbackPending(true);
    try {
      const accepted = await onAddFeedback(formatReviewFeedback({ ...selected, path: file.path, oldPath: file.oldPath, comparisonId: snapshot.comparisonId, oldRevision, newRevision, side: selection.side, comment: feedback }));
      if (feedbackGeneration.current !== version) return;
      if (accepted === false) { setNotice(words.feedbackFailed); return; }
      setSelection(null); setFeedback(""); setNotice(words.feedbackAdded);
    } catch {
      if (feedbackGeneration.current === version) setNotice(words.feedbackFailed);
    } finally {
      feedbackPendingRef.current = false;
      setFeedbackPending(false);
    }
  };

  const headerButton = (name: string, label: string, onClick: () => void, ref?: RefObject<HTMLButtonElement | null>, pressed?: boolean, shortcut?: string) => <WorkspaceControlButton triggerRef={ref} placement="top" tooltipGap={4.8} label={label} shortcut={shortcut} className={`changes-icon-button${pressed ? " is-active" : ""}`} aria-pressed={pressed} aria-haspopup={ref ? "menu" : undefined} aria-expanded={ref ? menu === (ref === comparisonButton ? "comparison" : ref === finderButton ? "finder" : "settings") : undefined} onClick={onClick}><Icon name={name} /></WorkspaceControlButton>;

  if (!visible) return null;
  return <div ref={root} className="changes-pane" data-show-files={showFiles || undefined} tabIndex={-1} aria-label={words.changes} onKeyDown={(event) => {
    if (event.nativeEvent.isComposing || event.keyCode === 229 || event.altKey || !(event.ctrlKey || event.metaKey)) return;
    const target = event.target as HTMLElement;
    // Shortcuts belong to pane chrome. Embedded editors and feedback inputs keep their keys.
    if (target.closest("input, textarea, [contenteditable=true]")) return;
    if (!event.shiftKey && event.key.toLowerCase() === "p") { event.preventDefault(); event.stopPropagation(); openMenu("finder"); }
    if (event.shiftKey && event.key.toLowerCase() === "y") { event.preventDefault(); event.stopPropagation(); setShowFiles((value) => !value); }
  }}>
    <header {...headerDragProps} className={`changes-header changes-pane-header ${headerDragProps?.className ?? ""}`}>
      {headerButton("tree", words.showFiles, () => setShowFiles((value) => !value), undefined, showFiles, "Ctrl+Shift+Y")}
      <button ref={comparisonButton} type="button" className="changes-comparison-button" aria-haspopup="menu" aria-expanded={menu === "comparison"} title={scope === "all" ? `${comparisonLabel} → ${branchLabel}` : comparisonLabel} onClick={() => openMenu("comparison")}><span>{comparisonLabel}</span>{scope === "all" && branchLabel && <><Icon name="arrow" size={13} /><span>{branchLabel}</span></>}<Icon name="down" size={12} /></button>
      <div className="changes-header-actions">
        {headerButton("search", words.find, () => openMenu("finder"), finderButton, menu === "finder", "Ctrl+P")}
        {headerButton("more", words.settings, () => openMenu("settings"), settingsButton, menu === "settings")}
        {onOpenWindow && headerButton("window", words.openWindow, onOpenWindow)}
        {onExpand && headerButton(expanded ? "restore" : "expand", expanded ? words.restore : words.expand, onExpand)}
        {onClose && headerButton("close", words.close, onClose)}
        {headerExtra}
      </div>
    </header>
    <div className="changes-body">
      {showFiles && <aside className="changes-sidebar" aria-label={words.showFiles}>
        <FadedScroll className="changes-tree-scroll" onKeyDown={rove}><div>
          {fileGroups.map(({ group, files: grouped }) => <div key={group} className="changes-tree-group">{separate && group !== "source" && <div className="changes-group-label">{words[group]}</div>}<ReviewTree files={grouped} grouped={groupFolders} selected={selectedPath} onSelect={selectFile} statusLabel={statusLabel} /></div>)}
        </div></FadedScroll>
        <div className="changes-commits">
          <button type="button" className="changes-commits-heading" aria-expanded={commitsOpen} onClick={() => setCommitsOpen((value) => !value)}><Icon name={commitsOpen ? "down" : "right"} size={13} /><span>{words.commits}</span><span>{snapshot?.commits.length ?? 0}</span></button>
          {commitsOpen && <FadedScroll className="changes-commit-scroll" onKeyDown={rove}><div>
            <button type="button" data-roving tabIndex={0} className={`changes-commit-row${scope === "all" ? " is-selected" : ""}`} onClick={() => changeScope("all")}>{words.all}</button>
            <button type="button" data-roving tabIndex={-1} className={`changes-commit-row${scope === "uncommitted" ? " is-selected" : ""}`} onClick={() => changeScope("uncommitted")}>{words.uncommitted}</button>
            {snapshot?.commits.map((item) => <button key={item.oid} type="button" data-roving tabIndex={-1} className={`changes-commit-row${scope === "commit" && commit === item.oid ? " is-selected" : ""}`} title={`${item.subject}\n${item.oid}\n${item.authorName} · ${item.authoredAt}`} onClick={() => changeScope("commit", item.oid)}><span>{item.subject}</span><small>{item.oid.slice(0, 7)} · {item.authorName}</small></button>)}
          </div></FadedScroll>}
        </div>
      </aside>}
      <div ref={scroller} className="changes-diff-scroll" aria-busy={!snapshot && !error}>
        {!snapshot && !error && <div className="changes-state" role="status">{words.loading}</div>}
        {error && <div className="changes-state is-error" role="alert"><span>{error}</span><button type="button" onClick={() => setRefresh((value) => value + 1)}>{words.retry}</button></div>}
        {snapshot && <>
          {snapshot.large && <div className="changes-large-hint">{words.large}</div>}
          {snapshot.truncated && <div className="changes-notice">{words.truncated}</div>}
          {!files.length && <div className="changes-state">{words.empty}</div>}
          {orderedFiles.map((file) => {
            const state = patches.get(file.path);
            const isOpen = open.has(file.path);
            return <section key={`${snapshot.comparisonId}:${file.path}`} ref={(element) => { if (element) sections.current.set(file.path, element); else sections.current.delete(file.path); }} className={`changes-file${selectedPath === file.path ? " is-selected" : ""}`} aria-label={file.path}>
              <button type="button" className="changes-file-toggle" aria-expanded={isOpen} title={`${isOpen ? words.collapseFile : words.expandFile}: ${file.path}${file.oldPath ? ` (${file.oldPath})` : ""}`} onClick={() => toggleFile(file.path)}><Icon name={isOpen ? "down" : "right"} size={14} /><FileLabel file={file} /><span className="changes-file-status" title={statusLabel(file)}>{file.status === "conflict" ? "!" : file.status === "renamed" ? "R" : file.status === "deleted" ? "D" : ""}</span><Counts file={file} /></button>
              {isOpen && <div className="changes-file-content">
                {(!state || state.state === "loading") && <div className="changes-file-state" role="status">{words.loadingPatch}</div>}
                {state?.state === "error" && <div className="changes-file-state is-error" role="alert"><span>{state.stale ? words.stale : state.message}</span><button type="button" onClick={() => state.stale ? setRefresh((value) => value + 1) : patches.retry(file.path)}>{state.stale ? words.refresh : words.retry}</button></div>}
                {state?.state === "ready" && <ReviewDiff file={file} data={state.data} words={words} split={split} wrap={wrap} highlight={highlight} context={contexts[file.path] ?? 3} onMore={() => setContexts((current) => ({ ...current, [file.path]: current[file.path] === 20 ? "all" : 20 }))} selection={selection?.path === file.path ? selection : null} onSelectLine={(side, line, extend) => selectLine(file, side, line, extend)} feedback={feedback} pending={feedbackPending} setFeedback={setFeedback} onCancel={() => { feedbackGeneration.current++; setSelection(null); setFeedback(""); }} onSubmit={submitFeedback} />}
              </div>}
            </section>;
          })}
        </>}
      </div>
    </div>
    {notice && <div className="changes-announcement" role="status">{notice}<button type="button" aria-label={words.close} onClick={() => setNotice("")}><Icon name="close" size={12} /></button></div>}
    {menu === "settings" && <Popover anchor={settingsButton} width={352} label={words.settings} onClose={closeMenu}>
      <MenuItem checked={showFiles} hint={<kbd>Ctrl+Shift+Y</kbd>} onClick={() => { setShowFiles((value) => !value); closeMenu(); }}>{words.showFiles}</MenuItem>
      <MenuItem checked={groupFolders} onClick={() => { setGroupFolders((value) => !value); closeMenu(); }}>{words.group}</MenuItem>
      <MenuItem checked={separate} onClick={() => { setSeparate((value) => !value); closeMenu(); }}>{words.separate}</MenuItem>
      <div className="changes-menu-separator" />
      <MenuItem onClick={() => { setOpen(new Set()); setSelection(null); closeMenu(); }}>{words.collapseAll}</MenuItem>
      <MenuItem disabled={!snapshot || snapshot.large} title={snapshot?.large ? words.largeExpand : undefined} onClick={() => { if (!snapshot?.large) setOpen(new Set(files.map((file) => file.path))); closeMenu(); }}>{words.expandAll}</MenuItem>
      {snapshot?.large && <p className="changes-menu-explanation">{words.largeExpand}</p>}
      <div className="changes-menu-separator" />
      <MenuItem checked={split} onClick={() => { setSplit((value) => !value); closeMenu(); }}>{words.split}</MenuItem>
      <MenuItem checked={wrap} onClick={() => { setWrap((value) => !value); closeMenu(); }}>{words.wrap}</MenuItem>
      <MenuItem checked={highlight} onClick={() => { setHighlight((value) => !value); closeMenu(); }}>{words.words}</MenuItem>
      <MenuItem checked={ignoreWhitespace} onClick={() => { setIgnoreWhitespace((value) => !value); closeMenu(); }}>{words.whitespace}</MenuItem>
      <div className="changes-menu-separator" />
      <MenuItem onClick={() => { setRefresh((value) => value + 1); closeMenu(); }}>{words.refresh}</MenuItem>
    </Popover>}
    {menu === "comparison" && <Popover anchor={comparisonButton} width={submenu ? 340 : 282} label={words.compare} onClose={closeMenu}>
      {!submenu ? <>
        <MenuItem checked={scope === "all"} hint={shortReviewRef(snapshot?.baseRef || base)} onClick={() => changeScope("all")}>{words.all}</MenuItem>
        <MenuItem checked={scope === "uncommitted"} onClick={() => changeScope("uncommitted")}>{words.uncommitted}</MenuItem>
        <div className="changes-menu-separator" />
        <MenuItem hint={<><span>{shortReviewRef(snapshot?.baseRef || base)}</span><Icon name="right" size={13} /></>} onClick={() => { setSubmenu("branches"); setQuery(""); }}>{words.compare}</MenuItem>
        <MenuItem hint={<>{snapshot?.commits.length ?? 0}<Icon name="right" size={13} /></>} onClick={() => { setSubmenu("commits"); setQuery(""); }}>{words.commits}</MenuItem>
      </> : <>
        <button type="button" className="changes-submenu-back" onClick={() => { setSubmenu(null); setQuery(""); }}><Icon name="right" size={12} />{words.back}</button>
        <input autoFocus className="changes-search-input" aria-label={submenu === "branches" ? words.branches : words.commits} placeholder={submenu === "branches" ? words.branches : words.commits} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.keyCode === 229) return;
          if (event.key === "ArrowDown") { event.preventDefault(); event.currentTarget.parentElement?.querySelector<HTMLElement>("[data-roving]")?.focus(); }
        }} />
        <FadedScroll className="changes-menu-list">
          <div>{submenu === "branches" ? <>
            {snapshot?.refs.filter((item) => shortReviewRef(item.name).toLowerCase().includes(query.toLowerCase())).map((item) => <MenuItem key={item.name} checked={(base || snapshot.baseRef) === item.name} hint={item.isDefault ? words.default : undefined} onClick={() => { setBase(item.name); setScope("all"); closeMenu(); }}>{shortReviewRef(item.name)}</MenuItem>)}
            {!snapshot?.refs.some((item) => shortReviewRef(item.name).toLowerCase().includes(query.toLowerCase())) && <p className="changes-file-state">{words.noBranches}</p>}
          </> : <>
            {snapshot?.commits.filter((item) => `${item.subject} ${item.oid} ${item.authorName}`.toLowerCase().includes(query.toLowerCase())).map((item) => <MenuItem key={item.oid} checked={commit === item.oid && scope === "commit"} hint={item.oid.slice(0, 7)} onClick={() => changeScope("commit", item.oid)}>{item.subject}</MenuItem>)}
            {!snapshot?.commits.some((item) => `${item.subject} ${item.oid} ${item.authorName}`.toLowerCase().includes(query.toLowerCase())) && <p className="changes-file-state">{words.noCommits}</p>}
          </>}</div>
        </FadedScroll>
      </>}
    </Popover>}
    {menu === "finder" && <Popover anchor={finderButton} width={424} label={words.finder} role="dialog" onClose={closeMenu}>
      <input className="changes-search-input" role="combobox" aria-label={words.finder} aria-expanded="true" aria-controls={`${id}-finder`} aria-activedescendant={visibleFinderFiles[finderIndex] ? `${id}-file-${finderIndex}` : undefined} placeholder={words.finder} value={query} onChange={(event) => { setQuery(event.target.value); setFinderIndex(0); }} onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || event.keyCode === 229) return;
        if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setFinderIndex((value) => Math.max(0, Math.min(visibleFinderFiles.length - 1, value + (event.key === "ArrowDown" ? 1 : -1)))); }
        if (event.key === "Enter" && visibleFinderFiles[finderIndex]) { event.preventDefault(); selectFile(visibleFinderFiles[finderIndex].path); }
      }} />
      <FadedScroll className="changes-finder-list"><div id={`${id}-finder`} role="listbox" aria-label={words.finder}>
        {visibleFinderFiles.map((entry, index) => { const file = fileMap.get(entry.path)!; return <button type="button" key={entry.path} id={`${id}-file-${index}`} className={`changes-finder-row${finderIndex === index ? " is-selected" : ""}`} role="option" aria-selected={finderIndex === index} title={file.path} onPointerMove={() => setFinderIndex(index)} onClick={() => selectFile(file.path)}><FileLabel file={file} /><Counts file={file} /></button>; })}
        {!finderFiles.length && <p className="changes-file-state">{words.emptySearch}</p>}
      </div></FadedScroll>
      {finderFiles.length > 12 && <div className="changes-finder-footer">{finderFiles.length - 12} {words.more}</div>}
    </Popover>}
  </div>;
}

function ReviewTree({ files, grouped, selected, onSelect, statusLabel }: { files: GitReviewFile[]; grouped: boolean; selected: string; onSelect: (path: string) => void; statusLabel: (file: GitReviewFile) => string }) {
  const [closed, setClosed] = useState(new Set<string>());
  const tree = useMemo(() => buildSearchTree(files.map((file) => file.path)), [files]);
  const map = useMemo(() => new Map(files.map((file) => [file.path, file])), [files]);
  let first = true;
  const fileRow = (file: GitReviewFile, depth: number) => {
    const tabIndex = first ? 0 : -1; first = false;
    return <button key={file.path} type="button" data-roving tabIndex={tabIndex} className={`changes-tree-row${selected === file.path ? " is-selected" : ""}`} style={{ "--changes-depth": depth } as CSSProperties} title={`${file.oldPath ? `${file.oldPath} → ` : ""}${file.path} (${statusLabel(file)})`} onClick={() => onSelect(file.path)}><Icon name="code" size={12} /><span>{grouped ? file.path.split("/").pop() : file.path}</span><Counts file={file} /></button>;
  };
  const nodes = (entries: SearchTreeNode[], depth: number): ReactNode => entries.map((node) => {
    if (!node.isDir) return map.has(node.path) ? fileRow(map.get(node.path)!, depth) : null;
    // Compact chains with one directory child, like the reference's app/api path rows.
    let compact = node;
    let label = node.name;
    while (compact.children.length === 1 && compact.children[0].isDir) { compact = compact.children[0]; label += `/${compact.name}`; }
    const path = compact.path;
    const isClosed = closed.has(path);
    const tabIndex = first ? 0 : -1; first = false;
    return <div key={path}><button type="button" data-roving tabIndex={tabIndex} className="changes-tree-folder" style={{ "--changes-depth": depth } as CSSProperties} aria-expanded={!isClosed} title={path} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "ArrowLeft" || event.key === "ArrowRight") { event.preventDefault(); setClosed((current) => { const next = new Set(current); if (event.key === "ArrowLeft") next.add(path); else next.delete(path); return next; }); }
    }} onClick={() => setClosed((current) => { const next = new Set(current); if (next.has(path)) next.delete(path); else next.add(path); return next; })}><Icon name={isClosed ? "right" : "down"} size={12} /><span>{label}</span></button>{!isClosed && nodes(compact.children, depth + 1)}</div>;
  });
  return <div>{grouped ? nodes(tree, 0) : files.map((file) => fileRow(file, 0))}</div>;
}

function ReviewDiff({ file, data, words, split, wrap, highlight, context, onMore, selection, onSelectLine, feedback, pending, setFeedback, onCancel, onSubmit }: { file: GitReviewFile; data: GitReviewPatch; words: Words; split: boolean; wrap: boolean; highlight: boolean; context: GitReviewContext; onMore: () => void; selection: Selection | null; onSelectLine: (side: ReviewSide, line: number, extend: boolean) => void; feedback: string; pending: boolean; setFeedback: (text: string) => void; onCancel: () => void; onSubmit: (rows: SplitDiffRow[]) => Promise<void> }) {
  const rows = useMemo(() => parseUnifiedPatch(data.patch)?.[0]?.rows ?? [], [data.patch]);
  const inline = useMemo(() => inlineReviewRows(rows), [rows]);
  const selected = selection ? reviewSelection(rows, selection.side, selection.start, selection.end) : null;
  const inSelection = (side: ReviewSide, line: number | null) => selection?.side === side && line !== null && line >= Math.min(selection.start, selection.end) && line <= Math.max(selection.start, selection.end);
  const lineButton = (side: ReviewSide, line: number | null) => line === null ? <span className="changes-line-number" /> : <button type="button" className={`changes-line-number${inSelection(side, line) ? " is-selected" : ""}`} aria-label={`${words.feedback}: ${side === "old" ? words.old : words.new} ${line}`} title={`${words.feedback} · ${side === "old" ? words.old : words.new} ${line}`} aria-pressed={inSelection(side, line) || false} onClick={(event) => onSelectLine(side, line, event.shiftKey)}>{line}</button>;
  const text = (cell: SplitDiffCell, paired?: SplitDiffCell) => {
    if (highlight && paired && cell.type !== "context" && cell.type !== "empty" && paired.type !== "empty") {
      const parts = cell.type === "removed" ? reviewWordParts(cell.text, paired.text).old : reviewWordParts(paired.text, cell.text).new;
      return parts.map((part, index) => part.changed ? <mark key={index}>{part.text}</mark> : part.text);
    }
    return cell.text || " ";
  };
  const editor = <div className="changes-feedback" role="group" aria-label={words.feedback}>
    <div className="changes-feedback-label">{words.selectedLines}: {selection?.side === "old" ? words.old : words.new} {selection && Math.min(selection.start, selection.end)}{selection && selection.start !== selection.end ? `–${Math.max(selection.start, selection.end)}` : ""}<span>{file.path}</span></div>
    {!selected && <p className="changes-feedback-error">{words.selectionGap}</p>}
    <textarea autoFocus disabled={pending} value={feedback} aria-label={words.feedback} placeholder={words.feedbackHint} rows={3} onChange={(event) => setFeedback(event.target.value)} onKeyDown={(event) => {
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); onCancel(); }
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter" && selected && feedback.trim()) { event.preventDefault(); onSubmit(rows); }
    }} />
    <div className="changes-feedback-actions"><button type="button" onClick={onCancel}>{words.cancel}</button><button type="button" disabled={pending || !selected || !feedback.trim()} onClick={() => void onSubmit(rows)}>{pending ? words.sendingFeedback : words.addDraft}</button></div>
  </div>;
  if (!data.supported) return <div className="changes-file-state">{data.reason === "binary" ? words.binary : data.reason === "too-large" ? words.tooLarge : words.metadata}</div>;
  if (!rows.length) return <div className="changes-file-state">{words.noPatch}</div>;
  const hunkLabel = (row: { text: string; omitted: number }) => row.omitted > 0 ? `${row.omitted} ${words.unchanged}` : row.text;
  const expandContext = (label: string) => <button type="button" className="changes-context-button" disabled={context === "all" || data.truncated} onClick={onMore} title={context === 20 ? words.fullContext : words.context}><Icon name="down" size={12} />{label}</button>;
  let shownEditor = false;
  const wantsEditor = (oldLine: number | null, newLine: number | null) => {
    if (shownEditor || !selection) return false;
    const line = selection.side === "old" ? oldLine : newLine;
    if (line !== Math.max(selection.start, selection.end)) return false;
    shownEditor = true;
    return true;
  };
  return <div className={`changes-diff${split ? " is-split" : ""}${wrap ? " is-wrapped" : ""}`}>
    {data.truncated && <div className="changes-notice">{words.patchTruncated}</div>}
    {split ? <table className="changes-diff-table changes-split-table"><colgroup><col className="changes-number-col" /><col className="changes-code-col" /><col className="changes-number-col" /><col className="changes-code-col" /></colgroup><tbody>
      <tr className="changes-revision-heading"><th colSpan={2}>{words.old}</th><th colSpan={2}>{words.new}</th></tr>
      {rows.map((row, index) => row.type === "hunk" ? <tr key={index} className="changes-hunk"><td colSpan={4}>{row.text.startsWith("@@") ? expandContext(hunkLabel(inline.find((item) => item.type === "hunk" && item.text === row.text) as { text: string; omitted: number } ?? { text: row.text, omitted: 0 })) : row.text}</td></tr> : <ReviewRow key={index} editor={wantsEditor(row.left.lineNo, row.right.lineNo) ? editor : null} columns={4}><td className={`changes-gutter is-${row.left.type}`}>{lineButton("old", row.left.lineNo)}</td><td className={`changes-code is-${row.left.type}${inSelection("old", row.left.lineNo) ? " is-selected" : ""}`}><code>{text(row.left, row.right)}</code></td><td className={`changes-gutter changes-split-divider is-${row.right.type}`}>{lineButton("new", row.right.lineNo)}</td><td className={`changes-code is-${row.right.type}${inSelection("new", row.right.lineNo) ? " is-selected" : ""}`}><code>{text(row.right, row.left)}</code></td></ReviewRow>)}
    </tbody></table> : <table className="changes-diff-table"><colgroup><col className="changes-number-col" /><col className="changes-number-col" /><col className="changes-sign-col" /><col /></colgroup><tbody>
      {inline.map((row, index) => row.type === "hunk" ? <tr key={index} className="changes-hunk"><td colSpan={4}>{row.text.startsWith("@@") ? expandContext(hunkLabel(row)) : <span>{row.text}</span>}</td></tr> : <ReviewRow key={index} editor={wantsEditor(row.oldLine, row.newLine) ? editor : null} columns={4} className={`is-${row.cell.type}${inSelection(selection?.side ?? "new", selection?.side === "old" ? row.oldLine : row.newLine) ? " is-selected" : ""}`}><td className="changes-gutter">{lineButton("old", row.oldLine)}</td><td className="changes-gutter">{lineButton("new", row.newLine)}</td><td className="changes-sign">{row.cell.type === "added" ? "+" : row.cell.type === "removed" ? "−" : ""}</td><td className="changes-code"><code>{text(row.cell, row.paired)}</code></td></ReviewRow>)}
    </tbody></table>}
    {selection && !shownEditor && editor}
    {context !== "all" && !data.truncated && <div className="changes-more-context">{expandContext(context === 20 ? words.fullContext : words.context)}</div>}
  </div>;
}

function ReviewRow({ children, editor, columns, className = "" }: { children: ReactNode; editor: ReactNode; columns: number; className?: string }) {
  return <><tr className={`changes-code-row ${className}`}>{children}</tr>{editor && <tr className="changes-feedback-row"><td colSpan={columns}>{editor}</td></tr>}</>;
}
