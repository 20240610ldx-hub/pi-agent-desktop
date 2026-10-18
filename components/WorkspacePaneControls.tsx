"use client";

import { useI18n } from "@/hooks/useI18n";
import { PilaudeIcon } from "./PilaudeIcon";

export type WorkspacePaneId = "files" | "terminal" | "tasks";

interface Props {
  openPanes: Record<WorkspacePaneId, boolean>;
  onToggle: (id: WorkspacePaneId) => void;
}

const controls = [
  { id: "files", icon: "folder" },
  { id: "terminal", icon: "terminal" },
  { id: "tasks", icon: "branch" },
] as const;

/** Visibility controls never close tabs, terminate shells, or stop tasks. */
export function WorkspacePaneControls({ openPanes, onToggle }: Props) {
  const { t } = useI18n();
  return (
    <div className="workspace-pane-controls" role="group" aria-label={t("workspace.panes")}>
      {controls.map(({ id, icon }) => {
        const open = openPanes[id];
        const label = t(open ? "workspace.hidePane" : "workspace.showPane", { name: t(`workspace.pane.${id}`) });
        return (
          <button key={id} type="button" className="file-workbench-icon-button workspace-pane-toggle"
            title={label} aria-label={label} aria-pressed={open} aria-controls={`workspace-pane-${id}`}
            onClick={() => onToggle(id)}>
            <PilaudeIcon name={icon} size={16} />
          </button>
        );
      })}
    </div>
  );
}
