// Client-side helper for POST /api/agent/[id]/fork-send (see lib/fork-send.ts).
//
// Errors are AgentCommandError (code, accepted: false) plus the fields that matter here:
// `newSessionId` is set when the fork was created and kept although the prompt was not sent,
// so the caller keeps the draft and may retry with the same request key.

import { AgentCommandError } from "./agent-client";

export type ForkSendClientCode =
  | "invalid_request"
  | "source_not_found"
  | "source_not_persisted"
  | "shell_running"
  | "fork_write_failed"
  | "session_start_failed"
  | "prompt_rejected"
  | "aborted";

export class ForkSendClientError extends AgentCommandError {
  constructor(
    message: string,
    status: number,
    code: string | undefined,
    public readonly newSessionId?: string,
    public readonly promptSent: boolean = false,
  ) {
    super(message, status, code, false);
    this.name = "ForkSendClientError";
  }
}

export interface ForkSendPayload {
  /** One per user action: pass the same key when retrying or when a key press may repeat. */
  requestKey: string;
  message: string;
  images?: Array<{ type: "image"; data: string; mimeType: string }>;
}

export interface ForkSendResponse {
  newSessionId: string;
  promptSent: true;
}

export function createForkSendKey(): string {
  return globalThis.crypto.randomUUID();
}

export async function forkSend(
  sessionId: string,
  payload: ForkSendPayload,
  options: { signal?: AbortSignal } = {},
): Promise<ForkSendResponse> {
  const res = await fetch(`/api/agent/${encodeURIComponent(sessionId)}/fork-send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: options.signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: ForkSendResponse;
    error?: string;
    code?: string;
    newSessionId?: string;
  };
  if (!res.ok || body.error || !body.data) {
    throw new ForkSendClientError(
      body.error ?? `HTTP ${res.status}`,
      res.status,
      body.code,
      body.newSessionId,
    );
  }
  return body.data;
}
