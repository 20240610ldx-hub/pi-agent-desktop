"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import type { ToolEntryState } from "@/lib/activity-entry-ledger";

const ease = "cubic-bezier(.19, 1, .22, 1)";
const visible = (element: Element) => element.isConnected && element.getClientRects().length > 0
  && !element.matches('[hidden], [inert]') && !element.parentElement?.closest('[hidden], [inert], [aria-hidden="true"]') && getComputedStyle(element).visibility === "visible";

/** One-time event grants and committed semantic changes, scoped above turn remounts.
 * WAAPI only supplies finite presentation; text/status/accessibility update normally.
 */
export function useActivityStepMotion(rootRef: RefObject<HTMLDivElement | null>, entries: ToolEntryState, consume: (scope: number, ids: readonly string[]) => void) {
  const current = useRef({ entries, consume });
  current.current = { entries, consume };
  const consumed = useRef({ scope: entries.scope, ids: new Set<string>() });
  const scanRef = useRef<(() => void) | null>(null);
  const attached = useRef<{ root: HTMLDivElement; stop: () => void } | null>(null);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (attached.current?.root === root) { scanRef.current?.(); return; }
    attached.current?.stop();
    attached.current = null;
    if (!root) return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let snapshots = new WeakMap<Element, string>();
    const animations = new Map<Element, Animation>();
    const cancel = (element: Element) => { const animation = animations.get(element); animations.delete(element); animation?.cancel(); };
    const animate = (element: Element, frames: Keyframe[], duration: number, delay = 0) => {
      cancel(element);
      if (motion.matches || !visible(element)) return;
      const animation = element.animate(frames, { duration, delay, easing: ease, iterations: 1, fill: "backwards" });
      animations.set(element, animation);
      animation.onfinish = animation.oncancel = () => {
        if (animations.get(element) === animation) animations.delete(element);
        animation.onfinish = animation.oncancel = null;
      };
    };
    const cancelHidden = () => {
      for (const [element] of animations) if (motion.matches || !visible(element)) cancel(element);
    };
    const scan = () => {
      const { entries: next, consume: acknowledge } = current.current;
      if (consumed.current.scope !== next.scope) {
        for (const [element] of animations) cancel(element);
        consumed.current = { scope: next.scope, ids: new Set() };
        snapshots = new WeakMap();
      }
      cancelHidden();
      if (next.grants.size) {
        const rows = [...root.querySelectorAll<HTMLElement>(".tool-call-row[data-tool-call-id]")]
          .map((element) => ({ element, id: element.dataset.toolCallId!, sequence: next.grants.get(element.dataset.toolCallId!) }))
          .filter((row) => row.sequence !== undefined && !consumed.current.ids.has(row.id))
          .sort((a, b) => a.sequence! - b.sequence!);
        rows.forEach(({ element, id }, index) => {
          // Claim first committed appearance even when hidden/reduced. A hook ack
          // rerender, Strict Mode replay or keyed turn remount cannot grant it again.
          consumed.current.ids.add(id);
          animate(element, [{ opacity: 0, transform: "translateY(6px)" }, { opacity: 1, transform: "translateY(0)" }], 180, Math.min(index * 40, 120));
        });
        if (rows.length) acknowledge(next.scope, rows.map(({ id }) => id));
      }
      for (const element of root.querySelectorAll(".tool-call-status-icon, .process-details-status, .process-details-label")) {
        const summary = element.classList.contains("process-details-label");
        const value = summary ? element.textContent ?? "" : element.closest(".tool-call-row, .process-details")?.getAttribute("data-status") ?? "";
        const previous = snapshots.get(element);
        snapshots.set(element, value);
        if (previous !== undefined && previous !== value) animate(element, [{ opacity: .5 }, { opacity: 1 }], summary ? 150 : 160);
      }
    };
    scanRef.current = scan;
    const observer = new MutationObserver(scan);
    observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-status", "aria-hidden", "inert", "hidden"] });
    // Chat/session visibility is owned by ancestors outside the scrollport.
    const visibilityObserver = new MutationObserver(cancelHidden);
    for (let element: Element | null = root; element; element = element.parentElement) {
      visibilityObserver.observe(element, { attributes: true, attributeFilter: ["hidden", "inert", "aria-hidden", "style", "class"] });
    }
    const resize = new ResizeObserver(cancelHidden);
    resize.observe(root);
    motion.addEventListener("change", cancelHidden);
    scan();
    attached.current = { root, stop: () => {
      scanRef.current = null;
      observer.disconnect(); visibilityObserver.disconnect(); resize.disconnect();
      motion.removeEventListener("change", cancelHidden);
      for (const [element] of animations) cancel(element);
    } };
  });

  // A consumption rerender scans without tearing down an active animation.
  // Strict Mode cleanup cancels effects, while the claimed-id ref survives replay.
  useLayoutEffect(() => () => { attached.current?.stop(); attached.current = null; }, []);
}
