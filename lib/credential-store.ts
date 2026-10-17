import { spawn, spawnSync } from "node:child_process";
import { mkdir, open, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import lockfile from "proper-lockfile";
import type { AuthOperationOptions, Credential, CredentialInfo, CredentialStore } from "@earendil-works/pi-ai";

interface CredentialCipher {
  protect(text: string, signal?: AbortSignal): Promise<string>;
  unprotect(text: string, signal?: AbortSignal): Promise<string>;
}

const FORMAT = "pilaude-dpapi-v1";

function parseCredentials(plaintext: string): Map<string, Credential> {
  try {
    const parsed: unknown = JSON.parse(plaintext);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    for (const value of Object.values(parsed)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error();
      if (value.type === "api_key") {
        if (value.key !== undefined && typeof value.key !== "string") throw new Error();
        if (value.env !== undefined && (!value.env || typeof value.env !== "object" || Array.isArray(value.env)
          || Object.values(value.env).some(item => typeof item !== "string"))) throw new Error();
      } else if (value.type !== "oauth" || typeof value.access !== "string" || typeof value.refresh !== "string"
        || typeof value.expires !== "number" || !Number.isFinite(value.expires)) throw new Error();
    }
    return new Map(Object.entries(parsed as Record<string, Credential>));
  } catch { throw new Error("Invalid encrypted credential data. The original file was preserved."); }
}

export type CredentialRemovalResult =
  | { status: "removed" }
  | { status: "not_found" }
  | { status: "type_mismatch"; storedType: string };

function credentialProcess(operation: "Protect" | "Unprotect") {
  const script = `$ErrorActionPreference='Stop';Add-Type -AssemblyName System.Security;[Console]::InputEncoding=[Text.UTF8Encoding]::new($false);[Console]::OutputEncoding=[Text.UTF8Encoding]::new($false);$s=[Console]::In.ReadToEnd();$e=[Text.Encoding]::UTF8.GetBytes('io.github.20240610ldx-hub.pilaude:credentials:v1');$b=${operation === "Protect" ? "[Text.Encoding]::UTF8.GetBytes($s)" : "[Convert]::FromBase64String($s)"};$r=[Security.Cryptography.ProtectedData]::${operation}($b,$e,[Security.Cryptography.DataProtectionScope]::CurrentUser);[Console]::Write(${operation === "Protect" ? "[Convert]::ToBase64String($r)" : "[Text.Encoding]::UTF8.GetString($r)"});`;
  const env: NodeJS.ProcessEnv = { NODE_ENV: "production", ...Object.fromEntries(["SystemRoot", "WINDIR", "TEMP", "TMP", "USERPROFILE", "APPDATA", "LOCALAPPDATA"].flatMap((key) => process.env[key] ? [[key, process.env[key]]] : [])) };
  return { binary: join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe"), args: ["-NoProfile", "-NonInteractive", "-Command", script], env };
}

/** Pi's MCP AuthStorageBackend contract is synchronous. Secrets still use stdin. */
export function windowsCredentialCipherSync() {
  const run = (operation: "Protect" | "Unprotect", input: string): string => {
    if (process.platform !== "win32") throw new Error("Encrypted credential storage is currently supported on Windows.");
    const { binary, args, env } = credentialProcess(operation);
    const result = spawnSync(binary, args, { input, encoding: "utf8", env, windowsHide: true, timeout: 10000, maxBuffer: 4 * 1024 * 1024, stdio: ["pipe", "pipe", "ignore"] });
    if (result.error || result.status !== 0) throw new Error("Windows credential protection failed. Existing credentials were preserved.");
    return result.stdout;
  };
  return { protect: (text: string) => run("Protect", text), unprotect: (text: string) => run("Unprotect", text) };
}

/** No secret is placed in process arguments or in the helper's environment. */
export function windowsCredentialCipher(): CredentialCipher {
  if (process.platform !== "win32") {
    const unsupported = async () => { throw new Error("Encrypted credential storage is currently supported on Windows. Use provider environment credentials on this platform."); };
    return { protect: unsupported, unprotect: unsupported };
  }
  const run = (operation: "Protect" | "Unprotect", input: string, signal?: AbortSignal) => new Promise<string>((resolve, reject) => {
    signal?.throwIfAborted();
    const { binary, args, env } = credentialProcess(operation);
    const child = spawn(binary, args, { windowsHide: true, env, signal, timeout: 10000, stdio: ["pipe", "pipe", "ignore"] });
    let output = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => { output += chunk; if (output.length > 4 * 1024 * 1024) child.kill(); });
    child.once("error", () => reject(new Error("Windows credential protection could not start.")));
    child.once("close", (code) => code === 0 ? resolve(output) : reject(new Error("Windows credential protection failed. Existing credentials were preserved.")));
    child.stdin.on("error", () => {});
    child.stdin.end(input);
  });
  return { protect: (text, signal) => run("Protect", text, signal), unprotect: (text, signal) => run("Unprotect", text, signal) };
}

export class EncryptedCredentialStore implements CredentialStore {
  private decoded?: { raw: string; data: Promise<Map<string, Credential>> };
  constructor(private readonly file: string, private readonly cipher: CredentialCipher) {}

  private async load(signal?: AbortSignal): Promise<Map<string, Credential>> {
    signal?.throwIfAborted();
    let raw: string;
    try { raw = await readFile(this.file, "utf8"); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map(); throw error; }
    if (raw === "{}") return new Map();
    if (this.decoded?.raw !== raw) {
      let envelope: { format?: string; ciphertext?: string };
      try {
        envelope = JSON.parse(raw);
        if (envelope.format !== FORMAT || typeof envelope.ciphertext !== "string") throw new Error();
      } catch { throw new Error("Invalid Pilaude credential store. The original file was preserved."); }
      const data = this.cipher.unprotect(envelope.ciphertext, signal).then(parseCredentials);
      this.decoded = { raw, data };
      data.catch(() => { if (this.decoded?.data === data) this.decoded = undefined; });
    }
    const data = structuredClone(await this.decoded.data);
    signal?.throwIfAborted();
    return data;
  }

  private async update<T>(fn: (data: Map<string, Credential>) => Promise<{ result: T; changed: boolean; commit?: () => void | Promise<void> }>, options?: AuthOperationOptions): Promise<T> {
    const signal = options?.signal;
    signal?.throwIfAborted();
    await mkdir(dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      const handle = await open(this.file, "wx", 0o600);
      try { await handle.writeFile("{}"); } finally { await handle.close(); }
    }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
    const deadline = Date.now() + 30_000;
    let release: (() => Promise<void>) | undefined;
    let compromised: Error | undefined;
    while (!release) {
      signal?.throwIfAborted();
      try { release = await lockfile.lock(this.file, { realpath: false, retries: 0, stale: 30_000, onCompromised: (error) => { compromised = error; } }); }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== "ELOCKED" || Date.now() >= deadline) throw error; await delay(50, undefined, { signal }); }
    }
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      const previous = await readFile(this.file, "utf8");
      const data = await this.load(signal);
      const { result, changed, commit } = await fn(data);
      if (changed) {
        const ciphertext = await this.cipher.protect(JSON.stringify(Object.fromEntries(data)), signal);
        signal?.throwIfAborted(); if (compromised) throw compromised;
        await writeFile(temporary, JSON.stringify({ format: FORMAT, ciphertext }), { mode: 0o600, flag: "wx" });
        signal?.throwIfAborted(); if (compromised) throw compromised;
        await rename(temporary, this.file);
      }
      try { await commit?.(); }
      catch (error) {
        if (changed) {
          // Keep the credential lock while rolling back a paired config write.
          await writeFile(temporary, previous, { mode: 0o600, flag: "wx" });
          await rename(temporary, this.file);
        }
        throw error;
      }
      return result;
    } finally { await unlink(temporary).catch(() => {}); await release(); }
  }

  async read(providerId: string, options?: AuthOperationOptions): Promise<Credential | undefined> {
    return (await this.load(options?.signal)).get(providerId);
  }

  async list(options?: AuthOperationOptions): Promise<readonly CredentialInfo[]> {
    return [...(await this.load(options?.signal)).entries()].map(([providerId, credential]) => ({ providerId, type: credential.type }));
  }

  modify(providerId: string, fn: (current: Credential | undefined) => Promise<Credential | undefined>, options?: AuthOperationOptions): Promise<Credential | undefined> {
    return this.update(async (data) => {
      const current = data.get(providerId);
      const before = JSON.stringify(current);
      const next = await fn(current);
      if (next === undefined) return { result: current, changed: false };
      data.set(providerId, next);
      return { result: next, changed: JSON.stringify(next) !== before };
    }, options);
  }

  delete(providerId: string, options?: AuthOperationOptions): Promise<void> {
    return this.update(async (data) => ({ result: undefined, changed: data.delete(providerId) }), options);
  }

  removeIfType(providerId: string, expectedType: Credential["type"]): Promise<CredentialRemovalResult> {
    return this.update<CredentialRemovalResult>(async (data) => {
      const current = data.get(providerId);
      if (!current) return { result: { status: "not_found" }, changed: false };
      if (current.type !== expectedType) return { result: { status: "type_mismatch", storedType: current.type }, changed: false };
      data.delete(providerId);
      return { result: { status: "removed" }, changed: true };
    });
  }

  /** Publish secret changes and a sanitized models.json save under one writer lock. */
  saveApiKeys(keys: ReadonlyMap<string, string>, commit: () => void | Promise<void>): Promise<void> {
    return this.update(async (data) => {
      const before = JSON.stringify(Object.fromEntries(data));
      for (const [providerId, key] of keys) {
        if (key) data.set(providerId, { type: "api_key", key });
        else if (data.get(providerId)?.type === "api_key") data.delete(providerId);
      }
      return { result: undefined, changed: JSON.stringify(Object.fromEntries(data)) !== before, commit };
    });
  }
}

export function createPilaudeCredentialStore(agentDir: string): EncryptedCredentialStore {
  return new EncryptedCredentialStore(join(agentDir, "credentials.json"), windowsCredentialCipher());
}
