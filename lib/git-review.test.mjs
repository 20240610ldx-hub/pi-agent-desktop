import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createJiti } from "jiti";

const { getGitReview, GitReviewError, GIT_REVIEW_PATCH_BYTES } = await createJiti(import.meta.url).import("./git-review.ts");
const fixtureEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
const git = (cwd, ...args) => execFileSync("git", ["-C", cwd, "-c", "core.autocrlf=false", "-c", "core.fsmonitor=false", ...args], {
  encoding: "utf8", env: { ...fixtureEnv, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: process.platform === "win32" ? "NUL" : os.devNull, GIT_TERMINAL_PROMPT: "0" }, stdio: "pipe",
}).trim();

function allowOnly(...roots) {
  globalThis.__piAllowedRootsCache = { roots: new Set(roots), expiresAt: Date.now() + 3_600_000 };
}

function fixture(t, initial = { "file.txt": "one\ntwo\nthree\n" }) {
  const parent = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "pi-git-review-")));
  const repo = path.join(parent, "repo");
  fs.mkdirSync(repo);
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Review Test");
  git(repo, "config", "commit.gpgsign", "false");
  git(repo, "config", "core.autocrlf", "false");
  const write = (name, content) => {
    const target = path.join(repo, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  for (const [name, content] of Object.entries(initial)) write(name, content);
  let root;
  if (Object.keys(initial).length) {
    git(repo, "add", ".");
    git(repo, "commit", "-qm", "root");
    root = git(repo, "rev-parse", "HEAD");
  }
  allowOnly(repo);
  t.after(() => { fs.rmSync(parent, { recursive: true, force: true }); globalThis.__piAllowedRootsCache = undefined; globalThis.__piGitReviewMetadata = undefined; });
  return { repo, parent, root, write, review: (options = {}) => getGitReview({ cwd: repo, ...options }) };
}

function rejectsStatus(operation, status, text) {
  return assert.rejects(operation, (error) => error instanceof GitReviewError && error.status === status && (!text || text.test(error.message)));
}

test("all uses merge-base through staged + unstaged + untracked; uncommitted starts at HEAD", async (t) => {
  const { repo, root, write, review } = fixture(t);
  git(repo, "checkout", "-qb", "feature");
  write("committed.txt", "branch change\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "branch commit");
  const feature = git(repo, "rev-parse", "HEAD");
  write("file.txt", "one\nstaged\nthree\n");
  git(repo, "add", "file.txt");
  write("file.txt", "one\nstaged\nunstaged\n");
  write("untracked space.txt", "untracked\nlast");
  const indexBefore = fs.readFileSync(path.join(repo, ".git", "index"));
  const headBefore = git(repo, "rev-parse", "HEAD");
  const all = await review();
  assert.equal(all.baseRef, "refs/heads/main");
  assert.equal(all.baseOid, root);
  assert.equal(all.headOid, feature);
  assert.equal(all.currentBranch, "feature");
  assert.deepEqual(all.files.map((file) => [file.path, file.status, file.additions, file.deletions]), [
    ["committed.txt", "added", 1, 0], ["file.txt", "modified", 2, 2], ["untracked space.txt", "untracked", 2, 0],
  ]);
  assert.deepEqual(all.totals, { additions: 5, deletions: 2 });
  assert.equal(all.refs.find((ref) => ref.name === "refs/heads/main").isDefault, true);
  assert.equal(all.commits[0].subject, "branch commit");
  assert.equal(all.commits[0].authorName, "Review Test");
  assert.match(all.commits[0].authoredAt, /^\d{4}-/);
  const uncommitted = await review({ scope: "uncommitted" });
  assert.equal(uncommitted.baseOid, feature);
  assert.deepEqual(uncommitted.files.map((file) => file.path), ["file.txt", "untracked space.txt"]);
  const patch = await review({ path: "file.txt" });
  assert.equal(patch.comparisonId, all.comparisonId);
  assert.equal(patch.supported, true);
  assert.match(patch.patch, /\+staged\n\+unstaged/);
  assert.equal(git(repo, "rev-parse", "HEAD"), headBefore);
  assert.deepEqual(fs.readFileSync(path.join(repo, ".git", "index")), indexBefore, "review must not refresh/write the index");
  write("file.txt", "one\nnext version\nunstaged\n");
  assert.notEqual((await review({ path: "file.txt" })).comparisonId, all.comparisonId);
});

test("selected and root commits ignore live edits and compare their first parent", async (t) => {
  const { repo, root, write, review } = fixture(t);
  write("file.txt", "one\nchanged\nthree\n");
  git(repo, "commit", "-qam", "second");
  const selected = git(repo, "rev-parse", "HEAD");
  write("file.txt", "live worktree\n");
  write("untracked.txt", "outside selected commit\n");
  const snapshot = await review({ scope: "commit", commit: selected });
  assert.equal(snapshot.baseOid, root);
  assert.deepEqual(snapshot.files.map((file) => [file.path, file.additions, file.deletions]), [["file.txt", 1, 1]]);
  const selectedPatch = await review({ scope: "commit", commit: selected, path: "file.txt" });
  assert.equal(selectedPatch.comparisonId, snapshot.comparisonId);
  assert.match(selectedPatch.patch, /\+changed/);
  assert.doesNotMatch(selectedPatch.patch, /live worktree/);
  const rootSnapshot = await review({ scope: "commit", commit: root });
  assert.equal(rootSnapshot.baseOid, "4b825dc642cb6eb9a060e54bf8d69288fbee4904");
  assert.equal(rootSnapshot.files[0].status, "added");
  const rootPatch = await review({ scope: "commit", commit: root, path: "file.txt" });
  assert.match(rootPatch.patch, /@@ -0,0 \+1,3 @@/);
  assert.match(rootPatch.patch, /\+two/);
  write("file.txt", "yet another live edit\n");
  assert.equal((await review({ scope: "commit", commit: root })).comparisonId, rootSnapshot.comparisonId);
});

test("merge-base does not include independent base-tip commits and origin/main wins", async (t) => {
  const { repo, root, write, review } = fixture(t);
  git(repo, "checkout", "-qb", "feature");
  write("feature.txt", "feature\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "feature");
  const feature = git(repo, "rev-parse", "HEAD");
  git(repo, "checkout", "-q", "main");
  write("base-only.txt", "base\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "independent base");
  const baseTip = git(repo, "rev-parse", "HEAD");
  git(repo, "update-ref", "refs/remotes/origin/main", baseTip);
  git(repo, "checkout", "-q", "feature");
  const result = await review();
  assert.equal(result.headOid, feature);
  assert.equal(result.baseRef, "refs/remotes/origin/main");
  assert.equal(result.baseOid, root);
  assert.deepEqual(result.files.map((file) => file.path), ["feature.txt"]);
  assert.ok(result.refs.some((ref) => ref.name === "refs/remotes/origin/main" && ref.oid === baseTip));
});

test("rename stats and lazy patch preserve oldPath; pure rename is metadata-only", async (t) => {
  const { repo, write, review } = fixture(t, { "old name.txt": "one\ntwo\nthree\nfour\nfive\n" });
  git(repo, "mv", "old name.txt", "new name.txt");
  let result = await review({ scope: "uncommitted" });
  assert.deepEqual(result.files, [{ path: "new name.txt", oldPath: "old name.txt", status: "renamed", additions: 0, deletions: 0 }]);
  assert.equal((await review({ scope: "uncommitted", path: "new name.txt" })).reason, "metadata-only");
  write("new name.txt", "one\ntwo\nthree\nfour\nfive\nsix\n");
  result = await review({ scope: "uncommitted" });
  assert.equal(result.files[0].additions, 1);
  const patch = await review({ scope: "uncommitted", path: "new name.txt" });
  assert.equal(patch.oldPath, "old name.txt");
  assert.match(patch.patch, /rename from old name.txt/);
  assert.match(patch.patch, /\+six/);
});

test("copied destination patch excludes a separately modified source", async (t) => {
  const original = Array.from({ length: 30 }, (_, index) => `original line ${index + 1}`).join("\n") + "\n";
  const source = process.platform === "win32" ? "a source [literal].txt" : 'a source "quoted".txt';
  const destination = process.platform === "win32" ? "b copy [literal].txt" : 'b copy "quoted".txt';
  const { repo, write, review } = fixture(t, { [source]: original });
  write(source, original.replace("original line 25\n", "source-only modification\n"));
  write(destination, original.replace("original line 15\n", "destination-only modification\n"));
  git(repo, "add", ".");
  const snapshot = await review({ scope: "uncommitted" });
  const copied = snapshot.files.find((file) => file.path === destination);
  assert.equal(copied.status, "copied");
  assert.equal(copied.oldPath, source);
  const result = await review({ scope: "uncommitted", path: destination });
  assert.equal(result.supported, true);
  assert.match(result.patch, /destination-only modification/);
  assert.doesNotMatch(result.patch, /source-only modification/);
  assert.equal((result.patch.match(/^diff --git /gm) ?? []).length, 1);
  assert.match(result.patch, /@@ -12,7 \+12,7 @@/);
});

test("paths with spaces, leading dash, wildcard and magic-looking names are literal", async (t) => {
  const { repo, write, review } = fixture(t, { "[a].txt": "old bracket\n", "a.txt": "old a\n", "-option.txt": "old dash\n", "space name.txt": "old space\n" });
  for (const name of ["[a].txt", "a.txt", "-option.txt", "space name.txt"]) write(name, `new ${name}\n`);
  const result = await review({ scope: "uncommitted", path: "[a].txt" });
  assert.match(result.patch, /\+new \[a\].txt/);
  assert.doesNotMatch(result.patch, /new a.txt/);
  assert.match((await review({ scope: "uncommitted", path: "-option.txt" })).patch, /new -option/);
  write("new space.txt", "new\nlast");
  const untracked = await review({ scope: "uncommitted", path: "new space.txt" });
  assert.match(untracked.patch, /@@ -0,0 \+1,2 @@/);
  assert.match(untracked.patch, /\\ No newline at end of file/);
  if (process.platform !== "win32") {
    write(":(glob)*", "literal magic\n");
    assert.match((await review({ scope: "uncommitted", path: ":(glob)*" })).patch, /literal magic/);
  }
  assert.equal(git(repo, "rev-parse", "--abbrev-ref", "HEAD"), "main");
});

test("whitespace option affects stats and identity; context preserves original line coordinates", async (t) => {
  const original = Array.from({ length: 70 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
  const { write, review } = fixture(t, { "lines.txt": original, "whitespace.txt": "one two\n" });
  write("whitespace.txt", "one   two\n");
  write("lines.txt", original.replace("line 40\n", "changed 40\n"));
  const normal = await review({ scope: "uncommitted" });
  const ignored = await review({ scope: "uncommitted", ignoreWhitespace: true });
  assert.notEqual(normal.comparisonId, ignored.comparisonId);
  assert.equal(normal.totals.additions, 2);
  assert.equal(ignored.totals.additions, 1);
  const p3 = await review({ scope: "uncommitted", path: "lines.txt", context: 3 });
  const p20 = await review({ scope: "uncommitted", path: "lines.txt", context: 20 });
  const pall = await review({ scope: "uncommitted", path: "lines.txt", context: "all" });
  assert.equal(p3.comparisonId, p20.comparisonId);
  assert.equal(p20.comparisonId, pall.comparisonId);
  assert.match(p3.patch, /@@ -37,7 \+37,7 @@/);
  assert.match(p20.patch, /@@ -20,41 \+20,41 @@/);
  assert.match(pall.patch, /@@ -1,70 \+1,70 @@/);
  await rejectsStatus(() => review({ scope: "uncommitted", path: "whitespace.txt", ignoreWhitespace: true }), 404);
});

test("binary, oversized, deleted large and empty files report explicit patch support", async (t) => {
  const { repo, write, review } = fixture(t, { "binary.bin": Buffer.from([0, 1, 2]), "large.txt": "a".repeat(GIT_REVIEW_PATCH_BYTES + 1) });
  write("binary.bin", Buffer.from([0, 3, 4]));
  write("large.txt", "b".repeat(GIT_REVIEW_PATCH_BYTES + 1));
  write("untracked.bin", Buffer.from([0, 5, 6]));
  write("untracked-large.txt", "x".repeat(GIT_REVIEW_PATCH_BYTES + 1));
  write("empty.txt", "");
  const snapshot = await review({ scope: "uncommitted" });
  assert.equal(snapshot.large, true);
  assert.equal(snapshot.files.find((file) => file.path === "binary.bin").binary, true);
  for (const name of ["binary.bin", "untracked.bin"]) {
    const patch = await review({ scope: "uncommitted", path: name });
    assert.equal(patch.reason, "binary");
    assert.equal(patch.patch, "");
    assert.equal(patch.supported, false);
  }
  for (const name of ["large.txt", "untracked-large.txt"]) {
    const patch = await review({ scope: "uncommitted", path: name });
    assert.equal(patch.reason, "too-large");
    assert.equal(patch.truncated, true);
  }
  assert.equal((await review({ scope: "uncommitted", path: "empty.txt" })).reason, "metadata-only");
  fs.unlinkSync(path.join(repo, "large.txt"));
  assert.equal((await review({ scope: "uncommitted", path: "large.txt" })).reason, "too-large");
});

test("binary and large untracked metadata are bounded and flagged", async (t) => {
  const { write, review } = fixture(t);
  write("huge.txt", "x".repeat(8 * 1024 * 1024 + 1));
  const result = await review({ scope: "uncommitted" });
  assert.equal(result.large, true);
  assert.equal(result.truncated, true);
  assert.equal(result.files.find((file) => file.path === "huge.txt").additions, 0);
});

test("rejects nonrepos, empty repos, invalid revisions, traversal, and .git reads", async (t) => {
  const { repo, parent, root, review } = fixture(t);
  for (const options of [{ cwd: "relative" }, { scope: "unknown" }, { context: 4 }, { base: "--help" }, { base: "main" }, { base: "refs/heads/main\n--help" }, { base: "refs/heads/main@{1}" }, { base: "refs/heads/x..y" }, { commit: "HEAD" }, { scope: "commit" }]) {
    await rejectsStatus(() => review(options), 400);
  }
  for (const name of ["../file.txt", "/file.txt", "a/../file.txt", ".git/config", ".git/objects/foo", "file.txt\0evil", "C:/secret.txt"]) {
    await rejectsStatus(() => review({ path: name }), 400);
  }
  await rejectsStatus(() => review({ base: "refs/heads/missing" }), 404);
  await rejectsStatus(() => review({ scope: "commit", commit: "f".repeat(40) }), 404);
  const blob = git(repo, "rev-parse", `${root}:file.txt`);
  await rejectsStatus(() => review({ scope: "commit", commit: blob }), 404);
  await rejectsStatus(() => review({ path: "file.txt" }), 404);
  const empty = path.join(parent, "empty");
  fs.mkdirSync(empty);
  git(empty, "init", "-q", "-b", "main");
  allowOnly(parent);
  await rejectsStatus(() => getGitReview({ cwd: parent }), 422, /not a Git/);
  await rejectsStatus(() => getGitReview({ cwd: empty }), 409, /no commits/);
  allowOnly(path.join(repo, "subdir"));
  fs.mkdirSync(path.join(repo, "subdir"));
  await rejectsStatus(() => getGitReview({ cwd: path.join(repo, "subdir"), scope: "uncommitted" }), 403, /Repository root/);
  allowOnly();
  await rejectsStatus(() => review(), 403);
});

test("denies escaping cwd, live paths, rename sources, and deleted parents through junctions/symlinks", async (t) => {
  const { repo, parent, root, write, review } = fixture(t, { "source/old.txt": "same\n" });
  const outside = path.join(parent, "outside");
  fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, "old.txt"), "outside secret\n");
  const linkType = process.platform === "win32" ? "junction" : "dir";
  fs.symlinkSync(outside, path.join(repo, "escape"), linkType);
  await rejectsStatus(() => getGitReview({ cwd: path.join(repo, "escape"), scope: "uncommitted" }), 403);
  // A tracked file under a directory replaced by a junction must be rejected even
  // when the leaf no longer exists (historical/deleted source authorization).
  fs.unlinkSync(path.join(repo, "escape"));
  git(repo, "mv", "source/old.txt", "renamed.txt");
  fs.rmSync(path.join(repo, "source"), { recursive: true, force: true });
  fs.symlinkSync(outside, path.join(repo, "source"), linkType);
  await rejectsStatus(() => review({ path: "renamed.txt" }), 403, /outside/);
  fs.unlinkSync(path.join(outside, "old.txt"));
  await rejectsStatus(() => review({ scope: "commit", commit: root, path: "source/old.txt" }), 403, /outside/);
  fs.unlinkSync(path.join(repo, "source"));
  fs.mkdirSync(path.join(repo, "source"));
  write("live/value.txt", "original\n");
  git(repo, "add", ".");
  git(repo, "commit", "-qm", "live file");
  fs.rmSync(path.join(repo, "live"), { recursive: true });
  fs.writeFileSync(path.join(outside, "value.txt"), "outside live secret\n");
  fs.symlinkSync(outside, path.join(repo, "live"), linkType);
  await rejectsStatus(() => review({ scope: "uncommitted", path: "live/value.txt" }), 403);
});

test("rejects untracked directory aliases into .git metadata", async (t) => {
  const { repo, review } = fixture(t);
  fs.symlinkSync(path.join(repo, ".git"), path.join(repo, "metadata-alias"), process.platform === "win32" ? "junction" : "dir");
  await rejectsStatus(() => review({ scope: "uncommitted", path: "metadata-alias/config" }), 403);
});

test("lazy patches reuse snapshot metadata and recheck changed selected paths", async (t) => {
  const { repo, write, review } = fixture(t);
  write("file.txt", "first live change\n");
  const snapshot = await review({ scope: "uncommitted" });
  // Expensive complete metadata must be reused for repeated per-file requests.
  // An unrelated untracked edit does not invalidate an unchanged selected patch.
  write("unrelated.txt", "new unrelated change\n");
  const patch = await review({ scope: "uncommitted", path: "file.txt" });
  assert.equal(patch.comparisonId, snapshot.comparisonId);
  write("file.txt", "second live change\n");
  const changed = await review({ scope: "uncommitted", path: "file.txt" });
  assert.notEqual(changed.comparisonId, snapshot.comparisonId);
  assert.match(changed.patch, /second live change/);
  const outside = path.join(path.dirname(repo), "outside");
  fs.mkdirSync(outside);
  fs.unlinkSync(path.join(repo, "file.txt"));
  // Windows directory junctions exercise cached-path authorization without
  // requiring Developer Mode's file-symlink privilege.
  fs.symlinkSync(outside, path.join(repo, "file.txt"), process.platform === "win32" ? "junction" : "dir");
  await rejectsStatus(() => review({ scope: "uncommitted", path: "file.txt" }), 403);
});

test("does not execute configured fsmonitor, external diff, textconv, or clean filters", async (t) => {
  const { repo, parent, write, review } = fixture(t, { ".gitattributes": "file.txt filter=evil diff=evil\n", "file.txt": "old\n" });
  const marker = path.join(parent, "executed").replace(/\\/g, "/");
  const command = `node -e "require('fs').writeFileSync('${marker}','executed')"`;
  for (const key of ["core.fsmonitor", "diff.external", "diff.evil.command", "diff.evil.textconv", "filter.evil.clean", "filter.evil.process"]) git(repo, "config", key, command);
  git(repo, "config", "filter.evil.required", "true");
  write("file.txt", "new\n");
  const before = { GIT_DIR: process.env.GIT_DIR, GIT_EXTERNAL_DIFF: process.env.GIT_EXTERNAL_DIFF };
  process.env.GIT_DIR = path.join(parent, "not-this-repo");
  process.env.GIT_EXTERNAL_DIFF = command;
  t.after(() => {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  const result = await review({ scope: "uncommitted", path: "file.txt" });
  assert.equal(result.supported, true);
  assert.match(result.patch, /\+new/);
  assert.equal(fs.existsSync(marker), false);
});

test("custom-only branches and detached HEAD remain reviewable without a conventional base", async (t) => {
  const { repo, root, write, review } = fixture(t);
  git(repo, "branch", "-m", "custom-only");
  write("file.txt", "custom branch edit\n");
  const result = await review();
  assert.equal(result.baseRef, "refs/heads/custom-only");
  assert.equal(result.baseOid, root);
  assert.equal(result.refs[0].name, "refs/heads/custom-only");
  assert.equal(result.files[0].path, "file.txt");
  git(repo, "checkout", "--detach", root);
  const detached = await review();
  assert.equal(detached.currentBranch, null);
  assert.equal(detached.baseRef, "HEAD");
});

test("commits and refs are capped with an explicit metadata truncation flag", async (t) => {
  const { repo, root, review } = fixture(t);
  let parent = root;
  // commit-tree creates tiny history without 100 checkouts/working-tree scans.
  const tree = git(repo, "rev-parse", "HEAD^{tree}");
  for (let i = 0; i < 102; i++) parent = git(repo, "commit-tree", tree, "-p", parent, "-m", `commit ${i}`);
  git(repo, "update-ref", "refs/heads/main", parent);
  const result = await review({ scope: "uncommitted" });
  assert.equal(result.commits.length, 100);
  assert.equal(result.commits[0].oid, parent);
  assert.equal(result.truncated, true);
  assert.equal(result.large, false);
});
