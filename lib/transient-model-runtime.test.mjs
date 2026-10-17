import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

test("model probes resolve draft secrets without writing them to temporary configuration", async () => {
  const { withTransientModelRuntime } = await createJiti(import.meta.url).import("./transient-model-runtime");
  const before = new Set(await readdir(tmpdir()));
  await withTransientModelRuntime({ providers: { "pilaude-probe": {
    api: "openai-completions", baseUrl: "https://example.invalid/v1", apiKey: "probe-private-key",
    headers: { "X-Private": "private-header" },
    models: [{ id: "probe", headers: { "X-Model": "private-model-header" } }],
    modelOverrides: { probe: { headers: { "X-Model": "overridden-should-lose", "X-Override": "private-override-header" } } },
  } } }, async (runtime) => {
    assert.equal(runtime.getError(), undefined);
    const model = runtime.getModel("pilaude-probe", "probe");
    const auth = await runtime.getAuth(model);
    assert.equal(auth.auth.apiKey, "probe-private-key");
    assert.equal(auth.auth.headers["X-Private"], "private-header");
    assert.equal(auth.auth.headers["X-Model"], "private-model-header");
    assert.equal(auth.auth.headers["X-Override"], "private-override-header");
    for (const dir of (await readdir(tmpdir())).filter(name => name.startsWith("pilaude-model-probe-") && !before.has(name))) {
      const raw = await readFile(join(tmpdir(), dir, "models.json"), "utf8");
      for (const secret of ["probe-private-key", "private-header", "private-model-header", "private-override-header"]) assert.equal(raw.includes(secret), false);
    }
  });
  assert.deepEqual((await readdir(tmpdir())).filter(name => name.startsWith("pilaude-model-probe-") && !before.has(name)), []);
});

test("a draft key overrides a saved key for the probe without changing stored credentials", {skip:process.platform!=='win32'}, async () => {
  const directory = await mkdtemp(join(tmpdir(),'pilaude-probe-shadow-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = directory;
  try {
    const jiti = createJiti(import.meta.url);
    const { createPilaudeCredentialStore } = await jiti.import('./credential-store');
    const { withTransientModelRuntime } = await jiti.import('./transient-model-runtime');
    const store = createPilaudeCredentialStore(directory);
    await store.modify('custom',async()=>({type:'api_key',key:'saved-old-key'}));
    await withTransientModelRuntime({providers:{custom:{api:'openai-completions',baseUrl:'https://example.invalid/v1',apiKey:'new-draft-key',models:[{id:'probe'}]}}},async runtime=>{
      assert.equal((await runtime.getAuth(runtime.getModel('custom','probe'))).auth.apiKey,'new-draft-key');
    });
    assert.equal((await store.read('custom')).key,'saved-old-key');
  } finally {
    if(previous===undefined)delete process.env.PI_CODING_AGENT_DIR;else process.env.PI_CODING_AGENT_DIR=previous;
    await rm(directory,{recursive:true,force:true});
  }
});
