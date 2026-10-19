export const TRANSCRIPT_VIEW_MODES = ["normal", "thinking", "verbose"] as const;
export type TranscriptViewMode = (typeof TRANSCRIPT_VIEW_MODES)[number];

const STORAGE_PREFIX = "pilaude:transcript-view:v1:";
const CHANGED_EVENT = "pilaude:transcript-view-changed";

function storageKey(sessionId: string): string {
  return STORAGE_PREFIX + encodeURIComponent(sessionId);
}

export function getTranscriptView(sessionId: string | null): TranscriptViewMode {
  if (!sessionId || typeof window === "undefined") return "normal";
  try {
    const value = window.localStorage.getItem(storageKey(sessionId));
    return value === "thinking" || value === "verbose" ? value : "normal";
  } catch {
    return "normal";
  }
}

export function setTranscriptView(sessionId: string, mode: TranscriptViewMode): boolean {
  if (!sessionId || typeof window === "undefined" || !TRANSCRIPT_VIEW_MODES.includes(mode)) return false;
  try {
    if (mode === "normal") window.localStorage.removeItem(storageKey(sessionId));
    else window.localStorage.setItem(storageKey(sessionId), mode);
    window.dispatchEvent(new Event(CHANGED_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function subscribeTranscriptView(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key.startsWith(STORAGE_PREFIX)) listener();
  };
  window.addEventListener(CHANGED_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGED_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}
