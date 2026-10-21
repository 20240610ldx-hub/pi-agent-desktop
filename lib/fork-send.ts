// Fork-owned: "send in a forked session" (PIL-0189). Takes the composer draft, forks the
// source session at its latest settled position and sends the draft as the first new user
// message of the child. The source session is never touched: the fork reuses
// writeForkedSession() (the file copy the browser's Fork button and ctx.fork share) and the
// child is an ordinary wrapper started through startRpcSession().
//
// Everything that reaches the rest of the app (finding the source, writing the fork file,
// starting the child) is injected through ForkSendDeps, so the orchestration can be driven
// by fixtures. createRpcForkSendDeps() wires the real ones; lib/rpc-manager.ts is imported
// lazily so this module stays cheap to load in tests and in the route.

import { SessionManager } from "@earendil-works/pi-coding-agent";
import { existsSync } from "fs";
import type { AgentSessionLike } from "./pi-types";
import { UNSAVED_SESSION_FORK_ERROR, writeForkedSession } from "./session-replacement";

export type ForkSendImage = { type: "image"; data: string; mimeType: string };

export type ForkSendErrorCode =
  | "invalid_request"
  | "source_not_found"
  | "source_not_persisted"
  | "shell_running"
  | "fork_write_failed"
  | "session_start_failed"
  | "prompt_rejected"
  | "aborted";

const STATUS_BY_CODE: Record<ForkSendErrorCode, number> = {
  invalid_request: 400,
  source_not_found: 404,
  source_not_persisted: 409,
  shell_running: 409,
  fork_write_failed: 500,
  session_start_failed: 500,
  prompt_rejected: 422,
  aborted: 499,
};

/**
 * A failure with a code the client can tell apart. `newSessionId` is set once the fork file
 * exists: the fork is kept, the draft was not consumed and `promptSent` is always false.
 */
export class ForkSendError extends Error {
  readonly status: number;
  readonly promptSent = false as const;
  constructor(
    public readonly code: ForkSendErrorCode,
    message: string,
    public readonly newSessionId?: string,
  ) {
    super(message);
    this.name = "ForkSendError";
    this.status = STATUS_BY_CODE[code];
  }
}

/** What forking reads from the source: its session manager, file and shell state, nothing else. */
export type ForkSendSourceSession = Pick<AgentSessionLike, "sessionManager" | "sessionFile" | "isBashRunning">;

export interface ForkSendSource {
  /** Running or idle alike: only entries already on disk are copied, so a run in flight keeps going. */
  inner: ForkSendSourceSession;
}

export interface ForkSendStartedSession {
  send(command: { type: "prompt"; message: string; images?: ForkSendImage[] }): Promise<unknown>;
}

export interface ForkSendDeps {
  /**
   * The source session: its live wrapper when open, otherwise a read-only view of its file
   * (starting a wrapper would let pi append entries to the source); null when it does not exist.
   */
  openSource(sourceId: string): Promise<ForkSendSource | null>;
  /** Copies the source path up to `leafId` into a new session file. */
  writeFork(inner: ForkSendSourceSession, leafId: string): { newSessionId: string; newSessionFile: string };
  /** Opens the forked file as its own session; model, thinking level, tools and cwd come from the file. */
  startSession(newSessionId: string, newSessionFile: string): Promise<ForkSendStartedSession>;
}

export interface ForkSendRequest {
  sourceId: string;
  /** Identifies one user action; repeats of it share one fork and one prompt. */
  requestKey: string;
  message: string;
  images?: ForkSendImage[];
  /** Aborting before the prompt is sent withdraws it; a fork that already exists is kept. */
  signal?: AbortSignal;
}

export interface ForkSendResult {
  newSessionId: string;
  promptSent: true;
}

type FlightEntry = {
  inflight?: Promise<ForkSendResult>;
  fork?: { newSessionId: string; newSessionFile: string };
  result?: ForkSendResult;
  expiresAt: number;
};

declare global {
  var __piForkSendFlights: Map<string, FlightEntry> | undefined;
}

/** Long enough to cover double presses and client retries, short enough not to pin memory. */
const ENTRY_TTL_MS = 10 * 60_000;
const MAX_ENTRIES = 500;

function flights(): Map<string, FlightEntry> {
  globalThis.__piForkSendFlights ??= new Map();
  return globalThis.__piForkSendFlights;
}

function pruneFlights(now: number): void {
  const map = flights();
  for (const [key, entry] of map) {
    if (!entry.inflight && entry.expiresAt <= now) map.delete(key);
  }
  while (map.size > MAX_ENTRIES) {
    const oldest = [...map].find(([, entry]) => !entry.inflight);
    if (!oldest) break;
    map.delete(oldest[0]);
  }
}

function throwIfAborted(signal: AbortSignal | undefined, newSessionId?: string): void {
  if (signal?.aborted) {
    throw new ForkSendError("aborted", "Request aborted before the prompt was sent", newSessionId);
  }
}

function validate(request: ForkSendRequest): void {
  if (!request.sourceId) throw new ForkSendError("invalid_request", "Missing source session id");
  if (!request.requestKey || request.requestKey.length > 200) {
    throw new ForkSendError("invalid_request", "requestKey must be a non-empty string of at most 200 characters");
  }
  if (typeof request.message !== "string") throw new ForkSendError("invalid_request", "message must be a string");
  if (!request.message.trim() && !request.images?.length) {
    throw new ForkSendError("invalid_request", "Nothing to send");
  }
}

async function run(request: ForkSendRequest, entry: FlightEntry, deps: ForkSendDeps): Promise<ForkSendResult> {
  const { signal } = request;
  if (!entry.fork) {
    throwIfAborted(signal);
    const source = await deps.openSource(request.sourceId);
    if (!source) throw new ForkSendError("source_not_found", "Session not found");
    const { inner } = source;
    if (inner.isBashRunning) {
      throw new ForkSendError("shell_running", "Cannot fork while a shell command is running");
    }
    const manager = inner.sessionManager;
    const sourceFile = inner.sessionFile;
    if (
      !manager.isPersisted()
      || !sourceFile
      || !existsSync(sourceFile)
      || manager.getEntries().length === 0
    ) {
      throw new ForkSendError("source_not_persisted", UNSAVED_SESSION_FORK_ERROR);
    }
    // Entries are appended when finished, so the leaf is the newest finished entry even while a run is in flight.
    const leafId = manager.getLeafId();
    if (!leafId) throw new ForkSendError("source_not_persisted", UNSAVED_SESSION_FORK_ERROR);
    throwIfAborted(signal);
    try {
      entry.fork = deps.writeFork(inner, leafId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new ForkSendError(
        message === UNSAVED_SESSION_FORK_ERROR ? "source_not_persisted" : "fork_write_failed",
        message,
      );
    }
  }

  const { newSessionId, newSessionFile } = entry.fork;
  throwIfAborted(signal, newSessionId);
  let session: ForkSendStartedSession;
  try {
    session = await deps.startSession(newSessionId, newSessionFile);
  } catch (error) {
    throw new ForkSendError(
      "session_start_failed",
      error instanceof Error ? error.message : String(error),
      newSessionId,
    );
  }
  // Last chance to withdraw: past this call the prompt belongs to the new session.
  throwIfAborted(signal, newSessionId);
  try {
    await session.send({
      type: "prompt",
      message: request.message,
      ...(request.images?.length ? { images: request.images } : {}),
    });
  } catch (error) {
    throw new ForkSendError(
      "prompt_rejected",
      error instanceof Error ? error.message : String(error),
      newSessionId,
    );
  }
  return { newSessionId, promptSent: true };
}

/**
 * Forks `sourceId` at its latest settled entry and sends the draft in the child.
 *
 * Concurrent calls with the same (source, requestKey) share one run. A repeat after the
 * prompt was accepted returns that result without sending again; a repeat after a failed
 * send reuses the fork that failure kept instead of creating another.
 */
export async function forkAndSend(request: ForkSendRequest, deps: ForkSendDeps): Promise<ForkSendResult> {
  validate(request);
  const now = Date.now();
  pruneFlights(now);
  const map = flights();
  const key = `${request.sourceId}\u0000${request.requestKey}`;
  let entry = map.get(key);
  if (!entry) {
    entry = { expiresAt: now + ENTRY_TTL_MS };
    map.set(key, entry);
  }
  entry.expiresAt = now + ENTRY_TTL_MS;
  if (entry.result) return entry.result;
  if (entry.inflight) return entry.inflight;

  const current = entry;
  const inflight = run(request, current, deps).then((result) => {
    current.result = result;
    return result;
  });
  current.inflight = inflight;
  const settled = () => {
    current.inflight = undefined;
    // Nothing worth resuming from: a later attempt starts from scratch.
    if (!current.fork && !current.result && map.get(key) === current) map.delete(key);
  };
  inflight.then(settled, settled);
  return inflight;
}

/** The production wiring: the live registry, `writeForkedSession()` and `startRpcSession()`. */
export function createRpcForkSendDeps(): ForkSendDeps {
  return {
    async openSource(sourceId) {
      const { getRpcSession } = await import("./rpc-manager");
      const existing = getRpcSession(sourceId);
      if (existing?.isAlive()) return { inner: existing.inner };
      const { resolveSessionPath } = await import("./session-reader");
      const file = await resolveSessionPath(sourceId);
      if (!file) return null;
      return { inner: { sessionManager: SessionManager.open(file, undefined), sessionFile: file, isBashRunning: false } };
    },
    // writeForkedSession() reads only sessionManager and sessionFile from its first argument.
    writeFork: (inner, leafId) => writeForkedSession(inner as unknown as AgentSessionLike, leafId),
    async startSession(newSessionId, newSessionFile) {
      const { startRpcSession } = await import("./rpc-manager");
      const { session } = await startRpcSession(newSessionId, newSessionFile, undefined);
      return { send: (command) => session.send(command) };
    },
  };
}
