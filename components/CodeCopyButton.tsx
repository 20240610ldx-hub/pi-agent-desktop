"use client";

import { useId, useLayoutEffect, useRef, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/hooks/useI18n";

/** Adapts CodeBlock's 2.5s saved-check-decay feedback (open-claude-ui, MIT). */
export function CodeCopyButton({ code, iconOnly = false }: { code: string; iconOnly?: boolean }) {
  const { t, locale } = useI18n();
  const [copiedAttempt, setCopiedAttempt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const [pending, setPending] = useState(false);
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const tooltipId = useId();
  const attempt = useRef(0);
  const copying = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    setCopiedAttempt(null);
    setFailed(false);
    setPending(false);
    setTooltipOpen(false);
    copying.current = false;
    return () => {
      attempt.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [code]);

  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    if (copying.current) return;
    copying.current = true;
    const button = event.currentTarget;
    const hadFocus = document.activeElement === button;
    const current = ++attempt.current;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setCopiedAttempt(null);
    setFailed(false);
    setPending(true);
    setTooltipOpen(iconOnly);
    try {
      await copyText(code);
      if (current !== attempt.current) return;
      setCopiedAttempt(current);
      timer.current = setTimeout(() => {
        if (current !== attempt.current) return;
        timer.current = null;
        setCopiedAttempt(null);
      }, 2500);
    } catch {
      if (current === attempt.current) {
        setFailed(true);
        setTooltipOpen(iconOnly);
      }
    } finally {
      if (current === attempt.current) {
        copying.current = false;
        setPending(false);
        // The execCommand fallback selects a temporary textarea. Restore only
        // focus it lost, without stealing focus from a user who moved on.
        if (hadFocus && button.isConnected && document.activeElement === document.body) {
          button.focus({ preventScroll: true });
        }
      }
    }
  };

  const label = iconOnly
    ? ({ en: "Copy code", "zh-CN": "复制代码", "zh-TW": "複製程式碼" }[locale])
    : t("i18n.copy");
  const feedback = failed ? t("pilaude.codeCopyFailed") : copiedAttempt !== null ? t("i18n.copied") : "";

  useLayoutEffect(() => {
    if (!tooltipOpen || !buttonRef.current || !tooltipRef.current) return;
    const button = buttonRef.current.getBoundingClientRect();
    const tooltip = tooltipRef.current.getBoundingClientRect();
    setTooltipPosition({
      left: Math.max(8, Math.min(button.left + (button.width - tooltip.width) / 2, window.innerWidth - tooltip.width - 8)),
      top: button.top - tooltip.height - 4 >= 8 ? button.top - tooltip.height - 4 : button.bottom + 4,
    });
    const hide = () => setTooltipOpen(false);
    window.addEventListener("resize", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.removeEventListener("resize", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, [tooltipOpen, feedback, label, pending]);

  return <span className={`code-copy-control${iconOnly ? " c13-copy-control" : ""}`} data-copy-state={pending ? "pending" : failed ? "failed" : copiedAttempt !== null ? "copied" : "idle"}>
    <button ref={buttonRef} type="button" onClick={copy} className="markdown-code-action markdown-code-copy" data-cds-adapter="CodeBlock"
      aria-label={iconOnly ? label : undefined} aria-describedby={iconOnly && tooltipOpen ? tooltipId : undefined}
      aria-busy={pending} aria-disabled={pending}
      onMouseEnter={() => { if (iconOnly) setTooltipOpen(true); }} onMouseLeave={() => setTooltipOpen(false)}
      onFocus={(event) => { if (iconOnly && event.currentTarget.matches(":focus-visible")) setTooltipOpen(true); }} onBlur={() => setTooltipOpen(false)}
      onKeyDown={(event) => {
        if (iconOnly && event.key === "Escape" && tooltipOpen) {
          event.preventDefault();
          event.stopPropagation();
          setTooltipOpen(false);
        }
      }}>
      {iconOnly ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {pending ? <circle className="c13-copy-pending" cx="12" cy="12" r="8" strokeDasharray="34 16" />
          : copiedAttempt !== null ? <path d="m5 12 4 4L19 6" />
            : <><rect x="9" y="9" width="12" height="12" rx="1" /><path d="M15 9V3H3v12h6" /></>}
      </svg> : copiedAttempt !== null
        ? <span key={copiedAttempt} className="code-copy-saved"><span aria-hidden="true">✓</span> {t("i18n.copied")}</span>
        : t("i18n.copy")}
    </button>
    {iconOnly ? <>
      {tooltipOpen && createPortal(<span ref={tooltipRef} id={tooltipId} role="tooltip" className="c13-copy-tooltip" data-copy-state={failed ? "failed" : undefined}
        style={{ left: tooltipPosition?.left ?? 0, top: tooltipPosition?.top ?? 0, visibility: tooltipPosition ? "visible" : "hidden" }}>
        {feedback || (pending ? t("i18n.loading") : label)}
      </span>, document.body)}
      <span role="status" className="c13-copy-status">{feedback}</span>
    </> : failed && <span role="status" className="code-copy-error">{feedback}</span>}
  </span>;
}
