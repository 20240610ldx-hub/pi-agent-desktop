import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { Credential, CredentialStore } from "@earendil-works/pi-ai";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createPilaudeCredentialStore } from "./credential-store";
import { createPilaudeModelRuntime } from "./pilaude-model-runtime";

type ProviderDraft = Record<string, unknown> & {
  apiKey?: string;
  headers?: Record<string, string>;
  models?: (Record<string, unknown> & { id: string; headers?: Record<string, string> })[];
  modelOverrides?: Record<string, { headers?: Record<string, string> }>;
};

/** Let Pi validate and compose drafts, keeping all request secrets in memory. */
export async function withTransientModelRuntime<T>(
  config: { providers: Record<string, ProviderDraft> },
  run: (runtime: ModelRuntime) => Promise<T>,
): Promise<T> {
  const sanitized = structuredClone(config);
  for (const provider of Object.values(sanitized.providers)) {
    delete provider.apiKey;
    delete provider.headers;
    for (const model of provider.models ?? []) delete model.headers;
    for (const override of Object.values(provider.modelOverrides ?? {})) delete override.headers;
  }
  const directory = mkdtempSync(join(tmpdir(), "pilaude-model-probe-"));
  try {
    const modelsPath = join(directory, "models.json");
    writeFileSync(modelsPath, JSON.stringify(sanitized), { mode: 0o600 });
    const stored = createPilaudeCredentialStore(getAgentDir());
    const drafts = new Map<string, Credential | undefined>(Object.entries(config.providers)
      .filter(([, provider]) => Object.hasOwn(provider, "apiKey")).map(([id]) => [id, undefined]));
    const credentials: CredentialStore = {
      read: (id, options) => drafts.has(id) ? Promise.resolve(drafts.get(id)) : stored.read(id, options),
      list: async options => (await stored.list(options)).filter(entry => !drafts.has(entry.providerId)),
      modify: async (id, update, options) => {
        if (!drafts.has(id)) return stored.modify(id, update, options);
        const next = await update(drafts.get(id));
        if (next !== undefined) drafts.set(id, next);
        return drafts.get(id);
      },
      delete: async (id, options) => { if (drafts.has(id)) drafts.set(id, undefined); else await stored.delete(id, options); },
    };
    const runtime = await createPilaudeModelRuntime({ modelsPath, credentials });
    if (!runtime.getError()) {
      for (const [id, provider] of Object.entries(config.providers)) {
        const models = runtime.getAllModels(id).map(model => ({
          ...model,
          headers: {
            ...provider.modelOverrides?.[model.id]?.headers,
            ...provider.models?.find(definition => definition.id === model.id)?.headers,
          },
        }));
        runtime.registerProvider(id, { apiKey: provider.apiKey, headers: provider.headers, models });
      }
    }
    return await run(runtime);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
