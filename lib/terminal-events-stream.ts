import { subscribeTerminal, type TerminalEvent } from "./terminal-manager";

const MAX_TERMINALS = 64;
const MAX_QUERY_LENGTH = 8192;
const MAX_QUEUE_BYTES = 256 * 1024;
const OUTPUT_CHUNK = 8192;

type Subscription = NonNullable<ReturnType<typeof subscribeTerminal>>;
type Subscribe = (id: string, listener: (event: TerminalEvent) => void, after?: number) => Subscription | null;
type Pending = { id: string; event: TerminalEvent; position: number; cost: number };

/** Dependency seam tests the real stream/cleanup without creating native PTYs. */
export function terminalEventsResponse(req: Request, subscribe: Subscribe = subscribeTerminal): Response {
  const raw = new URL(req.url).searchParams.get("terminals");
  let terminals: { id: string; after?: number }[];
  try {
    if (!raw || raw.length > MAX_QUERY_LENGTH) throw new Error();
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value) || !value.length || value.length > MAX_TERMINALS) throw new Error();
    const ids = new Set<string>();
    terminals = value.map((item: unknown) => {
      if (!item || typeof item !== "object") throw new Error();
      const { id, after } = item as Record<string, unknown>;
      if (typeof id !== "string" || !/^[a-f0-9]{32}$/.test(id) || ids.has(id)) throw new Error();
      if (after !== undefined && (typeof after !== "number" || !Number.isSafeInteger(after) || after < 0)) throw new Error();
      ids.add(id);
      return { id, after: after as number | undefined };
    });
  } catch { return new Response("Invalid terminal subscriptions", { status: 400 }); }

  let closeStream: (closeController: boolean) => void = () => {};
  let pull: () => void = () => {};
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder();
      const subscriptions = new Map<string, () => void>();
      const pending: Pending[] = [];
      let liveBytes = 0;
      let closed = false;
      let initializing = true;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      const cleanup = (closeController: boolean) => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        for (const unsubscribe of subscriptions.values()) unsubscribe();
        subscriptions.clear();
        pending.length = 0;
        req.signal.removeEventListener("abort", abort);
        if (closeController) { try { controller.close(); } catch { /* cancelled */ } }
      };
      const abort = () => cleanup(true);
      const enqueue = (text: string) => {
        if (closed) return false;
        try { controller.enqueue(encoder.encode(text)); return true; } catch { cleanup(false); return false; }
      };
      const drain = () => {
        if (closed || initializing) return;
        while (pending.length && (controller.desiredSize ?? 0) > 0) {
          const item = pending[0];
          let event = item.event;
          if (event.type === "output") {
            let end = Math.min(event.data.length, item.position + OUTPUT_CHUNK);
            // Keep UTF-16 surrogate pairs together while cursors remain code units.
            if (end < event.data.length && end > item.position && /[\uD800-\uDBFF]/.test(event.data[end - 1])) end -= 1;
            event = { type: "output", data: event.data.slice(item.position, end),
              offset: event.offset - event.data.length + end,
              ...(item.position === 0 && event.reset ? { reset: true } : {}) };
            item.position = end;
          }
          if (!enqueue(`data: ${JSON.stringify({ id: item.id, event })}\n\n`)) return;
          if (item.event.type !== "output" || item.position >= item.event.data.length) {
            liveBytes -= item.cost;
            pending.shift();
          }
        }
        if (!pending.length && !subscriptions.size) cleanup(true);
      };
      const send = (id: string, event: TerminalEvent, replay = false) => {
        if (closed) return;
        // Initial snapshots are bounded by terminal-manager's 128KiB backlog
        // and MAX_TERMINALS. Pull encodes them in small frames, so several full
        // histories (or JSON-escaped control output) cannot overflow the queue.
        const cost = replay ? 0 : (event.type === "output" ? event.data.length * 2 : 0) + 128;
        if (liveBytes + cost > MAX_QUEUE_BYTES) { cleanup(true); return; }
        liveBytes += cost;
        pending.push({ id, event, position: 0, cost });
        if (event.type !== "output") {
          subscriptions.get(id)?.();
          subscriptions.delete(id);
        }
        drain();
      };
      closeStream = cleanup;
      pull = drain;
      req.signal.addEventListener("abort", abort, { once: true });
      if (req.signal.aborted) { abort(); return; }
      enqueue(":\n\n");
      for (const { id, after } of terminals) {
        if (closed) break;
        const subscription = subscribe(id, (event) => send(id, event), after);
        if (!subscription) { send(id, { type: "closed" }, true); continue; }
        if (closed) { subscription.unsubscribe(); break; }
        subscriptions.set(id, subscription.unsubscribe);
        send(id, subscription.output, true);
        if (subscription.exited) send(id, { type: "exit", exitCode: subscription.exitCode ?? 0 }, true);
      }
      initializing = false;
      drain();
      if (closed) return;
      heartbeat = setInterval(() => {
        if (!pending.length && (controller.desiredSize ?? 0) > 0) enqueue(":\n\n");
      }, 30_000);
    },
    pull() { pull(); },
    cancel() { closeStream(false); },
  }, { highWaterMark: 64 * 1024, size: (chunk) => chunk.byteLength });
  return new Response(stream, { headers: {
    "Content-Type": "text/event-stream", "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive", "X-Accel-Buffering": "no",
  } });
}
