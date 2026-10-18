/**
 * A pane is a workspace surface, not one of its internal tabs.
 * Two panes per column is the confirmed default. Placement/recovery policies
 * below are engineering defaults; see docs/pilaude-workspace-panes.md.
 */
export type WorkspacePaneLayout = {
  version: 1;
  columns: Array<{
    id: string;
    paneIds: string[];
    width: number;
    split: number;
  }>;
  expandedPaneId: string | null;
};

type WorkspacePaneColumn = WorkspacePaneLayout["columns"][number];

const MAX_PANES_PER_COLUMN = 2;
const DEFAULT_WIDTH = 400;
const DEFAULT_SPLIT = 0.5;
const RESERVED_IDS = new Set([...Object.getOwnPropertyNames(Object.prototype), "prototype"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Keep persisted IDs short and opaque; never coerce or trim an invalid ID.
function isValidId(value: unknown): value is string {
  return typeof value === "string"
    && value.length <= 128
    && /^[A-Za-z0-9_-]+$/.test(value)
    && !RESERVED_IDS.has(value);
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback;
}

// Each operation derives IDs only from its input, with no global counter/randomness.
function columnIdAllocator(existingIds: Iterable<string>): () => string {
  const usedIds = new Set(existingIds);
  let next = 1;
  return () => {
    while (usedIds.has(`column-${next}`)) next += 1;
    const id = `column-${next}`;
    usedIds.add(id);
    next += 1;
    return id;
  };
}

export function normalizeWorkspacePaneLayout(raw: unknown): WorkspacePaneLayout {
  if (!isRecord(raw) || raw.version !== 1 || !Array.isArray(raw.columns)) {
    return { version: 1, columns: [], expandedPaneId: null };
  }

  const columns: WorkspacePaneColumn[] = [];
  const paneIds = new Set<string>();
  const columnIds = new Set<string>();
  for (const column of raw.columns) {
    if (!isRecord(column) || !Array.isArray(column.paneIds)) continue;

    const retainedPaneIds: string[] = [];
    for (const paneId of column.paneIds) {
      if (!isValidId(paneId) || paneIds.has(paneId)) continue;
      retainedPaneIds.push(paneId);
      paneIds.add(paneId);
      if (retainedPaneIds.length === MAX_PANES_PER_COLUMN) break;
    }
    if (retainedPaneIds.length === 0) continue;

    const id = isValidId(column.id) && !columnIds.has(column.id) ? column.id : "";
    if (id) columnIds.add(id);
    columns.push({
      id,
      paneIds: retainedPaneIds,
      width: clamp(column.width, 280, 1200, DEFAULT_WIDTH),
      split: clamp(column.split, 0.2, 0.8, DEFAULT_SPLIT),
    });
  }

  // Repair missing/duplicate column IDs after reserving all valid IDs, including
  // later columns, so recovery never steals another surviving column's key.
  const allocateColumnId = columnIdAllocator(columnIds);
  for (const column of columns) {
    if (!column.id) column.id = allocateColumnId();
  }

  return {
    version: 1,
    columns,
    expandedPaneId: isValidId(raw.expandedPaneId) && paneIds.has(raw.expandedPaneId)
      ? raw.expandedPaneId
      : null,
  };
}

export function reconcileWorkspacePanes(
  layout: WorkspacePaneLayout,
  openPaneIds: string[],
): WorkspacePaneLayout {
  const normalized = normalizeWorkspacePaneLayout(layout);
  const openIds = [...new Set(openPaneIds.filter(isValidId))];
  const openIdsSet = new Set(openIds);
  const allocateColumnId = columnIdAllocator(normalized.columns.map((column) => column.id));
  const columns = normalized.columns
    .map((column) => ({ ...column, paneIds: column.paneIds.filter((id) => openIdsSet.has(id)) }))
    .filter((column) => column.paneIds.length > 0);
  const retainedPaneIds = new Set(columns.flatMap((column) => column.paneIds));

  for (const paneId of openIds) {
    if (retainedPaneIds.has(paneId)) continue;

    // Only new panes fill vacancies. Existing panes never change parent columns,
    // even when closing another pane leaves holes or openPaneIds is reordered.
    let target: WorkspacePaneColumn | undefined;
    for (let index = columns.length - 1; index >= 0; index -= 1) {
      if (columns[index].paneIds.length < MAX_PANES_PER_COLUMN) {
        target = columns[index];
        break;
      }
    }
    if (target) {
      target.paneIds.push(paneId);
    } else {
      columns.push({
        id: allocateColumnId(),
        paneIds: [paneId],
        width: DEFAULT_WIDTH,
        split: DEFAULT_SPLIT,
      });
    }
  }

  return {
    version: 1,
    columns,
    expandedPaneId: normalized.expandedPaneId !== null && openIdsSet.has(normalized.expandedPaneId)
      ? normalized.expandedPaneId
      : null,
  };
}

/** A single column belongs to the outer workbench resizer. Saved inner widths
 * only constrain side-by-side columns, never a lone or expanded pane. */
export function getWorkspacePaneGridStyle(layout: WorkspacePaneLayout): {
  minWidth: number;
  gridTemplateColumns: string;
} {
  if (layout.expandedPaneId || layout.columns.length <= 1) {
    return { minWidth: 0, gridTemplateColumns: "minmax(0, 1fr)" };
  }
  return {
    minWidth: layout.columns.reduce((sum, column) => sum + column.width, (layout.columns.length - 1) * 8),
    gridTemplateColumns: layout.columns.map((column, index) => index === layout.columns.length - 1
      ? `minmax(${column.width}px, 1fr)` : `${column.width}px`).join(" 8px "),
  };
}

export function resizeWorkspacePaneColumn(
  layout: WorkspacePaneLayout,
  columnId: string,
  width: number,
): WorkspacePaneLayout {
  const normalized = normalizeWorkspacePaneLayout(layout);
  return {
    ...normalized,
    columns: normalized.columns.map((column) => column.id === columnId
      ? { ...column, width: clamp(width, 280, 1200, DEFAULT_WIDTH) }
      : column),
  };
}

export function splitWorkspacePaneColumn(
  layout: WorkspacePaneLayout,
  columnId: string,
  ratio: number,
): WorkspacePaneLayout {
  const normalized = normalizeWorkspacePaneLayout(layout);
  return {
    ...normalized,
    columns: normalized.columns.map((column) => column.id === columnId
      ? { ...column, split: clamp(ratio, 0.2, 0.8, DEFAULT_SPLIT) }
      : column),
  };
}

export function toggleWorkspacePaneExpanded(
  layout: WorkspacePaneLayout,
  paneId: string,
): WorkspacePaneLayout {
  const normalized = normalizeWorkspacePaneLayout(layout);
  if (!normalized.columns.some((column) => column.paneIds.includes(paneId))) return normalized;
  return {
    ...normalized,
    expandedPaneId: normalized.expandedPaneId === paneId ? null : paneId,
  };
}
