"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { SessionStatsInfo } from "@/lib/pi-types";
import type { SessionInfo } from "@/lib/types";
import { useI18n } from "@/hooks/useI18n";
import { PilaudeIcon } from "./PilaudeIcon";
import { focusModalPanel } from "@/lib/stacked-dialog";
import { getContextPresentation } from "@/lib/panel-layout";

interface Props {
  session: SessionInfo | null;
  cwd: string;
  stats: SessionStatsInfo | null;
  usage: { percent: number | null; contextWindow: number; tokens: number | null } | null;
  toolCount: number | null;
  onOpenConnectors: () => void;
  onOpenFiles: () => void;
  onOpenChanges?: () => void;
  /** False for a chat: it has no project files to review. */
  showChanges?: boolean;
  onOpenContext: () => void;
  onOpenTools: () => void;
  onClose: () => void;
  rightPanelOpen: boolean;
  rightPanelFullWidth: boolean;
}

function shortCount(value: number | null | undefined): string {
  if (value == null) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}m`;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toLocaleString();
}

export function PilaudeWorkspaceContext({ session, cwd, stats, usage, toolCount, onOpenConnectors, onOpenFiles, onOpenChanges, showChanges = true, onOpenContext, onOpenTools, onClose, rightPanelOpen, rightPanelFullWidth }: Props) {
  const { t } = useI18n();
  const paneRef = useRef<HTMLElement>(null);
  const [presentation, setPresentation] = useState<ReturnType<typeof getContextPresentation>>("dock");
  const isModal = presentation === "modal";
  useLayoutEffect(() => {
    const pane = paneRef.current;
    return () => {
      if (pane?.dataset.presentation === "floating" && pane.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(".pilaude-context-toggle")?.focus({ preventScroll: true });
      }
    };
  }, []);
  useLayoutEffect(() => {
    const container = paneRef.current?.parentElement;
    if (!container) return;
    let composer: HTMLElement | null = null;
    let composerAncestors: HTMLElement[] = [];
    const update = () => {
      const nextComposer = container.querySelector<HTMLElement>(".chat-input-shell");
      if (nextComposer !== composer) {
        for (const element of composerAncestors) observer.unobserve(element);
        composer = nextComposer;
        composerAncestors = [];
        // Extension widgets below the editor can move it without resizing it.
        for (let element = composer; element && element !== container; element = element.parentElement) {
          composerAncestors.push(element);
          observer.observe(element);
        }
      }
      setPresentation(getContextPresentation({ availableWidth: container.clientWidth, viewportWidth: window.innerWidth, rightPanelOpen, rightPanelFullWidth }));
      const bounds = container.getBoundingClientRect();
      const composerTop = composer?.getBoundingClientRect().top ?? bounds.bottom;
      paneRef.current?.style.setProperty("--context-available-height", `${Math.max(0, Math.min(bounds.height, composerTop - bounds.top - 8))}px`);
    };
    const observer = new ResizeObserver(update);
    const children = new MutationObserver(() => {
      if (composer !== container.querySelector(".chat-input-shell")) update();
    });
    update();
    observer.observe(container);
    children.observe(container, { childList: true, subtree: true });
    window.addEventListener("resize", update);
    return () => { observer.disconnect(); children.disconnect(); window.removeEventListener("resize", update); };
  }, [rightPanelOpen, rightPanelFullWidth]);
  useLayoutEffect(() => {
    if (presentation !== "modal" && presentation !== "floating") return;
    const restoreFocus = isModal ? focusModalPanel(document, paneRef.current, { restoreTextEntry: false }) : () => {};
    const focusable = () => [...(paneRef.current?.querySelectorAll<HTMLElement>('summary,button:not([disabled]),a[href],input:not([disabled]),[tabindex]:not([tabindex="-1"])') ?? [])].filter(element => element.getClientRects().length > 0);
    if (isModal) (focusable()[0] ?? paneRef.current)?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.isComposing || event.keyCode === 229) return;
        if (!isModal && !paneRef.current?.contains(document.activeElement) && !document.activeElement?.closest(".pilaude-context-toggle")) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose();
      } else if (isModal && event.key === "Tab") {
        const elements = focusable();
        const index = elements.indexOf(document.activeElement as HTMLElement);
        if (index < 0 || (event.shiftKey ? index === 0 : index === elements.length - 1)) {
          event.preventDefault();
          (event.shiftKey ? elements.at(-1) : elements[0])?.focus();
        }
      }
    };
    document.addEventListener("keydown", keydown, true);
    return () => {
      document.removeEventListener("keydown", keydown, true);
      restoreFocus();
    };
  }, [presentation, isModal, onClose]);
  const open = (action: () => void) => { if (isModal) onClose(); action(); };
  const [machine, setMachine] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/desktop/environment", { signal: controller.signal })
      .then(response => response.ok ? response.json() : null)
      .then(data => { if (!controller.signal.aborted && typeof data?.hostname === "string") setMachine(data.hostname); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  const context = usage ?? stats?.contextUsage;
  const used = context?.percent == null ? null : Math.min(100, Math.max(0, context.percent));
  const rows = [
    { label: t("session.input"), value: stats?.tokens.input, color: "#327dd6" },
    { label: t("session.output"), value: stats?.tokens.output, color: "#ed734c" },
    { label: t("session.cacheRead"), value: stats?.tokens.cacheRead, color: "#26a87c" },
    { label: t("session.cacheWrite"), value: stats?.tokens.cacheWrite, color: "#dda632" },
  ];
  const projectName = cwd.split(/[\\/]/).filter(Boolean).at(-1) || cwd;
  return (
    <>
    {isModal && <button type="button" className="pilaude-context-backdrop" aria-label={t("i18n.close")} onClick={onClose} />}
    <aside ref={paneRef} tabIndex={-1} hidden={presentation === "hidden"} role={isModal ? "dialog" : undefined} aria-modal={isModal || undefined} data-presentation={presentation} className={`pilaude-context-dock${presentation === "modal" || presentation === "floating" ? " is-overlay" : ""}`} aria-label={t("pilaude.contextPanel")}>
      <details className="pilaude-context-card" open>
        <summary>{t("pilaude.environment")}<PilaudeIcon name="chevron" size={14} /></summary>
        <div className="pilaude-context-card-body">
          <div className="pilaude-environment-row"><PilaudeIcon name="computer" /><span>{machine ?? t("pilaude.thisComputer")}</span></div>
          {cwd && <button className="pilaude-environment-row" onClick={() => open(onOpenFiles)} title={cwd}><PilaudeIcon name="folder" /><span>{projectName}</span><small>{cwd.match(/^[A-Za-z]:/)?.[0] ?? ""}</small></button>}
          {session?.branch && <div className="pilaude-environment-row" title={session.branch}><PilaudeIcon name="branch" /><span>{session.branch}</span>{session.isWorktree && <small>Worktree</small>}</div>}
        </div>
      </details>
      <details className="pilaude-context-card" open>
        <summary>{t("session.context")}<PilaudeIcon name="chevron" size={14} /></summary>
        <div className="pilaude-context-card-body">
          {used == null ? <p className="pilaude-context-empty">{t("pilaude.contextEmpty")}</p> : <>
          <button className="pilaude-context-usage" onClick={() => open(onOpenContext)}>
            <span>{used == null ? "—" : `${used.toFixed(0)}%`} {t("pilaude.contextUsed")}</span>
            <small>{shortCount(context?.tokens)} / {shortCount(context?.contextWindow)}</small>
          </button>
          <div className="pilaude-context-meter" role="progressbar" aria-label={t("session.context")} aria-valuenow={used ?? undefined} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${used ?? 0}%` }} /></div>
          <div className="pilaude-token-rows">{rows.map(row => <div className="pilaude-token-row" key={row.label}><i style={{ background: row.color }} /><span>{row.label}</span><small>{shortCount(row.value)}</small></div>)}</div>
          <div className="pilaude-context-rule" />
          <div className="pilaude-token-row"><i style={{ background: "#a5a59a" }} /><span>{t("pilaude.messages")}</span><small>{shortCount(stats?.totalMessages)}</small></div>
          <button className="pilaude-context-link" onClick={() => open(onOpenContext)}><PilaudeIcon name="chevron" size={14} /><span>{t("session.toolCalls")}</span><small>{shortCount(stats?.toolCalls)}</small></button>
          <button className="pilaude-context-link" onClick={() => open(onOpenTools)}><PilaudeIcon name="chevron" size={14} /><span>{t("pilaude.availableTools")}</span><small>{shortCount(toolCount)}</small></button>
          </>}
        </div>
      </details>
      <button className="pilaude-context-card pilaude-context-card-action" onClick={() => open(onOpenConnectors)}><span>{t("pilaude.connectors")}</span><PilaudeIcon name="chevron" size={14} /></button>
      {showChanges && (
        <details className="pilaude-context-card" open>
          <summary>{t("pilaude.changes")}<PilaudeIcon name="chevron" size={14} /></summary>
          <button className="pilaude-environment-row pilaude-changes-link" onClick={() => open(onOpenChanges ?? onOpenFiles)}><PilaudeIcon name="changes" /><span>{t("pilaude.reviewFiles")}</span><PilaudeIcon name="chevron" size={14} /></button>
        </details>
      )}
    </aside>
    </>
  );
}
