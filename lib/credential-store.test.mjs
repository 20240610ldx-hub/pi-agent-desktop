import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { writeFileSync } from "node:fs";
import { ModelRuntime } from "@earendil-works/pi-coding-agent";
const { EncryptedCredentialStore, windowsCredentialCipher } = await createJiti(import.meta.url).import("./credential-store");
const { savePilaudeModelSettings } = await createJiti(import.meta.url, {tsconfigPaths:true}).import("./pilaude-model-settings");

test("Windows DPAPI stores only ciphertext and SDK reads metadata and request credentials", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pilaude-credential-'));
  try {
    const store = new EncryptedCredentialStore(join(dir, 'credentials.json'), windowsCredentialCipher());
    await store.modify('deepseek', async ()=>({type:'api_key',key:'pilaude-not-a-real-key-测试'}));
    const raw = await readFile(join(dir, 'credentials.json'), 'utf8');
    assert.ok(!raw.includes('pilaude-not-a-real-key'));
    assert.ok(!raw.includes('deepseek'));
    assert.deepEqual(await store.list(), [{providerId:'deepseek',type:'api_key'}]);
    const runtime = await ModelRuntime.create({credentials:store,modelsPath:null});
    assert.deepEqual(runtime.getProviderAuthStatus('deepseek'), {configured:true,source:'stored'});
    assert.equal((await store.read('deepseek')).key, 'pilaude-not-a-real-key-测试');
    await store.delete('deepseek');
    assert.equal(await store.read('deepseek'), undefined);
  } finally { await rm(dir, {recursive:true,force:true}); }
});

test("concurrent writers preserve providers and a cancelled or failed update preserves the file", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pilaude-credential-lock-'));
  try {
    const file = join(dir, 'credentials.json');
    const one = new EncryptedCredentialStore(file, windowsCredentialCipher());
    const two = new EncryptedCredentialStore(file, windowsCredentialCipher());
    await Promise.all([one.modify('first',async()=>({type:'api_key',key:'one'})),two.modify('second',async()=>({type:'api_key',key:'two'}))]);
    assert.equal((await one.list()).length,2);
    const previous = await readFile(file,'utf8');
    await assert.rejects(one.modify('first',async()=>{throw new Error('refresh failed');}),/refresh failed/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(one.modify('first',async()=>({type:'api_key',key:'wrong'}),{signal:controller.signal}));
    assert.equal(await readFile(file,'utf8'),previous);
  } finally { await rm(dir, {recursive:true,force:true}); }
});

test("custom model settings never persist literal keys and failed config commits restore credentials", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pilaude-model-secret-'));
  try {
    const file = join(dir,'credentials.json');
    const store = new EncryptedCredentialStore(file, windowsCredentialCipher());
    let saved;
    await savePilaudeModelSettings({providers:{custom:{apiKey:'private-key',baseUrl:'https://example.test/v1',models:[]}}}, value=>{saved=value;}, store);
    assert.equal(JSON.stringify(saved).includes('private-key'),false);
    assert.equal((await store.read('custom')).key,'private-key');
    await assert.rejects(savePilaudeModelSettings({providers:{custom:{apiKey:'replacement'}}},()=>{throw new Error('disk unavailable');},store),/disk unavailable/);
    assert.equal((await store.read('custom')).key,'private-key');
    assert.equal((await readFile(file,'utf8')).includes('private-key'),false);
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("malformed encrypted credentials are never overwritten and parser errors reveal no decrypted text", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-credential-corrupt-'));
  try {
    const file = join(dir,'credentials.json'); const cipher = windowsCredentialCipher();
    for (const plaintext of ['{"bad":null}', 'private-broken-token']) {
      const raw = JSON.stringify({format:'pilaude-dpapi-v1',ciphertext:await cipher.protect(plaintext)});
      await writeFile(file,raw);
      const store = new EncryptedCredentialStore(file,cipher);
      await assert.rejects(store.modify('new',async()=>({type:'api_key',key:'new'})),error=>!error.message.includes('private-broken-token'));
      assert.equal(await readFile(file,'utf8'),raw);
    }
  } finally {await rm(dir,{recursive:true,force:true});}
});

test("switching a custom provider from a stored literal to an environment reference uses the new credential", {skip:process.platform!=='win32'}, async () => {
  const dir = await mkdtemp(join(tmpdir(),'pilaude-key-reference-'));
  const before = process.env.PILAUDE_TEST_REFERENCE;
  process.env.PILAUDE_TEST_REFERENCE = 'new-env-key';
  try {
    const store = new EncryptedCredentialStore(join(dir,'credentials.json'),windowsCredentialCipher());
    const modelsPath = join(dir,'models.json');
    const save = config => writeFileSync(modelsPath,JSON.stringify(config));
    const provider = {api:'openai-completions',baseUrl:'https://example.invalid/v1',models:[{id:'probe'}]};
    await savePilaudeModelSettings({providers:{custom:{...provider,apiKey:'old-key'}}},save,store);
    await assert.rejects(savePilaudeModelSettings({providers:{custom:{...provider,apiKey:'$PILAUDE_TEST_REFERENCE'}}},()=>{throw new Error('disk failure');},store),/disk failure/);
    assert.equal((await store.read('custom')).key,'old-key');
    await savePilaudeModelSettings({providers:{custom:{...provider,apiKey:'$PILAUDE_TEST_REFERENCE'}}},save,store);
    const runtime = await ModelRuntime.create({modelsPath,credentials:store});
    assert.equal((await runtime.getAuth(runtime.getModel('custom','probe'))).auth.apiKey,'new-env-key');
    assert.equal(await store.read('custom'),undefined);
    assert.equal(JSON.parse(await readFile(modelsPath,'utf8')).providers.custom.apiKey,'$PILAUDE_TEST_REFERENCE');
  } finally {
    if(before===undefined)delete process.env.PILAUDE_TEST_REFERENCE;else process.env.PILAUDE_TEST_REFERENCE=before;
    await rm(dir,{recursive:true,force:true});
  }
});
