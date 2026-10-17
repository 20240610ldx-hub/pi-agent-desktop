import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { EncryptedCredentialStore, windowsCredentialCipher } from "./credential-store";
import { isModelHeaderReference, mapModelHeaderValues, ModelHeaderError } from "./model-header-references";
import { readModelsConfig } from "./models-config-store";
import { loadPiSdkInternals } from "./pi-sdk-internals";

const PREFIX = "pilaude-secret://";
const unavailable = () => new ModelHeaderError("A saved request header is unavailable. Refresh settings or enter its value again.");

export function createModelHeaderStore(): EncryptedCredentialStore {
  // Reuse the tested DPAPI/locking backend; these header credentials never enter Pi's account list.
  return new EncryptedCredentialStore(join(getAgentDir(), "request-secrets.json"), windowsCredentialCipher());
}

async function resolveHeader(value: string, store: EncryptedCredentialStore): Promise<string> {
  if (!isModelHeaderReference(value)) return value;
  if (value.startsWith(`${PREFIX}legacy/`)) {
    try {
      const path: unknown = JSON.parse(decodeURIComponent(value.slice(`${PREFIX}legacy/`.length)));
      if (!Array.isArray(path) || !path.every(part => typeof part === "string")
        || path[0] !== "providers" || !((path.length === 4 && path[2] === "headers")
          || (path.length === 6 && (path[2] === "models" || path[2] === "modelOverrides") && path[4] === "headers"))) throw unavailable();
      let stored: unknown = readModelsConfig();
      for (const key of path) {
        if (!stored || typeof stored !== "object" || !Object.hasOwn(stored, key)) throw unavailable();
        stored = (stored as Record<string, unknown>)[key];
      }
      if (typeof stored !== "string" || isModelHeaderReference(stored)) throw unavailable();
      return stored;
    } catch { throw unavailable(); }
  }
  const id = value.slice(PREFIX.length);
  if (!/^[a-f0-9-]{36}$/.test(id)) throw unavailable();
  const credential = await store.read(id);
  if (credential?.type !== "api_key" || typeof credential.key !== "string") throw unavailable();
  return credential.key;
}

export async function resolveModelHeaderValues(config: Record<string, unknown>, store = createModelHeaderStore()): Promise<Record<string, unknown>> {
  const values = new Map<string, string>();
  const pending = new Set<string>();
  mapModelHeaderValues(config, value => { if (isModelHeaderReference(value)) pending.add(value); return value; });
  await Promise.all([...pending].map(async value => values.set(value, await resolveHeader(value, store))));
  return mapModelHeaderValues(config, value => values.get(value) ?? value);
}

/** Decode only stored references; the SDK already resolved every other value. */
export async function resolveRequestHeaderValues<T extends Record<string, string | null | undefined>>(
  headers: T, env?: Record<string, string>,
): Promise<T> {
  const references = Object.entries(headers).filter((entry): entry is [string, string] => typeof entry[1] === "string" && isModelHeaderReference(entry[1]));
  if (!references.length) return headers;
  const internals = await loadPiSdkInternals();
  if (!internals.ok) throw new ModelHeaderError("The saved request-header resolver is unavailable.");
  const store = createModelHeaderStore();
  const result: Record<string, string | null | undefined> = { ...headers };
  for (const [name, value] of references) {
    const raw = await resolveHeader(value, store);
    try { result[name] = internals.resolveConfigValueOrThrow(raw, "saved request header", env); }
    catch { throw new ModelHeaderError("A saved request header could not be resolved. Check its environment variables or command."); }
  }
  return result as T;
}

/** Stage new immutable references before publishing config; old references remain crash-safe. */
export async function saveModelHeaderValues(
  config: Record<string, unknown>,
  commit: (sanitized: Record<string, unknown>) => void | Promise<void>,
): Promise<void> {
  const store = createModelHeaderStore();
  const resolved = await resolveModelHeaderValues(config, store);
  const values = new Map<string, string>();
  const originalValues: string[] = [];
  mapModelHeaderValues(config, value => { originalValues.push(value); return value; });
  let index = 0;
  const sanitized = mapModelHeaderValues(resolved, value => {
    const original = originalValues[index++];
    if (!value) return value;
    if (isModelHeaderReference(original) && !original.startsWith(`${PREFIX}legacy/`)) return original;
    const id = randomUUID(); values.set(id, value);
    return `${PREFIX}${id}`;
  });
  if (values.size) await store.saveApiKeys(values, () => commit(sanitized));
  else await commit(sanitized);
}
