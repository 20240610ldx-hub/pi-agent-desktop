// Windows native baseline harness: launches the already-built desktop dev shell, attaches to its
// WebView2 over a loopback-only CDP port, probes real top-level windows and DPI, and guarantees that
// only the process tree it started is touched and left clean. Used by e2e/native-baseline.mjs and by
// later native check cards (PIL-0200, PIL-0201, ...). Never compiles anything and never runs `next build`.
import { spawn, spawnSync, execFile } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

export const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));
export const PROBE_SCRIPT = fileURLToPath(new URL("./native-window-probe.ps1", import.meta.url));
export const DEFAULT_EXE = path.join(REPO_ROOT, "src-tauri", "target", "debug", "pi-agent-desktop.exe");
export const BUILD_HINT = "cargo build --manifest-path src-tauri/Cargo.toml --no-default-features";
export const DPI_LABELS = { dpi100: 100, dpi125: 125, dpi150: 150, dpi175: 175 };

export const EXIT = { ok: 0, failed: 1, prerequisite: 2, labelMismatch: 3, usage: 64 };

export class HarnessError extends Error {
  constructor(message, exitCode = EXIT.failed) {
    super(message);
    this.name = "HarnessError";
    this.exitCode = exitCode;
  }
}

/** Every native check id the baseline documents; `implemented` ones run in this harness. */
export const CHECKS = [
  { id: "N1", name: "WebView2 / Tauri launch and CDP attach", command: "launch", owner: "PIL-0111", auto: true, needsUser: false },
  { id: "N2", name: "Top-level window, chrome and DPI screenshot", command: "window", owner: "PIL-0111", auto: true, needsUser: "DPI switch" },
  { id: "N3", name: "Process tree and exit hygiene", command: "hygiene", owner: "PIL-0111", auto: true, needsUser: false },
  { id: "N4", name: "Changes standalone window", command: null, owner: "PIL-0200", auto: true, needsUser: false },
  { id: "N5", name: "Clipboard read-back", command: null, owner: "PIL-0201", auto: true, needsUser: false },
  { id: "N6", name: "External editor", command: null, owner: "PIL-0201", auto: true, needsUser: false },
  { id: "N7", name: "Tray menu driving", command: null, owner: "PIL-0201", auto: true, needsUser: "admin terminal (powercfg /requests)" },
  { id: "N8", name: "Native file dialogs", command: null, owner: "PIL-0167", auto: false, needsUser: true },
  { id: "N9", name: "System notification toast", command: null, owner: "PIL-0166", auto: false, needsUser: true },
];

// ---------------------------------------------------------------- arguments

export const USAGE = `Usage: node e2e/native-baseline.mjs --check launch|window|hygiene --base <http://127.0.0.1:port> --out <dir> [--label dpi100|dpi125|dpi150|dpi175]
       node e2e/native-baseline.mjs --list
Options: --exe <path> (default src-tauri/target/debug/pi-agent-desktop.exe), --cdp-timeout-ms <n> (default 60000)
Exit codes: 0 ok, 1 check failed, 2 prerequisite missing (exe / dev server), 3 DPI label mismatch, 64 bad arguments`;

export function parseDpiLabel(label) {
  if (!Object.hasOwn(DPI_LABELS, label)) {
    throw new HarnessError(`Unknown --label "${label}"; expected one of ${Object.keys(DPI_LABELS).join(", ")}`, EXIT.usage);
  }
  return DPI_LABELS[label];
}

/** A bare http://127.0.0.1:port origin, the same rule the Rust shell applies to `devUrl`. */
export function parseBaseOrigin(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new HarnessError(`--base must be a URL, got "${value}"`, EXIT.usage);
  }
  const bare = url.protocol === "http:" && url.hostname === "127.0.0.1" && url.port !== ""
    && !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash;
  if (!bare) throw new HarnessError(`--base must be a bare http://127.0.0.1:<port> origin, got "${value}"`, EXIT.usage);
  return url.origin;
}

export function parseArgs(argv) {
  const known = new Set(["--check", "--base", "--out", "--label", "--exe", "--cdp-timeout-ms", "--list", "--help"]);
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (!known.has(flag)) throw new HarnessError(`Unknown argument "${flag}"\n${USAGE}`, EXIT.usage);
    if (flag === "--list" || flag === "--help") {
      values[flag.slice(2)] = true;
      continue;
    }
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new HarnessError(`${flag} needs a value\n${USAGE}`, EXIT.usage);
    values[flag.slice(2)] = value;
    index += 1;
  }
  if (values.help) return { help: true };
  if (values.list) return { list: true };
  const commands = CHECKS.filter((check) => check.command).map((check) => check.command);
  if (!commands.includes(values.check)) throw new HarnessError(`--check must be one of ${commands.join(", ")}\n${USAGE}`, EXIT.usage);
  if (!values.base) throw new HarnessError(`--base is required\n${USAGE}`, EXIT.usage);
  if (!values.out) throw new HarnessError(`--out is required\n${USAGE}`, EXIT.usage);
  if (values.out.includes("\0")) throw new HarnessError("--out contains a NUL byte", EXIT.usage);
  const cdpTimeoutMs = values["cdp-timeout-ms"] === undefined ? 60000 : Number(values["cdp-timeout-ms"]);
  if (!Number.isInteger(cdpTimeoutMs) || cdpTimeoutMs < 500) throw new HarnessError("--cdp-timeout-ms must be an integer >= 500", EXIT.usage);
  return {
    check: values.check,
    base: parseBaseOrigin(values.base),
    out: path.resolve(values.out),
    labelPercent: values.label === undefined ? undefined : parseDpiLabel(values.label),
    label: values.label,
    exe: path.resolve(values.exe ?? DEFAULT_EXE),
    cdpTimeoutMs,
  };
}

export function formatCheckList() {
  return CHECKS.map((check) => `${check.id}\t${check.owner}\t${check.command ?? "-"}\t${check.name}`).join("\n");
}

// ---------------------------------------------------------------- processes

const execFileAsync = (file, args, options = {}) => new Promise((resolve, reject) => {
  execFile(file, args, { windowsHide: true, maxBuffer: 64 * 1024 * 1024, ...options }, (error, stdout, stderr) => {
    if (error) {
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    } else resolve({ stdout, stderr });
  });
});

// Toolhelp snapshot + GetProcessTimes through one tiny Add-Type: ~0.5 s per call against ~1.3 s for Get-CimInstance, which
// matters because cleanup is bounded to 5 s. It carries no command lines (those need WMI, see `commandLinesOf`).
const PROCESS_LIST_CS = String.raw`using System;using System.Runtime.InteropServices;using System.Text;
public static class PilProc{
[StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]public struct PE{public uint dwSize,cntUsage,th32ProcessID;public IntPtr th32DefaultHeapID;public uint th32ModuleID,cntThreads,th32ParentProcessID;public int pcPriClassBase;public uint dwFlags;[MarshalAs(UnmanagedType.ByValTStr,SizeConst=260)]public string szExeFile;}
[DllImport("kernel32.dll",SetLastError=true)]public static extern IntPtr CreateToolhelp32Snapshot(uint f,uint p);
[DllImport("kernel32.dll",CharSet=CharSet.Unicode)]public static extern bool Process32FirstW(IntPtr h,ref PE e);
[DllImport("kernel32.dll",CharSet=CharSet.Unicode)]public static extern bool Process32NextW(IntPtr h,ref PE e);
[DllImport("kernel32.dll")]public static extern bool CloseHandle(IntPtr h);
[DllImport("kernel32.dll")]public static extern IntPtr OpenProcess(uint a,bool i,uint pid);
[DllImport("kernel32.dll")]public static extern bool GetProcessTimes(IntPtr h,out long c,out long e,out long k,out long u);
public static string All(){
var sb=new StringBuilder();var h=CreateToolhelp32Snapshot(2,0);var e=new PE();e.dwSize=(uint)Marshal.SizeOf(typeof(PE));
if(Process32FirstW(h,ref e)){do{
string cr="";long c,x,k,u;IntPtr p=OpenProcess(0x1000,false,e.th32ProcessID);
if(p!=IntPtr.Zero){if(GetProcessTimes(p,out c,out x,out k,out u)&&c>0)cr=DateTime.FromFileTimeUtc(c).ToString("o");CloseHandle(p);}
sb.Append(e.th32ProcessID.ToString()+"\t"+e.th32ParentProcessID.ToString()+"\t"+cr+"\t"+e.szExeFile+"\n");
}while(Process32NextW(h,ref e));}
CloseHandle(h);return sb.ToString();}}`;
const PS_PREAMBLE = "$ProgressPreference='SilentlyContinue';$ErrorActionPreference='Stop';[Console]::OutputEncoding=[Text.Encoding]::UTF8;";
const encodedCommand = (script) => Buffer.from(script, "utf16le").toString("base64");
const PROCESS_LIST_ARGS = ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand(`${PS_PREAMBLE}Add-Type -TypeDefinition @'\n${PROCESS_LIST_CS}\n'@\n[Console]::Out.Write([PilProc]::All())`)];

/** Parses `pid<TAB>ppid<TAB>created<TAB>name` lines from the snapshot script. `cmd` is null: command lines are fetched only on demand. */
export function parseProcessList(stdout) {
  const rows = [];
  for (const line of String(stdout).split(/\r?\n/)) {
    if (!line) continue;
    const [pid, ppid, created, ...name] = line.split("\t");
    if (!/^\d+$/.test(pid) || !/^\d+$/.test(ppid ?? "")) continue;
    rows.push({ pid: Number(pid), ppid: Number(ppid), name: name.join("\t"), created, cmd: null });
  }
  return rows;
}

/** All processes as `{ pid, ppid, name, created, cmd: null }`; reports drop everything but pid/ppid/name/created. */
export async function listProcesses() {
  const { stdout } = await execFileAsync("powershell.exe", PROCESS_LIST_ARGS);
  const rows = parseProcessList(stdout);
  if (rows.length === 0) throw new HarnessError("process snapshot returned no rows");
  return rows;
}

/** Command lines (WMI, ~1 s) of just these processes, as Map pid -> { created, cmd }. */
export async function commandLinesOf(pids) {
  if (pids.length === 0) return new Map();
  const filter = pids.map((pid) => `ProcessId=${Number(pid)}`).join(" OR ");
  const script = `${PS_PREAMBLE}Get-CimInstance Win32_Process -Filter '${filter}' -Property ProcessId,CreationDate,CommandLine | ForEach-Object { '{0}\t{1}\t{2}' -f $_.ProcessId, $(if ($_.CreationDate) { $_.CreationDate.ToUniversalTime().ToString('o') } else { '' }), ($_.CommandLine -replace '[\r\n\t]+', ' ') }`;
  const { stdout } = await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-EncodedCommand", encodedCommand(script)]);
  const found = new Map();
  for (const line of stdout.split(/\r?\n/)) {
    const [pid, created, ...cmd] = line.split("\t");
    if (/^\d+$/.test(pid)) found.set(Number(pid), { created, cmd: cmd.join("\t") });
  }
  return found;
}

export const processKey = (processInfo) => `${processInfo.pid}@${processInfo.created}`;
export const isPilaudeOrWebView = (name) => /^(pi-agent-desktop|pilaude)(\.exe)?$/i.test(name) || /^msedgewebview2(\.exe)?$/i.test(name);
export const publicProcess = ({ pid, ppid, name, created }) => ({ pid, ppid, name, created });

/** Creation time in ms from the probe's 7-digit ISO form or JS's 3-digit one; NaN when unknown. */
export function createdMs(value) {
  const match = /^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d)(?:\.(\d+))?Z$/.exec(String(value ?? ""));
  if (!match) return Number.NaN;
  return Date.parse(`${match[1]}Z`) + Number(`0.${match[2] ?? "0"}`) * 1000;
}

/**
 * `rootPid` and every descendant in one snapshot. Parent links alone are not enough because Windows
 * reuses pids: a child must also be created no earlier than its parent (and, for the root's own
 * children, no earlier than `notBefore`), and the root itself must be the process we started
 * (`rootCreated` / `notBefore`), otherwise a recycled pid would pull in unrelated trees.
 */
export function descendantsOf(rootPid, processes, { notBefore, rootCreated } = {}) {
  const root = processes.find((item) => item.pid === rootPid);
  if (rootPid == null || (rootCreated && !root)) return []; // a root we saw alive that is gone: its pid may be recycled
  if (root) {
    if (rootCreated && root.created !== rootCreated) return [];
    if (notBefore !== undefined && createdMs(root.created) < notBefore) return [];
  }
  const children = new Map();
  for (const item of processes) {
    if (!children.has(item.ppid)) children.set(item.ppid, []);
    children.get(item.ppid).push(item);
  }
  const found = new Map();
  const queue = [{ pid: rootPid, bound: root ? createdMs(root.created) : (notBefore ?? Number.NaN) }];
  while (queue.length) {
    const { pid, bound } = queue.shift();
    for (const child of children.get(pid) ?? []) {
      if (found.has(child.pid) || child.pid === rootPid) continue;
      const created = createdMs(child.created);
      if (created < bound) continue; // started before its supposed parent: a recycled ppid
      found.set(child.pid, child);
      queue.push({ pid: child.pid, bound: created });
    }
  }
  return [...(root ? [root] : []), ...found.values()];
}

/**
 * Processes this run owns: the root's tree plus any process whose command line carries our unique
 * WebView2 profile folder (re-parented or orphaned WebView2 children). Anything in `preexisting`
 * (the key of every process that existed before the run, whatever its name) is never owned.
 */
export function ownedProcesses({ rootPid, profileDir, processes, preexisting, notBefore, rootCreated }) {
  const owned = new Map();
  for (const item of descendantsOf(rootPid, processes, { notBefore, rootCreated })) owned.set(processKey(item), item);
  if (profileDir) {
    const marker = profileDir.toLowerCase();
    for (const item of processes) {
      if (/^msedgewebview2(\.exe)?$/i.test(item.name) && (item.cmd ?? "").toLowerCase().includes(marker)) owned.set(processKey(item), item);
    }
  }
  for (const key of preexisting) owned.delete(key);
  return [...owned.values()];
}

/** No `/T`: taskkill would expand the tree by ppid on its own, bypassing the pid+creation-time checks done here. */
export const taskkillArgs = (...pids) => [...pids.flatMap((pid) => ["/PID", String(pid)]), "/F"];

/** One taskkill process for all pids, in the order given (it works through them in that order and keeps going after a failure). */
export async function taskkillPids(pids) {
  if (pids.length === 0) return false;
  try {
    await execFileAsync("taskkill.exe", taskkillArgs(...pids));
    return true;
  } catch (error) {
    // 128 = some process was already gone; anything else (e.g. access denied) is a real failure.
    if (error.code === 128) return false;
    throw new HarnessError(`taskkill failed for ${pids.join(",")}: ${String(error.stderr || error.message).trim()}`);
  }
}

const isWebView = (item) => /^msedgewebview2(\.exe)?$/i.test(item.name);

/**
 * Kill only what this run owns, then verify nothing of it survives within `graceMs`.
 * `known` holds the rows (pid + creation time) seen alive while the root was still running; they are the
 * only roots the tree is expanded from, so a pid the OS recycled after the app exited is never treated as ours.
 * One snapshot decides the kill set; pids are then killed by number (no `/T`), children before parents, each key at most
 * once: all in one `killMany` call (default: a single taskkill), or, when a per-pid `kill` is injected, one depth level at a time. A second snapshot confirms; it only loops again for
 * processes that were not killed yet (e.g. spawned in between) until `graceMs` runs out.
 * `preexisting` is a Set of process keys that existed before the run; they are never killed.
 * `isGone(row)` marks a row whose process is known to have exited already (its pid may be recycled): never killed.
 * A failing kill is recorded in `errors` and does not stop the rest of the cleanup.
 * `timings` (ms) lists every snapshot, kill batch and command-line lookup, for the evidence log.
 */
export async function cleanupOwned({
  known = [], profileDir, preexisting, list = listProcesses, commandLines = commandLinesOf, kill, killMany = taskkillPids, isGone = () => false, graceMs = 5000, pollMs = 250,
}) {
  const started = Date.now();
  const timings = { snapshotsMs: [], killsMs: [], commandLinesMs: [], totalMs: 0 };
  const ownedKeys = new Map();
  const killedKeys = new Set();
  const lookedUp = new Set();
  const killed = [];
  const errors = [];
  const deadline = started + graceMs;
  const timed = async (bucket, fn) => {
    const t0 = Date.now();
    try { return await fn(); } finally { bucket.push(Date.now() - t0); }
  };
  for (const item of known) if (!preexisting.has(processKey(item))) ownedKeys.set(processKey(item), item);
  for (let round = 0; ; round += 1) {
    if (round > 1) await delay(pollMs); // round 1 is the confirmation; its own snapshot already takes a while
    let processes = await timed(timings.snapshotsMs, list);
    const present = new Set(processes.map(processKey));
    for (const row of [...ownedKeys.values()]) {
      if (!present.has(processKey(row))) continue;
      for (const item of ownedProcesses({ rootPid: row.pid, rootCreated: row.created, processes, preexisting })) ownedKeys.set(processKey(item), item);
    }
    if (profileDir) {
      // Orphaned WebView2 helpers are recognised by our profile folder in their command line: fetch it only for
      // WebView2 processes that are neither ours yet nor older than the run, once each.
      const candidates = processes.filter((item) => isWebView(item) && item.cmd == null && !preexisting.has(processKey(item)) && !ownedKeys.has(processKey(item)) && !lookedUp.has(processKey(item)));
      if (candidates.length) {
        for (const item of candidates) lookedUp.add(processKey(item));
        const lines = await timed(timings.commandLinesMs, () => commandLines(candidates.map((item) => item.pid))).catch((error) => { errors.push(`command lines: ${error.message}`); return new Map(); });
        processes = processes.map((item) => {
          const line = lines.get(item.pid);
          // The lookup ran after the snapshot: accept it only for the same process (creation time within 5 ms).
          return line && item.cmd == null && Math.abs(createdMs(line.created) - createdMs(item.created)) < 5 ? { ...item, cmd: line.cmd } : item;
        });
      }
      for (const item of ownedProcesses({ profileDir, processes, preexisting })) ownedKeys.set(processKey(item), item);
    }
    const alive = [...ownedKeys.values()].filter((item) => present.has(processKey(item)) && !isGone(item));
    const ownedSeen = [...ownedKeys.values()].map(publicProcess);
    const finish = (residual) => { timings.totalMs = Date.now() - started; return { killed, residual, ownedSeen, errors, timings, snapshot: processes }; };
    if (alive.length === 0) return finish([]);
    if (Date.now() >= deadline) return finish(alive.map(publicProcess));
    const byPid = new Map(alive.map((item) => [item.pid, item]));
    const depth = (item) => { let n = 0; for (let at = byPid.get(item.ppid); at && n < 64; at = byPid.get(at.ppid)) n += 1; return n; };
    const todo = alive.filter((candidate) => !killedKeys.has(processKey(candidate)));
    const levels = new Map();
    for (const item of todo) {
      killedKeys.add(processKey(item));
      const level = depth(item);
      if (!levels.has(level)) levels.set(level, []);
      levels.get(level).push(item);
    }
    const ordered = [...levels.keys()].sort((a, b) => b - a);
    await timed(timings.killsMs, async () => {
      if (!kill) {
        // Deepest first, all in one taskkill call: a call costs ~0.4 s, which would otherwise be paid per tree level.
        const pids = ordered.flatMap((level) => levels.get(level).map((item) => item.pid));
        killed.push(...pids);
        try { await killMany(pids); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
        return;
      }
      for (const level of ordered) {
        await Promise.all(levels.get(level).map(async (item) => {
          killed.push(item.pid);
          try { await kill(item.pid); } catch (error) { errors.push(error instanceof Error ? error.message : String(error)); }
        }));
      }
    });
  }
}

// Synchronous last resort if the harness dies without running its own cleanup.
const liveRoots = new Set();
let exitHookInstalled = false;
/**
 * Registers a started root for the exit hook; the caller drops it again when the process exits. The root's pid
 * cannot be recycled while it runs (Node holds its handle), but `/T` also follows stale ppid links of unrelated
 * older processes: it is a last resort for a harness that is dying anyway, never part of the normal cleanup.
 */
function trackRoot(pid) {
  liveRoots.add(pid);
  if (exitHookInstalled) return;
  exitHookInstalled = true;
  process.on("exit", () => {
    for (const pid of liveRoots) spawnSync("taskkill.exe", ["/PID", String(pid), "/T", "/F"], { windowsHide: true });
  });
}

// ---------------------------------------------------------------- fixture proxy

const FIXTURE_DATA = {
  "/api/sessions": { sessions: [] },
  "/api/home": { home: "C:/generated", homeDir: "C:/generated" },
  "/api/cwd/status": { availability: "available" },
  "/api/open-in-explorer": { supported: false, reason: "Generated fixture", platform: "win32" },
  "/api/scheduled-tasks": { tasks: [], scheduler: { owner: false, ownerInfo: null } },
  "/api/desktop/environment": { hostname: "Generated fixture", platform: "win32" },
  "/api/models": { models: {}, modelList: [], defaultModel: null, modelScopeWarnings: [] },
  "/api/models/enabled": { allEnabled: true, patterns: null, stalePatterns: [], enabledTotal: 0, availableTotal: 0, providers: [], scope: "global", settingsPath: "generated", editable: false },
  "/api/models/nonchat": { classifier: [], image: [], codemode: "automatic" },
  "/api/project-trust": { requiresTrust: false, trusted: true, decision: null, inherited: false },
  "/api/auth/providers": { oauthProviders: [], apiKeyProviders: [] },
  "/api/models-config": { providers: {} },
  "/api/updates": { updates: [], nextCheckAt: "2099-01-01T00:00:00Z" },
  "/api/web-auth": { enabled: false },
  "/api/tools/settings": { powerShellEnabled: false, powerShellAvailable: false },
  "/api/artifacts/settings": { enabled: false },
  "/api/git/status": { isGitRepository: false, files: [] },
};

export const isApiPath = (pathname) => pathname === "/api" || pathname.startsWith("/api/");

/**
 * The path a server would end up routing a request-target to: absolute-form stripped, query dropped,
 * percent-escapes decoded (repeatedly), backslashes and duplicate slashes folded, dot segments
 * resolved, lowercased. `//api/x` and `/%61pi/x` both come out as `/api/x`.
 */
export function normalizeRequestPath(target) {
  let value = String(target);
  const absolute = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i.exec(value);
  if (absolute) value = value.slice(absolute[0].length) || "/";
  value = value.split(/[?#]/, 1)[0];
  for (let round = 0; round < 4; round += 1) {
    const decoded = value.replace(/(?:%[0-9a-f]{2})+/gi, (run) => { try { return decodeURIComponent(run); } catch { return run; } });
    if (decoded === value) break;
    value = decoded;
  }
  const segments = [];
  for (const segment of value.replaceAll("\\", "/").split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") segments.pop();
    else segments.push(segment);
  }
  return `/${segments.join("/")}`.toLowerCase();
}

/**
 * Loopback reverse proxy in front of the dev server: everything outside `/api` is forwarded as-is
 * (including the HMR websocket), `/api` and SSE are answered from generated fixtures, so no request
 * reaches the real API regardless of when CDP attaches. The routing above uses the URL parser; a second
 * check on the forwarding path re-reads the raw request-target with `normalizeRequestPath`, and anything
 * that still resolves to `/api` (`//api/x`, `/%61pi/x`, `/API/x`, ...) is refused with 403, never
 * forwarded, and counted in `counters.realApiRequests` - the measured "would have reached the API" value.
 */
export async function startFixtureProxy({ upstream }) {
  const target = new URL(upstream);
  const counters = { realApiRequests: 0, fixtureApiRequests: 0, blockedWrites: 0, passthroughRequests: 0, directBaseRequests: 0 };
  const sockets = new Set();
  const streams = new Set();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://proxy.invalid");
    if (isApiPath(url.pathname)) {
      counters.fixtureApiRequests += 1;
      if (!["GET", "HEAD"].includes(request.method)) {
        counters.blockedWrites += 1;
        response.writeHead(409, { "content-type": "application/json" }).end(JSON.stringify({ error: "Native baseline fixture does not execute writes" }));
        return;
      }
      if ((request.headers.accept ?? "").includes("text/event-stream") || url.pathname.endsWith("/events")) {
        response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
        response.write(": fixture\n\n");
        streams.add(response);
        response.once("close", () => streams.delete(response));
        return;
      }
      if (url.pathname === "/api/custom-css") {
        response.writeHead(200, { "content-type": "text/css" }).end("");
        return;
      }
      const body = FIXTURE_DATA[url.pathname] ?? (url.pathname.startsWith("/api/agent/") ? { running: false, runningSessionIds: [] } : {});
      response.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(body));
      return;
    }
    if (isApiPath(normalizeRequestPath(request.url))) {
      counters.realApiRequests += 1;
      response.writeHead(403, { "content-type": "application/json" }).end(JSON.stringify({ error: "Native baseline proxy refuses API paths it cannot fixture" }));
      request.resume();
      return;
    }
    counters.passthroughRequests += 1;
    const headers = rewriteHeaders(request.headers, server.address().port, target);
    const forward = http.request({ host: target.hostname, port: target.port, method: request.method, path: request.url, headers }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode, upstreamResponse.headers);
      upstreamResponse.pipe(response);
    });
    forward.once("error", (error) => {
      if (!response.headersSent) response.writeHead(502, { "content-type": "text/plain" });
      response.end(`Upstream unavailable: ${error.message}`);
    });
    request.pipe(forward);
  });
  server.on("connection", (socket) => {
    sockets.add(socket);
    socket.once("close", () => sockets.delete(socket));
  });
  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url, "http://proxy.invalid");
    if (isApiPath(url.pathname)) {
      socket.destroy();
      return;
    }
    if (isApiPath(normalizeRequestPath(request.url))) {
      counters.realApiRequests += 1;
      socket.destroy();
      return;
    }
    const upstreamSocket = net.connect(Number(target.port), target.hostname, () => {
      const lines = [`${request.method} ${request.url} HTTP/${request.httpVersion}`];
      const headers = rewriteHeaders(request.headers, server.address().port, target);
      for (const [name, value] of Object.entries(headers)) lines.push(`${name}: ${Array.isArray(value) ? value.join(", ") : value}`);
      upstreamSocket.write(`${lines.join("\r\n")}\r\n\r\n`);
      if (head?.length) upstreamSocket.write(head);
      socket.pipe(upstreamSocket);
      upstreamSocket.pipe(socket);
    });
    upstreamSocket.once("error", () => socket.destroy());
    socket.once("error", () => upstreamSocket.destroy());
    socket.once("close", () => upstreamSocket.destroy());
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const port = server.address().port;
  return {
    origin: `http://127.0.0.1:${port}`,
    port,
    host: server.address().address,
    counters,
    async close() {
      for (const stream of streams) stream.end();
      for (const socket of sockets) socket.destroy();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function rewriteHeaders(headers, proxyPort, target) {
  const proxyOrigin = `http://127.0.0.1:${proxyPort}`;
  const next = { ...headers, host: target.host };
  for (const name of ["origin", "referer"]) {
    if (typeof next[name] === "string") next[name] = next[name].replace(proxyOrigin, target.origin);
  }
  return next;
}

// ---------------------------------------------------------------- probe, PNG, log

export function parseProbeOutput(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new HarnessError(`Window probe printed invalid JSON (${error.message}): ${String(text).slice(0, 200)}`);
  }
  if (!Array.isArray(parsed)) throw new HarnessError("Window probe output must be a JSON array");
  return parsed;
}

/** A capture path from the probe must be a plain file name inside the capture directory. */
export function assertInside(directory, file) {
  const root = path.resolve(directory);
  const resolved = path.resolve(file);
  const relative = path.relative(root, resolved);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative) || relative.includes(path.sep)) {
    throw new HarnessError(`Probe returned a path outside the capture directory: ${file}`);
  }
  if (!/^os-window-\d+\.png$/.test(relative)) throw new HarnessError(`Unexpected capture file name: ${relative}`);
  return resolved;
}

export async function runProbe({ pid, action = "list", captureDirectory, handle, x, y }) {
  const args = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", PROBE_SCRIPT, "-Action", action];
  if (pid !== undefined) args.push("-TargetProcessId", String(pid));
  if (captureDirectory) args.push("-CaptureDirectory", captureDirectory);
  if (handle !== undefined) args.push("-Handle", String(handle));
  if (x !== undefined) args.push("-X", String(x));
  if (y !== undefined) args.push("-Y", String(y));
  try {
    const { stdout } = await execFileAsync("powershell.exe", args);
    const rows = parseProbeOutput(stdout);
    if (captureDirectory) for (const row of rows) if (row.capture) row.capture = assertInside(captureDirectory, row.capture);
    return rows;
  } catch (error) {
    if (error instanceof HarnessError) throw error;
    throw new HarnessError(`Window probe failed (exit ${error.code}): ${String(error.stderr || error.message).trim()}`);
  }
}

/** Dimensions plus luminance standard deviation of an 8-bit non-interlaced RGB/RGBA PNG. */
export function readPng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (buffer.length < 33 || !buffer.subarray(0, 8).equals(signature)) throw new HarnessError("Not a PNG file");
  let offset = 8;
  let header;
  const data = [];
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const body = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") header = { width: body.readUInt32BE(0), height: body.readUInt32BE(4), depth: body[8], colorType: body[9], interlace: body[12] };
    if (type === "IDAT") data.push(body);
    if (type === "IEND") break;
    offset += 12 + length;
  }
  if (!header) throw new HarnessError("PNG has no IHDR");
  const channels = { 2: 3, 6: 4 }[header.colorType];
  if (header.depth !== 8 || !channels || header.interlace !== 0) throw new HarnessError(`Unsupported PNG format (depth ${header.depth}, colorType ${header.colorType})`);
  const raw = inflateSync(Buffer.concat(data));
  const stride = header.width * channels;
  const pixels = Buffer.alloc(stride * header.height);
  for (let y = 0; y < header.height; y += 1) {
    const filter = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i += 1) {
      const left = i >= channels ? pixels[y * stride + i - channels] : 0;
      const up = y > 0 ? pixels[(y - 1) * stride + i] : 0;
      const upLeft = y > 0 && i >= channels ? pixels[(y - 1) * stride + i - channels] : 0;
      let value = line[i];
      if (filter === 1) value += left;
      else if (filter === 2) value += up;
      else if (filter === 3) value += (left + up) >> 1;
      else if (filter === 4) {
        const estimate = left + up - upLeft;
        const [dl, du, dul] = [Math.abs(estimate - left), Math.abs(estimate - up), Math.abs(estimate - upLeft)];
        value += dl <= du && dl <= dul ? left : du <= dul ? up : upLeft;
      } else if (filter !== 0) throw new HarnessError(`Bad PNG filter ${filter}`);
      pixels[y * stride + i] = value & 0xff;
    }
  }
  let sum = 0;
  let squares = 0;
  const count = header.width * header.height;
  for (let pixel = 0; pixel < count; pixel += 1) {
    const base = pixel * channels;
    const luminance = 0.299 * pixels[base] + 0.587 * pixels[base + 1] + 0.114 * pixels[base + 2];
    sum += luminance;
    squares += luminance * luminance;
  }
  const mean = sum / count;
  return { width: header.width, height: header.height, stdDev: Math.sqrt(Math.max(0, squares / count - mean * mean)) };
}

/** Helper windows (IME, tooltips) are tiny; the app window is at least this large. */
export const isMainSized = (row) => row.width >= 200 && row.height >= 200;

export function desktopLogPath() {
  const localAppData = process.env.LOCALAPPDATA;
  if (!localAppData) return undefined;
  const config = JSON.parse(readFileSync(path.join(REPO_ROOT, "src-tauri", "tauri.conf.json"), "utf8"));
  return path.join(localAppData, config.identifier, "logs", "desktop.log");
}

export function readLogSince(file, offset) {
  if (!file || !existsSync(file)) return { text: "", offset: 0, available: false };
  const size = statSync(file).size;
  const start = size < offset ? 0 : offset;
  const buffer = readFileSync(file).subarray(start);
  return { text: buffer.toString("utf8"), offset: start, available: true };
}

export function inspectDesktopLog(text) {
  return { hasStartup: /startup/i.test(text), hasPanic: /panic/i.test(text), bytes: Buffer.byteLength(text) };
}

// ---------------------------------------------------------------- evidence

export function writeEvidence(outDir, report) {
  mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, "results.json");
  writeFileSync(file, `${JSON.stringify(report, null, 2)}\n`);
  return file;
}

async function sha256(file) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(file).on("data", (chunk) => hash.update(chunk)).on("error", reject).on("end", resolve);
  });
  return hash.digest("hex");
}

const freePort = () => new Promise((resolve, reject) => {
  const listener = net.createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const { port } = listener.address();
    listener.close((error) => (error ? reject(error) : resolve(port)));
  });
});

async function waitFor(check, { timeoutMs, intervalMs = 200, what }) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = await check();
    if (value) return value;
    if (Date.now() >= deadline) throw new HarnessError(`Timed out after ${timeoutMs} ms waiting for ${what}`);
    await delay(intervalMs);
  }
}

function redact(text, secrets) {
  let result = String(text);
  for (const secret of secrets) if (secret) result = result.split(secret).join("<redacted>");
  return result.slice(-1500);
}

// ---------------------------------------------------------------- the run

/**
 * One native run. Always cleans up its own process tree; returns `{ exitCode, report, resultsFile }`.
 * `hooks.afterLaunch` / `exeArgs` / `signal` exist for tests and for later cards that extend the run.
 */
export async function runBaseline(options) {
  const { check, base, out, exe, labelPercent, cdpTimeoutMs = 60000, exeArgs = [], signal, hooks = {} } = options;
  if (process.platform !== "win32") throw new HarnessError("The native baseline requires Windows", EXIT.prerequisite);
  if (!existsSync(exe)) {
    throw new HarnessError(`Desktop dev shell not found: ${exe}\nBuild it first (the harness never compiles): ${BUILD_HINT}`, EXIT.prerequisite);
  }
  // The abort listener goes on first so an interrupt at any later await (or one that already happened)
  // is seen: every await in the run is followed by guard(), and the long ones are wrapped in abortable().
  const state = { aborted: false };
  const interrupted = new Promise((_, reject) => {
    const fire = () => { state.aborted = true; reject(new HarnessError("Run interrupted")); };
    if (signal?.aborted) fire();
    else signal?.addEventListener("abort", fire, { once: true });
  });
  interrupted.catch(() => {});
  const guard = () => { if (state.aborted) throw new HarnessError("Run interrupted"); };
  const abortable = (promise) => Promise.race([promise, interrupted]);
  guard();
  try {
    const reachable = await fetch(`${base}/`, { signal: AbortSignal.timeout(8000) });
    await reachable.arrayBuffer();
  } catch (error) {
    guard();
    throw new HarnessError(`Dev server at ${base} is not reachable (${error.message}). Start it first, e.g. npx next dev --webpack -p ${new URL(base).port}`, EXIT.prerequisite);
  }
  guard();
  if (labelPercent !== undefined) {
    const [system] = await runProbe({ action: "dpi" });
    guard();
    if (system.primaryMonitorScalePercent !== labelPercent) {
      throw new HarnessError(`Label dpi${labelPercent} does not match the measured display scale ${system.primaryMonitorScalePercent}% (DPI ${system.primaryMonitorDpi}); refusing to record it`, EXIT.labelMismatch);
    }
  }

  mkdirSync(out, { recursive: true });
  const report = {
    schema: 1, check, label: options.label ?? null, status: "running", startedAt: new Date().toISOString(),
    base, os: { release: os.release(), build: Number(os.release().split(".")[2]), version: os.version(), arch: os.arch() },
    exe: null, launch: {}, dpi: {}, window: {}, realApiRequests: null, directBaseRequests: null, fixtureApiRequests: null, blockedWrites: null,
    processes: {}, hygiene: {}, desktopLog: {}, checks: [], warnings: [],
  };
  const stat = statSync(exe);
  report.exe = { path: path.relative(REPO_ROOT, exe).startsWith("..") ? path.basename(exe) : path.relative(REPO_ROOT, exe).replaceAll("\\", "/"), size: stat.size, builtAt: stat.mtime.toISOString(), sha256: await sha256(exe) };
  guard();
  // Every process alive before the run, whatever its name: none of them is ever owned or killed.
  const preBefore = await listProcesses();
  guard();
  const preexisting = new Set(preBefore.map(processKey));
  const preexistingApp = new Set(preBefore.filter((item) => isPilaudeOrWebView(item.name)).map(processKey));
  report.processes.before = preBefore.filter((item) => isPilaudeOrWebView(item.name)).map(publicProcess);
  const addCheck = (id, name, ok, detail) => report.checks.push({ id, name, status: ok ? "passed" : "failed", detail });

  const profileDir = mkdtempSync(path.join(os.tmpdir(), "pilaude-native-webview-"));
  const apiToken = randomBytes(24).toString("hex");
  const logFile = desktopLogPath();
  const logBefore = logFile && existsSync(logFile) ? statSync(logFile).size : 0;
  let proxy;
  let app;
  let browser;
  let appStderr = "";
  let appExit = null;
  let cleanup;
  let cleanupFailed = false;
  let failure;
  let exitCode = EXIT.ok;
  let spawnedAt;
  // Rows (pid + creation time) of the root and its descendants, taken only while the app was provably running.
  const known = new Map();
  const pendingSnapshots = new Set();

  /**
   * Records the root and its tree from a process snapshot, but only if the app had not exited by the time the
   * snapshot came back: Node holds the child's handle until 'exit', so until then its pid cannot be recycled.
   */
  const recordOwned = (processes) => {
    if (appExit !== null || app.exitCode !== null) return;
    const root = processes.find((item) => item.pid === app.pid);
    if (!root || createdMs(root.created) < spawnedAt - 2000 || preexisting.has(processKey(root))) return;
    for (const item of descendantsOf(app.pid, processes, { rootCreated: root.created })) {
      if (!preexisting.has(processKey(item))) known.set(processKey(item), item);
    }
  };
  const snapshotOwned = async () => {
    const processes = await listProcesses();
    recordOwned(processes);
    return processes;
  };

  const body = async () => {
    proxy = await startFixtureProxy({ upstream: base });
    guard();
    const cdpPort = await freePort();
    report.launch = { proxyOrigin: proxy.origin, cdpPort, cdpHost: "127.0.0.1" };
    await abortable(hooks.beforeSpawn?.({ report, proxy }));
    guard(); // nothing may be spawned after an interrupt: no await sits between this check and spawn()
    spawnedAt = Date.now();
    app = spawn(exe, exeArgs, {
      cwd: REPO_ROOT, windowsHide: false, stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        WEBVIEW2_USER_DATA_FOLDER: profileDir,
        WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${cdpPort} --remote-debugging-address=127.0.0.1`,
        PILAUDE_DEV_URL: proxy.origin,
        PI_DESKTOP_API_TOKEN: apiToken,
      },
    });
    const rootPid = app.pid;
    trackRoot(rootPid);
    report.launch.pid = rootPid;
    app.stdout.on("data", () => {});
    app.stderr.on("data", (chunk) => { appStderr = (appStderr + chunk).slice(-4000); });
    // Once it has exited its pid may be recycled, so the exit hook must not name it any more.
    app.once("exit", (code) => { appExit = code; liveRoots.delete(rootPid); });
    app.once("error", (error) => { appStderr += `spawn error: ${error.message}`; });
    const firstSnapshot = snapshotOwned().catch(() => {});
    pendingSnapshots.add(firstSnapshot);
    firstSnapshot.finally(() => pendingSnapshots.delete(firstSnapshot));

    const version = await waitFor(async () => {
      guard();
      if (appExit !== null) throw new HarnessError(`Desktop shell exited early with code ${appExit}: ${redact(appStderr, [apiToken])}`);
      try {
        const response = await fetch(`http://127.0.0.1:${cdpPort}/json/version`, { signal: AbortSignal.timeout(2000) });
        return response.ok ? await response.json() : false;
      } catch {
        return false;
      }
    }, { timeoutMs: cdpTimeoutMs, what: `the WebView2 CDP port ${cdpPort}` }).catch((error) => {
      throw new HarnessError(`${error.message}. stderr: ${redact(appStderr, [apiToken]) || "(empty)"}`);
    });
    report.launch.webview2 = version.Browser;
    await abortable(hooks.afterLaunch?.({ app, report, proxy }));
    guard();

    const { chromium } = await abortable(import("playwright"));
    guard();
    const connecting = chromium.connectOverCDP(`http://127.0.0.1:${cdpPort}`);
    connecting.then((connected) => { browser = connected; }, () => {});
    await abortable(connecting);
    guard();
    // Requests the page sends straight to the real dev server (bypassing the proxy) are measured too, from CDP attach onward only:
    // earlier ones are invisible here, so `directBaseRequests` is a lower bound.
    const noteDirect = (url) => {
      let parsed;
      try { parsed = new URL(url); } catch { return; }
      if (parsed.origin !== base) return;
      proxy.counters.directBaseRequests += 1;
      if (isApiPath(normalizeRequestPath(parsed.pathname))) proxy.counters.realApiRequests += 1;
    };
    for (const context of browser.contexts()) context.on("request", (request) => noteDirect(request.url()));
    const page = await waitFor(async () => {
      guard();
      for (const context of browser.contexts()) for (const candidate of context.pages()) if (candidate.url().startsWith(proxy.origin)) return candidate;
      return false;
    }, { timeoutMs: cdpTimeoutMs, what: "the main page on the fixture proxy" });
    await abortable(page.waitForFunction(() => Boolean(window.__TAURI_INTERNALS__), undefined, { timeout: 120000 }));
    guard();
    const tauri = await page.evaluate(() => ({
      hasInternals: Boolean(window.__TAURI_INTERNALS__),
      windowLabel: window.__TAURI_INTERNALS__?.metadata?.currentWindow?.label ?? null,
      devicePixelRatio: window.devicePixelRatio,
      visualViewportScale: window.visualViewport?.scale ?? 1,
      innerWidth: window.innerWidth,
      outerWidth: window.outerWidth,
    }));
    report.launch.tauri = tauri;
    addCheck("N1", "WebView2 / Tauri launch and CDP attach", tauri.hasInternals && tauri.windowLabel === "main" && proxy.counters.realApiRequests === 0,
      `window.__TAURI_INTERNALS__=${tauri.hasInternals}, label=${tauri.windowLabel}, realApiRequests=${proxy.counters.realApiRequests}`);

    const windows = await waitFor(async () => {
      guard();
      const rows = await runProbe({ pid: app.pid, captureDirectory: out });
      return rows.some((row) => isMainSized(row) && !row.toolWindow) ? rows : false;
    }, { timeoutMs: 45000, intervalMs: 500, what: "a visible top-level window" });
    const appWindows = windows.filter((row) => !row.toolWindow);
    report.window = { count: windows.length, appWindowCount: appWindows.length, windows };
    report.processes.during = (await snapshotOwned()).filter((item) => isPilaudeOrWebView(item.name)).map(publicProcess);
    guard();

    const main = appWindows[0];
    const expectedDpi = Math.round(96 * main.monitorScalePercent / 100);
    const png = main.capture ? readPng(readFileSync(main.capture)) : null;
    report.dpi = {
      windowDpi: main.dpi, monitorDpi: main.monitorDpi, monitorScalePercent: main.monitorScalePercent, monitorScaleFactor: main.monitorScaleFactor,
      devicePixelRatio: tauri.devicePixelRatio, pageZoom: Number((tauri.devicePixelRatio / (main.monitorScalePercent / 100)).toFixed(3)), expectedWindowDpi: expectedDpi,
    };
    report.window.capture = png && { width: png.width, height: png.height, stdDev: Number(png.stdDev.toFixed(3)), probePrintWindow: main.printWindow };
    const windowOk = appWindows.length === 1 && main.width > 0 && main.height > 0 && main.dpi === expectedDpi
      && png && png.width === main.width && png.height === main.height && png.stdDev > 2 && main.printWindow === true;
    addCheck("N2", "Top-level window, chrome and DPI screenshot", Boolean(windowOk),
      `visibleAppWindows=${appWindows.length} (+${windows.length - appWindows.length} tool helper), ${main.width}x${main.height}, dpi=${main.dpi} (expected ${expectedDpi}), png=${png ? `${png.width}x${png.height}` : "none"}, stdDev=${png?.stdDev.toFixed(2)}`);
    if (labelPercent !== undefined && main.monitorScalePercent !== labelPercent) {
      exitCode = EXIT.labelMismatch;
      throw new HarnessError(`Label dpi${labelPercent} does not match the main window's measured scale ${main.monitorScalePercent}%`, EXIT.labelMismatch);
    }
    report.dpi.label = options.label ?? null;
  };

  try {
    await body();
  } catch (error) {
    failure = error;
    if (error instanceof HarnessError && error.exitCode !== EXIT.failed) exitCode = error.exitCode;
    else exitCode = EXIT.failed;
  } finally {
    try {
      if (browser) await browser.close();
    } catch (error) {
      report.warnings.push(`CDP disconnect: ${error.message}`);
    }
    if (app?.pid) {
      await Promise.allSettled([...pendingSnapshots]);
      try {
        // A root that has exited may have had its pid recycled: never kill it by number.
        cleanup = await cleanupOwned({ known: [...known.values()], profileDir, preexisting, isGone: (item) => item.pid === app.pid && (appExit !== null || app.exitCode !== null) });
        for (const message of cleanup.errors) report.warnings.push(`cleanup: ${message}`);
      } catch (error) {
        report.warnings.push(`cleanup failed: ${error.message}`);
        cleanupFailed = true;
      }
      liveRoots.delete(app.pid);
    }
    if (proxy) {
      report.realApiRequests = proxy.counters.realApiRequests;
      report.directBaseRequests = proxy.counters.directBaseRequests;
      report.fixtureApiRequests = proxy.counters.fixtureApiRequests;
      report.blockedWrites = proxy.counters.blockedWrites;
      // N1 was judged when CDP attached; requests made later (window probe phase) must not slip past it.
      const n1 = report.checks.find((item) => item.id === "N1");
      if (n1?.status === "passed" && proxy.counters.realApiRequests !== 0) {
        n1.status = "failed";
        n1.detail += `; final realApiRequests=${proxy.counters.realApiRequests}`;
      }
      await proxy.close();
    }
    // The cleanup's confirming snapshot is the post-run state; take a fresh one only when no cleanup ran.
    const after = (cleanup?.snapshot ?? await listProcesses()).filter((item) => isPilaudeOrWebView(item.name));
    report.processes.after = after.map(publicProcess);
    const afterKeys = new Set(after.map(processKey));
    const killedPreexisting = cleanup ? cleanup.ownedSeen.filter((item) => preexisting.has(processKey(item))) : [];
    report.hygiene = {
      ownedProcessesSeen: cleanup?.ownedSeen.length ?? 0, killedPids: cleanup?.killed ?? [], residual: cleanup?.residual ?? [], cleanupTimings: cleanup?.timings ?? null, cleanupFailed,
      preexistingTouched: killedPreexisting.length, preexistingMissingAfter: [...preexistingApp].filter((key) => !afterKeys.has(key)),
    };
    let profileRemoved = false;
    for (let attempt = 0; attempt < 10 && !profileRemoved; attempt += 1) {
      try {
        rmSync(profileDir, { recursive: true, force: true });
        profileRemoved = !existsSync(profileDir);
      } catch (error) {
        report.warnings.push(`profile cleanup attempt ${attempt + 1}: ${error.code ?? error.message}`);
      }
      if (!profileRemoved) await delay(300);
    }
    report.hygiene.profileRemoved = profileRemoved;
    const log = readLogSince(logFile, logBefore);
    report.desktopLog = { available: log.available, ...inspectDesktopLog(log.text) };
    const hygieneOk = !cleanupFailed && report.hygiene.residual.length === 0 && report.hygiene.preexistingTouched === 0 && profileRemoved
      && (!app?.pid || (report.desktopLog.hasStartup && !report.desktopLog.hasPanic));
    addCheck("N3", "Process tree and exit hygiene", hygieneOk,
      `residual=${report.hygiene.residual.length}, preexistingTouched=${report.hygiene.preexistingTouched}, profileRemoved=${profileRemoved}, log startup=${report.desktopLog.hasStartup} panic=${report.desktopLog.hasPanic}`);
    if (failure) report.failure = redact(failure instanceof Error ? failure.message : String(failure), [apiToken]);
    const needed = { launch: ["N1", "N3"], window: ["N1", "N2", "N3"], hygiene: ["N1", "N3"] }[check];
    const failed = needed.filter((id) => report.checks.find((item) => item.id === id)?.status !== "passed");
    report.status = !failure && failed.length === 0 ? "passed" : "failed";
    if (report.status === "failed" && exitCode === EXIT.ok) exitCode = EXIT.failed;
    report.finishedAt = new Date().toISOString();
  }
  const resultsFile = writeEvidence(out, report);
  return { exitCode, report, resultsFile };
}
