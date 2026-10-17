"use client";

// Fork-owned: the "…" menu on a project row of the sidebar's project tree —
// switch branch, open a terminal, reveal in the file manager, archive. Rendered
// as a DOM menu here, or as native popups in the desktop shell (showNative*).
// SessionSidebar (upstream-owned) keeps the menu state and the actions.

import type { RefObject } from "react";
import { createPortal } from "react-dom";
import { showNativeMenu, type NativeMenuPoint } from "@/lib/desktop-menu";
import type { TranslationParams } from "@/lib/i18n/types";

export interface WorktreeEntry {
  path: string;
  branch: string | null;
  isMain: boolean;
}

export interface ProjectBranchMenuState {
  root: string;
  branches: string[];
  remoteBranches: string[];
  worktrees: WorktreeEntry[];
  loaded: boolean;
}

type Translate = (key: string, params?: TranslationParams) => string;

/** A project's local and remote branches plus its worktrees; empty when the read fails. */
export async function fetchProjectBranchMenu(projectRoot: string): Promise<ProjectBranchMenuState> {
  try {
    const res = await fetch(`/api/worktrees?cwd=${encodeURIComponent(projectRoot)}&branches=1`);
    const data = await res.json().catch(() => ({})) as {
      projectRoot?: string;
      branches?: string[];
      remoteBranches?: string[];
      worktrees?: WorktreeEntry[];
    };
    if (!res.ok || data.projectRoot !== projectRoot) throw new Error(`HTTP ${res.status}`);
    return {
      root: projectRoot,
      branches: Array.isArray(data.branches) ? data.branches : [],
      remoteBranches: Array.isArray(data.remoteBranches) ? data.remoteBranches : [],
      worktrees: Array.isArray(data.worktrees) ? data.worktrees : [],
      loaded: true,
    };
  } catch {
    return { root: projectRoot, branches: [], remoteBranches: [], worktrees: [], loaded: true };
  }
}

/** Desktop shell: the branch list as a native popup. */
export async function showNativeProjectBranchMenu({
  projectRoot, at, selectedCwd, switchingBranch, t, onSwitch,
}: {
  projectRoot: string;
  at: NativeMenuPoint;
  selectedCwd: string | null;
  switchingBranch: string | null;
  t: Translate;
  onSwitch: (projectRoot: string, branch: string, loaded: ProjectBranchMenuState) => void;
}) {
  const data = await fetchProjectBranchMenu(projectRoot);
  const checkout = data.worktrees.find((w) => w.path === selectedCwd) ?? data.worktrees.find((w) => w.isMain);
  const names = [
    ...data.branches.map((name) => ({ name, remote: false })),
    ...data.remoteBranches.map((name) => ({ name, remote: true })),
  ];
  await showNativeMenu(
    names.length === 0
      ? [{ label: t("sidebar.noOtherBranches"), disabled: true }]
      : names.map(({ name, remote }) => {
          const holder = data.worktrees.find((w) => w.branch === name && w.path !== checkout?.path);
          const tag = holder ? "worktree" : remote ? t("sidebar.remoteBranchTag") : "";
          return {
            label: tag ? `${name}  ·  ${tag}` : name,
            checked: checkout?.branch === name,
            disabled: switchingBranch !== null,
            onSelect: () => onSwitch(projectRoot, name, data),
          };
        }),
    at,
  );
}

interface ProjectContextMenuProps {
  menuRef: RefObject<HTMLDivElement | null>;
  projectRoot: string;
  pos: { top: number; left: number };
  branchMenu: ProjectBranchMenuState | null;
  branchLoading: boolean;
  selectedCwd: string | null;
  switchingBranch: string | null;
  canReveal: boolean;
  revealLabel: string;
  projectRevealError: string | null;
  t: Translate;
  onShowBranches: () => void;
  onBackToActions: () => void;
  onOpenTerminal?: () => void;
  onReveal: () => void;
  onArchive: () => void;
  onSwitchBranch: (branch: string) => void;
}

export function ProjectContextMenu({
  menuRef, projectRoot, pos, branchMenu, branchLoading, selectedCwd, switchingBranch,
  canReveal, revealLabel, projectRevealError, t,
  onShowBranches, onBackToActions, onOpenTerminal, onReveal, onArchive, onSwitchBranch,
}: ProjectContextMenuProps) {
  return createPortal(
    <div
      ref={menuRef}
      className="sidebar-project-context-menu native-popover"
      style={{ top: pos.top, left: pos.left, maxHeight: "min(70vh, 420px)", overflowY: "auto" }}
      role="menu"
    >
      {!branchMenu ? (
        <>
          <button
            type="button"
            role="menuitem"
            onClick={onShowBranches}
          >
            {t("sidebar.switchBranch")}
          </button>
          {onOpenTerminal && (
            <button
              type="button"
              role="menuitem"
              onClick={onOpenTerminal}
            >
              {t("sidebar.openTerminalHere")}
            </button>
          )}
          {canReveal && (
            <button
              type="button"
              role="menuitem"
              onClick={onReveal}
            >
              {revealLabel}
            </button>
          )}
          {projectRevealError && (
            <div className="sidebar-project-context-menu-hint" role="alert">{projectRevealError}</div>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={onArchive}
          >
            {t("sidebar.archiveProject")}
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            role="menuitem"
            className="sidebar-project-context-menu-back"
            onClick={onBackToActions}
          >
            <span aria-hidden="true">‹</span> {t("sidebar.moreActions")}
          </button>
          <div className="sidebar-project-context-menu-heading">{t("sidebar.switchBranch")}</div>
          {branchLoading && branchMenu.root === projectRoot && (
            <div className="sidebar-project-context-menu-hint">…</div>
          )}
          {branchMenu.loaded && branchMenu.root === projectRoot && (
            <>
              {[...branchMenu.branches.map((name) => ({ name, remote: false })),
                ...branchMenu.remoteBranches.map((name) => ({ name, remote: true }))]
                .map(({ name, remote }) => {
                  const checkout = branchMenu.worktrees.find((w) => w.path === selectedCwd)
                    ?? branchMenu.worktrees.find((w) => w.isMain);
                  const isCurrent = checkout?.branch === name;
                  const holder = branchMenu.worktrees.find((w) => w.branch === name && w.path !== checkout?.path);
                  const switching = switchingBranch === name;
                  return (
                    <button
                      key={`${remote ? "remote:" : "local:"}${name}`}
                      type="button"
                      role="menuitem"
                      disabled={switchingBranch !== null}
                      onClick={() => onSwitchBranch(name)}
                      title={holder
                        ? t("sidebar.branchInWorktreeTitle", { branch: name })
                        : remote
                          ? t("sidebar.branchRemoteTitle")
                          : t("sidebar.switchBranchTitle", { branch: name })}
                    >
                      <span className="sidebar-project-context-menu-branch-mark" aria-hidden="true">
                        {isCurrent ? "✓" : ""}
                      </span>
                      <span>{name}</span>
                      {holder && <span className="sidebar-project-context-menu-branch-tag">worktree</span>}
                      {remote && !holder && <span className="sidebar-project-context-menu-branch-tag">{t("sidebar.remoteBranchTag")}</span>}
                      {switching && <span className="sidebar-project-context-menu-branch-spinner" aria-hidden="true">↻</span>}
                    </button>
                  );
                })}
              {branchMenu.branches.length === 0 && branchMenu.remoteBranches.length === 0 && (
                <div className="sidebar-project-context-menu-hint">{t("sidebar.noOtherBranches")}</div>
              )}
            </>
          )}
        </>
      )}
    </div>,
    document.body,
  );
}
