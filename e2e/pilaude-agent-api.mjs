import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { chromium } from "playwright";

const url = "http://127.0.0.1:30141";
const project = resolve(process.argv[2] ?? "test-results/pilaude/runtime-data/project");
const data = dirname(project);
const artifacts = resolve("test-results/pilaude/agent-api");
const provider = "pilaude-encrypted-fixture";
const key = "pilaude-local-not-a-real-provider-key";
const answer = "Pilaude encrypted credential runtime verified.";
const headers = { "Content-Type": "application/json" };
let requests = 0;
let sessionId;
let browser;
const api = async (path, method = "GET", body) => {
  const response = await fetch(url + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(45000) });
  const result = await response.json();
  assert.ok(response.ok, `${method} ${path}: ${result.error ?? response.status}`);
  return result;
};

// Refuse to run against a user's normal application data.
const metadata = await api("/api/data");
assert.equal(resolve(metadata.agentDir).toLowerCase(), data.toLowerCase(), "Start an isolated fixture server first");
assert.ok(data.startsWith(resolve("test-results/pilaude")), "Use the test-results data root");
const previousConfig = await api("/api/models-config");
const settingsPath = join(data, "settings.json");
const previousSettings = await readFile(settingsPath, "utf8");
const server = createServer(async (request, response) => {
  if (request.url !== "/v1/chat/completions" || request.headers.authorization !== `Bearer ${key}`) {
    response.writeHead(401).end("Fixture authentication required"); return;
  }
  let body = "";
  for await (const chunk of request) body += chunk;
  assert.equal(JSON.parse(body).model, "fixture");
  requests++;
  response.writeHead(200, { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" });
  const chunk = (delta, finish_reason = null) => ({ id: "pilaude-fixture", object: "chat.completion.chunk", created: 1, model: "fixture", choices: [{ index: 0, delta, finish_reason }] });
  response.write(`data: ${JSON.stringify(chunk({ role: "assistant", content: answer }))}\n\n`);
  response.write(`data: ${JSON.stringify(chunk({}, "stop"))}\n\n`);
  response.end("data: [DONE]\n\n");
});
server.listen(0, "127.0.0.1");
await once(server, "listening");
try {
  const settings = JSON.parse(previousSettings);
  await writeFile(settingsPath, JSON.stringify({ ...settings, enabledModels: [...(settings.enabledModels ?? []), `${provider}/*`] }, null, 2));
  const config = { ...previousConfig, providers: { ...previousConfig.providers, [provider]: {
    api: "openai-completions", baseUrl: `http://127.0.0.1:${server.address().port}/v1`, authHeader: true, apiKey: key,
    models: [{ id: "fixture", name: "Pilaude local fixture", input: ["text"], contextWindow: 8192, maxTokens: 128 }],
  } } };
  await api("/api/models-config", "PUT", config);
  assert.equal((await readFile(join(data, "models.json"), "utf8")).includes(key), false);
  assert.equal((await readFile(join(data, "credentials.json"), "utf8")).includes(key), false);
  await api("/api/models/default", "PUT", { cwd: project, provider, modelId: "fixture" });
  const created = await api("/api/agent/new", "POST", {
    cwd: project, type: "prompt", message: "Verify this local fixture once.",
    provider, modelId: "fixture", thinkingLevel: "off", toolNames: [],
  });
  sessionId = created.sessionId;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 840 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(`${url}/?session=${encodeURIComponent(sessionId)}`);
  await page.getByText(answer, { exact: true }).waitFor({ timeout: 45000 });
  assert.equal(requests, 1, "The SDK must call the local model exactly once with the decrypted credential");
  assert.deepEqual(errors, []);
  await mkdir(artifacts, { recursive: true });
  await page.screenshot({ path: join(artifacts, "encrypted-agent-stream.png") });
  const result = { encrypted: true, sdkRequests: requests, streamedInUi: true, sessionId, status: "passed" };
  await writeFile(join(artifacts, "result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
} finally {
  await browser?.close();
  if (sessionId) { await api(`/api/agent/${sessionId}`, "POST", { type: "abort" }); await api(`/api/sessions/${sessionId}`, "DELETE"); }
  await api(`/api/auth/api-key/${provider}`, "DELETE");
  await writeFile(settingsPath, previousSettings);
  await api("/api/models-config", "PUT", previousConfig);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}
