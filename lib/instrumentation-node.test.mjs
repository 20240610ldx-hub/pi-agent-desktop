import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";

test("re-registering server instrumentation keeps a single owned shutdown listener", async () => {
  const previous = process.env.PI_WEB_DISABLE_SCHEDULER;
  process.env.PI_WEB_DISABLE_SCHEDULER = '1';
  try {
    const { registerNodeInstrumentation } = await createJiti(import.meta.url, {tsconfigPaths:true}).import('../instrumentation-node');
    const before = { SIGINT: process.listenerCount('SIGINT'), SIGTERM: process.listenerCount('SIGTERM') };
    registerNodeInstrumentation(); registerNodeInstrumentation();
    for (const signal of ['SIGINT','SIGTERM']) assert.equal(process.listenerCount(signal), before[signal]+1);
  } finally {
    if(previous===undefined)delete process.env.PI_WEB_DISABLE_SCHEDULER;else process.env.PI_WEB_DISABLE_SCHEDULER=previous;
  }
});
