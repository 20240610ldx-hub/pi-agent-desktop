"use client";

import { useCallback, useState, type Dispatch, type SetStateAction } from "react";
import { useTranscriptViewScope } from "@/components/TranscriptViewContext";

/** View changes reset the default once; a user's subsequent toggle stays independent. */
export function useTranscriptExpansion(initial: () => boolean, kind: "thinking" | "tool" | "process"): [boolean, Dispatch<SetStateAction<boolean>>] {
  const { mode, sessionId } = useTranscriptViewScope();
  const defaultExpanded = () => initial() || mode === "verbose" || (mode === "thinking" && kind !== "tool");
  const [selection, setSelection] = useState(() => ({ mode, sessionId, expanded: defaultExpanded() }));
  let expanded = selection.expanded;
  if (selection.mode !== mode || selection.sessionId !== sessionId) {
    expanded = defaultExpanded();
    setSelection({ mode, sessionId, expanded });
  }
  const setExpanded: Dispatch<SetStateAction<boolean>> = useCallback((value) => {
    setSelection((current) => ({ ...current, expanded: typeof value === "function" ? value(current.expanded) : value }));
  }, []);
  return [expanded, setExpanded];
}
