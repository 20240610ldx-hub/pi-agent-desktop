"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { TranscriptViewMode } from "@/lib/transcript-view-preference";

const TranscriptViewContext = createContext<{ mode: TranscriptViewMode; sessionId: string | null }>({ mode: "normal", sessionId: null });

export function TranscriptViewProvider({ mode, sessionId = null, children }: { mode: TranscriptViewMode; sessionId?: string | null; children: ReactNode }) {
  const value = useMemo(() => ({ mode, sessionId }), [mode, sessionId]);
  return <TranscriptViewContext.Provider value={value}>{children}</TranscriptViewContext.Provider>;
}

export function useTranscriptViewScope() {
  return useContext(TranscriptViewContext);
}
