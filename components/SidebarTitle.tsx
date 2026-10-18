"use client";

import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { isImeComposing } from "@/lib/ime";

/** Shared by project and session names; the button remains the focus target. */
export function SidebarTitle({ text, tooltipText = text, className = "" }: { text: string; tooltipText?: string; className?: string }) {
  const titleRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const [overflowing, setOverflowing] = useState(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const title = titleRef.current;
    if (!title) return;
    const button = title.closest("button");
    let pointerInside = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active = true;

    const measure = () => {
      const clipped = title.scrollWidth > title.clientWidth;
      setOverflowing(clipped);
      if (!clipped) setVisible(false);
      return clipped;
    };
    const clearTimer = () => { clearTimeout(timer); };
    const hide = () => {
      clearTimer();
      setVisible(false);
      setPosition(null);
    };
    const enter = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
      clearTimer();
      if (measure()) timer = setTimeout(() => { if (active) setVisible(true); }, 500);
    };
    const leave = () => {
      pointerInside = false;
      hide();
      if (button === document.activeElement && button?.matches(":focus-visible") && measure()) setVisible(true);
    };
    const focus = () => {
      clearTimer();
      if (button?.matches(":focus-visible") && measure()) setVisible(true);
    };
    const blur = () => {
      if (!pointerInside) hide();
    };
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isImeComposing(event)) hide();
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(title);
    measure();
    // A late-loaded UI font can change scrollWidth without changing the box.
    void document.fonts?.ready.then(() => { if (active) measure(); });
    title.addEventListener("pointerenter", enter);
    title.addEventListener("pointerleave", leave);
    button?.addEventListener("focus", focus);
    button?.addEventListener("blur", blur);
    button?.addEventListener("keydown", keydown);
    button?.addEventListener("pointerdown", hide);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      active = false;
      clearTimer();
      observer?.disconnect();
      title.removeEventListener("pointerenter", enter);
      title.removeEventListener("pointerleave", leave);
      button?.removeEventListener("focus", focus);
      button?.removeEventListener("blur", blur);
      button?.removeEventListener("keydown", keydown);
      button?.removeEventListener("pointerdown", hide);
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [text]);

  const showTooltip = overflowing && visible;
  useLayoutEffect(() => {
    const button = titleRef.current?.closest("button");
    if (!showTooltip || !button) return;
    const ids = new Set((button.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
    ids.add(tooltipId);
    button.setAttribute("aria-describedby", [...ids].join(" "));
    return () => {
      const remaining = (button.getAttribute("aria-describedby") ?? "").split(/\s+/).filter((id) => id && id !== tooltipId);
      if (remaining.length) button.setAttribute("aria-describedby", remaining.join(" "));
      else button.removeAttribute("aria-describedby");
    };
  }, [showTooltip, tooltipId]);

  useLayoutEffect(() => {
    if (!showTooltip || !titleRef.current || !tooltipRef.current) return;
    const anchor = titleRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    setPosition({
      left: Math.max(8, Math.min(anchor.right + 6, window.innerWidth - tooltip.width - 8)),
      top: Math.max(8, Math.min(anchor.top + (anchor.height - tooltip.height) / 2, window.innerHeight - tooltip.height - 8)),
    });
  }, [showTooltip, tooltipText]);

  return (
    <>
      <span
        ref={titleRef}
        className={`sidebar-title ${className}${overflowing ? " is-overflowing" : ""}`}
      >
        {text}
      </span>
      {showTooltip && createPortal(
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className="sidebar-title-tooltip"
          style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? "visible" : "hidden" }}
        >
          {tooltipText}
        </span>,
        document.body,
      )}
    </>
  );
}
