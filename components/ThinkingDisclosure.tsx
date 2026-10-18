"use client";

import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

interface ThinkingDisclosureProps {
  expanded: boolean;
  onToggle: () => void;
  label: string;
  title: string;
  preview: ReactNode;
  metadata?: ReactNode;
  error?: boolean;
  children: ReactNode;
}

/** Adapts ThinkingAccordion's Grid 0fr↔1fr mechanism (open-claude-ui, MIT).
 * Pi owns expansion preference and deferred loading; no forced-live state or timers.
 */
export function ThinkingDisclosure({ expanded, onToggle, label, title, preview, metadata, error, children }: ThinkingDisclosureProps) {
  const id = useId();
  const grid = useRef<HTMLDivElement>(null);
  const [retained, setRetained] = useState(expanded);
  useLayoutEffect(() => {
    if (expanded) { setRetained(true); return; }
    const element = grid.current;
    if (!element) return;
    const releaseClosedBody = () => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !element.getClientRects().length || element.getBoundingClientRect().height === 0) {
        setRetained(false);
        observer.disconnect();
      }
    };
    // Canceled or never-started transitions do not emit transitionend. Observe
    // the collapsed box so quick toggles, hidden chats and motion changes release it.
    const observer = new ResizeObserver(releaseClosedBody);
    observer.observe(element);
    releaseClosedBody();
    return () => observer.disconnect();
  }, [expanded]);
  return <div className="thinking-disclosure" data-cds-adapter="ThinkingAccordion" data-expanded={expanded}>
    <button type="button" id={`${id}-toggle`} className="thinking-disclosure-toggle" aria-expanded={expanded} aria-controls={`${id}-body`} aria-label={label} title={title} onClick={onToggle}>
      <svg className="thinking-disclosure-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      <span className="thinking-disclosure-preview">{preview}</span>
      {metadata !== undefined && <span className="thinking-disclosure-metadata">{metadata}</span>}
    </button>
    <div ref={grid} id={`${id}-body`} className="thinking-disclosure-grid" role="region" aria-labelledby={`${id}-toggle`} aria-hidden={!expanded} inert={!expanded} onTransitionEnd={event => {
      if (event.target === event.currentTarget && event.propertyName === "grid-template-rows" && !expanded) setRetained(false);
    }}>
      <div className="thinking-disclosure-clip"><div className={`thinking-disclosure-content${error ? " is-error" : ""}`}>{(expanded || retained) && children}</div></div>
    </div>
  </div>;
}
