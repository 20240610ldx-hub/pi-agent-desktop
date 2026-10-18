import { execFile } from "child_process";
import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { getAllowedFileRoots, isExistingFilePathAllowed, isFilePathAllowed } from "./file-access";
import { hasParentDirectorySegment, isPathWithinRoots, resolveRealRoots } from "./path-security";
import { isWindowsAbsolutePath, toNativePath } from "./paths";
import type {
  GitReviewCommit,
  GitReviewFile,
  GitReviewFileStatus,
  GitReviewOptions,
  GitReviewPatch,
  GitReviewRef,
  GitReviewResponse,
  GitReviewScope,
  GitReviewSnapshot,
} from "./git-review-types";

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 10_000;
const METADATA_BYTES = 8 * 1024 * 1024;
export const GIT_REVIEW_PATCH_BYTES = 1024 * 1024;
export const GIT_REVIEW_COMMIT_LIMIT = 100;
const REF_LIMIT = 200;
const FILE_LIMIT = 2_000;
const PATH_LIMIT = 100_000;
const CONTROL = /[\x00-\x1f\x7f]/;
const OID = /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/;

export class GitReviewError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GitReviewError";
  }
}

class GitCommandError extends Error {
  constructor(public readonly code: string | number | undefined) {
    super("Git command failed");
  }
}

interface Repository {
  root: string;
  roots: Set<string>;
  realRoots: Set<string>;
  config: string[];
  privateRoots: Set<string>;
  indexPath: string;
}

interface Comparison {
  repository: Repository;
  scope: GitReviewScope;
  headOid: string;
  baseRef: string | null;
  baseOid: string;
  targetOid: string | null;
  ignoreWhitespace: boolean;
}

interface Entry extends GitReviewFile {
  oldMode?: string;
  newMode?: string;
}

interface AuthorizedPath {
  absolute: string;
  real: string | null;
  stat: fs.BigIntStats | null;
}

interface Metadata {
  entries: Entry[];
  paths: Map<string, AuthorizedPath>;
  comparisonId: string;
  large: boolean;
  truncated: boolean;
}

interface CachedMetadata {
  metadata: Metadata;
  indexSignature: string;
  expiresAt: number;
}

declare global {
  var __piGitReviewMetadata: Map<string, CachedMetadata> | undefined;
}

const CACHE_MS = 30_000;

function statSignature(stat: fs.BigIntStats | null): string {
  return stat ? [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String).join(":") : "missing";
}

function indexSignature(repository: Repository): string {
  try {
    return statSignature(fs.lstatSync(repository.indexPath, { bigint: true }));
  } catch {
    return "missing";
  }
}

function comparisonKey(comparison: Comparison): string {
  return JSON.stringify([comparison.repository.root, comparison.scope, comparison.headOid, comparison.baseRef,
    comparison.baseOid, comparison.targetOid, comparison.ignoreWhitespace, comparison.repository.config]);
}

function cachedMetadata(comparison: Comparison, relative: string): Metadata | null {
  const cache = globalThis.__piGitReviewMetadata;
  const cached = cache?.get(comparisonKey(comparison));
  if (!cached || cached.expiresAt < Date.now()) return null;
  const entry = cached.metadata.entries.find((file) => file.path === relative);
  if (!entry) return null;
  if (!comparison.targetOid && indexSignature(comparison.repository) !== cached.indexSignature) return null;
  for (const name of [entry.path, ...(entry.oldPath ? [entry.oldPath] : [])]) {
    const current = authorizePath(comparison.repository, name);
    const prior = cached.metadata.paths.get(name);
    if (!comparison.targetOid && (!prior || statSignature(prior.stat) !== statSignature(current.stat)
      || prior.real !== current.real)) return null;
  }
  return cached.metadata;
}

function rememberMetadata(comparison: Comparison, metadata: Metadata): void {
  const cache = globalThis.__piGitReviewMetadata ??= new Map();
  const key = comparisonKey(comparison);
  cache.delete(key);
  for (const [entryKey, value] of cache) if (value.expiresAt < Date.now()) cache.delete(entryKey);
  while (cache.size >= 8) cache.delete(cache.keys().next().value!);
  cache.set(key, { metadata, indexSignature: indexSignature(comparison.repository), expiresAt: Date.now() + CACHE_MS });
}

function gitEnvironment(): NodeJS.ProcessEnv {
  // A parent process's GIT_DIR / index / object overrides must not redirect cwd.
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  return { ...env, NODE_ENV: process.env.NODE_ENV, LC_ALL: "C", GIT_LITERAL_PATHSPECS: "1", GIT_OPTIONAL_LOCKS: "0", GIT_TERMINAL_PROMPT: "0", GIT_NO_LAZY_FETCH: "1" };
}

async function git(cwd: string, args: string[], config: string[] = [], maxBuffer = METADATA_BYTES): Promise<string> {
  try {
    const { stdout } = await execFileAsync("git", [
      "--no-pager", "--no-replace-objects", "-C", cwd,
      "-c", "core.fsmonitor=false", "-c", "core.untrackedCache=false",
      "-c", "core.quotePath=false", "-c", "color.ui=false",
      ...config, ...args,
    ], { env: gitEnvironment(), timeout: TIMEOUT_MS, maxBuffer, encoding: "utf8", windowsHide: true });
    return stdout;
  } catch (error) {
    const failure = error as { code?: string | number; killed?: boolean; signal?: string };
    if (failure.code === "ERR_CHILD_PROCESS_STDIO_MAXBUFFER") {
      throw new GitReviewError(413, "Git review exceeds the output limit");
    }
    if (failure.killed || failure.signal === "SIGTERM") throw new GitReviewError(504, "Git review timed out");
    if (failure.code === "ENOENT") throw new GitReviewError(503, "Git is not installed");
    throw new GitCommandError(failure.code);
  }
}

async function repositoryGit(repository: Repository, args: string[], maxBuffer?: number): Promise<string> {
  return git(repository.root, args, repository.config, maxBuffer);
}

function validateOptions(options: GitReviewOptions): void {
  if (typeof options.cwd !== "string" || !options.cwd || CONTROL.test(options.cwd)
    || (!path.isAbsolute(options.cwd) && !isWindowsAbsolutePath(options.cwd))) {
    throw new GitReviewError(400, "cwd must be an absolute path");
  }
  if (hasParentDirectorySegment(options.cwd)) throw new GitReviewError(403, "Access denied");
  if (options.scope !== undefined && !["all", "uncommitted", "commit"].includes(options.scope)) {
    throw new GitReviewError(400, "Invalid review scope");
  }
  if (options.context !== undefined && ![3, 20, "all"].includes(options.context)) {
    throw new GitReviewError(400, "context must be 3, 20, or all");
  }
  if (options.base !== undefined && (CONTROL.test(options.base)
    || !/^refs\/(?:heads|remotes)\/[^\s~^:?*\[\\]+$/.test(options.base)
    || options.base.includes("..") || options.base.includes("@{")
    || options.base.split("/").some((part) => !part || part.startsWith("-") || part.startsWith(".") || part.endsWith(".") || part.endsWith(".lock")))) {
    throw new GitReviewError(400, "base must be a full local or remote ref");
  }
  if (options.commit !== undefined && !OID.test(options.commit)) {
    throw new GitReviewError(400, "commit must be a full commit object ID");
  }
  if (options.scope === "commit" && !options.commit) throw new GitReviewError(400, "commit is required for commit scope");
  if (options.path !== undefined) validateRepoPath(options.path);
}

function validateRepoPath(relative: string): void {
  const parts = relative.split(process.platform === "win32" ? /[\\/]/ : "/");
  if (!relative || CONTROL.test(relative) || path.isAbsolute(relative) || isWindowsAbsolutePath(relative)
    || /^[a-zA-Z]:/.test(relative) || (process.platform === "win32" && /[\\:]/.test(relative))
    || parts.some((part) => !part || part === "." || part === ".." || /^\.git[. ]*$/i.test(part))) {
    throw new GitReviewError(400, "path must be a repository-relative file path outside .git");
  }
}

async function openRepository(cwd: string): Promise<Repository> {
  const roots = await getAllowedFileRoots();
  if (!isFilePathAllowed(cwd, roots)) throw new GitReviewError(403, "Access denied");
  let stat: fs.Stats;
  try {
    stat = fs.statSync(cwd);
  } catch {
    throw new GitReviewError(404, "Directory not found");
  }
  if (!stat.isDirectory()) throw new GitReviewError(400, "cwd must be a directory");
  if (!isExistingFilePathAllowed(cwd, roots)) throw new GitReviewError(403, "Access denied");
  let root: string;
  try {
    if ((await git(cwd, ["rev-parse", "--is-bare-repository"])).trim() === "true") {
      throw new GitReviewError(422, "Bare repositories are not supported");
    }
    root = toNativePath((await git(cwd, ["rev-parse", "--show-toplevel"])).trim());
  } catch (error) {
    if (error instanceof GitReviewError) throw error;
    throw new GitReviewError(422, "cwd is not a Git working tree");
  }
  if (!root || !isFilePathAllowed(root, roots) || !isExistingFilePathAllowed(root, roots)) {
    throw new GitReviewError(403, "Repository root is outside the allowed directories");
  }
  root = fs.realpathSync(root);
  // Only Git supplies these internal paths. Request paths are never translated
  // into object/index reads; keep the worktree metadata directories off limits.
  const internalPaths = (await git(root, ["rev-parse", "--path-format=absolute", "--git-dir", "--git-common-dir", "--git-path", "index"]))
    .trim().split(/\r?\n/).map(toNativePath);
  if (internalPaths.length !== 3 || internalPaths.some((name) => !path.isAbsolute(name))) {
    throw new GitReviewError(422, "Unsupported Git repository layout");
  }
  const privateRoots = resolveRealRoots(new Set(internalPaths.slice(0, 2)));
  const config: string[] = [];
  // --no-ext-diff and --no-textconv do not disable clean/process filters. Git
  // normally runs these while hashing changed worktree files, even for numstat.
  let filterKeys = "";
  try {
    filterKeys = await git(root, ["config", "--null", "--name-only", "--get-regexp", "^filter\\..*\\.(clean|smudge|process|required)$"]);
  } catch (error) {
    if (!(error instanceof GitCommandError && error.code === 1)) throw error;
  }
  const drivers = new Set<string>();
  for (const key of filterKeys.split("\0").filter(Boolean)) {
    if (CONTROL.test(key) || key.includes("=")) throw new GitReviewError(422, "Unsupported Git filter configuration");
    drivers.add(key.replace(/\.(?:clean|smudge|process|required)$/, ""));
  }
  for (const driver of drivers) {
    for (const kind of ["clean", "smudge", "process"]) config.push("-c", `${driver}.${kind}=`);
    config.push("-c", `${driver}.required=false`);
  }
  return { root, roots, realRoots: resolveRealRoots(roots), config, privateRoots, indexPath: internalPaths[2] };
}

async function resolveCommit(repository: Repository, revision: string, message: string): Promise<string> {
  try {
    const oid = (await repositoryGit(repository, ["rev-parse", "--verify", "--end-of-options", `${revision}^{commit}`])).trim();
    if (!OID.test(oid)) throw new GitCommandError(undefined);
    return oid;
  } catch (error) {
    if (error instanceof GitReviewError) throw error;
    throw new GitReviewError(404, message);
  }
}

async function chooseBase(repository: Repository, explicit?: string): Promise<{ name: string; oid: string }> {
  const names = explicit ? [explicit] : ["refs/remotes/origin/main", "refs/heads/main", "refs/heads/master"];
  for (const name of names) {
    try {
      return { name, oid: await resolveCommit(repository, name, "Base ref does not resolve to a commit") };
    } catch (error) {
      if (!(error instanceof GitReviewError && error.status === 404)) throw error;
    }
  }
  if (explicit) throw new GitReviewError(404, "Base ref does not resolve to a commit");
  // A repository with only a custom branch still needs a usable snapshot/refs
  // picker. Without a conventional base, show its uncommitted changes first.
  let current = "";
  try {
    current = (await repositoryGit(repository, ["symbolic-ref", "--quiet", "HEAD"])).trim();
  } catch (error) {
    if (!(error instanceof GitCommandError && error.code === 1)) throw error;
  }
  return { name: current || "HEAD", oid: await resolveCommit(repository, "HEAD", "Repository has no commits") };
}

async function resolveComparison(options: GitReviewOptions, repository: Repository): Promise<Comparison> {
  let headOid: string;
  try {
    headOid = await resolveCommit(repository, "HEAD", "Repository has no commits");
  } catch (error) {
    if (error instanceof GitReviewError && error.status === 404) throw new GitReviewError(409, "Repository has no commits");
    throw error;
  }
  const scope = options.scope ?? "all";
  const common = { repository, scope, headOid, ignoreWhitespace: options.ignoreWhitespace === true };
  if (scope === "uncommitted") return { ...common, baseRef: null, baseOid: headOid, targetOid: null };
  if (scope === "commit") {
    const targetOid = await resolveCommit(repository, options.commit!, "Selected commit was not found");
    if (targetOid.toLowerCase() !== options.commit!.toLowerCase()) throw new GitReviewError(400, "commit must identify a commit object");
    const ancestry = (await repositoryGit(repository, ["rev-list", "--parents", "--max-count=1", targetOid, "--"])).trim().split(" ");
    // Hashing the empty tree locally avoids writing an object (also supports SHA-256 repositories).
    const emptyTree = createHash(headOid.length === 64 ? "sha256" : "sha1").update("tree 0\0").digest("hex");
    return { ...common, baseRef: null, baseOid: ancestry[1] ?? emptyTree, targetOid };
  }
  const base = await chooseBase(repository, options.base);
  let baseOid: string;
  try {
    baseOid = (await repositoryGit(repository, ["merge-base", base.oid, headOid])).trim();
  } catch (error) {
    if (error instanceof GitReviewError) throw error;
    throw new GitReviewError(422, "The selected base and HEAD have no common ancestor");
  }
  if (!OID.test(baseOid)) throw new GitReviewError(422, "Could not resolve a merge base");
  return { ...common, baseRef: base.name, baseOid, targetOid: null };
}

/** Authorize the leaf, or its nearest existing ancestor for deleted paths. */
function authorizePath(repository: Repository, relative: string): AuthorizedPath {
  validateRepoPath(relative);
  const absolute = path.join(repository.root, relative);
  // Check every directory component; a link to an allowed target must not hide
  // an earlier traversal through an unauthorized junction.
  const parts = relative.split("/");
  for (let i = 1; i < parts.length; i++) {
    const prefix = path.join(repository.root, ...parts.slice(0, i));
    try {
      fs.lstatSync(prefix);
    } catch (error) {
      if (["ENOENT", "ENOTDIR"].includes((error as NodeJS.ErrnoException).code ?? "")) break;
      throw new GitReviewError(403, "Cannot authorize review directory");
    }
    let realPrefix: string;
    try {
      realPrefix = fs.realpathSync(prefix);
    } catch {
      throw new GitReviewError(403, "Review directory has an inaccessible link target");
    }
    if (!isPathWithinRoots(realPrefix, repository.realRoots) || isPathWithinRoots(realPrefix, repository.privateRoots)
      || realPrefix.split(path.sep).some((part) => /^\.git[. ]*$/i.test(part))) {
      throw new GitReviewError(403, "Review directory resolves outside the allowed directories or into .git");
    }
  }
  if (!isPathWithinRoots(absolute, new Set([repository.root])) || !isFilePathAllowed(absolute, repository.roots)) {
    throw new GitReviewError(403, "Review file is outside the allowed directories");
  }
  let ancestor = absolute;
  let stat: fs.BigIntStats | null = null;
  while (true) {
    try {
      const current = fs.lstatSync(ancestor, { bigint: true });
      if (ancestor === absolute) stat = current;
      break;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT" && code !== "ENOTDIR") throw new GitReviewError(403, "Cannot access review file");
      const parent = path.dirname(ancestor);
      if (parent === ancestor) throw new GitReviewError(403, "Cannot authorize review file");
      ancestor = parent;
    }
  }
  let real: string;
  try {
    real = fs.realpathSync(ancestor);
  } catch {
    throw new GitReviewError(403, "Review file has an inaccessible link target");
  }
  if (!isPathWithinRoots(real, repository.realRoots)) throw new GitReviewError(403, "Review file resolves outside the allowed directories");
  if (isPathWithinRoots(real, repository.privateRoots) || real.split(path.sep).some((part) => /^\.git[. ]*$/i.test(part))) {
    throw new GitReviewError(403, "Review files cannot resolve into Git metadata");
  }
  return { absolute, real: ancestor === absolute ? real : null, stat };
}

function diffArgs(comparison: Comparison): string[] {
  return ["diff", "--no-color", "--no-ext-diff", "--no-textconv", "--no-abbrev",
    "--find-renames=50%", "--find-copies", "-l1000", "--submodule=short", "--ignore-submodules=dirty",
    "--diff-algorithm=myers", ...(comparison.ignoreWhitespace ? ["--ignore-all-space"] : [])];
}

function revisions(comparison: Comparison): string[] {
  return [comparison.baseOid, ...(comparison.targetOid ? [comparison.targetOid] : [])];
}

function parseDiffMetadata(output: string): Entry[] {
  const records = output.split("\0");
  const entries = new Map<string, Entry>();
  const statuses: Record<string, GitReviewFileStatus> = {
    A: "added", M: "modified", D: "deleted", R: "renamed", C: "copied", U: "conflict", T: "typechange",
  };
  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    if (!record) continue;
    if (record.startsWith(":")) {
      const match = /^:(\d{6}) (\d{6}) [a-f0-9]+ [a-f0-9]+ ([A-Z])\d*$/.exec(record);
      if (!match) throw new GitReviewError(422, "Unsupported Git diff metadata");
      const firstPath = records[++i];
      const renamed = match[3] === "R" || match[3] === "C";
      const filePath = renamed ? records[++i] : firstPath;
      if (!filePath || !statuses[match[3]]) throw new GitReviewError(422, "Unsupported Git diff entry");
      const previous = entries.get(filePath);
      entries.set(filePath, {
        path: filePath, ...(renamed ? { oldPath: firstPath } : {}),
        status: previous?.status === "conflict" ? "conflict" : statuses[match[3]],
        additions: 0, deletions: 0, oldMode: match[1], newMode: match[2],
      });
    } else {
      const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(record);
      if (!match) throw new GitReviewError(422, "Unsupported Git line statistics");
      let filePath = match[3];
      if (!filePath) {
        i++; // numstat rename's old path; raw metadata already retained it.
        filePath = records[++i];
      }
      const entry = entries.get(filePath);
      if (!entry) throw new GitReviewError(422, "Git line statistics did not match file metadata");
      if (match[1] === "-" || match[2] === "-") entry.binary = true;
      else {
        entry.additions += Number(match[1]);
        entry.deletions += Number(match[2]);
      }
    }
  }
  return [...entries.values()];
}

function readBoundedFile(file: AuthorizedPath, maxBytes: number): Buffer | null {
  if (!file.stat?.isFile() || !file.real || file.stat.size > BigInt(maxBytes)) return null;
  const fd = fs.openSync(file.real, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW ?? 0));
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.size > maxBytes) return null;
    const buffer = Buffer.alloc(Math.min(stat.size + 1, maxBytes + 1));
    let length = 0;
    while (length < buffer.length) {
      const count = fs.readSync(fd, buffer, length, buffer.length - length, null);
      if (count === 0) break;
      length += count;
    }
    return length > maxBytes ? null : buffer.subarray(0, length);
  } finally {
    fs.closeSync(fd);
  }
}

function countLines(bytes: Buffer): number {
  if (!bytes.length) return 0;
  let lines = bytes[bytes.length - 1] === 10 ? 0 : 1;
  for (const byte of bytes) if (byte === 10) lines++;
  return lines;
}

async function readMetadata(comparison: Comparison): Promise<Metadata> {
  const repository = comparison.repository;
  // Enumerate paths without diffing worktree contents first. This also catches a
  // deleted source/rename source whose parent was replaced with an escaping link.
  const treePaths = async (oid: string) => (await repositoryGit(repository, ["ls-tree", "-r", "--name-only", "-z", oid])).split("\0").filter(Boolean);
  const [basePaths, targetPaths, indexOutput, untrackedOutput] = await Promise.all([
    treePaths(comparison.baseOid),
    comparison.targetOid ? treePaths(comparison.targetOid) : Promise.resolve([]),
    comparison.targetOid ? Promise.resolve("") : repositoryGit(repository, ["ls-files", "--stage", "-z"]),
    comparison.targetOid ? Promise.resolve("") : repositoryGit(repository, ["ls-files", "--others", "--exclude-standard", "-z"]),
  ]);
  const indexPaths: string[] = [];
  const conflicts = new Set<string>();
  for (const record of indexOutput.split("\0").filter(Boolean)) {
    const match = /^\d{6} [a-f0-9]+ ([0-3])\t([\s\S]*)$/.exec(record);
    if (!match) throw new GitReviewError(422, "Unsupported Git index entry");
    indexPaths.push(match[2]);
    if (match[1] !== "0") conflicts.add(match[2]);
  }
  const untracked = untrackedOutput.split("\0").filter(Boolean);
  const candidates = new Set([...basePaths, ...targetPaths, ...indexPaths, ...untracked]);
  if (candidates.size > PATH_LIMIT) throw new GitReviewError(413, "Repository has too many paths to review safely");
  const paths = new Map<string, AuthorizedPath>();
  const identity = createHash("sha256").update(JSON.stringify([
    repository.root, comparison.scope, comparison.headOid, comparison.baseRef, comparison.baseOid,
    comparison.targetOid, comparison.ignoreWhitespace,
  ])).update(indexOutput).update(untrackedOutput);
  for (const relative of [...candidates].sort()) {
    const file = authorizePath(repository, relative);
    paths.set(relative, file);
    if (!comparison.targetOid) {
      const stat = file.stat;
      identity.update(JSON.stringify([relative, stat ? [stat.dev, stat.ino, stat.mode, stat.size, stat.mtimeNs, stat.ctimeNs].map(String) : null]));
    }
  }
  const output = await repositoryGit(repository, [...diffArgs(comparison), "--raw", "--numstat", "-z", ...revisions(comparison), "--"]);
  identity.update(output);
  const entries = parseDiffMetadata(output);
  for (const entry of entries) {
    // Do not trust even git-produced paths, and recheck after Git's worktree read.
    paths.set(entry.path, authorizePath(repository, entry.path));
    if (entry.oldPath) paths.set(entry.oldPath, authorizePath(repository, entry.oldPath));
    if (conflicts.has(entry.path)) entry.status = "conflict";
  }
  let budget = METADATA_BYTES;
  let truncated = false;
  let large = entries.length > 200 || Buffer.byteLength(output) > GIT_REVIEW_PATCH_BYTES;
  for (const relative of untracked) {
    const file = paths.get(relative)!;
    const entry: Entry = { path: relative, status: "untracked", additions: 0, deletions: 0 };
    if (file.stat?.isFile()) {
      const bytes = readBoundedFile(file, budget);
      if (bytes === null) {
        large = true;
        truncated = true;
      } else {
        budget -= bytes.length;
        identity.update(bytes);
        if (bytes.includes(0)) entry.binary = true;
        else entry.additions = countLines(bytes);
      }
    }
    entries.push(entry);
  }
  entries.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  large ||= entries.length > 200 || entries.some((entry) => entry.additions + entry.deletions > 20_000
    || (paths.get(entry.path)?.stat?.size ?? BigInt(0)) > BigInt(GIT_REVIEW_PATCH_BYTES));
  return { entries, paths, comparisonId: identity.digest("hex"), large, truncated: truncated || entries.length > FILE_LIMIT };
}

async function readRefs(repository: Repository): Promise<{ refs: GitReviewRef[]; truncated: boolean }> {
  const output = await repositoryGit(repository, ["for-each-ref", `--count=${REF_LIMIT + 1}`, "--sort=refname",
    "--format=%(refname)%00%(objectname)%00%(objecttype)%00%(symref)", "refs/heads/", "refs/remotes/"]);
  const refs: GitReviewRef[] = [];
  for (const line of output.split("\n").filter(Boolean)) {
    const [name, oid, type, symbolic] = line.split("\0");
    if (type === "commit" && !symbolic && OID.test(oid)) refs.push({ name, oid });
  }
  const defaultName = ["refs/remotes/origin/main", "refs/heads/main", "refs/heads/master"].find((name) => refs.some((ref) => ref.name === name));
  return { refs: refs.slice(0, REF_LIMIT).map((ref) => ({ ...ref, ...(ref.name === defaultName ? { isDefault: true } : {}) })),
    truncated: output.split("\n").filter(Boolean).length > REF_LIMIT };
}

async function readCommits(repository: Repository, oid: string): Promise<{ commits: GitReviewCommit[]; truncated: boolean }> {
  const output = await repositoryGit(repository, ["log", `--max-count=${GIT_REVIEW_COMMIT_LIMIT + 1}`, "-z", "--no-show-signature",
    "--format=%H%x00%s%x00%an%x00%aI", oid, "--"]);
  const fields = output.split("\0");
  const commits: GitReviewCommit[] = [];
  for (let i = 0; i + 3 < fields.length; i += 4) {
    if (!OID.test(fields[i])) throw new GitReviewError(422, "Unsupported Git commit metadata");
    commits.push({ oid: fields[i], subject: fields[i + 1], authorName: fields[i + 2], authoredAt: fields[i + 3] });
  }
  return { commits: commits.slice(0, GIT_REVIEW_COMMIT_LIMIT), truncated: commits.length > GIT_REVIEW_COMMIT_LIMIT };
}

async function snapshot(comparison: Comparison, metadata: Metadata): Promise<GitReviewSnapshot> {
  const repository = comparison.repository;
  const [refs, commits, branch] = await Promise.all([
    readRefs(repository), readCommits(repository, comparison.targetOid ?? comparison.headOid),
    repositoryGit(repository, ["symbolic-ref", "--quiet", "--short", "HEAD"]).catch((error) => {
      if (error instanceof GitCommandError && error.code === 1) return "";
      throw error;
    }),
  ]);
  const files = metadata.entries.slice(0, FILE_LIMIT).map((entry): GitReviewFile => ({
    path: entry.path,
    ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
    status: entry.status,
    additions: entry.additions,
    deletions: entry.deletions,
    ...(entry.binary !== undefined ? { binary: entry.binary } : {}),
  }));
  const totals = metadata.entries.reduce((sum, file) => ({ additions: sum.additions + file.additions, deletions: sum.deletions + file.deletions }), { additions: 0, deletions: 0 });
  return {
    repoRoot: repository.root, currentBranch: branch.trim() || null, headOid: comparison.headOid,
    baseRef: comparison.baseRef, baseOid: comparison.baseOid, comparisonId: metadata.comparisonId,
    scope: comparison.scope, refs: refs.refs, commits: commits.commits, files, totals,
    large: metadata.large || metadata.entries.length > FILE_LIMIT,
    ...(metadata.truncated || refs.truncated || commits.truncated ? { truncated: true } : {}),
  };
}

function addedFilePatch(relative: string, bytes: Buffer): string {
  const quote = (name: string) => /["\\\t\n\r]/.test(name) ? JSON.stringify(name) : name;
  const oldName = quote(`a/${relative}`);
  const newName = quote(`b/${relative}`);
  const text = bytes.toString("utf8");
  const lines = text.split("\n");
  if (text.endsWith("\n")) lines.pop();
  return `diff --git ${oldName} ${newName}\nnew file mode 100644\n--- /dev/null\n+++ ${newName}\n@@ -0,0 +1,${lines.length} @@\n`
    + lines.map((line) => `+${line}\n`).join("") + (text.endsWith("\n") ? "" : "\\ No newline at end of file\n");
}

async function patch(comparison: Comparison, metadata: Metadata, options: GitReviewOptions): Promise<GitReviewPatch> {
  const entry = metadata.entries.find((file) => file.path === options.path);
  if (!entry) throw new GitReviewError(404, "File is not part of this comparison");
  const result: GitReviewPatch = {
    comparisonId: metadata.comparisonId, path: entry.path, ...(entry.oldPath ? { oldPath: entry.oldPath } : {}), patch: "", supported: false,
  };
  if (entry.binary) return { ...result, reason: "binary" };
  if (entry.oldMode === "160000" || entry.newMode === "160000") return { ...result, reason: "metadata-only" };
  const file = authorizePath(comparison.repository, entry.path);
  if (entry.oldPath) authorizePath(comparison.repository, entry.oldPath);
  if (file.stat?.isFile() && file.stat.size > BigInt(GIT_REVIEW_PATCH_BYTES)) {
    return { ...result, reason: "too-large", truncated: true };
  }
  let text: string;
  if (entry.status === "untracked") {
    const bytes = readBoundedFile(file, GIT_REVIEW_PATCH_BYTES);
    if (bytes === null) return { ...result, reason: file.stat?.isFile() ? "too-large" : "metadata-only", ...(file.stat?.isFile() ? { truncated: true } : {}) };
    if (bytes.includes(0)) return { ...result, reason: "binary" };
    if (!bytes.length) return { ...result, reason: "metadata-only" };
    text = addedFilePatch(entry.path, bytes);
  } else {
    try {
      text = await repositoryGit(comparison.repository, [...diffArgs(comparison),
        // A copy still needs its source path for detection, but that source may
        // also be modified. Emit only the copy, never its separate source diff.
        ...(entry.status === "copied" ? ["--diff-filter=C"] : []),
        "--src-prefix=a/", "--dst-prefix=b/", `--unified=${options.context === "all" ? 2147483647 : options.context ?? 3}`,
        ...revisions(comparison), "--", ...(entry.oldPath ? [entry.oldPath] : []), entry.path,
      ], GIT_REVIEW_PATCH_BYTES);
    } catch (error) {
      if (error instanceof GitReviewError && error.status === 413) return { ...result, reason: "too-large", truncated: true };
      throw error;
    }
  }
  if (Buffer.byteLength(text) > GIT_REVIEW_PATCH_BYTES) return { ...result, reason: "too-large", truncated: true };
  if (!/^@@ /m.test(text)) return { ...result, reason: "metadata-only" };
  return { ...result, patch: text, supported: true };
}

/** Read-only review; never checks out refs, refreshes the index, fetches, or runs hooks/filters. */
export async function getGitReview(options: GitReviewOptions): Promise<GitReviewResponse> {
  validateOptions(options);
  try {
    const repository = await openRepository(options.cwd);
    const comparison = await resolveComparison(options, repository);
    const metadata = (options.path === undefined ? null : cachedMetadata(comparison, options.path)) ?? await readMetadata(comparison);
    rememberMetadata(comparison, metadata);
    if (options.path === undefined) return await snapshot(comparison, metadata);
    const entry = metadata.entries.find((file) => file.path === options.path);
    const selectedPaths = entry ? [entry.path, ...(entry.oldPath ? [entry.oldPath] : [])] : [];
    const before = selectedPaths.map((relative) => authorizePath(repository, relative));
    if (!comparison.targetOid && selectedPaths.some((relative, index) => {
      const prior = metadata.paths.get(relative);
      return !prior || statSignature(prior.stat) !== statSignature(before[index].stat) || prior.real !== before[index].real;
    })) throw new GitReviewError(409, "Repository changed while reading metadata; refresh the review");
    const result = await patch(comparison, metadata, options);
    const after = selectedPaths.map((relative) => authorizePath(repository, relative));
    if (!comparison.targetOid && (after.some((file, index) => {
      return statSignature(file.stat) !== statSignature(before[index].stat) || file.real !== before[index].real;
    }) || indexSignature(repository) !== globalThis.__piGitReviewMetadata?.get(comparisonKey(comparison))?.indexSignature)) {
      throw new GitReviewError(409, "Repository changed while reading the patch; refresh the review");
    }
    return result;
  } catch (error) {
    if (error instanceof GitReviewError) throw error;
    throw new GitReviewError(500, "Git review could not read this repository");
  }
}
