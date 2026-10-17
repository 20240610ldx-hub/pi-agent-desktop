import assert from "node:assert/strict";
import test from "node:test";
import { createJiti } from "jiti";
const { POST } = await createJiti(import.meta.url, { tsconfigPaths: true }).import("./route");

test("discovery rejects an untrusted origin and non-JSON body before contacting any provider", async () => {
  const original = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return Response.json({ data: [{ id: "fixture" }] }); };
  try {
    for (const [headers, status] of [
      [{ Host: "localhost", Origin: "https://untrusted.example", "Content-Type": "application/json" }, 403],
      [{ Host: "localhost", "Content-Type": "text/plain" }, 415],
    ]) {
      const request = new Request("http://localhost/api/models-config/discover", { method: "POST", headers,
        body: JSON.stringify({ providerName: "fixture", provider: { api: "openai-completions", baseUrl: "https://example.invalid/v1", apiKey: "fixture-key" } }),
      });
      assert.equal((await POST(request)).status, status);
      assert.equal(calls, 0);
    }
  } finally { globalThis.fetch = original; }
});
