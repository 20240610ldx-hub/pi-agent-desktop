"use client";

import { useId, type ReactNode } from "react";
import { DisclosureBody } from "./DisclosureBody";

interface ThinkingDisclosureProps {
  expanded: boolean;
  searchTarget?: boolean;
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
export function ThinkingDisclosure({ expanded, searchTarget, onToggle, label, title, preview, metadata, error, children }: ThinkingDisclosureProps) {
  const id = useId();
  return <div className="thinking-disclosure" data-cds-adapter="ThinkingAccordion" data-expanded={expanded} data-search-target={searchTarget || undefined}>
    <button type="button" id={`${id}-toggle`} className="thinking-disclosure-toggle" aria-expanded={expanded} aria-controls={`${id}-body`} aria-label={label} title={title} onClick={onToggle}>
      <span className="thinking-disclosure-preview">{preview}</span>
      {metadata !== undefined && <span className="thinking-disclosure-metadata">{metadata}</span>}
      <svg className="thinking-disclosure-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
    </button>
    <DisclosureBody id={`${id}-body`} labelledBy={`${id}-toggle`} expanded={expanded} className="thinking-disclosure-grid" clipClassName="thinking-disclosure-clip" contentClassName={`thinking-disclosure-content${error ? " is-error" : ""}`}>
      {children}
    </DisclosureBody>
  </div>;
}
