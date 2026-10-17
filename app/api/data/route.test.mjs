import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

test("data import requires same-origin JSON and uses only fixed application directories", async () => {
  const root = await mkdtemp(join(tmpdir(), "pilaude-data-api-"));
  const previous = { home: process.env.PI_AGENT_HOME, agent: process.env.PI_CODING_AGENT_DIR };
  try {
    process.env.PI_AGENT_HOME = join(root,"home");
    process.env.PI_CODING_AGENT_DIR = join(root,"data");
    const source = join(root,"home",".pi","agent");
    await mkdir(join(source,"sessions"),{recursive:true});
    await writeFile(join(source,"sessions","api.jsonl"),'{"type":"session","future":true}\n');
    await writeFile(join(source,"auth.json"),'private-legacy-key');
    const { POST, GET } = await createJiti(import.meta.url,{tsconfigPaths:true}).import('./route');
    const request = (body, headers={}) => new Request('http://localhost/api/data',{ method:'POST', headers:{'Content-Type':'application/json',Host:'localhost',...headers},body:JSON.stringify(body) });
    assert.equal((await POST(request({action:'preview'},{Origin:'https://untrusted.test'}))).status,403);
    assert.equal((await POST(request({action:'preview'},{'Content-Type':'text/plain'}))).status,415);
    assert.equal((await POST(request({action:'preview',sourceDir:root}))).status,400);
    const info = await GET().json(); assert.equal(info.agentDir,join(root,'data'));
    const previewResponse = await POST(request({action:'preview'})); assert.equal(previewResponse.status,200);
    const preview = await previewResponse.json();
    assert.equal(JSON.stringify(preview).includes('private-legacy-key'),false);
    const result = await POST(request({action:'import',digest:preview.digest})); assert.equal(result.status,200);
    assert.deepEqual((await result.json()).imported,['sessions/api.jsonl']);
    assert.equal(await readFile(join(root,'data','sessions','api.jsonl'),'utf8'),'{"type":"session","future":true}\n');
  } finally {
    for(const [name,value] of [['PI_AGENT_HOME',previous.home],['PI_CODING_AGENT_DIR',previous.agent]]) {
      if(value===undefined)delete process.env[name];else process.env[name]=value;
    }
    await rm(root,{recursive:true,force:true});
  }
});
