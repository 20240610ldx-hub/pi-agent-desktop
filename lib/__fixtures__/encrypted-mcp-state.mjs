import { createJiti } from "jiti";
const { encryptedMcpAuthBackend } = await createJiti(import.meta.url).import("../encrypted-mcp-auth");

export function writeMcpState(agentDir, state) {
  encryptedMcpAuthBackend(agentDir).withLock(() => ({ result: undefined, next: JSON.stringify(state) }));
}
export function readMcpState(agentDir) {
  return JSON.parse(encryptedMcpAuthBackend(agentDir).read() ?? "{}");
}
