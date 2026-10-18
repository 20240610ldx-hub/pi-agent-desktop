import { APP_PREF_KEYS } from "./app-prefs.ts";

const MAX_TEXT_LENGTH = 64 * 1024;
const MAX_AGE_MS = 30_000;

export interface ChangesFeedbackRequest {
  id: string;
  targetId: string;
  cwd: string;
  text: string;
  createdAt: number;
}

function readJson(raw: string | null): Record<string, unknown> | null {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}

function sameDirectory(a: string, b: string): boolean {
  const normalize = (path: string) => path.replace(/\\/g, "/").replace(/\/+$/, "");
  const left = normalize(a);
  const right = normalize(b);
  return /^[A-Za-z]:\//.test(left) ? left.toLowerCase() === right.toLowerCase() : left === right;
}

export function parseChangesFeedbackRequest(raw: string | null, targetId: string, cwd: string, now = Date.now()): ChangesFeedbackRequest | null {
  const value = readJson(raw);
  if (!value || typeof value.id !== "string" || value.id.length > 128 || !value.id
    || value.targetId !== targetId || typeof value.cwd !== "string" || !sameDirectory(value.cwd, cwd)
    || typeof value.text !== "string" || !value.text.trim() || value.text.length > MAX_TEXT_LENGTH
    || typeof value.createdAt !== "number" || !Number.isFinite(value.createdAt)
    || value.createdAt > now + 1000 || now - value.createdAt > MAX_AGE_MS) return null;
  return value as unknown as ChangesFeedbackRequest;
}

/** A live receiver only: old persisted requests never populate a later draft. */
export function subscribeChangesFeedback({ targetId, cwd, onFeedback }: {
  targetId: string;
  cwd: string;
  onFeedback: (text: string) => boolean;
}): () => void {
  const seen = new Set<string>();
  const receive = (event: StorageEvent) => {
    if (event.storageArea !== window.localStorage || event.key !== APP_PREF_KEYS.changesFeedbackRequest) return;
    const request = parseChangesFeedbackRequest(event.newValue, targetId, cwd);
    if (!request || seen.has(request.id)) return;
    // A queued storage event may outlive the sender's timeout or cancellation.
    try {
      if (readJson(window.localStorage.getItem(APP_PREF_KEYS.changesFeedbackRequest))?.id !== request.id) return;
    } catch { return; }
    seen.add(request.id);
    if (seen.size > 128) seen.delete(seen.values().next().value!);
    if (!onFeedback(request.text)) return;
    try {
      window.localStorage.setItem(APP_PREF_KEYS.changesFeedbackAck, JSON.stringify({ id: request.id, targetId, deliveredAt: Date.now() }));
    } catch { /* The sender offers a copy fallback when an acknowledgement cannot be stored. */ }
  };
  window.addEventListener("storage", receive);
  return () => window.removeEventListener("storage", receive);
}

export function requestChangesFeedback({ targetId, cwd, text }: { targetId?: string; cwd: string; text: string }): Promise<boolean> {
  if (typeof window === "undefined" || !targetId || !text.trim() || text.length > MAX_TEXT_LENGTH) return Promise.resolve(false);
  const request: ChangesFeedbackRequest = { id: crypto.randomUUID(), targetId, cwd, text, createdAt: Date.now() };
  return new Promise((resolve) => {
    let settled = false;
    const finish = (delivered: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      window.removeEventListener("storage", acknowledge);
      try {
        if (readJson(window.localStorage.getItem(APP_PREF_KEYS.changesFeedbackRequest))?.id === request.id) {
          window.localStorage.removeItem(APP_PREF_KEYS.changesFeedbackRequest);
        }
        if (readJson(window.localStorage.getItem(APP_PREF_KEYS.changesFeedbackAck))?.id === request.id) {
          window.localStorage.removeItem(APP_PREF_KEYS.changesFeedbackAck);
        }
      } catch { /* Storage is optional; the caller has a copy fallback. */ }
      resolve(delivered);
    };
    const acknowledge = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage || event.key !== APP_PREF_KEYS.changesFeedbackAck) return;
      const ack = readJson(event.newValue);
      if (ack?.id === request.id && ack.targetId === targetId && typeof ack.deliveredAt === "number" && ack.deliveredAt >= request.createdAt) finish(true);
    };
    window.addEventListener("storage", acknowledge);
    const timer = setTimeout(() => finish(false), 2000);
    try { window.localStorage.setItem(APP_PREF_KEYS.changesFeedbackRequest, JSON.stringify(request)); }
    catch { finish(false); }
  });
}
