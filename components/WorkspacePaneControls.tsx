"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ButtonHTMLAttributes, type Ref } from "react";
import { createPortal } from "react-dom";
import { isImeComposing } from "@/lib/ime";
import { useI18n } from "@/hooks/useI18n";
import { PilaudeIcon } from "./PilaudeIcon";

export type WorkspacePaneId = "files" | "terminal" | "changes" | "tasks";

interface Props {
  openPanes: Record<WorkspacePaneId, boolean>;
  onToggle: (id: WorkspacePaneId) => void;
}

const controls = [
  { id: "files", icon: "folder" },
  { id: "terminal", icon: "terminal" },
  { id: "changes", icon: "changes" },
  { id: "tasks", icon: "branch" },
] as const;

/** A local portal avoids clipping by the shell's overflow-hidden topbar. */
export function WorkspaceControlButton({ label, shortcut, onClick, triggerRef, placement = "bottom", tooltipGap = 6, tooltipClassName, tooltipDescription, ...props }: Omit<ButtonHTMLAttributes<HTMLButtonElement>, "title" | "aria-label"> & { label: string; shortcut?: string; triggerRef?: Ref<HTMLButtonElement>; placement?: "top" | "bottom"; tooltipGap?: number; tooltipClassName?: string; tooltipDescription?: string }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const clearTimer = () => { if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = null; };
  const hide = () => { clearTimer(); setOpen(false); setPosition(null); };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);
  useEffect(() => {
    if (!open) return;
    const close = () => { setOpen(false); setPosition(null); };
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === "Escape" && !isImeComposing(event)) close(); };
    window.addEventListener("resize", close);
    window.addEventListener("scroll", close, true);
    document.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("resize", close);
      window.removeEventListener("scroll", close, true);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open || !buttonRef.current || !tooltipRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(button.right - tooltip.width, window.innerWidth - tooltip.width - 8)),
      top: Math.max(8, Math.min(placement === "top" && button.top - tooltip.height - tooltipGap >= 8 ? button.top - tooltip.height - tooltipGap : button.bottom + tooltipGap, window.innerHeight - tooltip.height - 8)),
    });
  }, [label, open, shortcut, placement, tooltipGap, tooltipClassName]);
  return <>
    <button {...props} ref={(element) => { buttonRef.current = element; if (typeof triggerRef === "function") triggerRef(element); else if (triggerRef) triggerRef.current = element; }} type="button" aria-label={label} aria-describedby={[props["aria-describedby"], open ? tooltipId : undefined].filter(Boolean).join(" ") || undefined}
      onPointerEnter={(event) => {
        if (event.pointerType === "touch") return;
        clearTimer();
        timerRef.current = setTimeout(() => setOpen(true), 450);
      }}
      onPointerLeave={hide}
      onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) setOpen(true); }}
      onBlur={hide}
      onPointerDown={hide}
      onClick={(event) => { hide(); onClick?.(event); }} />
    {open && createPortal(<span id={tooltipId} ref={tooltipRef} role="tooltip" className={`workspace-control-tooltip${tooltipClassName ? ` ${tooltipClassName}` : ""}`}
      style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}>
      <span>{tooltipDescription ? `${label} · ${tooltipDescription}` : label}</span>{shortcut && <kbd>{shortcut}</kbd>}
    </span>, document.body)}
  </>;
}

/** Visibility controls never close tabs, terminate shells, or stop tasks. */
export function WorkspacePaneControls({ openPanes, onToggle }: Props) {
  const { t } = useI18n();
  return (
    <div className="workspace-pane-controls" role="group" aria-label={t("workspace.panes")}>
      {controls.map(({ id, icon }) => {
        const open = openPanes[id];
        const label = t(open ? "workspace.hidePane" : "workspace.showPane", { name: t(`workspace.pane.${id}`) });
        return (
          <WorkspaceControlButton key={id} label={label} className="file-workbench-icon-button workspace-pane-toggle"
            aria-pressed={open} aria-controls={`workspace-pane-${id}`} onClick={() => onToggle(id)}>
            <PilaudeIcon name={icon} size={16} />
          </WorkspaceControlButton>
        );
      })}
    </div>
  );
}
