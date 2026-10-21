/**
 * Keep-awake service for the desktop shell.
 *
 * The page never holds the truth: `enabled` is copied from what the native
 * command reports after the OS accepted (or released) the request. A failed
 * call leaves the previous state untouched and records the error; nothing is
 * shown as enabled optimistically. In a browser there is no bridge, so the
 * service reports `unavailable` and never calls anything.
 */

export type KeepAwakeNativeStatus = { supported: boolean; enabled: boolean };

export interface KeepAwakeBridge {
  /** Native status, or null when there is no desktop shell (web). */
  status(): Promise<KeepAwakeNativeStatus | null>;
  /** Ask the OS to start/stop; rejects with the native error message. */
  set(enabled: boolean): Promise<KeepAwakeNativeStatus>;
}

export type KeepAwakeAvailability = "unknown" | "unavailable" | "unsupported" | "supported";

export interface KeepAwakeState {
  availability: KeepAwakeAvailability;
  /** True only while the OS reports it holds the request. */
  enabled: boolean;
  /** A toggle is in flight; `enabled` still shows the last OS-confirmed value. */
  pending: boolean;
  /** Message from the last failed native call; cleared by the next success. */
  error: string | null;
}

export interface KeepAwakeService {
  getState(): KeepAwakeState;
  subscribe(listener: (state: KeepAwakeState) => void): () => void;
  refresh(): Promise<KeepAwakeState>;
  /** Resolves with the OS-confirmed state; never throws, failures land in `error`. */
  setEnabled(enabled: boolean): Promise<KeepAwakeState>;
}

function errorMessage(error: unknown): string {
  if (typeof error === "string" && error) return error;
  if (error instanceof Error && error.message) return error.message;
  return "Keep awake failed.";
}

export function createKeepAwakeService(bridge: KeepAwakeBridge): KeepAwakeService {
  let state: KeepAwakeState = {
    availability: "unknown",
    enabled: false,
    pending: false,
    error: null,
  };
  const listeners = new Set<(state: KeepAwakeState) => void>();
  // Calls run one after another so rapid toggles reach the OS in order.
  let queue: Promise<unknown> = Promise.resolve();

  function publish(next: Partial<KeepAwakeState>) {
    state = { ...state, ...next };
    for (const listener of [...listeners]) listener(state);
  }

  function applyNative(status: KeepAwakeNativeStatus | null) {
    if (status === null) {
      publish({ availability: "unavailable", enabled: false, error: null });
    } else {
      publish({
        availability: status.supported ? "supported" : "unsupported",
        enabled: status.supported && status.enabled,
        error: null,
      });
    }
  }

  function enqueue<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(task, task);
    queue = run.catch(() => undefined);
    return run;
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    refresh() {
      return enqueue(async () => {
        try {
          applyNative(await bridge.status());
        } catch (error) {
          publish({ error: errorMessage(error) });
        }
        return state;
      });
    },
    setEnabled(enabled) {
      return enqueue(async () => {
        if (state.availability === "unavailable" || state.availability === "unsupported") {
          publish({
            error:
              state.availability === "unavailable"
                ? "Keep awake is only available in the desktop app."
                : "Keep awake is not supported on this platform.",
          });
          return state;
        }
        publish({ pending: true });
        try {
          applyNative(await bridge.set(enabled));
        } catch (error) {
          publish({ error: errorMessage(error) });
        }
        publish({ pending: false });
        return state;
      });
    },
  };
}

let shared: KeepAwakeService | null = null;

/** Process-wide service wired to the narrow desktop-native bridge. */
export function getKeepAwakeService(): KeepAwakeService {
  shared ??= createKeepAwakeService({
    async status() {
      const { keepAwakeStatusNative } = await import("@/lib/desktop-native");
      return keepAwakeStatusNative();
    },
    async set(enabled) {
      const { setKeepAwakeNative } = await import("@/lib/desktop-native");
      return setKeepAwakeNative(enabled);
    },
  });
  return shared;
}
