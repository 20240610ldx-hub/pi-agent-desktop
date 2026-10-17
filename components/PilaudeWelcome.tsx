"use client";

import { CdsButton } from "@/vendor/open-claude-ui/CdsButton";
import { useI18n } from "@/hooks/useI18n";
import { motion, useReducedMotion } from "framer-motion";
import { SPRING_SNAPPY } from "@/vendor/open-claude-ui/ClaudeMotionPresets";

export function PilaudeWelcome({ onOpenProject, onOpenModels }: {
  onOpenProject: () => void;
  onOpenModels: () => void;
}) {
  const { t } = useI18n();
  const reducedMotion = useReducedMotion();
  return (
    <motion.section className="pilaude-welcome" aria-labelledby="pilaude-welcome-title"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }} transition={reducedMotion ? { duration: 0 } : SPRING_SNAPPY}>
      <div className="pilaude-welcome-wordmark">Pilaude</div>
      <h1 id="pilaude-welcome-title">{t("welcome.title")}</h1>
      <p className="pilaude-welcome-description">{t("welcome.description")}</p>
      <div className="pilaude-welcome-actions">
        <CdsButton variant="primary" size="lg" onClick={onOpenProject}>
          {t("welcome.openProject")}
        </CdsButton>
        <CdsButton variant="secondary" size="lg" onClick={onOpenModels}>
          {t("welcome.connectModel")}
        </CdsButton>
      </div>
      <p className="pilaude-welcome-note">{t("welcome.localNote")}</p>
    </motion.section>
  );
}
