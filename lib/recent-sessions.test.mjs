import assert from "node:assert/strict";
import test from "node:test";
import { getRecallSessions, hasRecallSessionsToday, MAX_RECENT_SESSIONS } from "./recent-sessions.ts";

const session = (id, modified, relation, projectKey = id) => ({
  id,
  modified,
  relation,
  projectKey,
});

test("recent sessions sort across projects, exclude subagents and scheduled runs, and cap the list", () => {
  const sessions = [
    session("old", "2026-10-01T10:00:00Z"),
    session("subagent", "2026-10-04T10:00:00Z", { kind: "subagent", parentSessionId: "old" }),
    session("scheduled", "2026-10-03T10:00:00Z", { kind: "scheduled", taskId: "task", runId: "run" }),
    session("new-b", "2026-10-04T09:00:00Z"),
    session("new-a", "2026-10-04T10:00:01Z"),
    session("new-c", "2026-10-04T08:00:00Z"),
    session("new-d", "2026-10-03T12:00:00Z"),
    session("new-e", "2026-10-03T11:00:00Z"),
    session("new-f", "2026-10-03T10:00:00Z"),
    session("new-g", "2026-10-02T10:00:00Z"),
  ];

  assert.deepEqual(getRecallSessions(sessions), [
    sessions[4],
    sessions[3],
    sessions[5],
    sessions[6],
    sessions[7],
    sessions[8],
  ]);
  assert.equal(MAX_RECENT_SESSIONS, 6);
  assert.deepEqual(getRecallSessions(sessions, new Date("2026-10-04T00:00:00Z"), 1).map((item) => item.id), ["new-a"]);
  assert.deepEqual(getRecallSessions([], 1), []);
});

test("recall prefers today's sessions and labels the section accordingly", () => {
  const now = new Date("2026-10-04T12:00:00");
  const sessions = [
    { id: "old", modified: "2026-10-02T23:00:00Z" },
    { id: "today", modified: "2026-10-04T00:00:00Z" },
  ];

  assert.equal(hasRecallSessionsToday(sessions, now), true);
  assert.deepEqual(getRecallSessions(sessions, now).map((item) => item.id), ["today"]);
  assert.equal(hasRecallSessionsToday([sessions[0]], now), false);
  assert.deepEqual(getRecallSessions([sessions[0]], now).map((item) => item.id), ["old"]);
});

test("recall caps projects before filling remaining slots", () => {
  const now = new Date("2026-10-04T12:00:00Z");
  const sessions = [
    session("a3", "2026-10-04T11:00:00Z", undefined, "a"),
    session("a2", "2026-10-04T10:00:00Z", undefined, "a"),
    session("a1", "2026-10-04T09:00:00Z", undefined, "a"),
    session("b2", "2026-10-04T08:00:00Z", undefined, "b"),
    session("b1", "2026-10-04T07:00:00Z", undefined, "b"),
    session("c1", "2026-10-04T06:00:00Z", undefined, "c"),
  ];

  assert.deepEqual(getRecallSessions(sessions, now).map((item) => item.id), [
    "a3",
    "a2",
    "b2",
    "b1",
    "c1",
    "a1",
  ]);
});
