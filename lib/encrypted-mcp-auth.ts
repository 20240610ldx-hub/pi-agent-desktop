import { randomUUID } from "node:crypto";
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import lockfile from "proper-lockfile";
import type { AuthOperationOptions } from "@earendil-works/pi-ai";
import { windowsCredentialCipherSync } from "./credential-store";
import type { PiSdkInternals } from "./pi-sdk-internals";

type Backend = NonNullable<ConstructorParameters<PiSdkInternals["McpOAuthCredentialStore"]>[0]>;
type Cipher = ReturnType<typeof windowsCredentialCipherSync>;
type Update<T> = { result: T; next?: string };
const FORMAT = "pilaude-mcp-dpapi-v1";

function validateState(text: string): void {
  try {
    const data: unknown = JSON.parse(text);
    if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error();
    for (const value of Object.values(data)) {
      if (!value || typeof value !== "object" || Array.isArray(value)
        || (value.serverUrl !== undefined && typeof value.serverUrl !== "string")) throw new Error();
    }
  } catch { throw new Error("Invalid encrypted MCP credential data. The original file was preserved."); }
}

/** Pi's locking callback remains intact; only its on-disk representation changes. */
export class EncryptedMcpAuthBackend implements Backend {
  private decoded?: { raw: string; plaintext: string };
  constructor(private readonly file: string, private readonly cipher: Cipher = windowsCredentialCipherSync()) {}

  /** Status reads must neither create a file nor perform legacy-state migration. */
  read(): string | undefined {
    if (!existsSync(this.file)) { this.decoded = undefined; return undefined; }
    const raw = readFileSync(this.file, "utf8");
    if (raw === "{}") return undefined;
    if (this.decoded?.raw === raw) return this.decoded.plaintext;
    let ciphertext: string;
    try {
      const envelope = JSON.parse(raw);
      if (envelope.format !== FORMAT || typeof envelope.ciphertext !== "string") throw new Error();
      ciphertext = envelope.ciphertext;
    } catch { throw new Error("Invalid encrypted MCP credential file. The original file was preserved."); }
    const plaintext = this.cipher.unprotect(ciphertext);
    validateState(plaintext);
    this.decoded = { raw, plaintext };
    return plaintext;
  }

  private prepare(): void {
    mkdirSync(dirname(this.file), { recursive: true, mode: 0o700 });
    try {
      const descriptor = openSync(this.file, "wx", 0o600);
      try { writeFileSync(descriptor, "{}"); } finally { closeSync(descriptor); }
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
  }

  private publish(next: string | undefined, check: () => void): void {
    if (next === undefined) return;
    validateState(next);
    const raw = JSON.stringify({ format: FORMAT, ciphertext: this.cipher.protect(next) });
    const temporary = `${this.file}.${randomUUID()}.tmp`;
    try {
      writeFileSync(temporary, raw, { flag: "wx", mode: 0o600 });
      check();
      renameSync(temporary, this.file);
      this.decoded = { raw, plaintext: next };
    } finally { if (existsSync(temporary)) unlinkSync(temporary); }
  }

  withLock<T>(update: (current: string | undefined) => Update<T>): T {
    this.prepare();
    let compromised: Error | undefined;
    const deadline = Date.now() + 30_000;
    const pause = new Int32Array(new SharedArrayBuffer(4));
    let release: (() => void) | undefined;
    while (!release) {
      try { release = lockfile.lockSync(this.file, { realpath: false, stale: 30_000, onCompromised: error => { compromised = error; } }); }
      catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if ((code !== "ELOCKED" && !(process.platform === "win32" && code === "EPERM")) || Date.now() >= deadline) throw error;
        Atomics.wait(pause, 0, 0, 20);
      }
    }
    try {
      const result = update(this.read());
      this.publish(result.next, () => { if (compromised) throw compromised; });
      return result.result;
    } finally { release(); }
  }

  async withLockAsync<T>(update: (current: string | undefined) => Promise<Update<T>>, options?: AuthOperationOptions): Promise<T> {
    options?.signal?.throwIfAborted();
    this.prepare();
    let compromised: Error | undefined;
    const release = await lockfile.lock(this.file, { realpath: false, retries: { retries: 20, minTimeout: 50, maxTimeout: 100 }, stale: 30_000, onCompromised: error => { compromised = error; } });
    try {
      options?.signal?.throwIfAborted();
      const result = await update(this.read());
      this.publish(result.next, () => { options?.signal?.throwIfAborted(); if (compromised) throw compromised; });
      return result.result;
    } finally { await release(); }
  }
}

const backends = new Map<string, EncryptedMcpAuthBackend>();
export function encryptedMcpAuthBackend(agentDir: string): EncryptedMcpAuthBackend {
  const file = join(agentDir, "mcp-credentials.json");
  let backend = backends.get(file);
  if (!backend) { backend = new EncryptedMcpAuthBackend(file); backends.set(file, backend); }
  return backend;
}

/** Existing guarded subclasses and SDK refresh locks keep using this same store. */
export function withEncryptedMcpCredentials(Store: PiSdkInternals["McpOAuthCredentialStore"]): PiSdkInternals["McpOAuthCredentialStore"] {
  return class PilaudeMcpCredentialStore extends Store {
    constructor(backend?: Backend, lockDir?: string) {
      super(backend ?? encryptedMcpAuthBackend(getAgentDir()), lockDir ?? getAgentDir());
    }
  };
}
