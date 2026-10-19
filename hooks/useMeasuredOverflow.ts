"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Height-measurement/disclosure mechanism adapted from Caho1/open-claude-ui
 * ChatMessageBubbles.tsx:95-101, author commit 638800b8a4cee4513c8763c3df0ecf8a77b32379
 * (MIT; see vendor/open-claude-ui/LICENSE).
 * Natural-content/container observation and font lifecycle are product extensions.
 */
export function useMeasuredOverflow(contentKey: string, threshold: number) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body) return;
    let active = true;
    let frame: number | undefined;

    const measure = () => {
      // Hidden retained chats have no useful geometry. Keep their decision until
      // ResizeObserver reports the content returning to layout.
      if (!active || body.getClientRects().length === 0) return;
      const next = body.scrollHeight > threshold;
      setOverflowing((previous) => previous === next ? previous : next);
    };
    const schedule = () => {
      if (!active || frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        measure();
      });
    };

    measure();
    const observer = typeof ResizeObserver === "undefined" ? undefined : new ResizeObserver(schedule);
    observer?.observe(body);
    // The body can be capped at 220px. Its unbounded Markdown child still changes
    // height when width, fonts, images or rendered content change.
    if (body.firstElementChild) observer?.observe(body.firstElementChild);
    window.addEventListener("resize", schedule);
    const fonts = document.fonts;
    fonts?.addEventListener("loadingdone", schedule);
    fonts?.addEventListener("loadingerror", schedule);
    void fonts?.ready.then(schedule);

    return () => {
      active = false;
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      fonts?.removeEventListener("loadingdone", schedule);
      fonts?.removeEventListener("loadingerror", schedule);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [contentKey, threshold]);

  return { bodyRef, overflowing };
}
