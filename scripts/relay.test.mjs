// Tests for scripts/relay.mjs — the relay board and integrity guard.
// Each test builds a throwaway git repository so nothing touches the real board.

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { acceptanceHash, globToRegex, globsOverlap, parseCard, serializeCard } from "./relay.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const RELAY = path.join(here, "relay.mjs");
const INTEGRATION = "fusion/pi-claude-desktop";
const NOW = "2026-10-19T10:00:00Z";

function card({ id, status = "todo", files = "[lib/demo/**]", sha = "", extra = "" }) {
  return `---
id: ${id}
title: Demo ${id}
epic: E1
priority: P1
status: ${status}
owner:
lease_until:
branch:
implementers: []
depends_on: []
files_allowed: ${files}
acceptance_sha: ${sha}
waivers: []
${extra}---

## 目标

Demo.

## 验收标准

- [ ] A1 does the thing. 验证：\`node -e 0\`
- [ ] A2 handles failure.

## 范围外

Nothing.

## 证据

| 验收项 | 命令/步骤 | 结果 | 证据位置 | 提交 | 验证者 |
| --- | --- | --- | --- | --- | --- |

## 日志

- 2026-10-19T09:00Z · test · created
`;
}

function setup() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "relay-test-"));
  const repo = path.join(root, "repo");
  fs.mkdirSync(repo);
  const g = (...args) => execFileSync("git", args, { cwd: repo, encoding: "utf8" });
  g("init", "-q", "-b", INTEGRATION);
  g("config", "user.email", "t@example.com");
  g("config", "user.name", "t");
  g("config", "commit.gpgsign", "false");
  const write = (rel, text) => {
    fs.mkdirSync(path.dirname(path.join(repo, rel)), { recursive: true });
    fs.writeFileSync(path.join(repo, rel), text);
  };
  fs.mkdirSync(path.join(repo, "scripts"));
  fs.copyFileSync(RELAY, path.join(repo, "scripts/relay.mjs"));
  write(
    "docs/relay/relay.config.json",
    JSON.stringify({
      integrationBranch: INTEGRATION,
      idPrefix: "PIL",
      tasksDir: "docs/relay/tasks",
      statusFile: "docs/relay/STATUS.md",
      worktreeRoot: "../wt",
      evidenceRoot: "../evidence",
      defaultLeaseHours: 3,
      maxActiveTasks: 8,
      protectedPaths: ["app/globals.css", "scripts/relay.mjs"],
      privatePatterns: ["references/**", "**/*.woff2"],
      secretRegexes: ["sk-ant-[A-Za-z0-9_-]{20,}"],
    }),
  );
  write("docs/relay/templates/task.md", card({ id: "PIL-0000" }));
  write("docs/relay/STATUS.md", "# Status\n");
  write("docs/relay/tasks/PIL-0001-demo.md", card({ id: "PIL-0001" }));
  write("docs/relay/tasks/PIL-0002-other.md", card({ id: "PIL-0002", files: "[lib/demo/sub/**]" }));
  write("docs/relay/tasks/PIL-0003-free.md", card({ id: "PIL-0003", files: "[components/free/**]" }));
  write("lib/demo/a.ts", "export const a = 1;\n");
  write("lib/demo/a.test.mjs", 'import test from "node:test";\ntest("one", () => {});\ntest("two", () => {});\n');
  write("lib/other.ts", "export const b = 2;\n");
  write("app/globals.css", "body{}\n");
  g("add", "-A");
  g("commit", "-q", "-m", "init");
  const run = (args, { cwd = repo, env = {} } = {}) =>
    spawnSync(process.execPath, [path.join(repo, "scripts/relay.mjs"), ...args], {
      cwd,
      encoding: "utf8",
      env: { ...process.env, RELAY_NOW: NOW, ...env },
    });
  const read = (rel) => fs.readFileSync(path.join(repo, rel), "utf8");
  return { root, repo, g, write, run, read };
}

test("card frontmatter round-trips and keeps list fields", () => {
  const parsed = parseCard(card({ id: "PIL-0009", files: "[a/**, b/*.ts]" }));
  assert.deepEqual(parsed.fields.files_allowed, ["a/**", "b/*.ts"]);
  const again = parseCard(serializeCard(parsed));
  assert.deepEqual(again.fields, parsed.fields);
});

test("acceptance hash ignores checkbox state but not wording", () => {
  const body = "## 验收标准\n\n- [ ] A1 x\n\n## 证据\n";
  assert.equal(acceptanceHash(body), acceptanceHash(body.replace("[ ]", "[x]")));
  assert.notEqual(acceptanceHash(body), acceptanceHash(body.replace("A1 x", "A1 y")));
});

test("globs match paths and overlap by static prefix", () => {
  assert.ok(globToRegex("lib/**").test("lib/a/b.ts"));
  assert.ok(globToRegex("lib/*.ts").test("lib/a.ts"));
  assert.ok(!globToRegex("lib/*.ts").test("lib/a/b.ts"));
  assert.ok(globToRegex("**/*.woff2").test("public/x/font.woff2"));
  assert.ok(globsOverlap(["lib/demo/**"], ["lib/demo/sub/**"]));
  assert.equal(globsOverlap(["lib/demo/**"], ["components/**"]), null);
});

test("claim requires frozen acceptance, then records owner, lease and a board commit", () => {
  const t = setup();
  let r = t.run(["claim", "PIL-0001", "--owner", "claude:sonnet-high:impl"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /not frozen/);
  assert.equal(t.run(["freeze", "PIL-0001", "--owner", "claude:opus-high:plan"]).status, 0);
  r = t.run(["claim", "PIL-0001", "--owner", "claude:sonnet-high:impl"]);
  assert.equal(r.status, 0, r.stderr);
  const c = parseCard(t.read("docs/relay/tasks/PIL-0001-demo.md"));
  assert.equal(c.fields.status, "in_progress");
  assert.equal(c.fields.owner, "claude:sonnet-high:impl");
  assert.equal(c.fields.lease_until, "2026-10-19T13:00Z");
  assert.deepEqual(c.fields.implementers, ["claude:sonnet-high:impl"]);
  assert.match(t.g("log", "-1", "--format=%s"), /relay\(PIL-0001\): claim/);
  assert.match(t.read("docs/relay/STATUS.md"), /PIL-0001 \| P1 \| in_progress/);
});

test("a live lease blocks other owners; an expired one needs --takeover", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["claim", "PIL-0001", "--owner", "claude:sonnet-high:impl"]);
  let r = t.run(["claim", "PIL-0001", "--owner", "codex:gpt:impl"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /held by/);
  const later = { env: { RELAY_NOW: "2026-10-19T14:00:00Z" } };
  r = t.run(["claim", "PIL-0001", "--owner", "codex:gpt:impl"], later);
  assert.match(r.stderr, /--takeover/);
  r = t.run(["claim", "PIL-0001", "--owner", "codex:gpt:impl", "--takeover"], later);
  assert.equal(r.status, 0, r.stderr);
  const c = parseCard(t.read("docs/relay/tasks/PIL-0001-demo.md"));
  assert.deepEqual(c.fields.implementers, ["claude:sonnet-high:impl", "codex:gpt:impl"]);
});

test("overlapping file scopes cannot be claimed concurrently", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["freeze", "PIL-0002"]);
  t.run(["freeze", "PIL-0003"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  const r = t.run(["claim", "PIL-0002", "--owner", "b:impl"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /overlap with active PIL-0001/);
  assert.equal(t.run(["claim", "PIL-0003", "--owner", "b:impl"]).status, 0);
});

test("editing frozen acceptance is caught; only a non-implementer can amend", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  const file = "docs/relay/tasks/PIL-0001-demo.md";
  t.write(file, t.read(file).replace("A2 handles failure.", "A2 handles nothing."));
  let r = t.run(["check"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /R8 acceptance text changed/);
  r = t.run(["amend", "PIL-0001", "--reason", "easier", "--approved-by", "a:impl"]);
  assert.match(r.stderr, /cannot approve/);
  r = t.run(["amend", "PIL-0001", "--reason", "user narrowed scope", "--approved-by", "user"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(t.run(["check"]).status, 0);
});

test("done needs passing evidence from a non-implementer and a separate reviewer", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  t.run(["set", "PIL-0001", "verify"]);
  let r = t.run(["evidence", "PIL-0001", "--ac", "A1", "--result", "通过", "--owner", "a:impl"]);
  assert.match(r.stderr, /implementer of this task cannot record passing/);
  t.run(["evidence", "PIL-0001", "--ac", "A1", "--result", "通过", "--how", "node -e 0", "--owner", "v:verify"]);
  t.run(["set", "PIL-0001", "review"]);
  r = t.run(["set", "PIL-0001", "done", "--reviewed-by", "r:review"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /A2 has no passing evidence/);
  t.run(["evidence", "PIL-0001", "--ac", "A2", "--result", "通过", "--owner", "v:verify"]);
  r = t.run(["set", "PIL-0001", "done", "--reviewed-by", "a:impl"]);
  assert.match(r.stderr, /reviewer must not be an implementer/);
  r = t.run(["set", "PIL-0001", "done", "--reviewed-by", "r:review"]);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(t.run(["check"]).status, 0);
});

test("guard blocks deleted tests, removed cases, skip/only and protected paths", () => {
  const t = setup();
  fs.rmSync(path.join(t.repo, "lib/demo/a.test.mjs"));
  t.write("app/globals.css", "body{color:red}\n");
  let r = t.run(["guard", "--base", "HEAD"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /R1 test-file-deleted/);
  assert.match(r.stdout, /R6 protected-path-changed/);
  t.g("checkout", "--", ".");
  t.write("lib/demo/a.test.mjs", 'import test from "node:test";\ntest.only("one", () => {});\nconst ok = /x/.test("x");\n');
  r = t.run(["guard", "--base", "HEAD"]);
  assert.match(r.stdout, /R2 test-cases-removed/);
  assert.match(r.stdout, /R3 skip-or-only-added/);
});

test("guard on a task branch blocks files outside scope unless waived on the card", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  const r0 = t.run(["start", "PIL-0001"]);
  assert.equal(r0.status, 0, r0.stderr);
  const wt = path.join(t.root, "wt", "PIL-0001");
  assert.ok(fs.existsSync(path.join(wt, "lib/demo/a.ts")));
  fs.writeFileSync(path.join(wt, "lib/demo/a.ts"), "export const a = 2;\n");
  fs.writeFileSync(path.join(wt, "lib/other.ts"), "export const b = 3;\n");
  let r = t.run(["guard"], { cwd: wt });
  assert.equal(r.status, 1);
  assert.match(r.stdout, /R7 out-of-task-scope\s+lib\/other\.ts/);
  assert.doesNotMatch(r.stdout, /lib\/demo\/a\.ts/);
  const file = "docs/relay/tasks/PIL-0001-demo.md";
  t.write(file, t.read(file).replace("waivers: []", "waivers: [R7:user-approved]"));
  r = t.run(["guard"], { cwd: wt });
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, /WAIVED R7/);
});

test("guard flags private material and secrets in added lines", () => {
  const t = setup();
  t.write("references/shot.png", "x");
  t.write("lib/key.ts", `export const k = "sk-ant-${"a".repeat(30)}";\n`);
  const r = t.run(["guard", "--base", "HEAD"]);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /R9 private-material-or-secret\s+references\/shot\.png/);
  assert.match(r.stdout, /R9 private-material-or-secret\s+lib\/key\.ts/);
});

test("scope changes need a non-implementer approver and are logged", () => {
  const t = setup();
  t.run(["freeze", "PIL-0001"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  let r = t.run(["scope", "PIL-0001", "--add", "lib/other.ts", "--reason", "needed", "--approved-by", "a:impl"]);
  assert.match(r.stderr, /cannot widen its own scope/);
  r = t.run(["scope", "PIL-0001", "--add", "lib/other.ts", "--reason", "shared helper", "--approved-by", "c:coord"]);
  assert.equal(r.status, 0, r.stderr);
  const c = parseCard(t.read("docs/relay/tasks/PIL-0001-demo.md"));
  assert.deepEqual(c.fields.files_allowed, ["lib/demo/**", "lib/other.ts"]);
  assert.match(c.body, /c:coord · 范围/);
});

test("files_shared are in scope for the guard but do not block concurrent claims", () => {
  const t = setup();
  const file = "docs/relay/tasks/PIL-0003-free.md";
  t.write(file, t.read(file).replace("files_allowed: [components/free/**]", "files_allowed: [components/free/**]\nfiles_shared: [lib/demo/a.ts]"));
  t.g("commit", "-qam", "shared");
  t.run(["freeze", "PIL-0001"]);
  t.run(["freeze", "PIL-0003"]);
  t.run(["claim", "PIL-0001", "--owner", "a:impl"]);
  assert.equal(t.run(["claim", "PIL-0003", "--owner", "b:impl"]).status, 0);
  t.run(["start", "PIL-0003"]);
  const wt = path.join(t.root, "wt", "PIL-0003");
  fs.writeFileSync(path.join(wt, "lib/demo/a.ts"), "export const a = 3;\n");
  const r = t.run(["guard"], { cwd: wt });
  assert.equal(r.status, 0, r.stdout);
});

test("install-claude copies agents and skills and merges deny rules", () => {
  const t = setup();
  t.write("docs/relay/claude/agents/pil-x.md", "---\nname: pil-x\ndescription: x\n---\nbody\n");
  t.write("docs/relay/claude/skills/relay/SKILL.md", "---\nname: relay\ndescription: r\n---\n");
  t.write("docs/relay/claude/settings.json", JSON.stringify({ permissions: { deny: ["Bash(next build *)"] } }));
  t.write(".claude/settings.json", JSON.stringify({ permissions: { allow: ["Bash(ls *)"], deny: ["Bash(rm *)"] } }));
  let r = t.run(["check"]);
  assert.match(r.stdout, /install-claude/);
  r = t.run(["install-claude"]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(fs.existsSync(path.join(t.repo, ".claude/agents/pil-x.md")));
  assert.ok(fs.existsSync(path.join(t.repo, ".claude/skills/relay/SKILL.md")));
  const settings = JSON.parse(t.read(".claude/settings.json"));
  assert.deepEqual(settings.permissions.allow, ["Bash(ls *)"]);
  assert.deepEqual(settings.permissions.deny, ["Bash(rm *)", "Bash(next build *)"]);
  assert.doesNotMatch(t.run(["check"]).stdout, /install-claude/);
});

test("suppression and empty-catch checks apply to code, not prose", () => {
  const t = setup();
  t.write("docs/note.md", "Never use `@ts-ignore` or `catch {}`.\n");
  t.write("lib/demo/b.ts", "try { f(); } catch {}\n// @ts-ignore\n");
  const r = t.run(["guard", "--base", "HEAD"]);
  assert.doesNotMatch(r.stdout, /docs\/note\.md/);
  assert.match(r.stdout, /R5 suppression-added\s+lib\/demo\/b\.ts/);
  assert.match(r.stdout, /R10 empty-catch-added\s+lib\/demo\/b\.ts/);
});

function toReview(t, id, deps) {
  t.run(["freeze", id]);
  t.run(["claim", id, "--owner", "a:impl"]);
  t.run(["set", id, "verify"]);
  for (const ac of ["A1", "A2"]) t.run(["evidence", id, "--ac", ac, "--result", "通过", "--how", "node -e 0", "--owner", "v:verify"]);
  t.run(["set", id, "review"]);
  if (deps) {
    const rel = `docs/relay/tasks/${id}-demo.md`;
    t.write(rel, t.read(rel).replace("depends_on: []", `depends_on: [${deps}]`));
    t.g("add", "-A");
    t.g("commit", "-q", "-m", "deps");
  }
}

test("set done validates depends_on against all cards, not only the one being closed", () => {
  const t = setup();
  toReview(t, "PIL-0001", "PIL-0002");
  const r = t.run(["set", "PIL-0001", "done", "--reviewed-by", "r:review"]);
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stderr, /depends_on unknown/);
  assert.equal(t.run(["check"]).status, 0);
});

test("set done still rejects a depends_on that does not exist", () => {
  const t = setup();
  toReview(t, "PIL-0001", "PIL-0099");
  const r = t.run(["set", "PIL-0001", "done", "--reviewed-by", "r:review"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /depends_on unknown PIL-0099/);
});
