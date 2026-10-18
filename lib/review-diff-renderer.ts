import { computeNewLineNumber, computeOldLineNumber, markEdits, parseDiff, tokenize, type ChangeData, type FileData, type HunkData, type HunkTokens, type TokenizeOptions } from "react-diff-view";
import { refractor } from "refractor/core";
import "./syntax-highlighting.ts";
import type { ReviewSide } from "./git-review-display.ts";

/** Git remains the source of text and coordinates; the library owns parsing and display. */
export function parseReviewDiff(patch: string, split = false): FileData | undefined {
  if (!patch.trim()) return undefined;
  // The library's timestamped-unidiff normalizer does not cover bare Git headers.
  // Supply a neutral envelope only; actual paths and all source lines stay untouched.
  const input = patch.trimStart().startsWith("diff --git ") ? patch : `diff --git a/review b/review\n${patch}`;
  try { return parseDiff(input, split ? { nearbySequences: "zip" } : undefined)[0]; } catch { return undefined; }
}

export function reviewChangeLine(change: ChangeData, side: ReviewSide): number | null {
  const line = side === "old" ? computeOldLineNumber(change) : computeNewLineNumber(change);
  return Number.isSafeInteger(line) && line > 0 ? line : null;
}

export function reviewDiffSelection(hunks: readonly HunkData[], side: ReviewSide, start: number, end: number): { start: number; end: number; snippet: string } | null {
  const first = Math.min(start, end), last = Math.max(start, end);
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last - first > 499) return null;
  const lines = new Map<number, string>();
  for (const hunk of hunks) for (const change of hunk.changes) {
    const line = reviewChangeLine(change, side);
    if (line !== null && line >= first && line <= last) lines.set(line, change.content);
  }
  const snippet: string[] = [];
  for (let line = first; line <= last; line++) {
    if (!lines.has(line)) return null;
    snippet.push(lines.get(line)!);
  }
  return { start: first, end: last, snippet: snippet.join("\n") };
}

function languageForPath(path: string): string {
  const name = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "docker";
  if (name === "makefile" || name === "gnumakefile") return "makefile";
  if (/^\.(?:bashrc|bash_profile|zshrc)$/.test(name)) return "bash";
  const extension = name.split(".").pop() ?? "";
  const aliases: Record<string, string> = { mjs: "javascript", cjs: "javascript", mts: "typescript", cts: "typescript", cc: "cpp", cxx: "cpp", hpp: "cpp", h: "c", htm: "markup", vue: "markup", svelte: "markup", ps1: "powershell", jsonc: "json", jsonl: "json", gql: "graphql", tf: "hcl" };
  return Object.hasOwn(aliases, extension) ? aliases[extension] : extension;
}

/** Empty-line sentinel avoids the library's visual space fallback without adding source text. */
export function preserveReviewEmptyLines(hunks: readonly HunkData[], tokens?: HunkTokens): HunkTokens | undefined {
  let result = tokens;
  for (const hunk of hunks) for (const change of hunk.changes) {
    if (change.content !== "") continue;
    result ??= { old: [], new: [] };
    for (const side of ["old", "new"] as const) {
      const line = reviewChangeLine(change, side);
      if (line !== null) result[side][line - 1] = [{ type: "element", className: "changes-empty-line", children: [{ type: "text", value: "" }] }];
    }
  }
  return result;
}

/** Tokenize one rebased hunk at a time: no million-line arrays or invented gap state. */
export function tokenizeReviewDiff(hunks: readonly HunkData[], path: string, words: boolean, oldPath = path): HunkTokens | undefined {
  let size = 0, count = 0;
  for (const hunk of hunks) for (const change of hunk.changes) {
    size += change.content.length;
    if (++count > 2000 || size > 128_000 || change.content.length > 4096) return undefined;
  }
  const language = languageForPath(path);
  const oldLanguage = languageForPath(oldPath);
  const adapter = {
    highlight(source: string, grammar: string) {
      const children = refractor.highlight(source, grammar).children;
      return grammar === "yaml" || grammar === "yml"
        ? children.map(node => node.type === "text" ? { type: "element", tagName: "span", properties: { className: ["token", "string"] }, children: [node] } : node)
        : children;
    },
  };
  const result: HunkTokens = { old: [], new: [] };
  try {
    for (const hunk of hunks) {
      const oldOffset = Math.max(0, hunk.oldStart - 1), newOffset = Math.max(0, hunk.newStart - 1);
      const local: HunkData = {
        ...hunk, oldStart: 1, newStart: 1,
        changes: hunk.changes.map(change => change.type === "normal"
          ? { ...change, oldLineNumber: change.oldLineNumber - oldOffset, newLineNumber: change.newLineNumber - newOffset }
          : { ...change, lineNumber: change.lineNumber - (change.type === "delete" ? oldOffset : newOffset) }),
      };
      // markEdits block mode drops leading empty lines while joining its source.
      // They contain no characters to mark; omit them only from edit discovery so
      // the first nonempty change supplies the correct lineNumber. Syntax and
      // displayed text still consume every original source line below.
      const started = { old: false, new: false };
      const editHunk = { ...local, changes: local.changes.filter(change => {
        if (change.type === "normal") { started.old = started.new = false; return true; }
        const side = change.type === "delete" ? "old" : "new";
        if (!started[side] && change.content === "") return false;
        started[side] = true;
        return true;
      }) };
      const enhancers = words ? [markEdits([editHunk], { type: "block" })] : [];
      const tokenizeLanguage = (grammar: string) => {
        const options: TokenizeOptions = refractor.registered(grammar)
          ? { highlight: true, language: grammar, refractor: adapter as Extract<TokenizeOptions, { highlight: true }>["refractor"], enhancers }
          : { highlight: false, enhancers };
        return tokenize([local], options);
      };
      const tokens = tokenizeLanguage(language);
      // Renames can change the grammar. Reuse the shared pass for the usual case.
      const sameGrammar = oldLanguage === language || refractor.languages[oldLanguage] === refractor.languages[language];
      const oldTokens = sameGrammar ? tokens : tokenizeLanguage(oldLanguage);
      for (const change of hunk.changes) for (const side of ["old", "new"] as const) {
        const line = reviewChangeLine(change, side);
        const source = side === "old" ? oldTokens : tokens;
        if (line !== null) result[side][line - 1] = source[side][line - 1 - (side === "old" ? oldOffset : newOffset)];
      }
    }
    return result;
  } catch {
    return undefined;
  }
}
