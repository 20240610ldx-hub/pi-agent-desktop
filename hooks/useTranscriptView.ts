"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getTranscriptView, subscribeTranscriptView, type TranscriptViewMode } from "@/lib/transcript-view-preference";

export function useTranscriptView(sessionId: string | null): TranscriptViewMode {
  const getSnapshot = useCallback(() => getTranscriptView(sessionId), [sessionId]);
  return useSyncExternalStore(subscribeTranscriptView, getSnapshot, () => "normal");
}
