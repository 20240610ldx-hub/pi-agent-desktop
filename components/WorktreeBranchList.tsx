"use client";

// Fork-owned: the "Switch branch" list inside the sidebar's worktree dropdown —
// switches the current checkout in place, or jumps to the worktree that already
// holds the branch. SessionSidebar (upstream-owned) owns the state and actions.

import { useI18n } from "@/hooks/useI18n";
import { PathLabel } from "./path-ui";
import type { WorktreeEntry } from "./ProjectContextMenu";

interface WorktreeBranchListProps {
  currentBranch: string | null;
  branches: string[];
  remoteBranches: string[];
  loaded: boolean;
  worktrees: WorktreeEntry[];
  selectedCwd: string | null;
  switchingBranch: string | null;
  fetching: boolean;
  onFetch: () => void;
  onSwitch: (branch: string) => void;
}

export function WorktreeBranchList({
  currentBranch, branches, remoteBranches, loaded, worktrees, selectedCwd, switchingBranch, fetching, onFetch, onSwitch,
}: WorktreeBranchListProps) {
  const { t } = useI18n();
  const branchRows = [
    ...branches.map((name) => ({ name, remote: false })),
    ...remoteBranches.map((name) => ({ name, remote: true })),
  ];
  return (
    <div style={{ borderTop: "var(--hairline) solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 8px 3px" }}>
        <span style={{ flex: 1, fontSize: 10, fontWeight: 600, letterSpacing: "0.03em", color: "var(--text-dim)" }}>{t("sidebar.switchBranch")}</span>
        <button
          type="button"
          onClick={onFetch}
          disabled={fetching}
          title={t("sidebar.fetchBranchesTitle")}
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 22, height: 20, padding: 0,
            background: "none", border: "none",
            color: fetching ? "var(--accent)" : "var(--text-dim)",
            cursor: "pointer", borderRadius: 4, flexShrink: 0,
          }}
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={fetching ? { animation: "spin 0.9s linear infinite" } : undefined}>
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>
      <div style={{ maxHeight: "min(28vh, 200px)", overflowY: "auto" }}>
        {loaded && branchRows.length === 0 && (
          <div style={{ padding: "3px 10px 8px", fontSize: 11, color: "var(--text-dim)" }}>{t("sidebar.noOtherBranches")}</div>
        )}
        {branchRows.map(({ name, remote }) => {
          const isCurrent = name === currentBranch;
          const holder = worktrees.find((w) => w.branch === name && w.path !== selectedCwd);
          const switching = switchingBranch === name;
          return (
            <button
              key={name}
              onClick={() => onSwitch(name)}
              disabled={switchingBranch !== null}
              title={
                holder ? t("sidebar.branchInWorktreeTitle", { branch: name })
                  : remote ? t("sidebar.branchRemoteTitle")
                    : t("sidebar.switchBranchTitle", { branch: name })
              }
              style={{
                display: "flex", alignItems: "center", gap: 7,
                width: "100%", padding: "6px 10px",
                background: isCurrent ? "var(--bg-hover)" : "none",
                border: "none",
                color: isCurrent ? "var(--text)" : "var(--text-muted)",
                cursor: "pointer", textAlign: "left",
                fontSize: 11, fontFamily: "var(--font-mono)",
                opacity: switching ? 0.55 : 1,
              }}
            >
              {isCurrent ? (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <polyline points="1.5 5 4 7.5 8.5 2.5" />
                </svg>
              ) : (
                <span style={{ width: 10, flexShrink: 0 }} />
              )}
              <PathLabel text={name} style={{ flex: 1 }} />
              {holder && (
                <span title={holder.path} style={{ flexShrink: 0, display: "flex", alignItems: "center", color: "var(--text-dim)" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="6" y1="3" x2="6" y2="15" />
                    <circle cx="18" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                  </svg>
                </span>
              )}
              {remote && !holder && (
                <span style={{ flexShrink: 0, color: "var(--text-dim)", fontSize: 10 }}>{t("sidebar.remoteBranchTag")}</span>
              )}
              {switching && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}>
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
