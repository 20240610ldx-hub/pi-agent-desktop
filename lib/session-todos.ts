/** Read-only native projection of @juicesharp/rpiv-todo's canonical custom entry. */
export type SessionTodoStatus = "pending" | "in_progress" | "completed" | "deleted";

export interface SessionTodoTask {
  id: number;
  subject: string;
  status: SessionTodoStatus;
  description?: string;
  activeForm?: string;
  blockedBy?: number[];
  owner?: string;
}

export interface SessionTodoState {
  source: "rpiv-todo";
  snapshotEntryId: string;
  tasks: SessionTodoTask[];
}

const TODO_ENTRY_TYPE = "rpiv-todo-state";
const MAX_TASKS = 1_000;
const MAX_TEXT_CHARACTERS = 256 * 1024;
const MAX_DEPENDENCIES = 10_000;
const TASK_STATUSES = new Set<SessionTodoStatus>(["pending", "in_progress", "completed", "deleted"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isEntryId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 512;
}

function projectTasks(value: unknown): SessionTodoTask[] | null {
  if (!Array.isArray(value) || value.length > MAX_TASKS) return null;
  const tasks: SessionTodoTask[] = [];
  const ids = new Set<number>();
  let characters = 0;
  let dependencies = 0;
  for (const raw of value) {
    if (!isRecord(raw) || !isId(raw.id) || ids.has(raw.id)
      || typeof raw.subject !== "string" || !raw.subject.trim() || raw.subject.length > 2_048
      || typeof raw.status !== "string" || !TASK_STATUSES.has(raw.status as SessionTodoStatus)) return null;
    const task: SessionTodoTask = { id: raw.id, subject: raw.subject, status: raw.status as SessionTodoStatus };
    ids.add(raw.id);
    characters += raw.subject.length;
    for (const [field, limit] of [["description", 16_384], ["activeForm", 2_048], ["owner", 256]] as const) {
      const text = raw[field];
      if (text === undefined) continue;
      if (typeof text !== "string" || text.length > limit) return null;
      characters += text.length;
      task[field] = text;
    }
    if (raw.blockedBy !== undefined) {
      if (!Array.isArray(raw.blockedBy) || raw.blockedBy.length > MAX_TASKS || !raw.blockedBy.every(isId)) return null;
      dependencies += raw.blockedBy.length;
      task.blockedBy = [...raw.blockedBy];
    }
    // Reject the whole snapshot instead of publishing a truncated, misleading list.
    if (characters > MAX_TEXT_CHARACTERS || dependencies > MAX_DEPENDENCIES) return null;
    tasks.push(task);
  }
  return tasks;
}

/** Shared client/server validator; copies only the fields the native panel displays. */
export function projectSessionTodoState(value: unknown): SessionTodoState | null {
  if (!isRecord(value) || value.source !== "rpiv-todo" || !isEntryId(value.snapshotEntryId)) return null;
  const tasks = projectTasks(value.tasks);
  return tasks ? { source: "rpiv-todo", snapshotEntryId: value.snapshotEntryId, tasks } : null;
}

/** Unknown storage, malformed snapshots and legacy tool-result details are not Todo state. */
export function projectSessionTodoEntry(entry: unknown): SessionTodoState | null {
  if (!isRecord(entry) || entry.type !== "custom" || entry.customType !== TODO_ENTRY_TYPE
    || !isEntryId(entry.id) || !isRecord(entry.data) || !isId(entry.data.nextId)) return null;
  return projectSessionTodoState({ source: "rpiv-todo", snapshotEntryId: entry.id, tasks: entry.data.tasks });
}

/** Latest valid snapshot on the full selected ancestor chain, independent of chat pagination. */
export function readSessionTodos(entries: readonly unknown[], leafId?: string | null): SessionTodoState | null {
  if (leafId === null || entries.length === 0) return null;
  const byId = new Map<string, Record<string, unknown>>();
  for (const entry of entries) {
    if (isRecord(entry) && isEntryId(entry.id)) byId.set(entry.id, entry);
  }
  const last = entries[entries.length - 1];
  let current = leafId === undefined ? (isRecord(last) ? last : undefined) : byId.get(leafId);
  const visited = new Set<unknown>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    const todos = projectSessionTodoEntry(current);
    if (todos) return todos;
    current = typeof current.parentId === "string" ? byId.get(current.parentId) : undefined;
  }
  return null;
}
