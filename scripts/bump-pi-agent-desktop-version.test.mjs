import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

async function fixture(t, { releases = [], newline = "\n", validLock = true } = {}) {
  const directory = await mkdtemp(join(tmpdir(), "pilaude-version-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, "scripts"));
  await mkdir(join(directory, "src-tauri"));
  for (const name of ["bump-pi-agent-desktop-version.mjs", "release-components.mjs"]) {
    await copyFile(join(root, "scripts", name), join(directory, "scripts", name));
  }
  const product = { name: "pilaude", version: "0.1.0", repository: "20240610ldx-hub/pi-agent-desktop" };
  await writeFile(join(directory, "src-tauri", "pilaude-package.json"), JSON.stringify(product));
  await writeFile(join(directory, "src-tauri", "pi-agent-desktop-package.json"), '{"version":"0.7.1"}');
  await writeFile(join(directory, "src-tauri", "Cargo.toml"), `[package]${newline}name = "pi-agent-desktop"${newline}version = "0.1.0"${newline}`);
  await writeFile(join(directory, "src-tauri", "Cargo.lock"), `[[package]]${newline}name = "${validLock ? "pi-agent-desktop" : "other-crate"}"${newline}version = "0.1.0"${newline}`);
  const preload = join(directory, "fetch-fixture.mjs");
  await writeFile(preload, `globalThis.fetch = async (url) => {
    if (url !== "https://api.github.com/repos/20240610ldx-hub/pi-agent-desktop/releases?per_page=100") throw new Error("Unexpected release source: " + url);
    return new Response(JSON.stringify(${JSON.stringify(releases)}), {status: 200});
  };`);
  return {
    directory,
    run: () => execFileSync(process.execPath, ["--import", pathToFileURL(preload).href, join(directory, "scripts", "bump-pi-agent-desktop-version.mjs")], {
      cwd: directory,
      encoding: "utf8",
      timeout: 10_000,
      stdio: ["ignore", "pipe", "pipe"],
    }),
    read: (name) => readFile(join(directory, "src-tauri", name), "utf8"),
  };
}

test("advances the product patch even when there are no published releases", async (t) => {
  const files = await fixture(t);
  files.run();
  assert.equal(JSON.parse(await files.read("pilaude-package.json")).version, "0.1.1");
  assert.equal(JSON.parse(await files.read("pi-agent-desktop-package.json")).version, "0.7.1");
});

test("advances past development prereleases and updates a CRLF Cargo lock", async (t) => {
  const files = await fixture(t, {
    newline: "\r\n",
    releases: [{ tag_name: "v0.1.2-test.1", html_url: "https://github.com/20240610ldx-hub/pi-agent-desktop/releases/tag/v0.1.2-test.1", prerelease: true, draft: false }],
  });
  files.run();
  assert.equal(JSON.parse(await files.read("pilaude-package.json")).version, "0.1.3");
  assert.match(await files.read("Cargo.toml"), /version = "0\.1\.3"/);
  assert.match(await files.read("Cargo.lock"), /name = "pi-agent-desktop"\r\nversion = "0\.1\.3"/);
});

test("refuses an unrecognized lock before changing any product version", async (t) => {
  const files = await fixture(t, { validLock: false });
  assert.throws(files.run, (error) => String(error.stderr).includes("Cannot locate the Pilaude Cargo package"));
  assert.equal(JSON.parse(await files.read("pilaude-package.json")).version, "0.1.0");
  assert.match(await files.read("Cargo.toml"), /version = "0\.1\.0"/);
});
