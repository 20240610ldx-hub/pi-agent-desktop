"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type RefObject } from "react";
import { useI18n } from "../hooks/useI18n";
import { isImeComposing } from "../lib/ime";

export interface ConversationTurnLocation {
  index: number;
  question: string;
  entryId?: string;
}

interface Props {
  turns: ConversationTurnLocation[];
  /** Only expose the real beginning once the oldest history page is loaded. */
  hasSessionStart?: boolean;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  onSelect: (index: number) => void;
}

export const SESSION_START_INDEX = -1;

/** Existing user text supplies the label; this does not generate chapter names. */
export function getConversationLocationTitle(question: string): string {
  return (question.split(/\r?\n/).find((line) => line.trim()) ?? "")
    .trim().replace(/^#{1,6}\s+/, "");
}

/** A section stays current until the next anchor crosses the reading line. */
export function findActiveConversationLocation(
  anchors: { index: number; top: number }[],
  readingLine: number,
  atStart: boolean,
  hasSessionStart: boolean,
): number | null {
  if (atStart && hasSessionStart) return SESSION_START_INDEX;
  if (anchors.length === 0) return null;
  let active = hasSessionStart ? SESSION_START_INDEX : anchors[0].index;
  for (const anchor of anchors) {
    if (anchor.top > readingLine) break;
    active = anchor.index;
  }
  return active;
}

/** Scroll this small list only; scrollIntoView would also move the transcript. */
export function keepConversationItemVisible(container: HTMLElement, item: HTMLElement): void {
  const viewport = container.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const top = viewport.top + container.clientTop;
  const bottom = top + container.clientHeight;
  if (rect.top < top) container.scrollTop -= top - rect.top;
  else if (rect.bottom > bottom) container.scrollTop += rect.bottom - bottom;
}

export function ConversationNavigator({ turns, hasSessionStart = false, scrollContainerRef, onSelect }: Props) {
  const { t } = useI18n();
  const directoryId = useId();
  const sessionStartTitle = t("chat.conversationSessionStart");
  const locations = useMemo(() => [
    ...(hasSessionStart ? [{ index: SESSION_START_INDEX, key: "session-start", title: sessionStartTitle }] : []),
    ...turns.map((turn) => ({
      index: turn.index,
      key: turn.entryId ?? `turn-${turn.index}`,
      title: getConversationLocationTitle(turn.question),
    })),
  ], [turns, hasSessionStart, sessionStartTitle]);
  const [activeKey, setActiveKey] = useState(locations[0]?.key ?? "");
  const [isOpen, setIsOpen] = useState(false);
  const [focusedPosition, setFocusedPosition] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const directoryRef = useRef<HTMLElement>(null);
  const rowRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeTickRef = useRef<HTMLSpanElement>(null);
  const skipFocusOpenRef = useRef(false);
  const keyboardFocusRef = useRef(false);
  const activePosition = Math.max(0, locations.findIndex((location) => location.key === activeKey));
  const activeLocationKey = locations[activePosition]?.key;
  const locationKey = locations.map((location) => location.key).join("\n");

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || locations.length === 0) return;
    let frame: number | null = null;
    const updateActive = () => {
      const containerTop = container.getBoundingClientRect().top;
      const anchors = Array.from(container.querySelectorAll<HTMLElement>("[data-conversation-turn]"))
        .map((anchor) => ({ index: Number(anchor.dataset.conversationTurn), top: anchor.getBoundingClientRect().top }));
      const active = findActiveConversationLocation(anchors, containerTop + 28, container.scrollTop <= 1, hasSessionStart);
      const location = locations.find((location) => location.index === active);
      if (location) setActiveKey(location.key);
    };
    const scheduleUpdate = () => {
      if (frame !== null) return;
      frame = requestAnimationFrame(() => { frame = null; updateActive(); });
    };
    updateActive();
    container.addEventListener("scroll", scheduleUpdate, { passive: true });
    const resizeObserver = new ResizeObserver(scheduleUpdate);
    resizeObserver.observe(container);
    const content = container.querySelector(".chat-transcript-column");
    if (content) resizeObserver.observe(content);
    // Revealing older rendered turns need not change the list of loaded turns.
    const mutationObserver = new MutationObserver(scheduleUpdate);
    mutationObserver.observe(container, { childList: true, subtree: true });
    return () => {
      container.removeEventListener("scroll", scheduleUpdate);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [scrollContainerRef, hasSessionStart, locationKey, locations]);

  const closeDirectory = useCallback((restoreFocus = false) => {
    setIsOpen(false);
    if (restoreFocus && rootRef.current?.contains(document.activeElement)) {
      // Returning from a row or Escape must not immediately reopen the list.
      skipFocusOpenRef.current = document.activeElement !== triggerRef.current;
      triggerRef.current?.focus({ preventScroll: true });
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const onOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) closeDirectory();
    };
    const onOutsideFocus = (event: FocusEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) closeDirectory();
    };
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || isImeComposing(event)) return;
      const inside = event.target instanceof Node && rootRef.current?.contains(event.target);
      if (!inside) { closeDirectory(); return; }
      event.preventDefault();
      event.stopPropagation();
      closeDirectory(true);
    };
    document.addEventListener("pointerdown", onOutsidePointer, true);
    document.addEventListener("focusin", onOutsideFocus);
    document.addEventListener("keydown", onEscape, true);
    return () => {
      document.removeEventListener("pointerdown", onOutsidePointer, true);
      document.removeEventListener("focusin", onOutsideFocus);
      document.removeEventListener("keydown", onEscape, true);
    };
  }, [isOpen, closeDirectory]);

  useLayoutEffect(() => {
    const tick = activeTickRef.current;
    const track = triggerRef.current;
    if (track && tick) keepConversationItemVisible(track, tick);
  }, [activeLocationKey, locationKey]);

  useLayoutEffect(() => {
    const directory = directoryRef.current;
    const row = directory?.querySelector<HTMLElement>('[aria-current="location"]');
    if (isOpen && directory && row) keepConversationItemVisible(directory, row);
  }, [isOpen, activeLocationKey]);

  const selectPosition = useCallback((position: number) => {
    const location = locations[position];
    if (!location) return;
    setActiveKey(location.key);
    setFocusedPosition(position);
    onSelect(location.index);
  }, [locations, onSelect]);

  const focusPosition = useCallback((position: number) => {
    const next = Math.max(0, Math.min(locations.length - 1, position));
    setFocusedPosition(next);
    const row = rowRefs.current[next];
    row?.focus({ preventScroll: true });
    if (row && directoryRef.current) keepConversationItemVisible(directoryRef.current, row);
  }, [locations.length]);

  const handleTriggerKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    if (isImeComposing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === "ArrowUp") next = Math.max(0, activePosition - 1);
    else if (event.key === "ArrowDown") next = Math.min(locations.length - 1, activePosition + 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = locations.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    keyboardFocusRef.current = true;
    setIsOpen(true);
    selectPosition(next);
  };

  const handleDirectoryKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (isImeComposing(event) || event.altKey || event.ctrlKey || event.metaKey) return;
    let next: number;
    if (event.key === "ArrowUp") next = focusedPosition - 1;
    else if (event.key === "ArrowDown") next = focusedPosition + 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = locations.length - 1;
    else return;
    event.preventDefault();
    event.stopPropagation();
    keyboardFocusRef.current = true;
    focusPosition(next);
  };

  if (turns.length === 0 || locations.length < 2) return null;

  return (
    <div
      ref={rootRef}
      className={`conversation-navigator${isOpen ? " is-open" : ""}`}
      // 12 native px pitch / 1.25 implementation capture scale = 9.6 CSS px.
      style={{ height: Math.min(locations.length, 27) * 9.6 - 7.2 }}
      onPointerEnter={(event) => {
        if (event.pointerType !== "touch") {
          setFocusedPosition(activePosition);
          setIsOpen(true);
        }
      }}
      onPointerLeave={() => {
        if (!keyboardFocusRef.current || !rootRef.current?.contains(document.activeElement)) closeDirectory();
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) closeDirectory();
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        className="conversation-navigator-track"
        aria-label={t("chat.conversationNavigator")}
        aria-expanded={isOpen}
        aria-controls={isOpen ? directoryId : undefined}
        onPointerDown={() => { keyboardFocusRef.current = false; }}
        onFocus={() => {
          if (skipFocusOpenRef.current) { skipFocusOpenRef.current = false; return; }
          keyboardFocusRef.current = triggerRef.current?.matches(":focus-visible") ?? false;
          setFocusedPosition(activePosition);
          setIsOpen(true);
        }}
        onKeyDown={handleTriggerKeyDown}
        onClick={() => {
          setIsOpen(true);
          requestAnimationFrame(() => focusPosition(activePosition));
        }}
      >
        {locations.map((location, position) => (
          <span
            key={location.key}
            ref={position === activePosition ? activeTickRef : undefined}
            aria-hidden="true"
            className={`conversation-navigator-tick${position === activePosition ? " is-active" : ""}`}
          />
        ))}
      </button>
      {isOpen && (
        <nav
          id={directoryId}
          ref={directoryRef}
          className="conversation-navigator-directory"
          aria-label={t("chat.conversationNavigator")}
          data-navigation-source="user-turns"
          onKeyDown={handleDirectoryKeyDown}
        >
          {locations.map((location, position) => (
            <button
              key={location.key}
              ref={(element) => { rowRefs.current[position] = element; }}
              type="button"
              className="conversation-navigator-row"
              data-navigation-index={location.index}
              aria-current={position === activePosition ? "location" : undefined}
              tabIndex={position === focusedPosition ? 0 : -1}
              title={location.title}
              onPointerDown={() => { keyboardFocusRef.current = false; }}
              onFocus={() => setFocusedPosition(position)}
              onClick={() => { selectPosition(position); closeDirectory(true); }}
            >
              <span className="conversation-navigator-row-tick" aria-hidden="true" />
              <span className="conversation-navigator-label">{location.title}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
