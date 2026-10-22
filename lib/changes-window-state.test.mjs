import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const api = await jiti.import("./changes-window-state.ts");

function storage(run) {
  const previous = globalThis.window;
  const values = new Map();
  globalThis.window = { localStorage: { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) } };
  try { return run(values); } finally { globalThis.window = previous; }
}

test("a popout reloads the same commit, file, sidebar and draft without putting them in its URL", () => storage(() => {
  const id = api.createChangesWindowView({ cwd: "D:/project", targetId: "draft-A", sessionId: "session-A", state: {
    version: 1, scope: "commit", base: "refs/heads/main", commit: "a".repeat(40), selectedPath: "src/用户.ts",
    openPaths: ["src/用户.ts"], showFiles: true, commitsOpen: false, split: true, wrap: false,
    closedFolders: ["tests"], contexts: { "src/用户.ts": 20 },
    selection: { path: "src/用户.ts", side: "old", start: 81, end: 83 }, feedback: "Keep this unsent feedback 中文", scrollTop: 720,
  } });
  assert.match(id, /^[0-9a-f-]{36}$/);
  const view = api.readChangesWindowView(id, "D:/project", "draft-A");
  assert.equal(view.sessionId, "session-A");
  assert.equal(view.state.scope, "commit");
  assert.equal(view.state.commit, "a".repeat(40));
  assert.equal(view.state.selectedPath, "src/用户.ts");
  assert.deepEqual(view.state.openPaths, ["src/用户.ts"]);
  assert.equal(view.state.commitsOpen, false);
  assert.equal(view.state.split, true);
  assert.equal(view.state.wrap, false);
  assert.deepEqual(view.state.closedFolders, ["tests"]);
  assert.deepEqual(view.state.selection, { path: "src/用户.ts", side: "old", start: 81, end: 83 });
  assert.equal(view.state.feedback, "Keep this unsent feedback 中文");
  assert.equal(view.state.scrollTop, 720);
  assert.equal(api.readChangesWindowView(id, "D:/other", "draft-A"), null);
  assert.equal(api.readChangesWindowView(id, "D:/project", "draft-B"), null);
  api.updateChangesWindowView(id, "D:/project", "draft-A", { ...view.state, scrollTop: 930 });
  assert.equal(api.readChangesWindowView(id, "D:/project", "draft-A").state.scrollTop, 930);
}));

test("unknown fields, unsafe paths, unbounded ranges and future versions never become view state", () => {
  const value = api.normalizeChangesViewState({ version: 1, token: "private", patch: "never retained", openPaths: ["src/ok.ts", "../outside", "D:/absolute", "/root"],
    selectedPath: "../outside", scrollTop: Infinity, contexts: { "src/ok.ts": "all", "../outside": 20 }, selection: { path: "src/ok.ts", side: "new", start: 1, end: 501 }, feedback: "discard without valid selection" });
  assert.deepEqual(value.openPaths, ["src/ok.ts"]);
  assert.equal(value.selectedPath, "");
  assert.equal(value.selection, null);
  assert.equal(value.feedback, "discard without valid selection", "unbound comment is retained without a submit-capable range");
  assert.equal(value.scrollTop, 0);
  assert.equal("token" in value, false);
  assert.equal("patch" in value, false);
  assert.deepEqual(value.contexts, { "src/ok.ts": "all" });
  assert.equal(api.normalizeChangesViewState({ version: 2, scope: "uncommitted" }).scope, "all");
});

test("view records expire, stay bounded, and report inaccessible storage before opening", () => storage(values => {
  const ids = Array.from({ length: 9 }, () => api.createChangesWindowView({ cwd: "D:/project", state: { version: 1 } }));
  assert.equal(api.readChangesWindowView(ids[0], "D:/project"), null);
  assert.ok(api.readChangesWindowView(ids[8], "D:/project"));
  const [key, raw] = [...values][0];
  const records = JSON.parse(raw);
  records[7].updatedAt = Date.now() - 24 * 60 * 60 * 1000 - 1;
  values.set(key, JSON.stringify(records));
  assert.equal(api.readChangesWindowView(ids[8], "D:/project"), null);
  globalThis.window.localStorage.setItem = () => {};
  assert.throws(() => api.createChangesWindowView({ cwd: "D:/project", state: {} }), /storage is unavailable/);
}));

test("opening rejects excess paths and UTF-8 bytes before writing a truncated view", () => storage(values => {
  for (const state of [
    { version: 1, openPaths: Array.from({ length: 129 }, (_, i) => `src/${i}.ts`) },
    { version: 1, openPaths: Array.from({ length: 128 }, (_, i) => `src/${i}.ts`), closedFolders: ["other"] },
    { version: 1, openPaths: Array.from({ length: 30 }, (_, i) => `${i}/${"字".repeat(1200)}`) },
  ]) {
    assert.throws(() => api.createChangesWindowView({ cwd: "D:/project", state }), /too much state|too many paths/);
    assert.equal(values.size, 0, "rejected state must not reach storage or the open-window consumer");
  }
}));

test("malformed, missing and mismatched view identifiers never recover another owner's state", () => storage(() => {
  const id = api.createChangesWindowView({ cwd: "D:/project", targetId: "draft-A", state: { version: 1 } });
  for (const candidate of ["", "../api/home", id.toUpperCase(), `${id}0`, id.slice(1)]) {
    assert.equal(api.readChangesWindowView(candidate, "D:/project", "draft-A"), null);
  }
  assert.equal(api.readChangesWindowView(id, "D:/other", "draft-A"), null);
  assert.equal(api.readChangesWindowView(id, "D:/project", "draft-B"), null);
}));
