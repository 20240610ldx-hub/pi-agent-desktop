"use client";

import { RECOMMENDED_PI_EXTENSIONS } from "@/lib/recommended-pi-extensions";
import { useI18n } from "@/hooks/useI18n";
import { ConfigButton, ConfigSectionTitle } from "./SettingsUi";

export function RecommendedPiExtensions({ busy, onSelectSource }: { busy: boolean; onSelectSource: (source: string) => void }) {
  const { t } = useI18n();
  return <section className="recommended-pi-extensions" aria-label={t("plugins.recommended.title")}>
    <ConfigSectionTitle>{t("plugins.recommended.title")}</ConfigSectionTitle>
    <p>{t("plugins.recommended.description")}</p>
    <div className="recommended-pi-extension-list">
      {RECOMMENDED_PI_EXTENSIONS.map(item => <article key={item.id} className="recommended-pi-extension" data-extension-id={item.id}>
        <div className="recommended-pi-extension-heading"><strong>{t(item.nameKey)}</strong><span>{t(`plugins.recommended.status.${item.status}`)}</span></div>
        <code>{item.id} · {item.version} · {item.license}</code>
        <p>{t(item.descriptionKey)}</p>
        <p className="recommended-pi-extension-reason">{t(item.reasonKey)}</p>
        <div className="recommended-pi-extension-actions">
          <a href={item.sourceUrls[0]} target="_blank" rel="noreferrer">{t("plugins.recommended.source")}</a>
          {item.installSource && <ConfigButton size="small" disabled={busy} onClick={() => onSelectSource(item.installSource!)}>{t("plugins.recommended.select")}</ConfigButton>}
        </div>
      </article>)}
    </div>
  </section>;
}
