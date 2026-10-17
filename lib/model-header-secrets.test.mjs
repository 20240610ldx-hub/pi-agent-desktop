import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createJiti } from "jiti";
import { createAssistantMessageEventStream, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { setTimeout as delay } from "node:timers/promises";

async function fixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "pilaude-header-secrets-"));
  const previous = process.env.PI_CODING_AGENT_DIR;
  process.env.PI_CODING_AGENT_DIR = directory;
  try {
    const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
    const { savePilaudeModelSettings } = await jiti.import("./pilaude-model-settings");
    const { createPilaudeModelRuntime } = await jiti.import("./pilaude-model-runtime");
    const { createPilaudeCredentialStore } = await jiti.import("./credential-store");
    const { redactModelsJson } = await jiti.import("./models-config-redaction");
    const modelsPath = join(directory, "models.json");
    const credentials = createPilaudeCredentialStore(directory);
    const save = config => writeFileSync(modelsPath, JSON.stringify(config));
    await run({ directory, modelsPath, credentials, save, savePilaudeModelSettings, createPilaudeModelRuntime, redactModelsJson, jiti });
  } finally {
    if (previous === undefined) delete process.env.PI_CODING_AGENT_DIR;
    else process.env.PI_CODING_AGENT_DIR = previous;
    await rm(directory, { recursive: true, force: true });
  }
}

const provider = {
  api: "openai-completions", baseUrl: "https://example.invalid/v1", apiKey: "fixture-only-key",
  headers: { "X-Provider": "private-provider-header" },
  models: [{ id: "probe", headers: { "X-Model": "private-model-header" } }],
  modelOverrides: { probe: { headers: { "X-Override": "private-override-header", "X-Model": "overridden-should-lose" } } },
};

test("saved provider, model and override headers stay encrypted and survive runtime refresh", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const publicText = await readFile(f.modelsPath, "utf8");
  for (const secret of ["private-provider-header", "private-model-header", "private-override-header", "overridden-should-lose"]) {
    assert.equal(publicText.includes(secret), false, "models.json must not contain request secrets");
    assert.equal((await readFile(join(f.directory, "request-secrets.json"), "utf8")).includes(secret), false);
  }
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath, credentials: f.credentials });
  for (let i = 0; i < 2; i++) {
    const result = await runtime.getAuth(runtime.getModel("custom", "probe"));
    assert.equal(result.auth.headers["X-Provider"], "private-provider-header");
    assert.equal(result.auth.headers["X-Model"], "private-model-header");
    assert.equal(result.auth.headers["X-Override"], "private-override-header");
    await runtime.refresh({ allowNetwork: false });
  }
  const saved = JSON.parse(publicText);
  saved.providers.renamed = saved.providers.custom;
  delete saved.providers.custom;
  saved.providers.renamed.apiKey = "fixture-only-key";
  saved.providers.renamed.models[0].id = "renamed-model";
  await f.savePilaudeModelSettings(saved, f.save, f.credentials);
  const renamed = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
  assert.equal((await renamed.getAuth(renamed.getModel("renamed", "renamed-model"))).auth.headers["X-Model"], "private-model-header");
}));

test("legacy GET hides all literal headers and an explicit save preserves renamed values", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  const original = { providers: { custom: provider } };
  await writeFile(f.modelsPath, JSON.stringify(original));
  const draft = f.redactModelsJson(original);
  for (const secret of ["private-provider-header", "private-model-header", "private-override-header"]) assert.equal(JSON.stringify(draft).includes(secret), false);
  assert.equal(await readFile(f.modelsPath, "utf8"), JSON.stringify(original), "redaction must not migrate on read");
  draft.providers.renamed = draft.providers.custom;
  delete draft.providers.custom;
  draft.providers.renamed.apiKey = "fixture-only-key";
  await f.savePilaudeModelSettings(draft, f.save, f.credentials);
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
  assert.equal((await runtime.getAuth(runtime.getModel("renamed", "probe"))).auth.headers["X-Provider"], "private-provider-header");
}));

test("failed asynchronous config publication restores both encrypted stores", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const files = ["models.json", "credentials.json", "request-secrets.json"];
  const previous = await Promise.all(files.map(name => readFile(join(f.directory, name), "utf8")));
  await assert.rejects(f.savePilaudeModelSettings({ providers: { custom: { ...provider, apiKey: "changed-key", headers: { "X-Provider": "changed-header" } } } }, async () => {
    await Promise.resolve(); throw new Error("disk unavailable");
  }, f.credentials), /disk unavailable/);
  assert.deepEqual(await Promise.all(files.map(name => readFile(join(f.directory, name), "utf8"))), previous);
}));

test("unknown saved-header references fail without replacing configuration or exposing supplied values", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const previous = await readFile(f.modelsPath, "utf8");
  const draft = JSON.parse(previous);
  draft.providers.custom.headers["X-Provider"] = "pilaude-secret://missing-sensitive-reference";
  await assert.rejects(f.savePilaudeModelSettings(draft, f.save, f.credentials), error => !error.message.includes("sensitive-reference"));
  assert.equal(await readFile(f.modelsPath, "utf8"), previous);
}));

test("a malformed header vault is preserved and errors do not reflect its content", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const vault = join(f.directory, "request-secrets.json");
  await writeFile(vault, "vault-leak-flag");
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
  await assert.rejects(runtime.getAuth(runtime.getModel("custom", "probe")), error => !error.message.includes("vault-leak-flag"));
  assert.equal(await readFile(vault, "utf8"), "vault-leak-flag");
}));

test("persisted header templates use Pi interpolation and escaping exactly once, like draft probes", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  const before = process.env.PILAUDE_HEADER_TEST;
  process.env.PILAUDE_HEADER_TEST = "value$MUST_NOT_EXPAND";
  try {
    const config = { providers: { custom: { ...provider, headers: {
      "X-Template": "Bearer $PILAUDE_HEADER_TEST", "X-Escaped": "cash$$literal$!",
      "X-Command": "!echo fixture-command-value",
    } } } };
    await f.savePilaudeModelSettings(config, f.save, f.credentials);
    const raw = await readFile(f.modelsPath, "utf8");
    for (const value of Object.values(config.providers.custom.headers)) assert.equal(raw.includes(value), false);
    const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
    const headers = (await runtime.getAuth(runtime.getModel("custom", "probe"))).auth.headers;
    assert.equal(headers["X-Template"], "Bearer value$MUST_NOT_EXPAND");
    assert.equal(headers["X-Escaped"], "cash$literal!");
    assert.equal(headers["X-Command"], "fixture-command-value");
    const { withTransientModelRuntime } = await f.jiti.import("./transient-model-runtime");
    await withTransientModelRuntime(JSON.parse(raw), async probe => {
      assert.deepEqual((await probe.getAuth(probe.getModel("custom", "probe"))).auth.headers, headers);
    });
    const override = (await runtime.getAuth(runtime.getModel("custom", "probe"), { env: { PILAUDE_HEADER_TEST: "override-value" } })).auth.headers;
    assert.equal(override["X-Template"], "Bearer override-value");
  } finally { if (before === undefined) delete process.env.PILAUDE_HEADER_TEST; else process.env.PILAUDE_HEADER_TEST = before; }
}));

test("native provider null header removals keep the SDK contract", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null });
  runtime.registerNativeProvider({
    id: "fixture-native", name: "Fixture native", getModels: () => [],
    auth: { apiKey: { name: "Fake", check: async () => ({ type: "api_key" }), resolve: async () => ({
      auth: { apiKey: "fixture-native-key", headers: { "X-Remove": null, "X-Literal": "literal$value" } }, source: "fixture",
    }) } },
  });
  assert.deepEqual((await runtime.getAuth("fixture-native")).auth.headers, { "X-Remove": null, "X-Literal": "literal$value" });
}));

test("saved command-resolution errors never return the command text", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: { ...provider, headers: { "X-Command": "!pilaude_missing_fixture_command private-command-marker" } } } }, f.save, f.credentials);
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
  await assert.rejects(runtime.getAuth(runtime.getModel("custom", "probe")), error => !error.message.includes("private-command-marker"));
}));

test("provider probe errors redact resolved saved headers and API keys", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const saved = JSON.parse(await readFile(f.modelsPath, "utf8"));
  const previousFetch = globalThis.fetch;
  try {
    for (const path of ["../app/api/models-config/discover/route", "../app/api/models-config/test/route"]) {
      let calls = 0; const reflected = [];
      globalThis.fetch = async (_url, options) => {
        calls++;
        const headers = new Headers(options?.headers);
        const values = [headers.get("authorization"), headers.get("x-provider"), headers.get("x-model")].filter(Boolean);
        reflected.push(...values);
        return new Response(JSON.stringify({ error: { message: `gateway rejected ${values.join(" ")}` } }), { status: 401, headers: { "Content-Type": "application/json" } });
      };
      const { POST } = await f.jiti.import(path);
      const response = await POST(new Request("http://localhost/api/models-config/probe", {
        method: "POST", headers: { Host: "localhost", "Content-Type": "application/json" },
        body: JSON.stringify({ providerName: "custom", provider: saved.providers.custom, model: saved.providers.custom.models[0] }),
      }));
      const text = await response.text();
      assert.equal(calls, 1);
      assert.ok(reflected.some(value => value.includes("private-provider-header")));
      for (const value of reflected) assert.equal(text.includes(value), false, `${path} must redact resolved request secrets`);
    }
  } finally { globalThis.fetch = previousFetch; }
}));

test("ordinary model stream errors are redacted before results and client events", { skip: process.platform !== "win32" }, async () => fixture(async f => {
  await f.savePilaudeModelSettings({ providers: { custom: provider } }, f.save, f.credentials);
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: f.modelsPath });
  const previous = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error: { message: "gateway rejected private-provider-header fixture-only-key" } }), { status: 401, headers: { "Content-Type": "application/json" } });
  try {
    const stream = runtime.streamSimple(runtime.getModel("custom", "probe"), { messages: [{ role: "user", content: "fixture", timestamp: Date.now() }] }, { maxRetries: 0 });
    const events = []; for await (const event of stream) events.push(event);
    const result = await stream.result();
    assert.equal(result.stopReason, "error");
    const { toClientAgentEvent } = await f.jiti.import("./agent-event-wire");
    const wire = toClientAgentEvent({ type: "message_end", message: result });
    for (const value of ["private-provider-header", "fixture-only-key"]) {
      assert.equal(JSON.stringify({ events, result, wire }).includes(value), false);
    }
  } finally { globalThis.fetch = previous; }
}));

test("queued partials cannot acquire secrets through later provider mutation", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null });
  const model = { id: "probe", name: "Probe", api: "openai-completions", provider: "late-native", baseUrl: "https://example.invalid",
    reasoning: false, input: ["text"], contextWindow: 100, maxTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
  const source = () => {
    const stream = createAssistantMessageEventStream();
    const message = { role: "assistant", api: model.api, provider: model.provider, model: model.id, content: [],
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
      stopReason: "stop", timestamp: Date.now() };
    setTimeout(() => {
      stream.push({ type: "start", partial: message });
      setTimeout(() => {
        message.stopReason = "error";
        message.errorMessage = "gateway echoed fake-late-header";
        stream.push({ type: "error", reason: "error", error: message });
      }, 5);
    }, 0);
    return stream;
  };
  runtime.registerNativeProvider({ id: model.provider, name: "Late native", getModels: () => [model],
    auth: { apiKey: { name: "Fake", check: async () => ({ type: "api_key" }), resolve: async () => ({
      auth: { apiKey: "fake-key", headers: { "X-Private": "fake-late-header" } }, source: "fixture",
    }) } }, stream: source, streamSimple: source });
  const stream = runtime.streamSimple(runtime.getModel(model.provider, model.id), { messages: [] });
  await delay(40);
  const events = []; for await (const event of stream) events.push(event);
  assert.deepEqual(events.map(event => event.type), ["start", "error"]);
  assert.equal(JSON.stringify({ events, result: await stream.result() }).includes("fake-late-header"), false);
}));

test("auth cancellation retains its DOMException contract without reflecting its reason", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null, credentials: new InMemoryCredentialStore() });
  for (const name of ["AbortError", "TimeoutError"]) {
    const signal = AbortSignal.abort(new DOMException("private-cancellation-marker", name));
    await assert.rejects(runtime.getAuth("deepseek", { signal }), error => {
      assert.ok(error instanceof DOMException);
      assert.equal(error.name, name);
      assert.equal(error.message.includes("private-cancellation-marker"), false);
      return true;
    });
  }
}));

test("auth failures retain the SDK error code without a secret-bearing cause", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null, credentials: new InMemoryCredentialStore() });
  runtime.registerNativeProvider({ id: "failed-auth", name: "Failed auth", getModels: () => [],
    auth: { apiKey: { name: "Fake", check: async () => ({ type: "api_key" }), resolve: async () => { throw new Error("private-auth-marker"); } } } });
  await assert.rejects(runtime.getAuth("failed-auth"), error => {
    assert.equal(error.code, "auth");
    assert.equal(error.message.includes("private-auth-marker"), false);
    assert.equal(error.cause, undefined);
    return true;
  });
}));

test("concurrent native streams isolate request secrets and redact end-only and deferred results", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null, credentials: new InMemoryCredentialStore() });
  const observed = [];
  const models = ["first", "second"].map(id => {
    const model = { id: "probe", name: "Probe", api: "openai-completions", provider: `concurrent-${id}`, baseUrl: "https://example.invalid",
      reasoning: false, input: ["text"], contextWindow: 100, maxTokens: 10, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 } };
    const source = (_model, _context, options) => {
      observed.push([id, options.apiKey, options.headers["X-Private"]]);
      const stream = createAssistantMessageEventStream();
      setTimeout(() => {
        const message = { role: "assistant", api: model.api, provider: model.provider, model: model.id, content: [],
          usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: "error", errorMessage: `gateway ${id}-private-key ${id}-private-header`, timestamp: Date.now() };
        if (id === "first") stream.end(message);
        else stream.push({ type: "error", reason: "error", error: message });
      }, id === "first" ? 5 : 40);
      return stream;
    };
    runtime.registerNativeProvider({ id: model.provider, name: id, getModels: () => [model],
      auth: { apiKey: { name: "Fake", check: async () => ({ type: "api_key" }), resolve: async () => {
        await delay(id === "first" ? 15 : 0);
        return { auth: { apiKey: `${id}-private-key`, headers: { "X-Private": `${id}-private-header` } }, source: "fixture" };
      } } }, stream: source, streamSimple: source, fetchDeferred: source });
    return model;
  });
  const streams = [runtime.stream(models[0], { messages: [] }), runtime.streamSimple(models[1], { messages: [] })];
  await Promise.all(streams.map(async (stream, i) => {
    const events = []; for await (const event of stream) events.push(event);
    if (i === 0) assert.equal(events.length, 0, "end-only providers must keep their event contract");
    assert.equal((await stream.result()).stopReason, "error");
    assert.equal(JSON.stringify({ events, result: await stream.result() }).includes("-private-"), false);
  }));
  const deferred = await runtime.fetchDeferred(models[1], { type: "fixture" });
  assert.equal(deferred.errorMessage.includes("-private-"), false);
  assert.deepEqual(observed, [["second", "second-private-key", "second-private-header"], ["first", "first-private-key", "first-private-header"], ["second", "second-private-key", "second-private-header"]]);
}));

test("image, classifier and deferred cancellation errors redact actual resolved auth", async () => fixture(async f => {
  const runtime = await f.createPilaudeModelRuntime({ modelsPath: null, credentials: new InMemoryCredentialStore() });
  const observed = [];
  const fail = operation => async (_model, _context, options) => {
    observed.push(operation);
    assert.equal(options.headers["X-Private"], "nonchat-private-header");
    throw new Error("gateway nonchat-private-header nonchat-private-key");
  };
  const model = { id: "probe", name: "Probe", api: "fixture", provider: "nonchat-fixture", input: ["text"] };
  runtime.registerNativeProvider({ id: model.provider, name: "Nonchat fixture", getModels: () => [],
    auth: { apiKey: { name: "Fake", check: async () => ({ type: "api_key" }), resolve: async () => ({
      auth: { apiKey: "nonchat-private-key", headers: { "X-Private": "nonchat-private-header" } }, source: "fixture",
    }) } }, generateImages: fail("images"), classify: fail("classifier"), cancelDeferred: fail("cancel") });
  for (const result of [await runtime.generateImages({ ...model, type: "image" }, { prompt: "fixture" }), await runtime.classify({ ...model, type: "classifier" }, {})]) {
    assert.equal(result.stopReason, "error");
    assert.equal(result.errorMessage.includes("nonchat-private-"), false);
  }
  await assert.rejects(runtime.cancelDeferred(model, { type: "fixture" }), error => !error.message.includes("nonchat-private-"));
  assert.deepEqual(observed, ["images", "classifier", "cancel"]);
}));
