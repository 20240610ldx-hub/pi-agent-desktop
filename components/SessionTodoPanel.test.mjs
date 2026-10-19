import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
import { fromHtml } from "hast-util-from-html";

const jiti = createJiti(import.meta.url, { jsx: { runtime: "automatic" }, tsconfigPaths: true });
const React = await jiti.import("react");
const { renderToStaticMarkup } = await jiti.import("react-dom/server");
const { I18nProvider } = await jiti.import("@/hooks/useI18n");
const { SessionTodoPanel } = await jiti.import("./SessionTodoPanel.tsx");
const nodes = (node, predicate) => [...(predicate(node) ? [node] : []), ...(node.children ?? []).flatMap((child) => nodes(child, predicate))];
const text = (node) => node.type === "text" ? node.value : (node.children ?? []).map(text).join("");
const hasClass = (node, name) => node.properties?.className?.includes(name);
const render = (todos) => fromHtml(renderToStaticMarkup(React.createElement(I18nProvider, null, React.createElement(SessionTodoPanel, { todos }))), { fragment: true });

test("unknown task state stays absent while canonical clear and deleted-only snapshots show an honest empty state", () => {
  assert.equal(text(render(null)), "");
  for (const tasks of [[], [{ id: 1, subject: "Deleted record", status: "deleted" }]]) {
    const tree = render({ source: "rpiv-todo", snapshotEntryId: "generated-clear", tasks });
    assert.equal(nodes(tree, (node) => node.tagName === "section").length, 1);
    assert.match(text(tree), /TasksNo tasks/);
    assert.doesNotMatch(text(tree), /completed|progress|Deleted record|Plan|%/);
  }
});

test("canonical tasks expose real status, owner, dependencies and counts without modifying deleted history", () => {
  const todos = { source: "rpiv-todo", snapshotEntryId: "generated-todo-panel", tasks: [
    { id: 1, subject: "Inspect source <literal>", status: "completed" },
    { id: 2, subject: "Implement generated consumer", status: "in_progress", activeForm: "Implementing generated consumer", owner: "generated-worker" },
    { id: 3, subject: "Verify exact contract", status: "pending", description: "Keep <source> & dependency IDs", blockedBy: [1, 2, 99] },
    { id: 4, subject: "Deleted historical task", status: "deleted" },
  ] };
  const before = structuredClone(todos);
  const tree = render(todos);
  const rows = nodes(tree, (node) => hasClass(node, "session-todo-row"));
  assert.equal(rows.length, 3, "Deleted tombstones are omitted from the visible list only");
  assert.deepEqual(rows.map((node) => node.properties.dataStatus), ["completed", "in_progress", "pending"]);
  assert.match(text(tree), /1 of 3 completed/);
  assert.match(text(tree), /1 in progress/);
  assert.match(text(tree), /1 pending/);
  assert.match(text(tree), /Owner: generated-worker/);
  assert.match(text(tree), /Depends on: #1, #2, #99/);
  assert.match(text(tree), /Inspect source <literal>/);
  assert.match(text(tree), /Keep <source> & dependency IDs/);
  assert.equal(nodes(tree, (node) => node.tagName === "source").length, 0, "Task data remains plain text");
  assert.equal(nodes(tree, (node) => node.tagName === "input" || node.properties?.role === "progressbar").length, 0, "Read-only tasks do not offer mutation or an invented percentage");
  assert.doesNotMatch(text(tree), /Deleted historical task|Plan|%/);
  assert.deepEqual(todos, before, "Rendering never removes backend tombstones or rewrites statuses");
});
