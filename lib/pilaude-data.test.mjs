import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, win32, posix } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
const { resolvePilaudeAgentDir, initializePilaudeData, planPiImport } = await createJiti(import.meta.url).import("./pilaude-data");

test("uses independent platform app data without changing home or explicit overrides", () => {
  assert.equal(resolvePilaudeAgentDir('C:\\Users\\Test\\AppData\\Roaming', win32), 'C:\\Users\\Test\\AppData\\Roaming\\Pilaude\\agent');
  assert.equal(resolvePilaudeAgentDir('/Users/test/Library/Application Support', posix), '/Users/test/Library/Application Support/Pilaude/agent');
  const env = { HOME: '/existing', APPDATA: 'C:\\Data' };
  assert.equal(initializePilaudeData(env, 'win32'), 'C:\\Data\\Pilaude\\agent');
  assert.equal(env.HOME, '/existing');
  const override = { PI_CODING_AGENT_DIR: 'D:\\custom', HOME: '/existing' };
  assert.equal(initializePilaudeData(override, 'win32'), 'D:\\custom');
});

test("import planning is read-only and excludes credentials, browser profiles and executable extensions", async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pilaude-import-'));
  try {
    const source = join(dir, 'pi'); const target = join(dir, 'pilaude');
    await mkdir(join(source, 'sessions'), { recursive: true }); await mkdir(target);
    await writeFile(join(source, 'sessions', 'history.jsonl'), 'history');
    await writeFile(join(source, 'auth.json'), 'sensitive');
    await writeFile(join(source, 'settings.json'), '{"safe":"source"}');
    await writeFile(join(target, 'settings.json'), '{"safe":"target"}');
    const plan = await planPiImport(source, target);
    assert.deepEqual(plan.files.map(x=>x.relativePath).sort(), ['sessions/history.jsonl', 'settings.json']);
    assert.equal(plan.files.find(x=>x.relativePath==='settings.json').conflict, true);
    assert.ok(plan.excluded.includes('auth.json'));
    assert.equal(await readFile(join(target, 'settings.json'), 'utf8'), '{"safe":"target"}');
    assert.equal(await readFile(join(source, 'auth.json'), 'utf8'), 'sensitive');
  } finally { await rm(dir, {recursive:true,force:true}); }
});
