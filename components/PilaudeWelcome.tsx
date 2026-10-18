"use client";

import { PilaudeCodeRipple } from "./PilaudeCodeRipple";
import { useI18n } from "@/hooks/useI18n";

export function PilaudeWelcome({ onOpenProject, onOpenModels }: {
  onOpenProject: () => void;
  onOpenModels: () => void;
}) {
  const { t } = useI18n();
  return (
    <section className="pilaude-welcome pilaude-welcome--quiet" aria-labelledby="pilaude-welcome-title">
      <PilaudeCodeRipple />
      <h1 id="pilaude-welcome-title" className="sr-only">Pilaude</h1>
      <div className="pilaude-welcome-start">
        <button type="button" className="pilaude-welcome-project" onClick={onOpenProject}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
          </svg>
          <span>{t("welcome.openProject")}</span>
          <svg className="pilaude-welcome-project-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="m7 10 5 5 5-5" />
          </svg>
        </button>
        <button type="button" className="pilaude-welcome-models" onClick={onOpenModels}>
          {t("welcome.modelSettings")}
        </button>
      </div>
    </section>
  );
}
