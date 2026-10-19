"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface DisclosureBodyProps {
  id: string;
  labelledBy: string;
  expanded: boolean;
  keepMountedAfterOpen?: boolean;
  className?: string;
  clipClassName?: string;
  contentClassName?: string;
  children: ReactNode;
}

/** ThinkingAccordion's Grid 0fr↔1fr mechanism (open-claude-ui, MIT).
 * Controllers own expansion; the body only retains content until its box closes.
 */
export function DisclosureBody({ id, labelledBy, expanded, keepMountedAfterOpen = false, className, clipClassName, contentClassName, children }: DisclosureBodyProps) {
  const grid = useRef<HTMLDivElement>(null);
  const latestExpanded = useRef(expanded);
  latestExpanded.current = expanded;
  const wasExpanded = useRef(expanded);
  const [retained, setRetained] = useState(expanded);

  useLayoutEffect(() => {
    const element = grid.current;
    if (wasExpanded.current && !expanded && element?.contains(document.activeElement)) {
      const trigger = document.getElementById(labelledBy);
      // A hidden session must not move focus into itself when it closes.
      if (trigger?.getClientRects().length && !trigger.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(trigger).visibility === "visible") {
        trigger.focus({ preventScroll: true });
      }
    }
    wasExpanded.current = expanded;
    if (expanded) { setRetained(true); return; }
    if (!element || keepMountedAfterOpen || !retained) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const releaseClosedBody = () => {
      if (latestExpanded.current) return;
      if (motion.matches || !element.getClientRects().length || element.getBoundingClientRect().height === 0) {
        setRetained(false);
      }
    };
    // Resize handles canceled/never-started transitions and hidden ancestors;
    // the media listener handles motion changes even without a resize event.
    const observer = new ResizeObserver(releaseClosedBody);
    observer.observe(element);
    motion.addEventListener("change", releaseClosedBody);
    releaseClosedBody();
    return () => { observer.disconnect(); motion.removeEventListener("change", releaseClosedBody); };
  }, [expanded, keepMountedAfterOpen, labelledBy, retained]);

  return <div ref={grid} id={id} className={`disclosure-body${className ? ` ${className}` : ""}`} data-expanded={expanded} role="region" aria-labelledby={labelledBy} aria-hidden={!expanded} inert={!expanded} onTransitionEnd={event => {
    if (event.target === event.currentTarget && event.propertyName === "grid-template-rows" && !latestExpanded.current && !keepMountedAfterOpen && event.currentTarget.getBoundingClientRect().height === 0) setRetained(false);
  }}>
    <div className={`disclosure-body-clip${clipClassName ? ` ${clipClassName}` : ""}`}>
      {(expanded || retained) && <div className={contentClassName}>{children}</div>}
    </div>
  </div>;
}
