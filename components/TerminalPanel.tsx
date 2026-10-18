"use client";

import { useEffect, useRef, useState } from "react";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ITheme } from "@xterm/xterm";
import { useI18n } from "@/hooks/useI18n";
import { useTheme } from "@/hooks/useTheme";
import { copyText } from "@/lib/clipboard";
import { useTerminalAppearance } from "@/lib/terminal-appearance";
import { createTerminalWriter, terminalRequest } from "@/lib/terminal-client";
import { subscribeTerminalEvents } from "@/lib/terminal-events-client";
import type { TerminalTab } from "./terminal-tab-state";

interface Props {
  tab: TerminalTab;
  active: boolean;
  onRestart: () => void;
  onClosed: () => void;
  onCloseError: () => void;
}

function terminalTheme(container: HTMLElement): ITheme {
  const style = getComputedStyle(container);
  return {
    background: style.getPropertyValue("--pilaude-terminal-background").trim(),
    foreground: style.getPropertyValue("--pilaude-terminal-foreground").trim(),
    cursor: style.getPropertyValue("--pilaude-terminal-cursor").trim(),
    cursorAccent: style.getPropertyValue("--pilaude-terminal-background").trim(),
    selectionBackground: style.getPropertyValue("--pilaude-terminal-selection").trim(),
  };
}

export function TerminalPanel({ tab, active, onRestart, onClosed, onCloseError }: Props) {
  const { t } = useI18n();
  const { theme } = useTheme();
  const { appearance } = useTerminalAppearance();
  const appearanceRef = useRef(appearance);
  appearanceRef.current = appearance;
  const { id, cwd, restored } = tab;
  const containerRef = useRef<HTMLDivElement>(null);
  const terminalRef = useRef<Terminal | null>(null);
  const startRef = useRef<Promise<void>>(Promise.resolve());
  const writerRef = useRef<ReturnType<typeof createTerminalWriter> | null>(null);
  const callbacksRef = useRef({ onClosed, onCloseError });
  callbacksRef.current = { onClosed, onCloseError };
  const [status, setStatus] = useState<"connecting" | "ready" | "exited" | "error">("connecting");
  const [error, setError] = useState<string | null>(null);
  const [exitCode, setExitCode] = useState<number | null>(null);
  const [reconnectKey, setReconnectKey] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let disposed = false;
    let unsubscribeEvents: (() => void) | null = null;
    let connected = false;
    let exited = false;
    let inputFailed = false;
    setStatus("connecting");
    setError(null);
    setExitCode(null);

    const terminal = new Terminal({
      cursorStyle: appearanceRef.current.cursorStyle,
      cursorBlink: appearanceRef.current.cursorBlink,
      fontFamily: getComputedStyle(container).getPropertyValue("--pilaude-terminal-font").trim() || "monospace",
      fontSize: 12,
      lineHeight: 1.1,
      scrollback: appearanceRef.current.scrollback,
      screenReaderMode: true,
      disableStdin: true,
      theme: terminalTheme(container),
    });
    terminalRef.current = terminal;
    const fit = new FitAddon();
    terminal.loadAddon(fit);
    terminal.open(container);
    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown") return true;
      const key = event.key.toLowerCase();
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === "Backslash") return false;
      if ((event.ctrlKey || event.metaKey) && key === "v") return false;
      if ((event.ctrlKey || event.metaKey) && key === "c" && terminal.hasSelection()) return false;
      return true;
    });

    const writer = createTerminalWriter(id, (reason) => {
      if (disposed) return;
      inputFailed = true;
      terminal.options.disableStdin = true;
      setError(reason.message);
      setStatus("error");
    });
    writerRef.current = writer;
    const onData = terminal.onData((data) => {
      if (connected && !exited && !inputFailed) writer.write(data);
    });
    const onSelectionChange = terminal.onSelectionChange(() => {
      if (!appearanceRef.current.copyOnSelect) return;
      const selection = terminal.getSelection();
      if (selection) void copyText(selection).catch(() => {});
    });
    const fitAndResize = () => {
      if (!container.offsetWidth || !container.offsetHeight) return;
      fit.fit();
    };
    const onResize = terminal.onResize(({ cols, rows }) => {
      if (connected && !exited && !inputFailed) writer.resize(cols, rows);
    });
    const resizeObserver = new ResizeObserver(fitAndResize);
    resizeObserver.observe(container);

    const connect = () => {
      if (disposed || exited) return;
      unsubscribeEvents = subscribeTerminalEvents(id, {
        onEvent(event) {
          if (disposed) return;
          if (event.type === "output") {
            if (event.reset) terminal.reset();
            terminal.write(event.data);
          } else {
            exited = true;
            connected = false;
            terminal.options.disableStdin = true;
            setExitCode(event.type === "exit" ? event.exitCode : null);
            setStatus("exited");
          }
        },
        onOpen() {
          if (disposed || exited) return;
          connected = true;
          if (inputFailed) return;
          terminal.options.disableStdin = false;
          setStatus("ready");
          fitAndResize();
          writer.resize(terminal.cols, terminal.rows);
          if (container.offsetWidth && container.offsetHeight) terminal.focus();
        },
        onDisconnect() {
          if (disposed || exited) return;
          connected = false;
          terminal.options.disableStdin = true;
          if (!inputFailed) setStatus("connecting");
        },
      });
    };

    startRef.current = (async () => {
      fitAndResize();
      if (restored || reconnectKey > 0) {
        // Restoring a tab must never silently launch a replacement shell.
        await terminalRequest(`/api/terminal/${encodeURIComponent(id)}`);
      } else {
        await terminalRequest("/api/terminal", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, cwd, cols: terminal.cols, rows: terminal.rows }),
        });
      }
      connect();
    })().catch((reason: Error) => {
      if (disposed) return;
      setError(reason.message);
      setStatus("error");
    });

    return () => {
      disposed = true;
      unsubscribeEvents?.();
      void writer.stop();
      resizeObserver.disconnect();
      onData.dispose();
      onSelectionChange.dispose();
      onResize.dispose();
      terminal.dispose();
      terminalRef.current = null;
    };
  }, [id, cwd, restored, reconnectKey]);

  useEffect(() => {
    const terminal = terminalRef.current;
    if (!terminal) return;
    terminal.options.cursorStyle = appearance.cursorStyle;
    terminal.options.cursorBlink = appearance.cursorBlink;
    terminal.options.scrollback = appearance.scrollback;
  }, [appearance]);

  useEffect(() => {
    const terminal = terminalRef.current;
    const container = containerRef.current;
    if (terminal && container) terminal.options.theme = terminalTheme(container);
  }, [theme]);

  useEffect(() => {
    if (active) terminalRef.current?.focus();
  }, [active]);

  useEffect(() => {
    if (!tab.closing) return;
    let cancelled = false;
    if (terminalRef.current) terminalRef.current.options.disableStdin = true;
    void (async () => {
      await startRef.current;
      await writerRef.current?.stop();
      await terminalRequest(`/api/terminal/${encodeURIComponent(id)}`, { method: "DELETE", keepalive: true });
      if (!cancelled) callbacksRef.current.onClosed();
    })().catch((reason: Error) => {
      if (cancelled) return;
      setError(reason.message);
      setStatus("error");
      callbacksRef.current.onCloseError();
    });
    return () => { cancelled = true; };
  }, [id, tab.closing]);

  return (
    <section className="terminal-panel" aria-label={t("terminal.title")} aria-description={cwd} data-status={status}>
      {(status === "error" || status === "exited") && <header className="terminal-panel-header">
        <div className="terminal-panel-path">
          <span className={`terminal-status-dot is-${status}`} title={t(`terminal.${status}`)} />
          <span title={cwd}>{cwd}</span>
        </div>
        {status === "error" && (
          <button type="button" onClick={() => setReconnectKey((key) => key + 1)} disabled={Boolean(tab.closing)} title={t("terminal.reconnect")} aria-label={t("terminal.reconnect")}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2" />
            </svg>
          </button>
        )}
        <button type="button" onClick={onRestart} disabled={Boolean(tab.closing)} title={t("terminal.restart")} aria-label={t("terminal.restart")}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M20 11a8 8 0 1 0-2.34 5.66" /><polyline points="20 4 20 11 13 11" />
          </svg>
        </button>
      </header>}
      <div>
        {error && <div className="terminal-panel-error" role="alert">{error}</div>}
        {status === "exited" && <div className="terminal-panel-exit" role="status">{exitCode === null ? t("terminal.exited") : t("terminal.exitCode", { code: exitCode })}</div>}
      </div>
      <div className="terminal-xterm"><div ref={containerRef} className="terminal-xterm-host" /></div>
    </section>
  );
}
