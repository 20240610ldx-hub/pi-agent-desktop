import { createElement, type ReactNode } from "react";
import { refractor } from "refractor/core";
// Reuse exactly the curated grammars already registered for FileViewer's PrismLight.
import "./syntax-highlighting.ts";
import type { RootContent } from "hast";
import type { SplitDiffCell, SplitDiffRow } from "./patch.ts";

export type ReviewSyntaxTone = "plain" | "property" | "string" | "keyword" | "function" | "comment" | "number" | "variable" | "operator" | "punctuation";
export interface ReviewSyntaxPart { text: string; tone: ReviewSyntaxTone; changed?: boolean }

function languageForPath(path: string): string {
  const name = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";
  if (name === "dockerfile" || name.startsWith("dockerfile.")) return "docker";
  if (name === "makefile" || name === "gnumakefile") return "makefile";
  if (/^\.(?:bashrc|bash_profile|zshrc)$/.test(name)) return "bash";
  const extension = name.split(".").pop() ?? "";
  const aliases: Record<string, string> = { mjs: "javascript", cjs: "javascript", mts: "typescript", cts: "typescript", cc: "cpp", cxx: "cpp", hpp: "cpp", h: "c", htm: "markup", vue: "markup", svelte: "markup", ps1: "powershell", jsonc: "json", jsonl: "json", gql: "graphql", tf: "hcl" };
  return Object.hasOwn(aliases, extension) ? aliases[extension] : extension;
}

function toneFor(classes: string[], parent: ReviewSyntaxTone): ReviewSyntaxTone {
  if (classes.some((name) => ["comment", "prolog", "doctype", "cdata"].includes(name))) return "comment";
  if (classes.some((name) => ["string", "char", "scalar", "heredoc-string", "template-string", "attr-value"].includes(name))) return "string";
  if (classes.some((name) => ["key", "property", "atrule", "attr-name", "tag"].includes(name))) return "property";
  if (classes.some((name) => ["keyword", "boolean", "null", "important"].includes(name))) return "keyword";
  if (classes.some((name) => ["function", "function-name", "class-name", "builtin"].includes(name))) return "function";
  // Shell environment variables also carry Prism's "constant" alias.
  if (classes.some((name) => name === "variable" || name === "environment")) return "variable";
  if (classes.some((name) => ["number", "constant"].includes(name))) return "number";
  if (classes.includes("operator")) return "operator";
  if (classes.includes("punctuation")) return "punctuation";
  return parent;
}

/** Syntax is presentation only: concatenate the returned runs to recover the input exactly. */
export function tokenizeReviewSource(source: string, path: string): ReviewSyntaxPart[] {
  const plain = (): ReviewSyntaxPart[] => [{ text: source, tone: "plain" }];
  const language = languageForPath(path);
  if (!source || source.length > 64_000 || source.split("\n").some((line) => line.length > 4096) || !refractor.registered(language)) return plain();
  try {
    const parts: ReviewSyntaxPart[] = [];
    const visit = (node: RootContent, parent: ReviewSyntaxTone) => {
      if (node.type === "text") {
        const previous = parts.at(-1);
        if (previous?.tone === parent) previous.text += node.value;
        else parts.push({ text: node.value, tone: parent });
      } else if (node.type === "element") {
        const classes = node.properties.className;
        const tone = toneFor(Array.isArray(classes) ? classes.map(String) : [], parent);
        node.children.forEach((child) => visit(child, tone));
      }
    };
    // Prism leaves YAML's unquoted scalars as root text. Give that language a
    // string base tone; explicit AST tokens still override it without re-lexing.
    const rootTone = language === "yaml" || language === "yml" ? "string" : "plain";
    refractor.highlight(source, language).children.forEach((node) => visit(node, rootTone));
    return parts.map((part) => part.text).join("") === source ? parts : plain();
  } catch {
    return plain();
  }
}

/** A contiguous hunk side is tokenized together so multiline grammars retain state.
 * Gaps between hunks must be separate calls: omitted source is never synthesized. */
export function tokenizeReviewLines(lines: readonly string[], path: string): ReviewSyntaxPart[][] {
  if (!lines.length) return [];
  if (lines.length > 1000) return lines.map((text) => [{ text, tone: "plain" }]);
  const result: ReviewSyntaxPart[][] = [[]];
  for (const token of tokenizeReviewSource(lines.join("\n"), path)) {
    const segments = token.text.split("\n");
    segments.forEach((text, index) => {
      if (index > 0) result.push([]);
      if (text) result.at(-1)!.push({ text, tone: token.tone });
    });
  }
  return result;
}

/** Presentation cache keyed by existing cell identity; revision line text stays untouched. */
export function tokenizeReviewCells(rows: readonly SplitDiffRow[], path: string, oldPath = path): Map<SplitDiffCell, ReviewSyntaxPart[]> {
  const result = new Map<SplitDiffCell, ReviewSyntaxPart[]>();
  let old: SplitDiffCell[] = [];
  let next: SplitDiffCell[] = [];
  const flush = () => {
    tokenizeReviewLines(old.map((cell) => cell.text), oldPath).forEach((parts, index) => result.set(old[index], parts));
    tokenizeReviewLines(next.map((cell) => cell.text), path).forEach((parts, index) => result.set(next[index], parts));
    old = []; next = [];
  };
  for (const row of rows) {
    if (row.type === "hunk") {
      if (row.text.startsWith("@@")) flush();
      continue;
    }
    if (row.left.type === "empty") result.set(row.left, [{ text: row.left.text, tone: "plain" }]);
    else old.push(row.left);
    if (row.right.type === "empty") result.set(row.right, [{ text: row.right.text, tone: "plain" }]);
    else next.push(row.right);
  }
  flush();
  return result;
}

/** Intersect two lossless partitions by UTF-16 offsets; neither owns source text. */
export function markReviewSyntax(tokens: readonly ReviewSyntaxPart[], marks: readonly { text: string; changed: boolean }[]): ReviewSyntaxPart[] {
  if (tokens.map((part) => part.text).join("") !== marks.map((part) => part.text).join("")) return tokens.slice();
  const result: ReviewSyntaxPart[] = [];
  let tokenIndex = 0;
  let markIndex = 0;
  let tokenOffset = 0;
  let markOffset = 0;
  while (tokenIndex < tokens.length && markIndex < marks.length) {
    const token = tokens[tokenIndex];
    const mark = marks[markIndex];
    const length = Math.min(token.text.length - tokenOffset, mark.text.length - markOffset);
    if (length > 0) result.push({ text: token.text.slice(tokenOffset, tokenOffset + length), tone: token.tone, changed: mark.changed });
    tokenOffset += length;
    markOffset += length;
    if (tokenOffset === token.text.length) { tokenIndex++; tokenOffset = 0; }
    if (markOffset === mark.text.length) { markIndex++; markOffset = 0; }
  }
  return result;
}

/** Only fixed semantic classes and text reach React; source HTML is never interpreted. */
export function renderReviewSyntax(parts: readonly ReviewSyntaxPart[]): ReactNode[] {
  return parts.map((part, index) => {
    const text = part.changed ? createElement("mark", null, part.text) : part.text;
    return part.tone === "plain"
      ? part.changed ? createElement("mark", { key: index }, part.text) : part.text
      : createElement("span", { className: `changes-syntax-${part.tone}`, key: index }, text);
  });
}
