"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import { CdsButton } from "@/vendor/open-claude-ui/CdsButton";

interface DataInfo { agentDir: string; legacyAgentDir: string; legacyAvailable: boolean }
interface Preview {
  digest: string; sourceDir: string; targetDir: string;
  files: { relativePath: string; conflict: boolean }[];
  excluded: string[]; warnings: string[];
}
interface ImportResult { imported: string[]; skipped: string[]; backupDir: string }

export function PilaudeDataSection({ onBusyChange }: { onBusyChange: (busy: boolean) => void }) {
  const { t } = useI18n();
  const [info, setInfo] = useState<DataInfo | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/data", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(t("pilaude.data.loadError"));
        setInfo(await response.json());
      }).catch(reason => { if (!controller.signal.aborted) setError(String(reason)); });
    return () => controller.abort();
  }, [t]);

  const run = async (action: "preview" | "import") => {
    if (busy || (action === "import" && !preview)) return;
    setBusy(true); onBusyChange(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/data", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, digest: preview?.digest }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || t("pilaude.data.loadError"));
      if (action === "preview") setPreview(body);
      else { setResult(body); setPreview(null); }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("pilaude.data.loadError"));
      if (action === "import") setPreview(null);
    } finally { setBusy(false); onBusyChange(false); }
  };

  return (
    <section className="settings-general-section pilaude-data-section" aria-labelledby="pilaude-data-title">
      <h3 className="settings-general-heading" id="pilaude-data-title">{t("pilaude.data.title")}</h3>
      <p className="settings-general-description">{t("pilaude.data.description")}</p>
      {info && <p><code>{info.agentDir}</code></p>}
      {info?.legacyAvailable && <CdsButton size="sm" variant="secondary" disabled={busy} onClick={() => void run("preview")}>{t("pilaude.data.preview")}</CdsButton>}
      {info && !info.legacyAvailable && <p className="settings-general-description">{t("pilaude.data.noLegacy")}</p>}
      {preview && <div className="pilaude-data-preview">
        <p>{t("pilaude.data.source")} <code>{preview.sourceDir}</code></p>
        <p>{t("pilaude.data.target")} <code>{preview.targetDir}</code></p>
        <p className="settings-general-description">{t("pilaude.data.importRules")}</p>
        <ul>{preview.files.map(file => <li key={file.relativePath}><code>{file.relativePath}</code> {file.conflict && <span>{t("pilaude.data.conflict")}</span>}</li>)}</ul>
        {(preview.excluded.length > 0 || preview.warnings.length > 0) && <details>
          <summary>{t("pilaude.data.excluded")}</summary>
          <ul>{[...preview.excluded, ...preview.warnings].map((entry, index) => <li key={index}><code>{entry}</code></li>)}</ul>
        </details>}
        <CdsButton size="sm" disabled={busy || preview.files.every(file => file.conflict)} onClick={() => void run("import")}>{t("pilaude.data.import")}</CdsButton>
      </div>}
      {busy && <p role="status">{t("pilaude.data.busy")}</p>}
      {result && <div role="status">
        <p>{t("pilaude.data.completed", { imported: result.imported.length, skipped: result.skipped.length })}</p>
        <p>{t("pilaude.data.backup")} <code>{result.backupDir}</code></p>
      </div>}
      {error && <p role="alert" className="settings-general-error">{error}</p>}
    </section>
  );
}
