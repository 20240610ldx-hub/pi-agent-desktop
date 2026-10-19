"use client";

import { memo } from "react";
import { SyntaxHighlighter } from "@/lib/syntax-highlighting";

// Keep synchronous Prism work below the existing diff view's per-line limit.
// Longer shell payloads stay fully visible/copyable as plain text.
const MAX_COMMAND_HIGHLIGHT_CHARS = 4096;

export const CompactCommandText = memo(function CompactCommandText({ command, language }: { command: string; language: "bash" | "powershell" }) {
  if (command.length > MAX_COMMAND_HIGHLIGHT_CHARS) return <>{command}</>;
  return <SyntaxHighlighter language={language} PreTag="span" CodeTag="span" useInlineStyles={false} showLineNumbers={false} wrapLines={false} customStyle={{ background: "transparent", padding: 0, margin: 0 }} codeTagProps={{ style: { whiteSpace: "inherit" } }}>{command}</SyntaxHighlighter>;
});
