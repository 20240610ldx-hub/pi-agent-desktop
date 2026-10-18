import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { access, copyFile, mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { after } from 'node:test';
import { createJiti } from 'jiti';

if (process.platform !== 'win32') {
  console.log('Native Windows credential checks are not applicable on this platform.');
  process.exit(0);
}
const root = fileURLToPath(new URL('../', import.meta.url));
const helper = path.resolve(process.env.PILAUDE_CREDENTIAL_HELPER || path.join(root,'src-tauri/target/debug/pi-agent-desktop.exe'));
await access(helper); // Missing native binary is a failed gate, never a silent skip.
const outputRoot = await realpath(path.join(root,'test-results/pilaude'));
const dir = await mkdtemp(path.join(outputRoot,'native-credentials-'));
const previous = process.env.PILAUDE_CREDENTIAL_HELPER;
const {createPilaudeCredentialStore,windowsCredentialCipher,windowsCredentialCipherSync} = await createJiti(import.meta.url).import('../lib/credential-store.ts');
after(async()=>{
  if(previous===undefined)delete process.env.PILAUDE_CREDENTIAL_HELPER;else process.env.PILAUDE_CREDENTIAL_HELPER=previous;
  if(path.dirname(await realpath(dir))!==outputRoot)throw new Error('Refusing cleanup outside the test artifact directory.');
  await rm(dir,{recursive:true,force:true});
});
const fixture='Pilaude native fixture 假凭据 🧪';

test('native and legacy DPAPI adapters read each other with unchanged entropy',async()=>{
  delete process.env.PILAUDE_CREDENTIAL_HELPER;
  const legacy=await windowsCredentialCipher().protect(fixture);
  process.env.PILAUDE_CREDENTIAL_HELPER=helper;
  assert.equal(await windowsCredentialCipher().unprotect(legacy),fixture);
  const native=await windowsCredentialCipher().protect(fixture);
  assert.equal(windowsCredentialCipherSync().unprotect(native),fixture);
  const nativeSync=windowsCredentialCipherSync().protect(fixture);
  delete process.env.PILAUDE_CREDENTIAL_HELPER;
  assert.equal(await windowsCredentialCipher().unprotect(native),fixture);
  assert.equal(windowsCredentialCipherSync().unprotect(nativeSync),fixture);
});

test('the native adapter opens legacy vaults and publishes ciphertext readable by the legacy adapter',async()=>{
  delete process.env.PILAUDE_CREDENTIAL_HELPER;
  await createPilaudeCredentialStore(dir).modify('fixture',async()=>({type:'api_key',key:fixture}));
  process.env.PILAUDE_CREDENTIAL_HELPER=helper;
  assert.equal((await createPilaudeCredentialStore(dir).read('fixture')).key,fixture);
  const changed=fixture+' changed';
  await createPilaudeCredentialStore(dir).modify('fixture',async()=>({type:'api_key',key:changed}));
  const raw=await readFile(path.join(dir,'credentials.json'),'utf8');
  assert.equal(raw.includes(fixture),false);
  delete process.env.PILAUDE_CREDENTIAL_HELPER;
  assert.equal((await createPilaudeCredentialStore(dir).read('fixture')).key,changed);
});

test('a configured but missing native helper fails closed and preserves the vault',async()=>{
  const before=await readFile(path.join(dir,'credentials.json'),'utf8');
  process.env.PILAUDE_CREDENTIAL_HELPER=path.join(dir,'missing.exe');
  await assert.rejects(createPilaudeCredentialStore(dir).modify('fixture',async()=>({type:'api_key',key:'replacement'})));
  assert.equal(await readFile(path.join(dir,'credentials.json'),'utf8'),before);
});

test('invalid ciphertext and extra arguments produce only a fixed failure without opening a window',()=>{
  for(const args of [['Unprotect'],['Protect','extra']]){
    const result=spawnSync(helper,['--pilaude-credential',...args],{input:Buffer.from('not a DPAPI blob'),windowsHide:true,timeout:5000});
    assert.equal(result.status,1);
    assert.equal(result.stdout.length,0);
    assert.equal(result.stderr.toString('utf8').trim(),'Windows credential protection failed.');
  }
});

test('the helper rejects oversized stdin without returning its contents',()=>{
  const result=spawnSync(helper,['--pilaude-credential','Protect'],{input:Buffer.alloc(4*1024*1024+1,97),windowsHide:true,timeout:5000});
  assert.equal(result.status,1);
  assert.equal(result.stdout.length,0);
  assert.equal(result.stderr.toString('utf8').trim(),'Windows credential protection failed.');
});

test('the native adapter works from an installation path containing spaces',async()=>{
  const installDir=path.join(dir,'Pilaude test installation');
  await mkdir(installDir);
  const installedHelper=path.join(installDir,'Pilaude.exe');
  await copyFile(helper,installedHelper);
  process.env.PILAUDE_CREDENTIAL_HELPER=installedHelper;
  try{
    const encrypted=await windowsCredentialCipher().protect(fixture);
    assert.equal(windowsCredentialCipherSync().unprotect(encrypted),fixture);
    assert.equal(await windowsCredentialCipher().unprotect(windowsCredentialCipherSync().protect(fixture)),fixture);
  }finally{
    process.env.PILAUDE_CREDENTIAL_HELPER=helper;
  }
});
