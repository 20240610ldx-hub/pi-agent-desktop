import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeSidebarSessionMetadata, setSidebarSessionFlag, moveSidebarSessionsToGroup,
  addSidebarSessionGroup, sidebarSessionFamilyIds, orderSidebarSessions, sidebarSessionStatus,
} from "./sidebar-session-metadata.ts";

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
