import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm, writeFile, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { nodeCliInvocation } = await jiti.import("../lib/node-cli.ts");
const root = dirname(dirname(fileURLToPath(import.meta.url)));

test("the npm package ships the handoff helper, exact third-party notices, and no other lib file", async () => {
  const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  const notices = await readFile(join(root, "THIRD_PARTY_NOTICES.md"));
  assert.ok(pkg.files.includes("THIRD_PARTY_NOTICES.md"));
  assert.ok(pkg.files.includes("lib/browser-open.js"));
  assert.equal(pkg.files.includes("lib"), false);
  assert.equal(pkg.files.includes("lib/"), false);

  const dir = await mkdtemp(join(tmpdir(), "pi-web-pack-"));
  try {
    await writeFile(join(dir, "package.json"), JSON.stringify(pkg));
    await mkdir(join(dir, "lib"));
    await mkdir(join(dir, "bin"));
    await cp(join(root, "lib/browser-open.js"), join(dir, "lib/browser-open.js"));
    await cp(join(root, "THIRD_PARTY_NOTICES.md"), join(dir, "THIRD_PARTY_NOTICES.md"));
    assert.deepEqual(await readFile(join(dir, "THIRD_PARTY_NOTICES.md")), notices);
    await writeFile(join(dir, "lib/not-shipped.js"), "module.exports = {};\n");
    await writeFile(join(dir, "bin/pi-web.js"), "#!/usr/bin/env node\n");

    const npm = nodeCliInvocation("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"]);
    const packed = spawnSync(npm.command, npm.args, { cwd: dir, encoding: "utf8" });
    assert.equal(packed.status, 0, packed.error?.message || packed.stderr);
    const result = JSON.parse(packed.stdout);
    const listing = Array.isArray(result) ? result : Object.values(result);
    const files = listing[0].files.map((file) => file.path.replaceAll("\\", "/"));
    assert.ok(files.some((file) => file.endsWith("lib/browser-open.js")));
    assert.equal(files.some((file) => file.endsWith("lib/not-shipped.js")), false);
    assert.ok(files.some((file) => file.endsWith("bin/pi-web.js")));
    const noticeEntries = listing[0].files.filter(file => file.path.replaceAll("\\", "/") === "THIRD_PARTY_NOTICES.md");
    assert.equal(noticeEntries.length, 1, "npm must include the root notice exactly once");
    assert.equal(noticeEntries[0].size, notices.length, "npm must ship the full notice text");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
