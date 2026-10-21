#!/usr/bin/env node
// Pilaude relay: task board, leases, worktrees and the integrity guard.
// Protocol: docs/relay/README.md. Rules enforced here: docs/relay/RULES.md.
// No dependencies; Node >= 22. Works from the main checkout or any task worktree.

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const STATUSES = ["todo", "in_progress", "verify", "review", "done", "blocked", "parked"];
const ACTIVE = new Set(["in_progress", "verify", "review"]);
const PRIORITIES = ["P0", "P1", "P2", "P3"];
const FIELD_ORDER = [
  "id", "title", "epic", "priority", "status", "owner", "lease_until", "branch",
  "implementers", "depends_on", "files_allowed", "files_shared", "acceptance_sha", "waivers",
];
const LIST_FIELDS = new Set(["implementers", "depends_on", "files_allowed", "files_shared", "waivers"]);
const TRANSITIONS = {
  todo: ["parked"],
  in_progress: ["verify", "blocked", "todo", "parked"],
  verify: ["review", "in_progress", "blocked"],
  review: ["done", "in_progress", "blocked"],
  blocked: ["todo", "in_progress", "parked"],
  parked: ["todo"],
  done: [],
};

const RULES = {
  R1: { severity: "block", name: "test-file-deleted" },
  R2: { severity: "block", name: "test-cases-removed" },
  R3: { severity: "block", name: "skip-or-only-added" },
  R4: { severity: "warn", name: "assertions-net-removed" },
  R5: { severity: "warn", name: "suppression-added" },
  R6: { severity: "block", name: "protected-path-changed" },
  R7: { severity: "block", name: "out-of-task-scope" },
  R8: { severity: "block", name: "acceptance-tampered" },
  R9: { severity: "block", name: "private-material-or-secret" },
  R10: { severity: "warn", name: "empty-catch-added" },
  R11: { severity: "block", name: "risk-threshold-changed" },
};

class RelayError extends Error {}

// ---------- environment ----------

function git(args, opts = {}) {
  try {
    return execFileSync("git", args, {
      cwd: opts.cwd ?? process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", opts.quiet ? "ignore" : "pipe"],
      maxBuffer: 256 * 1024 * 1024,
    }).replace(/\r\n/g, "\n");
  } catch (error) {
    if (opts.allowFail) return null;
    const stderr = error.stderr ? String(error.stderr).trim() : error.message;
    throw new RelayError(`git ${args.join(" ")} failed: ${stderr}`);
  }
}

function now() {
  return process.env.RELAY_NOW ? new Date(process.env.RELAY_NOW) : new Date();
}

function isoMinute(date) {
  return date.toISOString().slice(0, 16) + "Z";
}

function context() {
  const top = git(["rev-parse", "--show-toplevel"]).trim();
  const list = git(["worktree", "list", "--porcelain"], { cwd: top });
  const first = list.split("\n").find((line) => line.startsWith("worktree "));
  const main = path.resolve(first ? first.slice("worktree ".length) : top);
  const configPath = path.join(main, "docs/relay/relay.config.json");
  if (!fs.existsSync(configPath)) throw new RelayError(`missing ${configPath}`);
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: top, allowFail: true })?.trim() ?? "";
  const commonDir = path.resolve(top, git(["rev-parse", "--git-common-dir"], { cwd: top }).trim());
  return {
    top: path.resolve(top),
    main,
    config,
    branch,
    commonDir,
    tasksDir: path.join(main, config.tasksDir),
    statusFile: path.join(main, config.statusFile),
  };
}

// ---------- cards ----------

function parseList(raw) {
  const value = raw.trim();
  if (!value) return [];
  if (!value.startsWith("[") || !value.endsWith("]")) return [value];
  return value
    .slice(1, -1)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseCard(text, file = "<card>") {
  const normalized = text.replace(/\r\n/g, "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) throw new RelayError(`${file}: missing frontmatter`);
  const fields = {};
  const extra = [];
  for (const line of match[1].split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const idx = line.indexOf(":");
    if (idx < 0) throw new RelayError(`${file}: bad frontmatter line "${line}"`);
    const key = line.slice(0, idx).trim();
    const raw = line.slice(idx + 1).trim();
    fields[key] = LIST_FIELDS.has(key) ? parseList(raw) : raw;
    if (!FIELD_ORDER.includes(key)) extra.push(key);
  }
  for (const key of LIST_FIELDS) if (!(key in fields)) fields[key] = [];
  return { fields, body: match[2], extra, file };
}

export function serializeCard(card) {
  const keys = [...FIELD_ORDER, ...card.extra.filter((k) => !FIELD_ORDER.includes(k))];
  const lines = keys
    .filter((key) => key in card.fields)
    .map((key) => {
      const value = card.fields[key];
      return LIST_FIELDS.has(key) ? `${key}: [${value.join(", ")}]` : `${key}: ${value ?? ""}`.trimEnd();
    });
  const body = card.body.startsWith("\n") ? card.body : `\n${card.body}`;
  return `---\n${lines.join("\n")}\n---\n${body.replace(/^\n+/, "\n")}`;
}

function section(body, title) {
  const lines = body.split("\n");
  const start = lines.findIndex((line) => line.trim() === `## ${title}`);
  if (start < 0) return null;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i].startsWith("## ")) {
      end = i;
      break;
    }
  }
  return lines.slice(start + 1, end).join("\n");
}

export function acceptanceHash(body) {
  const text = section(body, "验收标准");
  if (text === null) return null;
  const normalized = text
    .split("\n")
    .map((line) => line.replace(/^(\s*-\s*)\[[ xX]\]/, "$1[ ]").trim())
    .filter(Boolean)
    .join("\n");
  return createHash("sha256").update(normalized).digest("hex").slice(0, 12);
}

export function acceptanceIds(body) {
  const text = section(body, "验收标准") ?? "";
  return [...text.matchAll(/^\s*-\s*\[[ xX]\]\s*(A\d+)\b/gm)].map((m) => m[1]);
}

function evidenceRows(body) {
  const text = section(body, "证据") ?? "";
  const rows = [];
  for (const line of text.split("\n")) {
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (cells.length < 6 || !/^A\d+$/.test(cells[0])) continue;
    rows.push({ id: cells[0], how: cells[1], result: cells[2], where: cells[3], commit: cells[4], verifier: cells[5] });
  }
  return rows;
}

function cardPath(ctx, id) {
  const files = fs.existsSync(ctx.tasksDir) ? fs.readdirSync(ctx.tasksDir) : [];
  const file = files.find((name) => name === `${id}.md` || name.startsWith(`${id}-`));
  if (!file) throw new RelayError(`no card for ${id} in ${ctx.config.tasksDir}`);
  return path.join(ctx.tasksDir, file);
}

function loadCard(ctx, id) {
  const file = cardPath(ctx, id);
  return parseCard(fs.readFileSync(file, "utf8"), file);
}

function loadAll(ctx) {
  if (!fs.existsSync(ctx.tasksDir)) return [];
  return fs
    .readdirSync(ctx.tasksDir)
    .filter((name) => name.endsWith(".md") && name.startsWith(ctx.config.idPrefix + "-"))
    .sort()
    .map((name) => {
      const file = path.join(ctx.tasksDir, name);
      return parseCard(fs.readFileSync(file, "utf8"), file);
    });
}

function saveCard(card) {
  fs.writeFileSync(card.file, serializeCard(card));
}

function appendLog(card, who, message) {
  const line = `- ${isoMinute(now())} · ${who || "unknown"} · ${message.replace(/\s*\n\s*/g, " ")}`;
  const lines = card.body.replace(/\s+$/, "").split("\n");
  if (!lines.some((l) => l.trim() === "## 日志")) lines.push("", "## 日志");
  lines.push(line);
  card.body = lines.join("\n") + "\n";
}

function leaseExpired(card) {
  if (!card.fields.lease_until) return true;
  return new Date(card.fields.lease_until.replace(/Z?$/, "Z")).getTime() < now().getTime();
}

// ---------- globs ----------

export function globToRegex(glob) {
  let out = "";
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        const slash = glob[i + 2] === "/";
        out += slash ? "(?:.*/)?" : ".*";
        i += slash ? 2 : 1;
      } else out += "[^/]*";
    } else if (ch === "?") out += "[^/]";
    else out += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${out}$`);
}

export function matchesAny(file, globs) {
  return globs.some((glob) => globToRegex(glob).test(file) || (glob.endsWith("/") && file.startsWith(glob)));
}

function staticPrefix(glob) {
  const idx = glob.search(/[*?]/);
  return idx < 0 ? glob : glob.slice(0, idx);
}

export function globsOverlap(a, b) {
  for (const x of a) {
    for (const y of b) {
      const px = staticPrefix(x);
      const py = staticPrefix(y);
      if (px.startsWith(py) || py.startsWith(px)) return `${x} ↔ ${y}`;
    }
  }
  return null;
}

// ---------- validation ----------

export function validateCards(cards, config) {
  const problems = [];
  const ids = new Set();
  for (const card of cards) {
    const f = card.fields;
    const where = path.basename(card.file);
    const say = (level, msg) => problems.push({ level, id: f.id || where, msg });
    if (!f.id || !new RegExp(`^${config.idPrefix}-\\d{4}$`).test(f.id)) say("error", "id missing or malformed");
    if (f.id && !where.startsWith(f.id)) say("error", `file name does not start with ${f.id}`);
    if (ids.has(f.id)) say("error", "duplicate id");
    ids.add(f.id);
    if (!f.title) say("error", "title missing");
    if (!STATUSES.includes(f.status)) say("error", `unknown status "${f.status}"`);
    if (!PRIORITIES.includes(f.priority)) say("error", `unknown priority "${f.priority}"`);
    if (!f.epic) say("error", "epic missing");
    for (const required of ["目标", "验收标准", "范围外", "证据", "日志"]) {
      if (section(card.body, required) === null) say("error", `section "## ${required}" missing`);
    }
    const accIds = acceptanceIds(card.body);
    if (accIds.length === 0) say("error", "no acceptance items (- [ ] A1 ...)");
    if (new Set(accIds).size !== accIds.length) say("error", "duplicate acceptance ids");
    const hash = acceptanceHash(card.body);
    if (f.acceptance_sha) {
      if (hash !== f.acceptance_sha) say("error", `R8 acceptance text changed without amend (${f.acceptance_sha} → ${hash})`);
    } else if (f.status !== "todo" && f.status !== "parked") {
      say("error", "acceptance not frozen but work has started");
    }
    if (ACTIVE.has(f.status)) {
      if (!f.owner) say("error", "active task without owner");
      if (leaseExpired(card)) say("warn", `lease expired (${f.lease_until || "none"}) — may be taken over`);
      if (f.files_allowed.length === 0) say("error", "active task without files_allowed");
    }
    if (f.status === "done") {
      const rows = evidenceRows(card.body);
      for (const accId of accIds) {
        const row = rows.find((r) => r.id === accId && /通过|PASS/i.test(r.result));
        if (!row) say("error", `done but ${accId} has no passing evidence row`);
        else if (f.implementers.includes(row.verifier)) say("error", `${accId} verified by an implementer (${row.verifier})`);
      }
    }
  }
  for (const card of cards) {
    for (const dep of card.fields.depends_on) {
      if (!ids.has(dep)) problems.push({ level: "error", id: card.fields.id, msg: `depends_on unknown ${dep}` });
    }
  }
  return problems;
}

// ---------- status board ----------

export function renderBoard(cards) {
  const by = (status) => cards.filter((c) => c.fields.status === status);
  const order = (a, b) =>
    PRIORITIES.indexOf(a.fields.priority) - PRIORITIES.indexOf(b.fields.priority) || a.fields.id.localeCompare(b.fields.id);
  const lastLog = (card) => {
    const log = section(card.body, "日志") ?? "";
    const lines = log.split("\n").filter((l) => l.startsWith("- "));
    return (lines.at(-1) ?? "").replace(/^- /, "").replace(/\|/g, "/");
  };
  const out = [];
  const counts = STATUSES.map((s) => `${s} ${by(s).length}`).join(" · ");
  out.push(`共 ${cards.length} 张任务卡：${counts}`, "");
  const active = cards.filter((c) => ACTIVE.has(c.fields.status)).sort(order);
  out.push("### 进行中 / 待验证 / 待评审", "");
  if (active.length === 0) out.push("（无）");
  else {
    out.push("| ID | 优先级 | 状态 | 标题 | 持有者 | 租约到期 (UTC) | 分支 |", "| --- | --- | --- | --- | --- | --- | --- |");
    for (const c of active) {
      const f = c.fields;
      const lease = leaseExpired(c) ? `已过期 ${f.lease_until || ""}` : f.lease_until;
      out.push(`| ${f.id} | ${f.priority} | ${f.status} | ${f.title} | ${f.owner} | ${lease} | ${f.branch || "—"} |`);
    }
  }
  out.push("", "### 阻塞", "");
  const blocked = by("blocked").sort(order);
  if (blocked.length === 0) out.push("（无）");
  else for (const c of blocked) out.push(`- **${c.fields.id}** ${c.fields.title} — ${lastLog(c)}`);
  out.push("", "### 待办（按优先级；未冻结验收的卡需先由规划者冻结）", "");
  const todo = by("todo").sort(order);
  if (todo.length === 0) out.push("（无）");
  else {
    out.push("| ID | 优先级 | Epic | 标题 | 验收已冻结 | 依赖 |", "| --- | --- | --- | --- | --- | --- |");
    for (const c of todo) {
      const f = c.fields;
      out.push(`| ${f.id} | ${f.priority} | ${f.epic} | ${f.title} | ${f.acceptance_sha ? "是" : "否"} | ${f.depends_on.join(", ") || "—"} |`);
    }
  }
  const done = by("done").sort(order);
  out.push("", `### 已完成（${done.length}）`, "");
  out.push(done.length ? done.map((c) => `${c.fields.id} ${c.fields.title}`).join("；") : "（无）");
  return out.join("\n");
}

const BOARD_START = "<!-- relay:board:start -->";
const BOARD_END = "<!-- relay:board:end -->";

function writeStatus(ctx) {
  const cards = loadAll(ctx);
  const board = renderBoard(cards);
  let text = fs.existsSync(ctx.statusFile) ? fs.readFileSync(ctx.statusFile, "utf8").replace(/\r\n/g, "\n") : "";
  const block = `${BOARD_START}\n${board}\n${BOARD_END}`;
  if (text.includes(BOARD_START) && text.includes(BOARD_END)) {
    text = text.slice(0, text.indexOf(BOARD_START)) + block + text.slice(text.indexOf(BOARD_END) + BOARD_END.length);
  } else {
    text = `${text.replace(/\s+$/, "")}\n\n## 任务板（自动生成，勿手改）\n\n${block}\n`;
  }
  fs.writeFileSync(ctx.statusFile, text);
}

function boardCommit(ctx, files, message, opts) {
  writeStatus(ctx);
  const rel = [...files, ctx.statusFile].map((file) => path.relative(ctx.main, file).split(path.sep).join("/"));
  if (opts["no-commit"] || process.env.RELAY_NO_COMMIT === "1") {
    console.log(`(未提交) 已修改：${rel.join(", ")}`);
    return;
  }
  const mainBranch = git(["rev-parse", "--abbrev-ref", "HEAD"], { cwd: ctx.main }).trim();
  if (mainBranch !== ctx.config.integrationBranch) {
    throw new RelayError(`main checkout is on ${mainBranch}, expected ${ctx.config.integrationBranch}; board commits only go to the integration branch (use --no-commit to only edit)`);
  }
  git(["add", "--", ...rel], { cwd: ctx.main });
  git(["commit", "--only", "--no-verify", "-q", "-m", message, "--", ...rel], { cwd: ctx.main });
  console.log(`已提交到 ${ctx.config.integrationBranch}：${message}`);
}

// ---------- guard ----------

function changedFiles(ctx, opts) {
  const cwd = ctx.top;
  const entries = new Map();
  const add = (output) => {
    for (const line of (output ?? "").split("\n").filter(Boolean)) {
      const parts = line.split("\t");
      const status = parts[0][0];
      const file = parts.at(-1);
      const from = status === "R" ? parts[1] : null;
      entries.set(file, { status, file, from });
    }
  };
  let range;
  if (opts.staged) {
    add(git(["diff", "--cached", "--name-status", "-M"], { cwd }));
    range = ["--cached"];
  } else {
    const base = opts.base || git(["merge-base", "HEAD", ctx.config.integrationBranch], { cwd, allowFail: true })?.trim() || "HEAD";
    add(git(["diff", "--name-status", "-M", base], { cwd }));
    for (const file of (git(["ls-files", "--others", "--exclude-standard"], { cwd }) ?? "").split("\n").filter(Boolean)) {
      entries.set(file, { status: "A", file, from: null, untracked: true });
    }
    range = [base];
  }
  return { entries: [...entries.values()], range };
}

function fileDiff(ctx, range, entry) {
  if (entry.untracked) {
    const full = path.join(ctx.top, entry.file);
    const text = fs.existsSync(full) && fs.statSync(full).isFile() ? fs.readFileSync(full, "utf8") : "";
    return { added: text.split("\n"), removed: [] };
  }
  const paths = entry.from ? [entry.from, entry.file] : [entry.file];
  const out = git(["diff", "-U0", "-M", ...range, "--", ...paths], { cwd: ctx.top, allowFail: true }) ?? "";
  const added = [];
  const removed = [];
  for (const line of out.split("\n")) {
    if (line.startsWith("+++") || line.startsWith("---")) continue;
    if (line.startsWith("+")) added.push(line.slice(1));
    else if (line.startsWith("-")) removed.push(line.slice(1));
  }
  return { added, removed };
}

const TEST_FILE = /(\.test\.[cm]?[jt]sx?$)|(^e2e\/)/;
const CODE_FILE = /\.[cm]?[jt]sx?$/;
const TEST_CASE = /(?<![.\w])(?:test|it)(?:\.(?:skip|only|todo))?\s*\(/g;
const SKIP_ONLY = /\b(?:test|it|describe)\.(?:skip|only|todo)\s*\(|\{\s*(?:skip|only|todo)\s*:\s*(?!false)|\bx(?:it|describe)\s*\(|\.skip\s*\(\s*\)/;
const ASSERTION = /\bassert(?:\.\w+)?\s*\(|\bexpect\s*\(/g;
const SUPPRESSION = /@ts-ignore|@ts-nocheck|@ts-expect-error|eslint-disable|\bas any\b/;
const EMPTY_CATCH = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/;
const countOf = (lines, regex) => lines.reduce((n, line) => n + (line.match(regex)?.length ?? 0), 0);

function taskFromBranch(branch) {
  const m = branch.match(/^task\/([A-Z]+-\d{4})/);
  return m ? m[1] : null;
}

export function runGuard(ctx, opts) {
  const findings = [];
  const flag = (rule, file, detail) => findings.push({ rule, ...RULES[rule], file, detail });
  const { entries, range } = changedFiles(ctx, opts);
  const taskId = opts.task || taskFromBranch(ctx.branch);
  let card = null;
  if (taskId) {
    try {
      card = loadCard(ctx, taskId);
    } catch {
      flag("R7", "-", `branch names task ${taskId} but no card exists`);
    }
  }
  const tasksRel = ctx.config.tasksDir.replace(/\/$/, "") + "/";
  const secretRes = (ctx.config.secretRegexes ?? []).map((s) => new RegExp(s));
  for (const entry of entries) {
    const file = entry.file;
    const isTest = TEST_FILE.test(file);
    if (entry.status === "D" && isTest) flag("R1", file, "test file deleted");
    if (matchesAny(file, ctx.config.protectedPaths ?? [])) flag("R6", file, "protected path changed");
    if (entry.status !== "D" && matchesAny(file, ctx.config.privatePatterns ?? [])) flag("R9", file, "private/personal material path");
    if (card && !file.startsWith(tasksRel) && !matchesAny(file, [...card.fields.files_allowed, ...card.fields.files_shared])) {
      flag("R7", file, `not in ${taskId} files_allowed`);
    }
    if (card && file.startsWith(tasksRel)) flag("R8", file, "task cards are edited only through relay on the integration branch");
    if (entry.status === "D") continue;
    const { added, removed } = fileDiff(ctx, range, entry);
    if (isTest) {
      const lost = countOf(removed, TEST_CASE) - countOf(added, TEST_CASE);
      if (lost > 0) flag("R2", file, `${lost} test case(s) net removed`);
      const skip = added.find((line) => SKIP_ONLY.test(line));
      if (skip) flag("R3", file, skip.trim().slice(0, 120));
      const weakened = countOf(removed, ASSERTION) - countOf(added, ASSERTION);
      if (weakened > 0) flag("R4", file, `${weakened} assertion(s) net removed`);
    } else if (CODE_FILE.test(file)) {
      const sup = added.find((line) => SUPPRESSION.test(line));
      if (sup) flag("R5", file, sup.trim().slice(0, 120));
    }
    const empty = CODE_FILE.test(file) && added.find((line) => EMPTY_CATCH.test(line));
    if (empty) flag("R10", file, empty.trim().slice(0, 120));
    for (const line of added) {
      const hit = secretRes.find((re) => re.test(line));
      if (hit) {
        findings.push({ rule: "R9", ...RULES.R9, severity: isTest ? "warn" : "block", file, detail: `looks like a secret (${hit.source})` });
        break;
      }
    }
    if (file === "scripts/fork-ownership.json" && [...added, ...removed].some((l) => /"(?:high|medium)"\s*:\s*\d+/.test(l))) {
      flag("R11", file, "riskModel threshold line changed");
    }
    if (file.startsWith(tasksRel) && file.endsWith(".md")) {
      const full = path.join(ctx.top, file);
      if (fs.existsSync(full)) {
        const c = parseCard(fs.readFileSync(full, "utf8"), file);
        if (c.fields.acceptance_sha && acceptanceHash(c.body) !== c.fields.acceptance_sha) {
          flag("R8", file, "acceptance text differs from acceptance_sha (use relay amend)");
        }
      }
    }
  }
  const waived = new Set([
    ...(card?.fields.waivers ?? []).map((w) => w.split(":")[0].trim()),
    ...(process.env.RELAY_WAIVE ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  ]);
  for (const finding of findings) finding.waived = waived.has(finding.rule);
  return { findings, taskId, files: entries.length };
}

function printGuard(result, opts) {
  if (opts.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    const label = result.taskId ? `任务 ${result.taskId}` : "无任务上下文";
    console.log(`relay guard：检查 ${result.files} 个文件（${label}）`);
    if (result.findings.length === 0) console.log("  未发现问题。");
    for (const f of result.findings) {
      const tag = f.waived ? "WAIVED" : f.severity === "block" ? "BLOCK " : "WARN  ";
      console.log(`  ${tag} ${f.rule} ${f.name}  ${f.file}  — ${f.detail}`);
    }
  }
  const blocking = result.findings.filter((f) => f.severity === "block" && !f.waived);
  if (blocking.length) {
    console.error(`\n${blocking.length} 个阻断项。不要绕过：修正改动，或请用户批准后在任务卡 waivers 中登记（见 docs/relay/RULES.md）。`);
    return 1;
  }
  return 0;
}

// ---------- commands ----------

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) opts[key] = true;
      else {
        opts[key] = next;
        i += 1;
      }
    } else opts._.push(arg);
  }
  return opts;
}

function need(value, message) {
  if (!value || value === true) throw new RelayError(message);
  return value;
}

function slugOf(card) {
  return path.basename(card.file, ".md").slice(card.fields.id.length + 1) || "task";
}

const commands = {
  list(ctx, opts) {
    for (const c of loadAll(ctx)) {
      const f = c.fields;
      if (opts.status && f.status !== opts.status) continue;
      if (opts.epic && f.epic !== opts.epic) continue;
      const lease = ACTIVE.has(f.status) ? ` ${f.owner} lease ${leaseExpired(c) ? "EXPIRED" : f.lease_until}` : "";
      console.log(`${f.id} ${f.priority} ${f.status.padEnd(11)} ${f.epic.padEnd(4)} ${f.title}${lease}`);
    }
    return 0;
  },

  show(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: show <id>"));
    console.log(serializeCard(card));
    return 0;
  },

  next(ctx) {
    const cards = loadAll(ctx);
    const done = new Set(cards.filter((c) => c.fields.status === "done").map((c) => c.fields.id));
    const active = cards.filter((c) => ACTIVE.has(c.fields.status) && !leaseExpired(c));
    const ready = cards
      .filter((c) => c.fields.status === "todo" && c.fields.acceptance_sha)
      .filter((c) => c.fields.depends_on.every((d) => done.has(d)))
      .filter((c) => !active.some((a) => globsOverlap(a.fields.files_allowed, c.fields.files_allowed)))
      .sort((a, b) => PRIORITIES.indexOf(a.fields.priority) - PRIORITIES.indexOf(b.fields.priority));
    const stale = cards.filter((c) => ACTIVE.has(c.fields.status) && leaseExpired(c));
    if (stale.length) console.log(`租约过期、可接手：${stale.map((c) => c.fields.id).join(", ")}`);
    if (ready.length === 0) console.log("没有可直接领取的任务（检查待冻结的卡与依赖）。");
    for (const c of ready.slice(0, 5)) console.log(`${c.fields.id} ${c.fields.priority} ${c.fields.title}`);
    return 0;
  },

  new(ctx, opts) {
    const title = need(opts.title, "usage: new --title <t> --epic <E> [--priority P2] [--slug s]");
    const epic = need(opts.epic, "--epic required");
    const cards = loadAll(ctx);
    const max = cards.reduce((m, c) => Math.max(m, Number(c.fields.id.split("-")[1]) || 0), 0);
    const id = `${ctx.config.idPrefix}-${String(max + 1).padStart(4, "0")}`;
    const slug = (opts.slug || "task").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const template = fs.readFileSync(path.join(ctx.main, "docs/relay/templates/task.md"), "utf8");
    const card = parseCard(template, path.join(ctx.tasksDir, `${id}-${slug}.md`));
    Object.assign(card.fields, { id, title, epic, priority: opts.priority || "P2", status: "todo" });
    appendLog(card, opts.owner || "planner", "创建");
    fs.mkdirSync(ctx.tasksDir, { recursive: true });
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${id}): create`, opts);
    console.log(card.file);
    return 0;
  },

  freeze(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: freeze <id>"));
    if (card.fields.acceptance_sha) throw new RelayError("already frozen; use amend");
    if (acceptanceIds(card.body).length === 0) throw new RelayError("no acceptance items to freeze");
    card.fields.acceptance_sha = acceptanceHash(card.body);
    appendLog(card, opts.owner || "planner", `冻结验收标准 ${card.fields.acceptance_sha}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${card.fields.id}): freeze acceptance`, opts);
    return 0;
  },

  amend(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: amend <id> --reason <r> --approved-by <who>"));
    const reason = need(opts.reason, "--reason required");
    const approver = need(opts["approved-by"], "--approved-by required (user or planner label)");
    if (card.fields.implementers.includes(approver) || approver === card.fields.owner) {
      throw new RelayError("the implementer cannot approve changes to its own acceptance criteria");
    }
    const before = card.fields.acceptance_sha;
    card.fields.acceptance_sha = acceptanceHash(card.body);
    appendLog(card, approver, `修订验收标准 ${before} → ${card.fields.acceptance_sha}：${reason}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${card.fields.id}): amend acceptance`, opts);
    return 0;
  },

  scope(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: scope <id> [--add g1,g2] [--remove g] --reason r --approved-by who"));
    const reason = need(opts.reason, "--reason required");
    const approver = need(opts["approved-by"], "--approved-by required (coordinator, planner or user label)");
    if (card.fields.implementers.includes(approver) || approver === card.fields.owner) {
      throw new RelayError("the implementer cannot widen its own scope");
    }
    const split = (v) => (v && v !== true ? String(v).split(",").map((s) => s.trim()).filter(Boolean) : []);
    const before = card.fields.files_allowed.join(", ");
    const removed = new Set(split(opts.remove));
    card.fields.files_allowed = [...new Set([...card.fields.files_allowed.filter((g) => !removed.has(g)), ...split(opts.add)])];
    appendLog(card, approver, `范围 [${before}] → [${card.fields.files_allowed.join(", ")}]：${reason}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${card.fields.id}): scope`, opts);
    return 0;
  },

  claim(ctx, opts) {
    const id = need(opts._[0], "usage: claim <id> --owner <tool:model:role> [--hours 3] [--takeover]");
    const owner = need(opts.owner, "--owner required, e.g. claude:sonnet-high:impl");
    const card = loadCard(ctx, id);
    const f = card.fields;
    const cards = loadAll(ctx);
    if (!f.acceptance_sha) throw new RelayError(`${id} acceptance is not frozen; a planner must run freeze first`);
    if (f.files_allowed.length === 0) throw new RelayError(`${id} has no files_allowed`);
    if (ACTIVE.has(f.status)) {
      if (!leaseExpired(card) && f.owner !== owner) throw new RelayError(`${id} is held by ${f.owner} until ${f.lease_until}`);
      if (leaseExpired(card) && f.owner !== owner && !opts.takeover) {
        throw new RelayError(`${id} lease expired (owner ${f.owner}); read its 日志 and branch, then claim with --takeover`);
      }
    } else if (!["todo", "blocked"].includes(f.status)) {
      throw new RelayError(`${id} is ${f.status}; cannot claim`);
    }
    const done = new Set(cards.filter((c) => c.fields.status === "done").map((c) => c.fields.id));
    const missing = f.depends_on.filter((d) => !done.has(d));
    if (missing.length && !opts.force) throw new RelayError(`${id} depends on unfinished ${missing.join(", ")}`);
    for (const other of cards) {
      if (other.fields.id === id || !ACTIVE.has(other.fields.status) || leaseExpired(other)) continue;
      const overlap = globsOverlap(other.fields.files_allowed, f.files_allowed);
      if (overlap && !opts.force) throw new RelayError(`files overlap with active ${other.fields.id} (${overlap})`);
    }
    const activeCount = cards.filter((c) => ACTIVE.has(c.fields.status) && !leaseExpired(c) && c.fields.id !== id).length;
    if (activeCount >= (ctx.config.maxActiveTasks ?? 8) && !opts.force) {
      throw new RelayError(`already ${activeCount} active tasks (maxActiveTasks)`);
    }
    const hours = Number(opts.hours || ctx.config.defaultLeaseHours || 3);
    const previous = f.owner;
    f.owner = owner;
    f.lease_until = isoMinute(new Date(now().getTime() + hours * 3600_000));
    if (!f.implementers.includes(owner) && !/:(review|verify|plan)/.test(owner)) f.implementers.push(owner);
    if (!ACTIVE.has(f.status)) f.status = "in_progress";
    if (!f.branch) f.branch = `task/${id}-${slugOf(card)}`;
    appendLog(card, owner, previous && previous !== owner ? `接手（原持有者 ${previous}）租约至 ${f.lease_until}` : `领取，租约至 ${f.lease_until}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${id}): claim by ${owner}`, opts);
    console.log(`下一步：node scripts/relay.mjs start ${id}`);
    return 0;
  },

  renew(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: renew <id> [--hours 3]"));
    if (!ACTIVE.has(card.fields.status)) throw new RelayError("only active tasks have leases");
    const hours = Number(opts.hours || ctx.config.defaultLeaseHours || 3);
    card.fields.lease_until = isoMinute(new Date(now().getTime() + hours * 3600_000));
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${card.fields.id}): renew lease`, opts);
    return 0;
  },

  start(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: start <id>"));
    const f = card.fields;
    if (!ACTIVE.has(f.status)) throw new RelayError(`${f.id} must be claimed first`);
    const wt = path.resolve(ctx.main, ctx.config.worktreeRoot, f.id);
    const existing = git(["worktree", "list", "--porcelain"], { cwd: ctx.main });
    if (!existing.split("\n").some((l) => l.startsWith("worktree ") && path.resolve(l.slice(9)) === wt)) {
      const hasBranch = git(["rev-parse", "--verify", "--quiet", `refs/heads/${f.branch}`], { cwd: ctx.main, allowFail: true, quiet: true });
      fs.mkdirSync(path.dirname(wt), { recursive: true });
      if (hasBranch) git(["worktree", "add", wt, f.branch], { cwd: ctx.main });
      else git(["worktree", "add", "-b", f.branch, wt, ctx.config.integrationBranch], { cwd: ctx.main });
    }
    const nm = path.join(wt, "node_modules");
    const mainNm = path.join(ctx.main, "node_modules");
    if (!fs.existsSync(nm) && fs.existsSync(mainNm) && !opts["no-node-modules"]) {
      fs.symlinkSync(mainNm, nm, process.platform === "win32" ? "junction" : "dir");
      console.log("node_modules 以 junction 共享主 checkout；若本任务修改 package.json/lock，先删除 junction 再在 worktree 内 npm ci。");
    }
    const evidence = path.resolve(ctx.main, ctx.config.evidenceRoot, f.id);
    fs.mkdirSync(evidence, { recursive: true });
    console.log(`worktree: ${wt}\nbranch:   ${f.branch}\nevidence: ${evidence}`);
    return 0;
  },

  log(ctx, opts) {
    const id = need(opts._[0], 'usage: log <id> "message" --owner <label>');
    const message = need(opts._.slice(1).join(" "), "message required");
    const card = loadCard(ctx, id);
    appendLog(card, opts.owner || card.fields.owner, message);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${id}): log`, opts);
    return 0;
  },

  evidence(ctx, opts) {
    const id = need(opts._[0], "usage: evidence <id> --ac A1 --result 通过|失败|未运行 --how <cmd> --where <path> --commit <sha> --owner <verifier>");
    const card = loadCard(ctx, id);
    const ac = need(opts.ac, "--ac required");
    if (!acceptanceIds(card.body).includes(ac)) throw new RelayError(`${ac} is not an acceptance id of ${id}`);
    const result = need(opts.result, "--result required");
    const verifier = need(opts.owner, "--owner (verifier label) required");
    if (/通过|PASS/i.test(result) && card.fields.implementers.includes(verifier)) {
      throw new RelayError("an implementer of this task cannot record passing evidence");
    }
    const cell = (v) => String(v === true || v === undefined ? "—" : v).replace(/\|/g, "/").replace(/\n/g, " ");
    const row = `| ${ac} | ${cell(opts.how)} | ${cell(result)} | ${cell(opts.where)} | ${cell(opts.commit)} | ${verifier} |`;
    const lines = card.body.split("\n");
    const start = lines.findIndex((l) => l.trim() === "## 证据");
    let end = lines.findIndex((l, i) => i > start && l.startsWith("## "));
    if (end < 0) end = lines.length;
    let insertAt = end;
    while (insertAt > start + 1 && lines[insertAt - 1].trim() === "") insertAt -= 1;
    lines.splice(insertAt, 0, row);
    card.body = lines.join("\n");
    appendLog(card, verifier, `证据 ${ac}：${result}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${id}): evidence ${ac}`, opts);
    return 0;
  },

  set(ctx, opts) {
    const [id, status] = opts._;
    need(id, "usage: set <id> <status> --owner <label> [--reason r] [--reviewed-by label]");
    if (!STATUSES.includes(status)) throw new RelayError(`status must be one of ${STATUSES.join(", ")}`);
    const card = loadCard(ctx, id);
    const f = card.fields;
    if (!(TRANSITIONS[f.status] ?? []).includes(status)) throw new RelayError(`${f.status} → ${status} is not allowed`);
    const who = opts.owner || f.owner;
    if (["blocked", "parked", "todo"].includes(status)) need(opts.reason, "--reason required");
    if (status === "done") {
      const reviewer = need(opts["reviewed-by"], "--reviewed-by required");
      if (f.implementers.includes(reviewer)) throw new RelayError("reviewer must not be an implementer of this task");
      // 在全量卡片集合上校验（depends_on 需要看到其他卡），再只保留属于本卡的错误
      const all = loadAll(ctx).map((c) => (c.fields.id === f.id ? { ...card, fields: { ...f, status: "done" } } : c));
      const problems = validateCards(all, ctx.config).filter((p) => p.level === "error" && p.id === f.id);
      if (problems.length) throw new RelayError(problems.map((p) => p.msg).join("; "));
    }
    const from = f.status;
    f.status = status;
    if (status === "todo" || status === "done" || status === "parked") f.lease_until = "";
    if (status === "todo") f.owner = "";
    appendLog(card, who, `${from} → ${status}${opts.reason && opts.reason !== true ? `：${opts.reason}` : ""}${opts["reviewed-by"] ? `（评审 ${opts["reviewed-by"]}）` : ""}`);
    saveCard(card);
    boardCommit(ctx, [card.file], `relay(${id}): ${status}`, opts);
    return 0;
  },

  status(ctx, opts) {
    writeStatus(ctx);
    if (opts.commit) boardCommit(ctx, [], "relay: refresh status board", opts);
    else console.log(`已更新 ${path.relative(ctx.main, ctx.statusFile)}`);
    return 0;
  },

  check(ctx) {
    const problems = validateCards(loadAll(ctx), ctx.config);
    const status = fs.existsSync(ctx.statusFile) ? fs.readFileSync(ctx.statusFile, "utf8").replace(/\r\n/g, "\n") : "";
    const board = renderBoard(loadAll(ctx));
    if (!status.includes(`${BOARD_START}\n${board}\n${BOARD_END}`)) {
      problems.push({ level: "warn", id: "STATUS", msg: "任务板过期：运行 node scripts/relay.mjs status" });
    }
    const agentSrc = path.join(ctx.main, "docs/relay/claude/agents");
    if (fs.existsSync(agentSrc)) {
      for (const name of fs.readdirSync(agentSrc)) {
        const installed = path.join(ctx.main, ".claude/agents", name);
        const same = fs.existsSync(installed) && fs.readFileSync(installed, "utf8") === fs.readFileSync(path.join(agentSrc, name), "utf8");
        if (!same) {
          problems.push({ level: "warn", id: "CLAUDE", msg: "Claude Code 子 agent 未安装或已过期：运行 node scripts/relay.mjs install-claude" });
          break;
        }
      }
    }
    for (const p of problems) console.log(`${p.level === "error" ? "ERROR" : "WARN "} ${p.id}: ${p.msg}`);
    const errors = problems.filter((p) => p.level === "error").length;
    console.log(errors ? `${errors} 个错误` : "任务卡校验通过");
    return errors ? 1 : 0;
  },

  guard(ctx, opts) {
    return printGuard(runGuard(ctx, opts), opts);
  },

  integrate(ctx, opts) {
    const card = loadCard(ctx, need(opts._[0], "usage: integrate <id> --reviewed-by <label>"));
    const reviewer = need(opts["reviewed-by"], "--reviewed-by required");
    if (card.fields.status !== "review") throw new RelayError("only tasks in review can be integrated");
    const wt = path.resolve(ctx.main, ctx.config.worktreeRoot, card.fields.id);
    if (fs.existsSync(wt)) {
      const result = runGuard({ ...ctx, top: wt, branch: card.fields.branch }, { task: card.fields.id });
      if (printGuard(result, {}) !== 0) return 1;
      const dirty = git(["status", "--porcelain"], { cwd: wt }).trim();
      if (dirty) throw new RelayError(`worktree ${wt} has uncommitted changes`);
    }
    git(["merge", "--no-ff", "-m", `merge ${card.fields.branch}: ${card.fields.title}`, card.fields.branch], { cwd: ctx.main });
    return commands.set(ctx, { ...opts, _: [card.fields.id, "done"], owner: reviewer });
  },

  lock(ctx, opts) {
    const name = need(opts._[0], "usage: lock <name> --owner <label> [--minutes 30] [--force]");
    const owner = need(opts.owner, "--owner required");
    const dir = path.join(ctx.commonDir, "relay", "locks");
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${name}.json`);
    if (fs.existsSync(file) && !opts.force) {
      const held = JSON.parse(fs.readFileSync(file, "utf8"));
      if (new Date(held.until) > now() && held.owner !== owner) throw new RelayError(`${name} held by ${held.owner} until ${held.until}`);
    }
    const until = isoMinute(new Date(now().getTime() + Number(opts.minutes || 30) * 60_000));
    fs.writeFileSync(file, JSON.stringify({ owner, until }));
    console.log(`锁 ${name} → ${owner} 至 ${until}`);
    return 0;
  },

  unlock(ctx, opts) {
    const name = need(opts._[0], "usage: unlock <name>");
    const file = path.join(ctx.commonDir, "relay", "locks", `${name}.json`);
    if (fs.existsSync(file)) fs.unlinkSync(file);
    console.log(`已释放 ${name}`);
    return 0;
  },

  locks(ctx) {
    const dir = path.join(ctx.commonDir, "relay", "locks");
    const files = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (!files.length) console.log("（无锁）");
    for (const file of files) {
      const held = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
      console.log(`${path.basename(file, ".json")}: ${held.owner} 至 ${held.until}${new Date(held.until) < now() ? "（已过期）" : ""}`);
    }
    return 0;
  },

  "install-claude"(ctx) {
    const src = path.join(ctx.main, "docs/relay/claude");
    const dest = path.join(ctx.main, ".claude");
    const copyDir = (from, to) => {
      fs.mkdirSync(to, { recursive: true });
      for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, entry.name);
        const b = path.join(to, entry.name);
        if (entry.isDirectory()) copyDir(a, b);
        else fs.copyFileSync(a, b);
      }
    };
    copyDir(path.join(src, "agents"), path.join(dest, "agents"));
    copyDir(path.join(src, "skills"), path.join(dest, "skills"));
    const wanted = JSON.parse(fs.readFileSync(path.join(src, "settings.json"), "utf8"));
    const settingsPath = path.join(dest, "settings.json");
    const current = fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {};
    current.permissions ??= {};
    current.permissions.deny = [...new Set([...(current.permissions.deny ?? []), ...wanted.permissions.deny])];
    fs.writeFileSync(settingsPath, JSON.stringify(current, null, 2) + "\n");
    console.log(`已安装 Claude Code 子 agent、/relay 技能与权限规则到 ${dest}（.claude/ 不进 git，源文件在 docs/relay/claude/）`);
    return 0;
  },

  "install-hooks"(ctx) {
    const current = git(["config", "--get", "core.hooksPath"], { cwd: ctx.main, allowFail: true })?.trim();
    if (current && current !== ".githooks") throw new RelayError(`core.hooksPath already set to ${current}`);
    git(["config", "core.hooksPath", ".githooks"], { cwd: ctx.main });
    console.log("core.hooksPath = .githooks（pre-commit 运行 relay guard --staged）。撤销：git config --unset core.hooksPath");
    return 0;
  },

  help() {
    console.log(`用法：node scripts/relay.mjs <命令>
  list [--status s] [--epic E]        列出任务卡
  next                                推荐可领取的任务
  show <id>                           显示任务卡
  new --title t --epic E [--priority P2] [--slug s]
  freeze <id>                         冻结验收标准（规划者）
  amend <id> --reason r --approved-by who   修订已冻结的验收标准
  scope <id> [--add g1,g2] [--remove g] --reason r --approved-by who   调整 files_allowed
  claim <id> --owner tool:model:role [--hours 3] [--takeover]
  renew <id> [--hours 3]              续租
  start <id>                          创建/进入任务 worktree 与分支
  log <id> "消息" [--owner label]     追加交接日志
  evidence <id> --ac A1 --result 通过|失败|未运行 --how cmd --where path --commit sha --owner verifier
  set <id> <status> [--reason r] [--reviewed-by label]
  integrate <id> --reviewed-by label  评审通过后合入集成分支并标记 done
  status [--commit]                   重新生成 STATUS.md 任务板
  check                               校验全部任务卡
  guard [--base ref|--staged] [--task id] [--json]   诚信守卫
  lock <name> --owner l [--minutes 30] / unlock <name> / locks
  install-hooks                       启用 .githooks/pre-commit
  install-claude                      把 docs/relay/claude/ 安装到 .claude/（子 agent、/relay、权限）
通用：--no-commit 只改文件不提交`);
    return 0;
  },
};

export function main(argv) {
  const [command = "help", ...rest] = argv;
  const opts = parseArgs(rest);
  const handler = commands[command];
  if (!handler) {
    console.error(`未知命令 ${command}`);
    commands.help();
    return 2;
  }
  try {
    return handler(command === "help" ? null : context(), opts);
  } catch (error) {
    if (error instanceof RelayError) {
      console.error(`relay: ${error.message}`);
      return 1;
    }
    throw error;
  }
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) process.exitCode = main(process.argv.slice(2));
