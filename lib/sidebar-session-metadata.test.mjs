import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSidebarSessionMetadata, setSidebarSessionFlag, moveSidebarSessionsToGroup,
  addSidebarSessionGroup, sidebarSessionFamilyIds, orderSidebarSessions, sidebarSessionStatus,
} from "./sidebar-session-metadata.ts";

import * as sidebarMetadata from "./sidebar-session-metadata.ts";

const empty = () => normalizeSidebarSessionMetadata(null);

test("malformed local metadata normalizes safely without prototype IDs", () => {
  for (const input of [null, [], {}, 1, "bad", { version: 2 }, { version: 1, groups: [null, false, [], { id: "__proto__", name: "bad" }], memberships: [null, false, [], {}, { sessionId: "x", groupId: "missing" }], pinnedIds: [null, "__proto__", "a", "a"], archivedIds: "bad" }]) {
    const next = normalizeSidebarSessionMetadata(input);
    assert.equal(next.version, 1);
    assert.ok(Array.isArray(next.groups));
    assert.ok(Array.isArray(next.memberships));
    assert.equal(next.groups.some((group) => group.id === "__proto__"), false);
    assert.deepEqual(next.memberships, []);
  }
});

test("pinning preserves order, is reversible and survives JSON persistence", () => {
  const metadata = setSidebarSessionFlag(empty(), "pinnedIds", ["b"], true);
  assert.deepEqual(orderSidebarSessions([{ id: "a" }, { id: "b" }, { id: "c" }], metadata.pinnedIds).map((item) => item.id), ["b", "a", "c"]);
  const restored = normalizeSidebarSessionMetadata(JSON.parse(JSON.stringify(metadata)));
  assert.deepEqual(restored, metadata);
  assert.deepEqual(setSidebarSessionFlag(restored, "pinnedIds", ["b"], false), empty());
});

test("pinned sessions follow persisted pin order while unpinned sessions keep input order", () => {
  const sessions = Object.freeze([Object.freeze({ id: "a" }), Object.freeze({ id: "b" }), Object.freeze({ id: "c" })]);
  const pins = Object.freeze(["b", "a"]);
  assert.deepEqual(orderSidebarSessions(sessions, pins).map((item) => item.id), ["b", "a", "c"]);
});

test("moving a displayed pin swaps adjacent eligible root slots without moving other metadata", () => {
  const metadata = Object.freeze({
    version: 1,
    pinnedIds: Object.freeze(["other-project", "b", "child", "archived", "a", "hidden-root", "other-group"]),
    archivedIds: Object.freeze(["archived"]),
    groups: Object.freeze([{ id: "g", name: "Group" }]),
    memberships: Object.freeze([{ sessionId: "other-group", groupId: "g" }]),
  });
  assert.equal(typeof sidebarMetadata.moveSidebarPinnedSession, "function");
  const moved = sidebarMetadata.moveSidebarPinnedSession(metadata, ["b", "a"], "b", "down");
  assert.deepEqual(moved, {
    ...metadata,
    pinnedIds: ["other-project", "a", "child", "archived", "b", "hidden-root", "other-group"],
  });
  assert.deepEqual(metadata.pinnedIds, ["other-project", "b", "child", "archived", "a", "hidden-root", "other-group"]);
});

test("adjacent pin moves reverse, stop at bucket boundaries and ignore ineligible ids", () => {
  const metadata = { ...empty(), pinnedIds: ["other", "a", "child", "b", "hidden"] };
  const move = sidebarMetadata.moveSidebarPinnedSession;
  assert.deepEqual(move(metadata, ["b", "a"], "b", "up").pinnedIds, ["other", "b", "child", "a", "hidden"]);
  const moved = move(metadata, ["a", "b"], "a", "down");
  assert.deepEqual(move(moved, ["a", "b"], "a", "up"), metadata);
  for (const [id, direction] of [["a", "up"], ["b", "down"], ["child", "up"], ["hidden", "down"], ["missing", "up"], ["unpinned", "down"]]) {
    assert.equal(move(metadata, ["a", "b", "unpinned"], id, direction), metadata);
  }
  assert.deepEqual(orderSidebarSessions([{ id: "d" }, { id: "c" }, { id: "b" }, { id: "a" }, { id: "e" }], ["missing", "a", "b"]).map((item) => item.id), ["a", "b", "d", "c", "e"]);
});

test("groups move complete families without changing stored session files", () => {
  const sessions = [{ id: "root" }, { id: "child", parentSessionId: "root" }, { id: "grandchild", parentSessionId: "child" }, { id: "other" }];
  const ids = sidebarSessionFamilyIds(sessions, "root");
  assert.deepEqual(ids, ["root", "child", "grandchild"]);
  const grouped = addSidebarSessionGroup(empty(), "group", "  My\n group  ", ids);
  assert.deepEqual(grouped.groups, [{ id: "group", name: "My group" }]);
  assert.equal(grouped.memberships.length, 3);
  assert.deepEqual(moveSidebarSessionsToGroup(grouped, ids, "missing"), grouped);
  assert.deepEqual(moveSidebarSessionsToGroup(grouped, ids, null).memberships, []);
  assert.equal(sessions[1].parentSessionId, "root");
});

test("archive and restore leave pin/group preferences and independent sessions intact", () => {
  const grouped = addSidebarSessionGroup(setSidebarSessionFlag(empty(), "pinnedIds", ["a"], true), "g", "Group", ["a"]);
  const archived = setSidebarSessionFlag(grouped, "archivedIds", ["a", "child"], true);
  assert.deepEqual(archived.archivedIds, ["a", "child"]);
  assert.deepEqual(setSidebarSessionFlag(archived, "archivedIds", ["a", "child"], false), grouped);
  assert.deepEqual(grouped.archivedIds, []);
});

test("needs-input outranks running and unread; idle is a distinct state", () => {
  assert.equal(sidebarSessionStatus(true, true, true), "needs-input");
  assert.equal(sidebarSessionStatus(false, true, true), "running");
  assert.equal(sidebarSessionStatus(false, false, true), "unread");
  assert.equal(sidebarSessionStatus(false, false, false), "idle");
});
