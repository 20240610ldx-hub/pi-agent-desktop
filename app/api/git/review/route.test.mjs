import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { GET } = await jiti.import("./route.ts");
const { NextRequest } = await jiti.import("next/server");
const fixtureEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, "-c", "core.autocrlf=false", ...args], {
  encoding: "utf8", env: { ...fixtureEnv, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull }, stdio: "pipe",
}).trim();
function request(values = {}) {
  return new NextRequest(`http://localhost/api/git/review?${new URLSearchParams(values)}`);
}
function allowOnly(...roots) {
  globalThis.__piAllowedRootsCache = { roots: new Set(roots), expiresAt: Date.now() + 3_600_000 };
}
function fixture(t, commit = true) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pi-git-review-route-")));
  const repo = path.join(parent, "repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  git(repo, "config", "commit.gpgsign", "false");
  git(repo, "config", "core.autocrlf", "false");
  if (commit) {
    fs.writeFileSync(path.join(repo, "name with space.txt"), "before\n");
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "root");
  }
  allowOnly(repo);
  t.after(() => { fs.rmSync(parent, { recursive: true, force: true }); globalThis.__piAllowedRootsCache = undefined; });
  return { repo, parent };
}

test("GET returns uncached real snapshot metadata and a separate lazy patch", async (t) => {
  const { repo } = fixture(t);
  fs.writeFileSync(path.join(repo, "name with space.txt"), "after\n");
  const snapshotResponse = await GET(request({ cwd: repo, scope: "uncommitted", context: "20" }));
  assert.equal(snapshotResponse.status, 200);
  assert.equal(snapshotResponse.headers.get("cache-control"), "no-store");
  const snapshot = await snapshotResponse.json();
  assert.equal(snapshot.repoRoot, repo);
  assert.equal(snapshot.currentBranch, "main");
  assert.deepEqual(snapshot.files, [{ path: "name with space.txt", status: "modified", additions: 1, deletions: 1 }]);
  assert.equal(snapshot.patch, undefined);
  const patchResponse = await GET(request({ cwd: repo, scope: "uncommitted", path: "name with space.txt", context: "all" }));
  const patch = await patchResponse.json();
  assert.equal(patchResponse.status, 200);
  assert.equal(patch.comparisonId, snapshot.comparisonId);
  assert.equal(patch.supported, true);
  assert.match(patch.patch, /\+after/);
});

test("invalid requests return useful 400 errors before metadata reads", async (t) => {
  const { repo } = fixture(t);
  for (const values of [
    {}, { cwd: "relative" }, { cwd: repo, scope: "staged" }, { cwd: repo, context: "999" },
    { cwd: repo, ignoreWhitespace: "true" }, { cwd: repo, scope: "commit" },
    { cwd: repo, base: "--all" }, { cwd: repo, commit: "HEAD~1" },
    { cwd: repo, path: "../outside" }, { cwd: repo, path: ".git/config" }, { cwd: repo, path: "" },
  ]) {
    const response = await GET(request(values));
    assert.equal(response.status, 400, JSON.stringify(values));
    assert.equal(typeof (await response.json()).error, "string");
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("authorization, missing files/refs, nonrepos and empty repos have distinct statuses", async (t) => {
  const { repo, parent } = fixture(t, false);
  assert.equal((await GET(request({ cwd: repo }))).status, 409);
  allowOnly(parent);
  assert.equal((await GET(request({ cwd: parent }))).status, 422);
  assert.equal((await GET(request({ cwd: path.join(parent, "missing") }))).status, 404);
  fs.writeFileSync(path.join(repo, "file.txt"), "root\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "root");
  assert.equal((await GET(request({ cwd: repo, base: "refs/heads/missing" }))).status, 404);
  assert.equal((await GET(request({ cwd: repo, path: "file.txt" }))).status, 404);
  allowOnly();
  const denied = await GET(request({ cwd: repo }));
  assert.equal(denied.status, 403);
  assert.match((await denied.json()).error, /Access denied/);
});

test("an escaping directory junction/symlink cannot widen cwd authorization", async (t) => {
  const { repo, parent } = fixture(t);
  const outside = path.join(parent, "outside");
  fs.mkdirSync(outside);
  fs.symlinkSync(outside, path.join(repo, "link"), process.platform === "win32" ? "junction" : "dir");
  const response = await GET(request({ cwd: path.join(repo, "link"), scope: "uncommitted" }));
  assert.equal(response.status, 403);
});
