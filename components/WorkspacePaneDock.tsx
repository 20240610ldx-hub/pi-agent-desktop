"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type PointerEvent, type KeyboardEvent, type HTMLAttributes } from "react";
import { APP_PREF_KEYS, getPrefJson, setPrefJson } from "@/lib/app-prefs";
import { WorkspaceControlButton } from "./WorkspacePaneControls";
import { isImeComposing } from "@/lib/ime";
import {
  getWorkspacePaneGridStyle, normalizeWorkspacePaneLayout, reconcileWorkspacePanes, resizeWorkspacePaneColumn,
  splitWorkspacePaneColumn, toggleWorkspacePaneExpanded, type WorkspacePaneLayout,
} from "@/lib/workspace-pane-layout";

export interface WorkspacePane {
  id: string;
  title: string;
  open: boolean;
  header?: ReactNode;
  /** A pane with its own toolbar still receives the dock's expansion/chrome state. */
  customHeader?: boolean;
  children: ReactNode | ((visible: boolean, chrome: WorkspacePaneChrome) => ReactNode);
  onClose: () => void;
  /** A real consumer, or a discoverable reason why this pane cannot pop out yet. */
  popout?: { label: string; onOpen?: () => void; disabledReason?: string };
}

export interface WorkspacePaneChrome {
  expanded: boolean;
  onExpand: () => void;
  overlayControls?: ReactNode;
  hasWindowControls: boolean;
  macWindowInset: boolean;
}

interface Props {
  panes: WorkspacePane[];
  expandLabel: string;
  restoreLabel: string;
  closeLabel: string;
  resizeColumnLabel: string;
  resizeRowsLabel: string;
  revealRequest?: { id: string } | null;
  /** Window chrome follows the upper-right visible pane, outside its scroller. */
  windowControls?: ReactNode;
  overlayControls?: ReactNode;
  macWindowInset?: boolean;
  headerDragProps?: HTMLAttributes<HTMLElement> & { "data-tauri-drag-region"?: true };
}

const MIN_PANE_HEIGHT = 160;
const SEPARATOR_SIZE = 8;
type Drag = {
  pointerId: number;
  target: HTMLDivElement;
  columnId: string;
  axis: "column" | "row";
  start: number;
  size: number;
  width: number;
  split: number;
  original: WorkspacePaneLayout;
};

/** Fixed sibling hosts: moving or hiding a pane must not remount a PTY or iframe. */
export function WorkspacePaneDock({ panes, expandLabel, restoreLabel, closeLabel, resizeColumnLabel, resizeRowsLabel, revealRequest, windowControls, overlayControls, macWindowInset = false, headerDragProps }: Props) {
  const [saved, setSaved] = useState(() => normalizeWorkspacePaneLayout(null));
  const [hydrated, setHydrated] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const [dragging, setDragging] = useState(false);
  const openIds = JSON.stringify(panes.filter((pane) => pane.open).map((pane) => pane.id));
  const layout = useMemo(() => reconcileWorkspacePanes(saved, JSON.parse(openIds) as string[]), [saved, openIds]);
  const expanded = layout.expandedPaneId;
  const chromePaneId = expanded ?? layout.columns.at(-1)?.paneIds[0];
  const overlayPaneId = expanded ?? layout.columns[0]?.paneIds[0];
  const multipleColumns = !expanded && layout.columns.length > 1;

  useEffect(() => {
    setSaved(normalizeWorkspacePaneLayout(getPrefJson(APP_PREF_KEYS.workspacePaneLayout)));
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    // Commit reconciliation too, so a later reopen uses the surviving columns.
    if (JSON.stringify(saved) !== JSON.stringify(layout)) setSaved(layout);
    if (!dragging) setPrefJson(APP_PREF_KEYS.workspacePaneLayout, layout);
  }, [dragging, hydrated, layout, saved]);

  useEffect(() => {
    if (!revealRequest) return;
    setSaved((current) => current.expandedPaneId && current.expandedPaneId !== revealRequest.id
      ? { ...current, expandedPaneId: null } : current);
    // Horizontal scrolling keeps every narrow pane accessible without moving hosts.
    const frame = requestAnimationFrame(() => {
      gridRef.current?.querySelector<HTMLElement>(`#workspace-pane-${revealRequest.id}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
    return () => cancelAnimationFrame(frame);
  }, [revealRequest]);

  const endDrag = useCallback((rollback = false) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (rollback) setSaved(drag.original);
    setDragging(false);
    try {
      if (drag.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId);
    } catch { /* Capture may already have been released by the browser. */ }
  }, []);
  const begin = (event: PointerEvent<HTMLDivElement>, columnId: string, axis: Drag["axis"]) => {
    if (event.button !== 0 || expanded || dragRef.current) return;
    const column = layout.columns.find((item) => item.id === columnId);
    if (!column) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { return; }
    const host = gridRef.current?.querySelector<HTMLElement>(`[data-pane-column="${columnId}"]`);
    dragRef.current = {
      pointerId: event.pointerId, target: event.currentTarget, columnId, axis,
      start: axis === "row" ? event.clientY : event.clientX,
      size: gridRef.current?.clientHeight || 1,
      width: host?.getBoundingClientRect().width ?? column.width,
      split: column.split, original: layout,
    };
    setDragging(true);
  };
  const move = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (event.pointerType === "mouse" && event.buttons === 0) { endDrag(); return; }
    event.preventDefault();
    const delta = (drag.axis === "row" ? event.clientY : event.clientX) - drag.start;
    const minimumSplit = Math.max(.2, (MIN_PANE_HEIGHT + SEPARATOR_SIZE / 2) / drag.size);
    const ratio = Math.max(minimumSplit, Math.min(1 - minimumSplit, drag.split + delta / drag.size));
    setSaved(drag.axis === "row"
      ? splitWorkspacePaneColumn(drag.original, drag.columnId, ratio)
      : resizeWorkspacePaneColumn(drag.original, drag.columnId, drag.width + delta));
  };
  const resizeKey = (event: KeyboardEvent<HTMLDivElement>, columnId: string, axis: Drag["axis"]) => {
    if (isImeComposing(event)) return;
    const column = layout.columns.find((item) => item.id === columnId);
    if (!column) return;
    const step = event.shiftKey ? 40 : 12;
    const negative = axis === "row" ? "ArrowUp" : "ArrowLeft";
    const positive = axis === "row" ? "ArrowDown" : "ArrowRight";
    if (![negative, positive, "Home", "End", "Enter"].includes(event.key)) return;
    event.preventDefault(); event.stopPropagation();
    const direction = event.key === negative ? -1 : 1;
    const minSplit = Math.max(.2, (MIN_PANE_HEIGHT + SEPARATOR_SIZE / 2) / (gridRef.current?.clientHeight || 820));
    const ratio = event.key === "Home" ? minSplit : event.key === "End" ? 1 - minSplit : event.key === "Enter" ? .5 : column.split + direction * .03;
    setSaved(axis === "row"
      ? splitWorkspacePaneColumn(layout, columnId, Math.max(minSplit, Math.min(1 - minSplit, ratio)))
      : resizeWorkspacePaneColumn(layout, columnId, event.key === "Home" ? 280 : event.key === "End" ? 1200 : event.key === "Enter" ? 400 : column.width + direction * step));
  };
  useEffect(() => {
    if (!dragging) return;
    const cancel = () => endDrag(true);
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || isImeComposing(event) || !dragRef.current) return;
      event.preventDefault(); event.stopImmediatePropagation();
      endDrag(true);
    };
    const visibility = () => { if (document.visibilityState !== "visible") cancel(); };
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("keydown", escape, true);
    return () => {
      window.removeEventListener("blur", cancel);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("keydown", escape, true);
    };
  }, [dragging, endDrag]);
  useEffect(() => () => {
    const drag = dragRef.current;
    dragRef.current = null;
    try { if (drag?.target.hasPointerCapture(drag.pointerId)) drag.target.releasePointerCapture(drag.pointerId); } catch { /* Removed host. */ }
  }, []);

  return (
    <div className={`workspace-pane-dock${multipleColumns ? " has-multiple-columns" : ""}${expanded ? " has-expanded-pane" : ""}${dragging ? " is-resizing" : ""}`}>
      {windowControls && <div className="workspace-pane-window-controls">{windowControls}</div>}
      <div className="workspace-pane-scroll">
      <div ref={gridRef} className="workspace-pane-grid" style={getWorkspacePaneGridStyle(layout)}>
        {panes.map((pane) => {
          const columnIndex = layout.columns.findIndex((column) => column.paneIds.includes(pane.id));
          const column = layout.columns[columnIndex];
          const index = column?.paneIds.indexOf(pane.id) ?? 0;
          const visible = Boolean(pane.open && column && (!expanded || expanded === pane.id));
          const stacked = !expanded && column?.paneIds.length === 2;
          const fraction = index === 0 ? column?.split : 1 - (column?.split ?? .5);
          return (
            <section key={pane.id} id={`workspace-pane-${pane.id}`} data-pane-column={column?.id}
              className={`workspace-pane workspace-pane--${pane.id}${pane.customHeader && pane.id === chromePaneId && windowControls ? " has-window-controls" : ""}${pane.customHeader && pane.id === overlayPaneId && macWindowInset ? " has-mac-window-inset" : ""}`} hidden={!visible} aria-label={pane.title}
              style={{ gridColumn: expanded ? 1 : columnIndex * 2 + 1, gridRow: 1,
                alignSelf: index === 0 || expanded ? "start" : "end",
                height: stacked ? `clamp(${MIN_PANE_HEIGHT}px, calc(${(fraction ?? .5) * 100}% - 4px), calc(100% - ${MIN_PANE_HEIGHT + SEPARATOR_SIZE}px))` : "100%" }}>
              {!pane.customHeader && <header {...headerDragProps} className={`workspace-pane-header${pane.id === chromePaneId && windowControls ? " has-window-controls" : ""}${pane.id === overlayPaneId && macWindowInset ? " has-mac-window-inset" : ""}`}>
                {pane.header ?? <span className="workspace-pane-title">{pane.title}</span>}
                {pane.id === overlayPaneId && overlayControls}
                {pane.popout && <>
                  <WorkspaceControlButton className="file-workbench-icon-button workspace-pane-popout"
                    label={pane.popout.label} placement="top" aria-disabled={!pane.popout.onOpen || Boolean(pane.popout.disabledReason)}
                    aria-describedby={pane.popout.disabledReason ? `workspace-popout-reason-${pane.id}` : undefined}
                    tooltipDescription={pane.popout.disabledReason}
                    onClick={() => { if (!pane.popout?.disabledReason) pane.popout?.onOpen?.(); }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><rect x="8" y="4.7" width="13" height="10.4" rx="1.5" /><path d="M16 8.7H3v10.6h13V8.7" /></svg>
                  </WorkspaceControlButton>
                  {pane.popout.disabledReason && <span id={`workspace-popout-reason-${pane.id}`} hidden>{pane.popout.disabledReason}</span>}
                </>}
                <button type="button" className="file-workbench-icon-button workspace-pane-expand"
                  title={`${expanded === pane.id ? restoreLabel : expandLabel}: ${pane.title}`}
                  aria-label={`${expanded === pane.id ? restoreLabel : expandLabel}: ${pane.title}`}
                  aria-pressed={expanded === pane.id} onClick={() => setSaved(toggleWorkspacePaneExpanded(layout, pane.id))}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={expanded === pane.id ? "M4 9h5V4m11 11h-5v5M9 9 3 3m12 12 6 6" : "M14 4h6v6M10 20H4v-6m16-10-7 7M4 20l7-7"} /></svg>
                </button>
                <button type="button" className="file-workbench-icon-button workspace-pane-close" title={closeLabel.replace("{name}", pane.title)} aria-label={closeLabel.replace("{name}", pane.title)} onClick={pane.onClose}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
                </button>
              </header>}
              <div className="workspace-pane-content">{typeof pane.children === "function" ? pane.children(visible, {
                expanded: expanded === pane.id,
                onExpand: () => setSaved(toggleWorkspacePaneExpanded(layout, pane.id)),
                overlayControls: pane.id === overlayPaneId ? overlayControls : undefined,
                hasWindowControls: pane.id === chromePaneId && Boolean(windowControls),
                macWindowInset: pane.id === overlayPaneId && macWindowInset,
              }) : pane.children}</div>
            </section>
          );
        })}
        {!expanded && layout.columns.flatMap((column, index) => {
          const common = {
            onPointerMove: move,
            onPointerUp: (event: PointerEvent<HTMLDivElement>) => { if (dragRef.current?.pointerId === event.pointerId) endDrag(); },
            onPointerCancel: (event: PointerEvent<HTMLDivElement>) => { if (dragRef.current?.pointerId === event.pointerId) endDrag(true); },
            onLostPointerCapture: (event: PointerEvent<HTMLDivElement>) => { if (dragRef.current?.pointerId === event.pointerId) endDrag(true); },
          };
          return [
            column.paneIds.length === 2 && <div key={`${column.id}-row`} className="workspace-pane-separator is-horizontal" role="separator" tabIndex={0} aria-label={`${resizeRowsLabel} ${index + 1}`} aria-orientation="horizontal" aria-valuemin={20} aria-valuemax={80} aria-valuenow={Math.round(column.split * 100)}
              style={{ gridColumn: index * 2 + 1, gridRow: 1, top: `clamp(${MIN_PANE_HEIGHT}px, calc(${column.split * 100}% - 4px), calc(100% - ${MIN_PANE_HEIGHT + SEPARATOR_SIZE}px))` }} onPointerDown={(event) => begin(event, column.id, "row")} onKeyDown={(event) => resizeKey(event, column.id, "row")} {...common} />,
            index < layout.columns.length - 1 && <div key={`${column.id}-column`} className="workspace-pane-separator is-vertical" role="separator" tabIndex={0} aria-label={`${resizeColumnLabel} ${index + 1}`} aria-orientation="vertical" aria-valuemin={280} aria-valuemax={1200} aria-valuenow={column.width}
              style={{ gridColumn: index * 2 + 2, gridRow: 1 }} onPointerDown={(event) => begin(event, column.id, "column")} onKeyDown={(event) => resizeKey(event, column.id, "column")} {...common} />,
          ];
        })}
      </div>
      </div>
      {dragging && <div className="workspace-pane-resize-shield" aria-hidden="true" />}
    </div>
  );
}
