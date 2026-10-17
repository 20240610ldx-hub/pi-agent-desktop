import { getAgentDir, ModelRuntime, type CreateModelRuntimeOptions } from "@earendil-works/pi-coding-agent";
import { createPilaudeCredentialStore } from "./credential-store";

/** All Pilaude model/auth entry points share the app-owned encrypted store. */
export function createPilaudeModelRuntime(options: CreateModelRuntimeOptions = {}): Promise<ModelRuntime> {
  return ModelRuntime.create({ ...options, credentials: options.credentials ?? createPilaudeCredentialStore(getAgentDir()) });
}
