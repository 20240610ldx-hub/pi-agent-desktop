import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test, { after } from "node:test";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const temporary = mkdtempSync(join(tmpdir(), "pi-output-style-api-"));
const originalAgentDir = process.env.PI_CODING_AGENT_DIR;
process.env.PI_CODING_AGENT_DIR = temporary;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": root }, tsconfigPaths: true });
const { GET, PUT } = await jiti.import("./[id]/output-style/route.ts");
const { cacheSessionPath } = await jiti.import("@/lib/session-reader.ts");
const { getRpcSession, AgentSessionWrapper } = await jiti.import("@/lib/rpc-manager.ts");
const { createSessionOutputStyle } = await jiti.import("@/lib/session-output-style.ts");
const { createOutputStyleStore } = await jiti.import("@/lib/output-style-store.ts");
after(() => { if (originalAgentDir === undefined) delete process.env.PI_CODING_AGENT_DIR; else process.env.PI_CODING_AGENT_DIR = originalAgentDir; rmSync(temporary, { recursive: true, force: true }); });

function session(tools) {
  const manager = SessionManager.create(temporary, join(temporary, "sessions"));
  manager.appendMessage({ role: "user", content: "Mock session", timestamp: 1 });
  if (tools) manager.appendCustomEntry("pi-web:tool-selection", { version: 1, tools });
  const id = manager.getSessionId();
  cacheSessionPath(id, manager.getSessionFile());
  return { id, path: manager.getSessionFile(), params: { params: Promise.resolve({ id }) } };
}
function request(id, styleId, extra = {}) {
  return new Request(`http://localhost/api/sessions/${id}/output-style`, { method: "PUT", headers: { Host: "localhost", "Content-Type": "application/json", ...extra }, body: JSON.stringify({ styleId }) });
}

test("reading and selecting a cold session style persists without starting a runtime or model", async () => {
  const s = session();
  let response = await GET(new Request(`http://localhost/api/sessions/${s.id}/output-style`), s.params);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).selectedId, "default");
  assert.equal(getRpcSession(s.id), undefined);
  response = await PUT(request(s.id, "explanatory"), s.params);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).selectedId, "explanatory");
  response = await GET(new Request(`http://localhost/api/sessions/${s.id}/output-style`), s.params);
  assert.equal((await response.json()).selectedId, "explanatory");
  assert.equal(getRpcSession(s.id), undefined);
  const reopened = SessionManager.open(s.path, dirname(s.path));
  assert.deepEqual(reopened.getEntries().at(-1).data, { version: 1, styleId: "explanatory" });
});

test("cold Chat-only and subagent sessions truthfully report unsupported styles", async () => {
  const chat = session([]);
  let response = await GET(new Request("http://localhost"), chat.params);
  assert.deepEqual(await response.json(), { supported: false, reason: "exact-system-prompt", selectedId: "default", styles: [] });
  assert.equal((await PUT(request(chat.id, "learning"), chat.params)).status, 409);
  assert.equal(SessionManager.open(chat.path, dirname(chat.path)).getEntries().at(-1).customType, "pi-web:tool-selection");
  const child = session();
  const manager = SessionManager.open(child.path, dirname(child.path));
  manager.appendCustomEntry("pi-web:subagent", { version: 1, parentSessionId: "mock-parent", parentSessionPath: "mock-parent.jsonl", resourceSnapshot: { version: 1, appendSystemPrompt: ["Profile-owned prompt"], tools: ["read"], loadSkills: false, loadExtensions: false } });
  response = await GET(new Request("http://localhost"), child.params);
  assert.equal((await response.json()).reason, "subagent");
  assert.equal((await PUT(request(child.id, "learning"), child.params)).status, 409);
});

test("live metadata commands update the owning SessionManager and stale idle wrappers yield to disk", async () => {
  const s = session();
  const manager = SessionManager.open(s.path, dirname(s.path));
  const store = createOutputStyleStore();
  const outputStyle = createSessionOutputStyle(manager, { customStyles: () => store.list() });
  const wrapper = new AgentSessionWrapper({ sessionId: s.id, sessionFile: s.path, sessionManager: manager, isStreaming: false, isCompacting: false, isBashRunning: false, dispose: () => {} }, { outputStyle });
  globalThis.__piSessions ??= new Map();
  globalThis.__piSessions.set(s.id, wrapper);
  try {
    assert.equal((await (await PUT(request(s.id, "concise"), s.params)).json()).selectedId, "concise");
    assert.equal(outputStyle.getState().selectedId, "concise");
    const external = SessionManager.open(s.path, dirname(s.path));
    external.appendCustomEntry("pi-web:output-style", { version: 1, styleId: "learning" });
    const response = await GET(new Request("http://localhost"), s.params);
    assert.equal((await response.json()).selectedId, "learning");
    assert.equal(wrapper.isAlive(), false);
  } finally { globalThis.__piSessions.delete(s.id); wrapper.destroy(); }
});

test("session style mutations validate origin, media type, unknown IDs and missing sessions", async () => {
  const s = session();
  assert.equal((await PUT(request(s.id, "concise", { Origin: "https://elsewhere.example" }), s.params)).status, 403);
  assert.equal((await PUT(request(s.id, "concise", { "Content-Type": "text/plain" }), s.params)).status, 415);
  const unknown = await PUT(request(s.id, "unknown"), s.params);
  assert.equal(unknown.status, 400, JSON.stringify(await unknown.json()));
  assert.equal((await PUT(request(s.id, undefined), s.params)).status, 400);
  assert.equal((await GET(new Request("http://localhost"), s.params)).status, 200);
  assert.equal(getRpcSession(s.id), undefined);
});

test("unexpected session metadata failures do not disclose private error contents", async () => {
  const s = session();
  const marker = "PRIVMARK42";
  globalThis.__piSessions ??= new Map();
  globalThis.__piSessions.set(s.id, { isAlive: () => true, evictIfDiskAhead: () => false, send: async () => { throw new Error(marker); } });
  try {
    for (const response of [await GET(new Request("http://localhost"), s.params), await PUT(request(s.id, "concise"), s.params)]) {
      assert.equal(response.status, 500);
      assert.equal((await response.text()).includes(marker), false, "unexpected session failures must use a generic public error");
    }
  } finally { globalThis.__piSessions.delete(s.id); }
});
