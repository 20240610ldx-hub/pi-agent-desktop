"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { useI18n } from "@/hooks/useI18n";

/** Adapts CodeBlock's 2.5s saved-check-decay feedback (open-claude-ui, MIT). */
export function CodeCopyButton({ code }: { code: string }) {
  const { t } = useI18n();
  const [copiedAttempt, setCopiedAttempt] = useState<number | null>(null);
  const [failed, setFailed] = useState(false);
  const attempt = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useLayoutEffect(() => {
    setCopiedAttempt(null);
    setFailed(false);
    return () => {
      attempt.current += 1;
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
    };
  }, [code]);

  const copy = async () => {
    const current = ++attempt.current;
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setCopiedAttempt(null);
    setFailed(false);
    try {
      await copyText(code);
      if (current !== attempt.current) return;
      setCopiedAttempt(current);
      timer.current = setTimeout(() => {
        timer.current = null;
        setCopiedAttempt(null);
      }, 2500);
    } catch {
      if (current === attempt.current) setFailed(true);
    }
  };

  return <span className="code-copy-control">
    <button type="button" onClick={copy} className="markdown-code-action markdown-code-copy" data-cds-adapter="CodeBlock">
      {copiedAttempt !== null
        ? <span key={copiedAttempt} className="code-copy-saved"><span aria-hidden="true">✓</span> {t("i18n.copied")}</span>
        : t("i18n.copy")}
    </button>
    {failed && <span role="status" className="code-copy-error">{t("pilaude.codeCopyFailed")}</span>}
  </span>;
}
