import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test, { after, beforeEach } from "node:test";
import { createJiti } from "jiti";

// Real encrypted storage in a temporary agent dir; nothing here touches ~/.pi.
const agentDir = await mkdtemp(path.join(os.tmpdir(), "pi-web-api-key-route-"));
const credentialsPath = path.join(agentDir, "credentials.json");
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
const originalOffline = process.env.PI_OFFLINE;
process.env.PI_CODING_AGENT_DIR = agentDir;
process.env.PI_OFFLINE = "1";
after(async () => {
  if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR;
  else process.env.PI_CODING_AGENT_DIR = originalAgentDir;
  if (originalOffline === undefined) delete process.env.PI_OFFLINE;
  else process.env.PI_OFFLINE = originalOffline;
  await rm(agentDir, { recursive: true, force: true });
});

const jiti = createJiti(import.meta.url, {
  alias: { "@": process.cwd() },
  interopDefault: true,
  moduleCache: false,
});
const apiKeyRoute = await jiti.import("./route.ts");
const providersRoute = await jiti.import("../../providers/route.ts");
const { createPilaudeCredentialStore } = await jiti.import("../../../../../lib/credential-store.ts");
const store = createPilaudeCredentialStore(agentDir);
const windowsOnly = { skip: process.platform !== "win32" };

const SECRET = "sk-test-ab12cd34ef56gh78ij90kl12mn34op56";
const params = (provider) => ({ params: Promise.resolve({ provider }) });

beforeEach(async () => {
  if (process.platform !== "win32") return;
  await store.modify("openai", async () => ({ type: "api_key", key: SECRET }));
  await store.modify("anthropic", async () => ({
    type: "oauth", access: "oauth-access", refresh: "oauth-refresh", expires: Date.now() + 3_600_000,
  }));
});

test("saving requires a non-empty key", async () => {
  for (const apiKey of [undefined, "", "   ", 42]) {
    const response = await apiKeyRoute.POST(new Request("http://localhost/api/auth/api-key/openai", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ apiKey }),
    }), params("openai"));
    assert.equal(response.status, 400, JSON.stringify(apiKey));
  }
  if (process.platform === "win32") assert.equal((await store.read("openai")).key, SECRET);
});

test("delete removes an API key but never an OAuth login", windowsOnly, async () => {
  const oauth = await apiKeyRoute.DELETE(new Request("http://localhost"), params("anthropic"));
  assert.equal(oauth.status, 409);
  assert.equal((await store.read("anthropic")).type, "oauth");

  const apiKey = await apiKeyRoute.DELETE(new Request("http://localhost"), params("openai"));
  assert.equal(apiKey.status, 200);
  assert.equal(await store.read("openai"), undefined);
  assert.equal((await store.read("anthropic")).type, "oauth");
});

test("saving persists encrypted credentials and returns no secret", windowsOnly, async () => {
  const replacement = "pilaude-route-fixture-replacement";
  const response = await apiKeyRoute.POST(new Request("http://localhost/api/auth/api-key/openai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ apiKey: replacement }),
  }), params("openai"));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { success: true });
  assert.equal((await store.read("openai")).key, replacement);
  const raw = await readFile(credentialsPath, "utf8");
  for (const secret of [SECRET, replacement, "oauth-access", "oauth-refresh"]) {
    assert.equal(raw.includes(secret), false);
  }
});

test("provider listings report sign-in state without the stored secret", windowsOnly, async () => {
  const response = await providersRoute.GET();
  assert.equal(response.status, 200);
  const text = await response.text();
  assert.equal(text.includes(SECRET), false);
  assert.equal(text.includes("oauth-access"), false);
  assert.equal(text.includes("oauth-refresh"), false);
  const body = JSON.parse(text);
  assert.ok(Array.isArray(body.apiKeyProviders));
  assert.ok(Array.isArray(body.oauthProviders));
});
