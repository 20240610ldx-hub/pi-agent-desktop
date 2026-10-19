import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
  getCurrentTools,
  Type,
} from "@earendil-works/pi-ai";
import {
  createAgentSessionFromServices,
  createAgentSessionServices,
  DefaultResourceLoader,
  ModelRuntime,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const { createSubagentExtension, preferPiWebSubagentExtension } = await createJiti(import.meta.url).import("./subagent-extension.ts");

const CONTROL_TOOLS = ["Agent", "get_subagent_result", "steer_subagent"];

// Only `get` answers, so the test can tell a call the model issued itself from one that reached
// the runtime from a script.
function recordingRuntime() {
  const calls = [];
  const refuse = (name) => async () => {
    calls.push(name);
    throw new Error(`${name} must not run`);
  };
  return {
    calls,
    runtime: {
      start: refuse("start"),
      resume: refuse("resume"),
      async get(sessionId) {
        calls.push(`get:${sessionId}`);
        return {
          sessionId,
          sessionPath: "/tmp/child.jsonl",
          parentSessionId: "parent-session",
          parentToolCallId: "model-call",
          profile: "explore",
          description: "Find parser",
          task: "Find the parser",
          runInBackground: false,
          status: "completed",
          result: "The parser is in lib/parse.ts.",
          createdAt: "2026-01-01T00:00:00.000Z",
          completedAt: "2026-01-01T00:00:01.000Z",
        };
      },
      steer: refuse("steer"),
      notifyParent: refuse("notifyParent"),
      markResultConsumed: () => calls.push("markResultConsumed"),
    },
  };
}

// Stands in for codemode: a direct tool that calls other tools through `ctx.executeTool()`.
function nestedCallerExtension(outcomes) {
  return (pi) => {
    pi.registerTool({
      name: "echo",
      label: "echo",
      description: "Return the text it was given.",
      parameters: Type.Object({ text: Type.String() }),
      async execute(_toolCallId, params) {
        return { content: [{ type: "text", text: params.text }], details: undefined };
      },
    });
    pi.registerTool({
      name: "script",
      label: "script",
      description: "Call other tools the way a codemode script does.",
      parameters: Type.Object({}),
      async execute(_toolCallId, _params, _signal, _onUpdate, ctx) {
        const calls = [
          ["echo", { text: "nested calls work" }],
          ["Agent", { prompt: "Find the parser", description: "Find parser" }],
          ["get_subagent_result", { agent_id: "child-session" }],
          ["steer_subagent", { agent_id: "child-session", message: "Stop" }],
        ];
        for (const [name, args] of calls) {
          const outcome = await ctx.executeTool(name, args);
          outcomes.push({
            name,
            isError: outcome.isError,
            text: outcome.result.content.map((block) => block.text).join(""),
          });
        }
        return { content: [{ type: "text", text: "script done" }], details: undefined };
      },
    });
  };
}

async function createSession(dir, faux, extensionFactories) {
  const modelRuntime = await ModelRuntime.create({
    authPath: join(dir, "auth.json"),
    modelsPath: null,
    refreshOnCreate: false,
  });
  modelRuntime.registerNativeProvider(faux.provider);
  const services = await createAgentSessionServices({
    cwd: dir,
    agentDir: dir,
    settingsManager: SettingsManager.inMemory(),
    modelRuntime,
    resourceLoaderOptions: {
      noSkills: true,
      noPromptTemplates: true,
      noThemes: true,
      noContextFiles: true,
      extensionFactories,
    },
  });
  const { session } = await createAgentSessionFromServices({
    services,
    sessionManager: SessionManager.inMemory(dir),
    model: faux.getModel("faux-model"),
  });
  return session;
}

function textOf(message) {
  return message.content.map((block) => block.text ?? "").join("");
}

// A codemode script must not start, collect, or steer subagents: a run started from a script
// would carry a nested parentToolCallId that no transcript entry has, so the chat could not
// link to its session. The model itself keeps all three tools and can still call them.
test("subagent control tools are declared to the model but cannot be called from another tool", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-subagent-exposure-"));
  let session;
  try {
    const faux = fauxProvider({ models: [{ id: "faux-model" }] });
    const { calls, runtime } = recordingRuntime();
    const outcomes = [];
    session = await createSession(dir, faux, [
      createSubagentExtension(runtime, () => []),
      nestedCallerExtension(outcomes),
    ]);

    const toolsByName = new Map(session.getAllTools().map((tool) => [tool.name, tool]));
    for (const name of CONTROL_TOOLS) assert.equal(toolsByName.get(name)?.exposure, "model-only", name);
    const active = session.getActiveToolNames();
    for (const name of CONTROL_TOOLS) assert.ok(active.includes(name), `${name} should be active`);
    const callable = session.getCallableToolNames();
    assert.ok(callable.includes("echo"));
    for (const name of CONTROL_TOOLS) assert.ok(!callable.includes(name), `${name} should not be callable`);

    let declared = [];
    faux.setResponses([
      (context) => {
        declared = getCurrentTools(context.messages).map((tool) => tool.name);
        return fauxAssistantMessage(
          [fauxToolCall("get_subagent_result", { agent_id: "child-session" })],
          { stopReason: "toolUse" },
        );
      },
      fauxAssistantMessage([fauxToolCall("script", {})], { stopReason: "toolUse" }),
      fauxAssistantMessage([fauxText("done")]),
    ]);
    await session.prompt("run the script");

    for (const name of CONTROL_TOOLS) assert.ok(declared.includes(name), `${name} should be declared`);
    const modelResult = session.agent.state.messages.find(
      (message) => message.role === "toolResult" && message.toolName === "get_subagent_result",
    );
    assert.equal(modelResult?.isError, false);
    assert.equal(textOf(modelResult), "Subagent child-session completed.\n\nThe parser is in lib/parse.ts.");
    assert.deepEqual(outcomes, [
      { name: "echo", isError: false, text: "nested calls work" },
      { name: "Agent", isError: true, text: "Tool Agent not found" },
      { name: "get_subagent_result", isError: true, text: "Tool get_subagent_result not found" },
      { name: "steer_subagent", isError: true, text: "Tool steer_subagent not found" },
    ]);
    // Only the model's own call reached the runtime.
    assert.deepEqual(calls, ["get:child-session"]);
  } finally {
    session?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});

async function realLoaderPackageIdentity(directoryName, manifest, hostMode = "enabled", outerPackage) {
  const root = await mkdtemp(join(tmpdir(), "pilaude-subagent-package-identity-"));
  try {
    const packageDir = join(root, "node_modules", directoryName);
    await mkdir(join(packageDir, "dist"), { recursive: true });
    if (outerPackage) await writeFile(join(root, "package.json"), JSON.stringify({ name: outerPackage, type: "module" }));
    await writeFile(join(packageDir, "package.json"), typeof manifest === "string" ? manifest : JSON.stringify({ version: "0.0.0", type: "module", ...manifest }));
    const filename = join(packageDir, "dist", "index.mjs");
    await writeFile(filename, 'export default pi => pi.registerTool({ name: "subagent", label: "subagent", description: "Generated package identity fixture", parameters: { type: "object" }, execute: async () => ({content: [], details: undefined}) });');
    let seen;
    const loader = new DefaultResourceLoader({
      cwd: root, agentDir: root, settingsManager: SettingsManager.inMemory(),
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      additionalExtensionPaths: [filename],
      extensionFactories: hostMode === "absent" ? [] : [{ name: "pi-web-subagents", factory(pi) {
        if (hostMode === "enabled") pi.registerTool({ name: "Agent", label: "Agent", description: "Generated host", parameters: { type: "object" }, execute: async () => ({ content: [], details: undefined }) });
      } }],
      extensionsOverride(base) {
        const candidate = base.extensions.find(extension => extension.path === filename);
        seen = candidate?.sourceInfo?.source;
        return preferPiWebSubagentExtension(base);
      },
    });
    await loader.reload();
    assert.equal(seen, "local", "The real override runs before npm source metadata is applied");
    return loader.getExtensions().extensions.some(extension => extension.path === filename);
  } finally { await rm(root, { recursive: true, force: true }); }
}

test("real loader filters pi-subagents under an alias using its nearest actual package manifest", async () => {
  assert.equal(await realLoaderPackageIdentity("review-agent-alias", { name: "pi-subagents" }), false);
});

test("real loader preserves a different package under a pi-subagents directory", async () => {
  assert.equal(await realLoaderPackageIdentity("pi-subagents", { name: "review-other-tools" }), true);
});

test("real loader stops at the nearest package boundary and preserves absent or disabled host choices", async () => {
  assert.equal(await realLoaderPackageIdentity("pi-subagents", { type: "module" }, "enabled", "pi-subagents"), true);
  assert.equal(await realLoaderPackageIdentity("review-agent-alias", { name: "pi-subagents" }, "absent"), true);
  assert.equal(await realLoaderPackageIdentity("review-agent-alias", { name: "pi-subagents" }, "disabled"), true);
});

test("a session with the subagent feature switched off registers no control tools", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pi-web-subagent-disabled-"));
  let session;
  try {
    const faux = fauxProvider({ models: [{ id: "faux-model" }] });
    const { runtime } = recordingRuntime();
    session = await createSession(dir, faux, [createSubagentExtension(runtime, () => [], () => false)]);

    const names = session.getAllTools().map((tool) => tool.name);
    for (const name of CONTROL_TOOLS) assert.ok(!names.includes(name), `${name} should not be registered`);
  } finally {
    session?.dispose();
    await rm(dir, { recursive: true, force: true });
  }
});
