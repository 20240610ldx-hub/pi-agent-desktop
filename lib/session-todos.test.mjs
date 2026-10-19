import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { projectSessionTodoEntry, projectSessionTodoState, readSessionTodos } = await jiti.import("./session-todos.ts");

function entry(id, parentId, tasks, extra = {}) {
  return { type: "custom", id, parentId, customType: "rpiv-todo-state", data: { tasks, nextId: 5, ...extra } };
}
const task = { id: 1, subject: "Inspect parser", status: "pending" };

test("canonical todo projection copies only display fields and retains deleted dependencies", () => {
  const tasks = [
    { ...task, description: "Details", activeForm: "Inspecting", blockedBy: [2], owner: "worker", metadata: { secret: "private" } },
    { id: 2, subject: "Old prerequisite", status: "deleted" },
  ];
  const raw = entry("snapshot", null, tasks, { params: { secret: "private" }, error: "private" });
  const state = projectSessionTodoEntry(raw);
  assert.deepEqual(state, {
    source: "rpiv-todo", snapshotEntryId: "snapshot", tasks: [
      { ...task, description: "Details", activeForm: "Inspecting", blockedBy: [2], owner: "worker" },
      { id: 2, subject: "Old prerequisite", status: "deleted" },
    ],
  });
  assert.equal(JSON.stringify(state).includes("private"), false);
  tasks[0].blockedBy.push(99);
  tasks[0].subject = "Mutated after projection";
  assert.equal(state.tasks[0].subject, task.subject);
  assert.deepEqual(state.tasks[0].blockedBy, [2]);
  assert.deepEqual(projectSessionTodoState({ ...state, params: "private" }), state);
});

test("invalid or excessive snapshots are ignored whole, while an empty canonical snapshot clears", () => {
  const invalidTasks = [
    [{ ...task, id: 0 }], [{ ...task, id: NaN }], [{ ...task, id: 1.5 }],
    [{ ...task, status: "done" }], [{ ...task, subject: " " }],
    [{ ...task, blockedBy: ["2"] }], [{ ...task, description: 42 }],
    [{ ...task, owner: {} }], [task, task],
    [{ ...task, subject: "x".repeat(2049) }],
    Array.from({ length: 1001 }, (_, i) => ({ ...task, id: i + 1 })),
  ];
  for (const tasks of invalidTasks) assert.equal(projectSessionTodoEntry(entry("bad", null, tasks)), null);
  for (const nextId of [undefined, 0, Infinity, "5"]) {
    assert.equal(projectSessionTodoEntry(entry("bad", null, [task], { nextId })), null);
  }
  assert.equal(projectSessionTodoEntry({ ...entry("bad", null, [task]), type: "custom_message" }), null);
  assert.equal(projectSessionTodoEntry({ ...entry("bad", null, [task]), customType: "other" }), null);
  assert.equal(projectSessionTodoState({ source: "other", snapshotEntryId: "x", tasks: [] }), null);
  assert.equal(projectSessionTodoState({ source: "rpiv-todo", snapshotEntryId: "", tasks: [] }), null);
  assert.deepEqual(projectSessionTodoEntry(entry("clear", null, [])), { source: "rpiv-todo", snapshotEntryId: "clear", tasks: [] });
});

test("latest valid ancestor wins without leaking a later sibling branch or inventing legacy tasks", () => {
  const root = { id: "root", parentId: null, type: "message", message: { role: "user", content: "Request" } };
  const entries = [
    root,
    entry("first", "root", [task]),
    entry("invalid", "first", [{ ...task, status: "invented" }]),
    { id: "leaf", parentId: "invalid", type: "compaction" },
    entry("sibling", "root", [{ ...task, id: 3, subject: "Other branch" }]),
  ];
  assert.deepEqual(readSessionTodos(entries, "leaf"), { source: "rpiv-todo", snapshotEntryId: "first", tasks: [task] });
  assert.equal(readSessionTodos(entries, null), null);
  assert.equal(readSessionTodos(entries, "missing"), null);
  assert.equal(readSessionTodos([]), null);
  assert.equal(readSessionTodos([root, { id: "tool", parentId: "root", type: "message", message: { role: "toolResult", details: { tasks: [task], nextId: 2 } } }]), null);
  assert.equal(readSessionTodos(entries).snapshotEntryId, "sibling");
  assert.equal(readSessionTodos([{ id: "cycle", parentId: "cycle" }], "cycle"), null);
});
