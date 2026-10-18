import type { TerminalEvent } from "./terminal-manager";

export interface TerminalEventsListener {
  onEvent: (event: TerminalEvent) => void;
  onOpen: () => void;
  onDisconnect: () => void;
}
type EventSourceLike = Pick<EventSource, "onopen" | "onerror" | "onmessage" | "close">;
interface Environment {
  createSource: (url: string) => EventSourceLike;
  lifecycle: Pick<Window, "addEventListener" | "removeEventListener">;
  online: () => boolean;
  defer: (callback: () => void) => void;
  setRetry: (callback: () => void) => ReturnType<typeof setTimeout>;
  clearRetry: (timer: ReturnType<typeof setTimeout>) => void;
}

/** All mounted tabs keep leases through one stream, including hidden tabs. */
export function createTerminalEventsClient(env: Environment) {
  const entries = new Map<string, { listeners: Set<TerminalEventsListener>; after?: number; ended: boolean }>();
  let source: EventSourceLike | null = null;
  let retry: ReturnType<typeof setTimeout> | null = null;
  let queued = false;
  let pageHidden = false;
  let listening = false;
  const notifyDisconnected = () => {
    for (const entry of entries.values()) if (!entry.ended) for (const listener of entry.listeners) listener.onDisconnect();
  };
  const close = () => {
    const old = source;
    source = null;
    if (old) { old.onopen = null; old.onmessage = null; old.onerror = null; old.close(); }
    if (retry !== null) env.clearRetry(retry);
    retry = null;
  };
  const connect = () => {
    close();
    const terminals = [...entries].filter(([, entry]) => !entry.ended).map(([id, entry]) => ({ id, after: entry.after }));
    if (!terminals.length || pageHidden || !env.online()) return;
    const next = env.createSource(`/api/terminal/events?terminals=${encodeURIComponent(JSON.stringify(terminals))}`);
    source = next;
    next.onopen = () => {
      if (source !== next) return;
      for (const entry of entries.values()) if (!entry.ended) for (const listener of entry.listeners) listener.onOpen();
    };
    next.onmessage = (message) => {
      if (source !== next) return;
      let envelope: { id: string; event: TerminalEvent };
      try { envelope = JSON.parse(message.data); } catch { return; }
      const entry = entries.get(envelope.id);
      const event = envelope.event;
      if (!entry || entry.ended || !event) return;
      if (event.type === "output") {
        if (typeof event.data !== "string" || !Number.isSafeInteger(event.offset) || event.offset < 0) return;
        if (!event.reset && entry.after !== undefined && event.offset <= entry.after) return;
        entry.after = event.offset;
      } else if (event.type === "exit" || event.type === "closed") {
        entry.ended = true;
      } else return;
      for (const listener of [...entry.listeners]) listener.onEvent(event);
      if (entry.ended) schedule();
    };
    next.onerror = () => {
      if (source !== next) return;
      // Native EventSource would reconnect with its original URL/cursors.
      // Replace it only after closing, and rebuild from delivered offsets.
      close();
      notifyDisconnected();
      retry = env.setRetry(() => { retry = null; connect(); });
    };
  };
  const schedule = () => {
    close();
    notifyDisconnected();
    if (queued) return;
    queued = true;
    env.defer(() => { queued = false; connect(); });
  };
  const suspend = () => { close(); notifyDisconnected(); };
  const hide = () => { pageHidden = true; suspend(); };
  const show = () => { pageHidden = false; schedule(); };
  const lifecycle = (add: boolean) => {
    if (listening === add) return;
    listening = add;
    const method = add ? "addEventListener" : "removeEventListener";
    env.lifecycle[method]("pagehide", hide);
    env.lifecycle[method]("pageshow", show);
    env.lifecycle[method]("offline", suspend);
    env.lifecycle[method]("online", schedule);
  };
  return {
    subscribe(id: string, listener: TerminalEventsListener, after?: number) {
      let entry = entries.get(id);
      if (!entry) {
        entry = { listeners: new Set(), after, ended: false };
        entries.set(id, entry);
      }
      entry.listeners.add(listener);
      lifecycle(true);
      schedule();
      let subscribed = true;
      return () => {
        if (!subscribed) return;
        subscribed = false;
        entry.listeners.delete(listener);
        if (!entry.listeners.size) entries.delete(id);
        schedule();
        if (!entries.size) lifecycle(false);
      };
    },
  };
}

type TerminalEventsClient = ReturnType<typeof createTerminalEventsClient>;
declare global { interface Window { __piTerminalEventsClient?: TerminalEventsClient } }

export function subscribeTerminalEvents(id: string, listener: TerminalEventsListener, after?: number): () => void {
  // Window ownership survives HMR and prevents separate bundles opening streams.
  const client = window.__piTerminalEventsClient ??= createTerminalEventsClient({
    createSource: (url) => new EventSource(url),
    lifecycle: window,
    online: () => navigator.onLine,
    defer: (callback) => queueMicrotask(callback),
    setRetry: (callback) => setTimeout(callback, 1000),
    clearRetry: (timer) => clearTimeout(timer),
  });
  return client.subscribe(id, listener, after);
}
