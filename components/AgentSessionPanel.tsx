"use client";

import { useMemo, useState } from "react";
import { useI18n } from "@/hooks/useI18n";
import type { SessionInfo, SubagentSessionStatus } from "@/lib/types";
import { isImeComposing } from "@/lib/ime";

interface Props {
  rootSession: SessionInfo;
  subagents: SessionInfo[];
  selectedSessionId: string;
  runningSessionIds: ReadonlySet<string>;
  onSelectSession: (session: SessionInfo) => void;
}

function sessionTitle(session: SessionInfo): string {
  return session.name || session.firstMessage || session.id.slice(0, 12);
}

function formatRelativeTime(value: string, locale: string): string {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "";
  const elapsedSeconds = Math.round((timestamp - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  if (Math.abs(elapsedSeconds) < 60) return formatter.format(elapsedSeconds, "second");
  const elapsedMinutes = Math.round(elapsedSeconds / 60);
  if (Math.abs(elapsedMinutes) < 60) return formatter.format(elapsedMinutes, "minute");
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (Math.abs(elapsedHours) < 24) return formatter.format(elapsedHours, "hour");
  return formatter.format(Math.round(elapsedHours / 24), "day");
}

function StatusIcon({ status }: { status: SubagentSessionStatus | "unknown" }) {
  return <svg className="agent-session-status-icon" width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {status === "completed" ? <path d="m3 8 3.2 3.2L13 4.5" />
      : status === "failed" ? <path d="m4 4 8 8M12 4l-8 8" />
      : status === "aborted" || status === "interrupted" ? <rect x="4" y="4" width="8" height="8" rx="1" />
      : <circle cx="8" cy="8" r={status === "running" ? 3 : 4.5} fill={status === "running" ? "currentColor" : "none"} />}
  </svg>;
}

function StopIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="6" height="6" rx="1" />
    </svg>
  );
}

function SteerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function AgentRow({
  session,
  main,
  selected,
  running,
  actionPending,
  onSelect,
  onStop,
  onSteer,
}: {
  session: SessionInfo;
  main?: boolean;
  selected: boolean;
  running: boolean;
  actionPending: boolean;
  onSelect: () => void;
  onStop: () => void;
  onSteer: () => void;
}) {
  const { locale, t } = useI18n();
  const relation = session.relation?.kind === "subagent" ? session.relation : null;
  const status: SubagentSessionStatus | "unknown" = running ? "running" : relation?.status ?? "unknown";
  const primary = main ? t("agentSwitcher.main") : relation?.description || sessionTitle(session);
  const secondary = main
    ? sessionTitle(session)
    : `${relation?.profile ?? t("agentSwitcher.subagent")} · ${formatRelativeTime(session.modified, locale)}`;
  const controllable = !main && running;

  return (
    <div className="agent-session-row" role="listitem" data-session-id={session.id} data-status={main && !running ? "idle" : status} data-selected={selected}>
      <button type="button" className="agent-session-select" aria-current={selected ? "true" : undefined} onClick={onSelect}
        onKeyDown={(event) => { if (isImeComposing(event)) event.preventDefault(); }}>
      <span style={{ width: 28, height: 28, display: "grid", placeItems: "center", color: main ? "var(--text-muted)" : "var(--accent)" }}>
        {main ? (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" />
          </svg>
        ) : (
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="5" y="7" width="14" height="11" rx="2" /><path d="M9 11h.01M15 11h.01M9 15h6M12 7V4M10 4h4" />
          </svg>
        )}
      </span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: selected ? 600 : 500 }} title={primary}>
          {primary}
        </span>
        <span style={{ display: "block", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-dim)", fontSize: 11 }} title={secondary}>
          {secondary}
        </span>
      </span>
      <span className="agent-session-status">
        {main && !running ? (
          selected ? t("agentSwitcher.current") : null
        ) : (
          <>
            <StatusIcon status={status} />
            <span>{t(`agentSwitcher.status.${status}`)}</span>
          </>
        )}
      </span>
      </button>
        {controllable && (
          <span className="agent-session-actions">
            <button
              type="button"
              title={t("agentSwitcher.steer")}
              aria-label={t("agentSwitcher.steer")}
              disabled={actionPending}
              onClick={(event) => {
                event.stopPropagation();
                onSteer();
              }}
              className="agent-session-action"
              onKeyDown={(event) => { if (isImeComposing(event)) event.preventDefault(); }}
            >
              <SteerIcon />
            </button>
            <button
              type="button"
              title={t("agentSwitcher.stop")}
              aria-label={t("agentSwitcher.stop")}
              disabled={actionPending}
              onClick={(event) => {
                event.stopPropagation();
                onStop();
              }}
              className="agent-session-action agent-session-action--stop"
              onKeyDown={(event) => { if (isImeComposing(event)) event.preventDefault(); }}
            >
              <StopIcon />
            </button>
          </span>
        )}
    </div>
  );
}

export function AgentSessionPanel({ rootSession, subagents, selectedSessionId, runningSessionIds, onSelectSession }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState("");
  const [steerOpenId, setSteerOpenId] = useState<string | null>(null);
  const [steerDraft, setSteerDraft] = useState("");
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  const sortedSubagents = useMemo(() => [...subagents].sort((a, b) => {
    const aRunning = runningSessionIds.has(a.id);
    const bRunning = runningSessionIds.has(b.id);
    if (aRunning !== bRunning) return aRunning ? -1 : 1;
    return b.modified.localeCompare(a.modified);
  }), [runningSessionIds, subagents]);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSubagents = normalizedQuery
    ? sortedSubagents.filter((session) => {
      const relation = session.relation?.kind === "subagent" ? session.relation : null;
      return [relation?.description, relation?.profile, session.name, session.firstMessage]
        .some((value) => value?.toLowerCase().includes(normalizedQuery));
    })
    : sortedSubagents;
  const runningCount = subagents.filter((session) => runningSessionIds.has(session.id)).length;

  async function controlSubagent(id: string, action: "abort" | "steer", message?: string): Promise<boolean> {
    setControlError(null);
    setActionPendingId(id);
    try {
      const res = await fetch(`/api/subagents/${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, message }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? `HTTP ${res.status}`);
      }
      return true;
    } catch (e) {
      setControlError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setActionPendingId(null);
    }
  }

  async function submitSteer(id: string) {
    const message = steerDraft.trim();
    if (!message) return;
    if (await controlSubagent(id, "steer", message)) {
      setSteerOpenId(null);
      setSteerDraft("");
    }
  }

  return (
    <div
      className="agent-session-panel"
      role="region"
      aria-label={t("agentSwitcher.title")}
      style={{
        background: "var(--bg-panel)",
        borderLeft: "var(--hairline) solid var(--border)",
        borderRight: "var(--hairline) solid var(--border)",
        borderBottom: "var(--hairline) solid var(--border)",
        borderRadius: "0 0 6px 6px",
        boxShadow: "0 10px 28px rgba(0,0,0,0.10)",
        overflow: "hidden",
      }}
    >
      <div>
        <div style={{ minHeight: 44, display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", borderBottom: "var(--hairline) solid var(--border)" }}>
          <strong style={{ fontSize: 12, fontWeight: 600 }}>{t("agentSwitcher.title")}</strong>
          <span style={{ color: "var(--text-dim)", fontSize: 11 }}>
            {t("agentSwitcher.count", { count: subagents.length })}
          </span>
          {runningCount > 0 && (
            <span style={{ marginLeft: "auto", color: "var(--accent)", fontSize: 11 }}>
              {t("agentSwitcher.runningCount", { count: runningCount })}
            </span>
          )}
        </div>
        {controlError && (
          <div role="alert" style={{ padding: "6px 12px", background: "rgba(239,68,68,0.07)", color: "#ef4444", fontSize: 11, borderBottom: "var(--hairline) solid var(--border)" }}>
            {controlError}
          </div>
        )}
        {(subagents.length > 8 || query.length > 0) && (
          <div style={{ padding: 8, borderBottom: "var(--hairline) solid var(--border)" }}>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("agentSwitcher.search")}
              aria-label={t("agentSwitcher.search")}
              style={{
                width: "100%", height: 32, padding: "0 10px",
                border: "var(--hairline) solid var(--border)", borderRadius: 6,
                background: "var(--bg)", color: "var(--text)", fontSize: 12, outline: "none",
              }}
            />
          </div>
        )}
        <div role="list" aria-label={t("agentSwitcher.title")} style={{ maxHeight: "min(58dvh, 480px)", overflowY: "auto" }}>
          <AgentRow
            session={rootSession}
            main
            selected={rootSession.id === selectedSessionId}
            running={runningSessionIds.has(rootSession.id)}
            actionPending={actionPendingId === rootSession.id}
            onSelect={() => onSelectSession(rootSession)}
            onStop={() => {}}
            onSteer={() => {}}
          />
          {visibleSubagents.map((session) => (
            <div key={session.id}>
              <AgentRow
                session={session}
                selected={session.id === selectedSessionId}
                running={runningSessionIds.has(session.id)}
                actionPending={actionPendingId === session.id}
                onSelect={() => onSelectSession(session)}
                onStop={() => {
                  setSteerOpenId(null);
                  void controlSubagent(session.id, "abort");
                }}
                onSteer={() => {
                  setControlError(null);
                  setSteerDraft("");
                  setSteerOpenId((current) => current === session.id ? null : session.id);
                }}
              />
              {steerOpenId === session.id && runningSessionIds.has(session.id) && (
                <div style={{ display: "flex", gap: 6, padding: "6px 12px", borderBottom: "var(--hairline) solid var(--border)", background: "var(--bg)" }}>
                  <input
                    autoFocus
                    type="text"
                    value={steerDraft}
                    onChange={(event) => setSteerDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (isImeComposing(event)) return;
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void submitSteer(session.id);
                      } else if (event.key === "Escape") {
                        event.preventDefault();
                        setSteerOpenId(null);
                      }
                    }}
                    placeholder={t("agentSwitcher.steerPlaceholder")}
                    aria-label={t("agentSwitcher.steer")}
                    style={{ flex: 1, minWidth: 0, height: 30, padding: "0 10px", border: "var(--hairline) solid var(--border)", borderRadius: 6, background: "var(--bg)", color: "var(--text)", fontSize: 12, outline: "none" }}
                  />
                  <button
                    type="button"
                    disabled={!steerDraft.trim() || actionPendingId === session.id}
                    onClick={() => void submitSteer(session.id)}
                    style={{ height: 30, padding: "0 12px", border: "none", borderRadius: 6, background: "var(--accent)", color: "var(--accent-contrast)", fontSize: 12, cursor: !steerDraft.trim() || actionPendingId === session.id ? "default" : "pointer" }}
                  >
                    {t("agentSwitcher.steerSend")}
                  </button>
                </div>
              )}
            </div>
          ))}
          {visibleSubagents.length === 0 && (
            <div style={{ padding: "22px 12px", color: "var(--text-dim)", fontSize: 12, textAlign: "center" }}>
              {subagents.length === 0 ? t("agentSwitcher.none") : t("agentSwitcher.noMatches")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
