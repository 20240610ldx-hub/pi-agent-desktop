import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("./useAgentSession.ts", import.meta.url), "utf8");
const start = source.indexOf("  const handleFork = useCallback");
const end = source.indexOf("  const handleNavigate = useCallback", start);
assert.ok(start >= 0 && end > start);

test("forking a response includes it; forking a user prompt keeps edit-before semantics", async () => {
  const commands = [], followed = [];
  const handleFork = vm.runInNewContext(stripTypeScriptTypes(source.slice(start, end) + "\nhandleFork;"), {
    useCallback: fn => fn,
    bashRunningRef: { current: false },
    sessionIdRef: { current: "original" },
    setForkingEntryId() {},
    sendAgentCommand: async (id, command) => { commands.push({ id, ...command }); return { newSessionId: "child" }; },
    onSessionForked: id => followed.push(id),
    addNotice: notice => assert.fail(JSON.stringify(notice)),
    t: value => value,
    console,
  });
  await handleFork("response-entry", "after");
  await handleFork("user-entry");
  assert.deepEqual(commands, [
    { id: "original", type: "fork_branch", entryId: "response-entry" },
    { id: "original", type: "fork", entryId: "user-entry" },
  ]);
  assert.deepEqual(followed, ["child", "child"]);
});
