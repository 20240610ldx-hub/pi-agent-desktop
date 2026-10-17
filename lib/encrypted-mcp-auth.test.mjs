import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { setTimeout as delay } from "node:timers/promises";
import { fork } from "node:child_process";
import { once } from "node:events";

test("Pi's MCP OAuth store persists encrypted state and separates servers sharing a URL", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-mcp-encryption-'));
  try {
    const jiti = createJiti(import.meta.url);
    const { EncryptedMcpAuthBackend } = await jiti.import('./encrypted-mcp-auth');
    const { loadPiSdkInternals } = await jiti.import('./pi-sdk-internals');
    const internals = await loadPiSdkInternals(); assert.equal(internals.ok,true,internals.reason);
    const file = join(dir,'mcp-credentials.json');
    const backend = new EncryptedMcpAuthBackend(file);
    const store = new internals.McpOAuthCredentialStore(backend,dir);
    const url = 'https://example.invalid/mcp';
    const state = { serverUrl:url, tokens:{access_token:'private-access-token',refresh_token:'private-refresh-token',token_type:'Bearer'},clientInformation:{client_id:'client',client_secret:'private-client-secret'},codeVerifier:'private-pkce-verifier' };
    await store.forServer('first',url).save(state);
    const raw = await readFile(file,'utf8');
    for(const secret of ['private-access-token','private-refresh-token','private-client-secret','private-pkce-verifier']) assert.equal(raw.includes(secret),false);
    assert.deepEqual(await store.forServer('first',url).load(),state);
    assert.equal(await store.forServer('second',url).load(),undefined);
    assert.deepEqual(store.tokens('first',url),state.tokens);
    assert.equal(store.remove('first',url),true);
    assert.equal(await store.forServer('first',url).load(),undefined);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("failed MCP writes and damaged encrypted files preserve the previous bytes", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-mcp-corrupt-'));
  try {
    const { EncryptedMcpAuthBackend } = await createJiti(import.meta.url).import('./encrypted-mcp-auth');
    const file = join(dir,'mcp-credentials.json'); const backend = new EncryptedMcpAuthBackend(file);
    backend.withLock(()=>({result:undefined,next:JSON.stringify({server:{serverUrl:'https://example.invalid'}})}));
    const original = await readFile(file,'utf8');
    assert.throws(()=>backend.withLock(()=>{throw new Error('sign-in cancelled');}),/cancelled/);
    assert.equal(await readFile(file,'utf8'),original);
    await writeFile(file,'broken-credential-data');
    assert.throws(()=>backend.withLock(()=>({result:undefined,next:'{}'})),/Invalid encrypted MCP/);
    assert.equal(await readFile(file,'utf8'),'broken-credential-data');
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("the actual app MCP constructor encrypts by default without touching Pi's plaintext file", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-mcp-default-'));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = dir;
  try {
    const { loadPiSdkInternals } = await createJiti(import.meta.url).import('./pi-sdk-internals');
    const internals = await loadPiSdkInternals(); assert.equal(internals.ok,true,internals.reason);
    const store = new internals.McpOAuthCredentialStore();
    const url = 'https://example.invalid/mcp';
    await store.forServer('default',url).save({serverUrl:url,tokens:{access_token:'default-private-token',token_type:'Bearer'}});
    const raw = await readFile(join(dir,'mcp-credentials.json'),'utf8');
    assert.equal(raw.includes('default-private-token'),false);
    await assert.rejects(readFile(join(dir,'mcp-auth.json'),'utf8'),{code:'ENOENT'});
    assert.equal(store.tokens('default',url).access_token,'default-private-token');
  } finally {
    if(previous===undefined)delete process.env.PI_CODING_AGENT_DIR;else process.env.PI_CODING_AGENT_DIR=previous;
    await rm(dir,{recursive:true,force:true});
  }
});

test("async MCP transactions serialize writers and cancellation preserves the encrypted file", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-mcp-writers-'));
  try {
    const { EncryptedMcpAuthBackend } = await createJiti(import.meta.url).import('./encrypted-mcp-auth');
    const file = join(dir,'mcp-credentials.json');
    const one = new EncryptedMcpAuthBackend(file); const two = new EncryptedMcpAuthBackend(file);
    await Promise.all([one,two].map((backend,index)=>backend.withLockAsync(async current=>{
      await delay(10);
      const state = JSON.parse(current??'{}'); state[index]={serverUrl:`https://${index}.example.invalid`};
      return {result:undefined,next:JSON.stringify(state)};
    })));
    assert.deepEqual(Object.keys(JSON.parse(one.read())),['0','1']);
    const original = await readFile(file,'utf8'); const controller = new AbortController();
    await assert.rejects(one.withLockAsync(async()=>{controller.abort();return {result:undefined,next:'{}'};},{signal:controller.signal}));
    assert.equal(await readFile(file,'utf8'),original);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("a synchronous MCP update waits for another process's encryption lock before saving", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-mcp-lock-process-'));
  let child; let exited;
  try {
    const { EncryptedMcpAuthBackend } = await createJiti(import.meta.url).import('./encrypted-mcp-auth');
    const file = join(dir,'mcp-credentials.json'); const backend = new EncryptedMcpAuthBackend(file);
    backend.withLock(()=>({result:undefined,next:JSON.stringify({first:{serverUrl:'https://first.example.invalid'}})}));
    const script = join(dir,'holder.cjs');
    const lockfilePath = import.meta.resolve('proper-lockfile');
    await writeFile(script, `const lockfile = require(require('node:url').fileURLToPath(${JSON.stringify(lockfilePath)})); const release=lockfile.lockSync(process.argv[2],{realpath:false}); process.send('locked'); setTimeout(()=>{release();process.disconnect();},200);`);
    child = fork(script,[file],{stdio:['ignore','ignore','ignore','ipc'],windowsHide:true});
    exited = once(child,'exit');
    await once(child,'message');
    backend.withLock(current=>({result:undefined,next:JSON.stringify({...JSON.parse(current),second:{serverUrl:'https://second.example.invalid'}})}));
    await exited;
    assert.deepEqual(Object.keys(JSON.parse(backend.read())),['first','second']);
  } finally {
    if(child?.connected)child.kill();
    await exited;
    await rm(dir,{recursive:true,force:true});
  }
});
