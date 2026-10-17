import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { createPilaudeCredentialStore, type EncryptedCredentialStore } from "./credential-store";
import { isSecretReference } from "./models-config-redaction";
import { writeModelsConfig } from "./models-config-store";

/** Literal keys belong to DPAPI; env/command references remain configuration. */
export async function savePilaudeModelSettings(
  config: Record<string, unknown>,
  write = writeModelsConfig,
  credentials: EncryptedCredentialStore = createPilaudeCredentialStore(getAgentDir()),
): Promise<void> {
  const sanitized = structuredClone(config);
  const keys = new Map<string, string>();
  const providers = sanitized.providers as Record<string, Record<string, unknown>> | undefined;
  for (const [name, provider] of Object.entries(providers ?? {})) {
    if (!("apiKey" in provider)) continue;
    if (isSecretReference(provider.apiKey)) {
      keys.set(name, ""); // A stored literal otherwise shadows this reference in Pi.
      continue;
    }
    if (typeof provider.apiKey !== "string") throw new Error("Provider API key must be a string.");
    keys.set(name, provider.apiKey.trim());
    delete provider.apiKey;
  }
  if (keys.size) await credentials.saveApiKeys(keys, () => write(sanitized));
  else write(sanitized);
}
