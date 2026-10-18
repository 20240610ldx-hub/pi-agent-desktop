import assert from "node:assert/strict";
import { homedir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

test("system home keeps OS semantics when the agent home is overridden", async () => {
  const previous = process.env.PI_AGENT_HOME;
  const expected = homedir();
  process.env.PI_AGENT_HOME = join(expected, "pilaude-agent-home-override");
  try {
    const { systemHome, userHome } = await createJiti(import.meta.url).import("./user-home.ts");
    assert.equal(systemHome(), expected);
    assert.equal(userHome(), process.env.PI_AGENT_HOME);
  } finally {
    if (previous === undefined) delete process.env.PI_AGENT_HOME;
    else process.env.PI_AGENT_HOME = previous;
  }
});
