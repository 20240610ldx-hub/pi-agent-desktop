import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const load = () => createJiti(import.meta.url).import("./pilaude-import");
async function fixture(run) {
  const root = await mkdtemp(join(tmpdir(), "pilaude-import-copy-"));
  try {
    const source = join(root, "old"); const target = join(root, "new");
    await mkdir(join(source, "sessions"), { recursive: true }); await mkdir(target);
    await run({ root, source, target });
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("import copies exact session bytes after backup and skips existing targets and credentials", async () => {
  const { previewPiImport, executePiImport } = await load();
  await fixture(async ({ source, target }) => {
    const history = '{"type":"session","unknown":{"future":true}}\r\n';
    await writeFile(join(source, "sessions", "history.jsonl"), history);
    await writeFile(join(source, "settings.json"), '{"defaultModel":"old"}');
    await writeFile(join(source, "auth.json"), "do-not-import");
    await writeFile(join(target, "settings.json"), '{"defaultModel":"current"}');
    const preview = await previewPiImport(source, target);
    const result = await executePiImport(source, target, preview.digest);
    assert.deepEqual(result.imported, ["sessions/history.jsonl"]);
    assert.deepEqual(result.skipped, ["settings.json"]);
    assert.equal(await readFile(join(target, "settings.json"), "utf8"), '{"defaultModel":"current"}');
    assert.equal(await readFile(join(target, "sessions", "history.jsonl"), "utf8"), history);
    assert.equal(await readFile(join(result.backupDir, "sessions", "history.jsonl"), "utf8"), history);
    assert.equal((await readdir(target)).includes("auth.json"), false);
    assert.equal(await readFile(join(source, "auth.json"), "utf8"), "do-not-import");
  });
});

test("import preserves unknown configuration but removes secrets and executable settings before backup", async () => {
  const { previewPiImport, executePiImport } = await load();
  await fixture(async ({ source, target }) => {
    await writeFile(join(source, "settings.json"), JSON.stringify({ extensions:["run-me"], packages:["npm:run"], shellCommandPrefix:"run", sessionDir:"elsewhere", defaultProjectTrust:"trusted", future:{ flag:1 }, defaultModel:"flash" }));
    await writeFile(join(source, "models.json"), JSON.stringify({ future:{ flag:2 }, providers:{ custom:{ baseUrl:"https://example.test/v1", apiKey:"private-import-key", headers:{ Authorization:"private-import-header" }, models:[{id:"x",headers:{"X-Key":"private-model-header"}}] } } }));
    const preview = await previewPiImport(source, target);
    assert.ok(preview.warnings.length > 0);
    const result = await executePiImport(source, target, preview.digest);
    const settings = JSON.parse(await readFile(join(target, "settings.json"), "utf8"));
    assert.deepEqual(settings.future, {flag:1}); assert.equal(settings.defaultModel,"flash");
    for (const key of ["extensions","packages","shellCommandPrefix","sessionDir","defaultProjectTrust"]) assert.equal(key in settings,false);
    for (const directory of [target,result.backupDir]) {
      const raw = await readFile(join(directory,"models.json"),"utf8");
      for (const secret of ["private-import-key","private-import-header","private-model-header"]) assert.equal(raw.includes(secret),false);
      assert.deepEqual(JSON.parse(raw).future,{flag:2});
    }
  });
});

test("changed source or malformed config is rejected before publishing any target file", async () => {
  const { previewPiImport, executePiImport } = await load();
  await fixture(async ({ source, target }) => {
    await writeFile(join(source,"settings.json"),'{}');
    const preview = await previewPiImport(source,target);
    await writeFile(join(source,"settings.json"),'{"changed":true}');
    await assert.rejects(executePiImport(source,target,preview.digest),/changed/i);
    assert.deepEqual(await readdir(target),[]);
    await writeFile(join(source,"settings.json"),'{bad');
    await assert.rejects(previewPiImport(source,target),/settings.json/);
    assert.deepEqual(await readdir(target),[]);
  });
});

test("import refuses linked target directories and never copies through them", async () => {
  const { previewPiImport, executePiImport } = await load();
  await fixture(async ({ root, source, target }) => {
    const outside = join(root,"outside"); await mkdir(outside);
    await writeFile(join(source,"sessions","history.jsonl"),'{}\n');
    await symlink(outside,join(target,"sessions"),process.platform==='win32'?'junction':'dir');
    await assert.rejects(async()=>executePiImport(source,target,(await previewPiImport(source,target)).digest),/link/i);
    assert.deepEqual(await readdir(outside),[]);
  });
});

test("ancestor junction aliases cannot import into the physical source or its descendants", async () => {
  const { previewPiImport } = await load();
  await fixture(async ({root,source})=>{
    const alias = join(root,'alias');
    await symlink(root,alias,process.platform==='win32'?'junction':'dir');
    for (const target of [join(alias,'old'),join(alias,'old','nested')]) {
      await assert.rejects(previewPiImport(source,target),/separate directories/i);
    }
    assert.deepEqual((await readdir(source)).sort(),['sessions']);
  });
});
