import type { SessionInfo } from "./types";

export const SIDEBAR_SESSION_METADATA_KEY = "pi-web:sidebar-session-metadata-v1";
export interface SidebarSessionMetadata {
  version: 1;
  pinnedIds: string[];
  archivedIds: string[];
  groups: Array<{ id: string; name: string }>;
  memberships: Array<{ sessionId: string; groupId: string }>;
}

const validId = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 256 && !/[\r\n\0]/.test(value) && !["__proto__", "prototype", "constructor"].includes(value);
const uniqueIds = (value: unknown): string[] => Array.isArray(value) ? [...new Set(value.filter(validId))] : [];

export function normalizeSidebarSessionMetadata(value: unknown): SidebarSessionMetadata {
  const empty: SidebarSessionMetadata = { version: 1, pinnedIds: [], archivedIds: [], groups: [], memberships: [] };
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== 1) return empty;
  const raw = value as Record<string, unknown>;
  const groups = new Map<string, { id: string; name: string }>();
  if (Array.isArray(raw.groups)) for (const item of raw.groups) {
    if (!item || typeof item !== "object" || !validId(item.id) || typeof item.name !== "string") continue;
    const name = item.name.replace(/\s+/g, " ").trim().slice(0, 80);
    if (name && !groups.has(item.id)) groups.set(item.id, { id: item.id, name });
  }
  const memberships = new Map<string, string>();
  if (Array.isArray(raw.memberships)) for (const item of raw.memberships) {
    if (item && validId(item.sessionId) && validId(item.groupId) && groups.has(item.groupId)) memberships.set(item.sessionId, item.groupId);
  }
  return { version: 1, pinnedIds: uniqueIds(raw.pinnedIds), archivedIds: uniqueIds(raw.archivedIds), groups: [...groups.values()], memberships: [...memberships].map(([sessionId, groupId]) => ({ sessionId, groupId })) };
}

export function setSidebarSessionFlag(metadata: SidebarSessionMetadata, flag: "pinnedIds" | "archivedIds", sessionIds: string[], enabled: boolean): SidebarSessionMetadata {
  const next = normalizeSidebarSessionMetadata(metadata);
  const ids = new Set(next[flag]);
  for (const id of sessionIds.filter(validId)) { if (enabled) ids.add(id); else ids.delete(id); }
  return { ...next, [flag]: [...ids] };
}

export function moveSidebarSessionsToGroup(metadata: SidebarSessionMetadata, sessionIds: string[], groupId: string | null): SidebarSessionMetadata {
  const next = normalizeSidebarSessionMetadata(metadata);
  if (groupId !== null && !next.groups.some((group) => group.id === groupId)) return next;
  const moved = new Set(sessionIds);
  return { ...next, memberships: [...next.memberships.filter((item) => !moved.has(item.sessionId)), ...(groupId === null ? [] : [...moved].filter(validId).map((sessionId) => ({ sessionId, groupId })))] };
}

export function addSidebarSessionGroup(metadata: SidebarSessionMetadata, id: string, name: string, sessionIds: string[]): SidebarSessionMetadata {
  const next = normalizeSidebarSessionMetadata({ ...metadata, groups: [...metadata.groups, { id, name }] });
  return moveSidebarSessionsToGroup(next, sessionIds, id);
}

/** Roots retain their nested descendants: move/archive the complete sidebar family. */
export function sidebarSessionFamilyIds(sessions: SessionInfo[], sessionId: string): string[] {
  const ids = new Set([sessionId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const session of sessions) if (session.parentSessionId && ids.has(session.parentSessionId) && !ids.has(session.id)) {
      ids.add(session.id); changed = true;
    }
  }
  return [...ids];
}

export function orderSidebarSessions<T extends { id: string }>(sessions: readonly T[], pinnedIds: readonly string[]): T[] {
  const pinRank = new Map(pinnedIds.map((id, index) => [id, index]));
  return sessions.map((session, index) => ({ session, index })).sort((a, b) => (pinRank.get(a.session.id) ?? Infinity) - (pinRank.get(b.session.id) ?? Infinity) || a.index - b.index).map(({ session }) => session);
}

/**
 * Adapted from open-claude-ui/code-examples/DraggableSessionList.tsx handleKeyDown:
 * find the adjacent index, guard boundaries, then splice a copied eligible list.
 * The caller supplies displayed roots from one project/group bucket. Merge back
 * into their original pin slots so descendants and every other bucket stay put.
 */
export function moveSidebarPinnedSession(metadata: SidebarSessionMetadata, eligibleRootIds: readonly string[], sessionId: string, direction: "up" | "down"): SidebarSessionMetadata {
  const eligible = new Set(eligibleRootIds);
  const list = metadata.pinnedIds.filter((id) => eligible.has(id));
  const currentIndex = list.indexOf(sessionId);
  if (currentIndex === -1) return metadata;
  const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (targetIndex < 0 || targetIndex >= list.length) return metadata;

  const updatedSubList = [...list];
  const [moved] = updatedSubList.splice(currentIndex, 1);
  updatedSubList.splice(targetIndex, 0, moved);
  let index = 0;
  return { ...metadata, pinnedIds: metadata.pinnedIds.map((id) => eligible.has(id) ? updatedSubList[index++] : id) };
}

export function sidebarSessionStatus(needsInput: boolean, running: boolean, unread: boolean): "needs-input" | "running" | "unread" | "idle" {
  return needsInput ? "needs-input" : running ? "running" : unread ? "unread" : "idle";
}
