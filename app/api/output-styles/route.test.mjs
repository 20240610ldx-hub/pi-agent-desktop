import assert from "node:assert/strict";
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { createJiti } from "jiti";

const directory = mkdtempSync(join(tmpdir(), "pi-output-definitions-api-"));
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = directory;
const jiti = createJiti(import.meta.url, { alias: { "@": fileURLToPath(new URL("../../../", import.meta.url)) }, tsconfigPaths: true });
const { GET, POST, PUT } = await jiti.import("./route.ts");
after(() => { if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = originalAgentDir; rmSync(directory, { recursive: true, force: true }); });
const request = (method, body, headers = {}) => new Request("http://localhost/api/output-styles", { method, headers: { Host: "localhost", "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

test("definition API creates an editable custom style beside immutable built-ins", async () => {
  let response = await GET();
  assert.equal(response.status, 200);
  assert.equal((await response.json()).styles[0].id, "default");
  response = await POST(request("POST", { name: "Worked examples", instructions: "Give one compact worked example." }));
  assert.equal(response.status, 201);
  const { style } = await response.json();
  assert.equal(style.builtin, false);
  response = await PUT(request("PUT", { id: style.id, name: "Examples", instructions: "Explain with an example." }));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).style.id, style.id);
  const list = (await (await GET()).json()).styles;
  assert.deepEqual(list.at(-1), { id: style.id, name: "Examples", instructions: "Explain with an example.", builtin: false });
  assert.equal(list.length, 6);
});

test("definition mutations reject cross-origin requests, wrong content type and invalid definitions", async () => {
  for (const call of [POST, PUT]) {
    assert.equal((await call(request("POST", { name: "Example", instructions: "Example" }, { Origin: "https://elsewhere.example" }))).status, 403);
    assert.equal((await call(request("POST", {}, { "Content-Type": "text/plain" }))).status, 415);
  }
  assert.equal((await POST(request("POST", { name: "x".repeat(81), instructions: "x" }))).status, 400);
  assert.equal((await POST(request("POST", { name: "x", instructions: "x".repeat(16001) }))).status, 400);
  assert.equal((await PUT(request("PUT", { id: "concise", name: "x", instructions: "x" }))).status, 400);
  const invalidJson = new Request("http://localhost/api/output-styles", { method: "POST", headers: { Host: "localhost", "Content-Type": "application/json" }, body: "{" });
  assert.equal((await POST(invalidJson)).status, 400);
});

test("malformed definition storage returns generic errors without disclosing stored instructions", async () => {
  const marker = "PRIVMARK42";
  const path = join(directory, "pi-web", "output-styles.json");
  mkdirSync(join(directory, "pi-web"), { recursive: true });
  let previous;
  try { previous = readFileSync(path, "utf8"); } catch (error) { if (error.code !== "ENOENT") throw error; }
  writeFileSync(path, `{"instructions": ${marker}}`);
  try {
    const responses = [await GET(), await POST(request("POST", { name: "Valid", instructions: "Valid" })), await PUT(request("PUT", { id: "custom:00000000-0000-0000-0000-000000000000", name: "Valid", instructions: "Valid" }))];
    for (const response of responses) {
      assert.equal(response.status, 500);
      const body = await response.text();
      assert.equal(body.includes(marker), false, "error responses must not contain stored instructions");
      assert.equal(body.includes(directory), false, "error responses must not expose private file paths");
    }
  } finally { if (previous === undefined) rmSync(path); else writeFileSync(path, previous); }
});
