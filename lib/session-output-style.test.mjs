import assert from "node:assert/strict";
import test from "node:test";
import { SessionManager, SettingsManager, ModelRuntime, createAgentSessionServices, createAgentSessionFromServices } from "@earendil-works/pi-coding-agent";
import { fauxProvider, fauxAssistantMessage, fauxText, getCurrentSystemPrompt, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { tsconfigPaths: true });
const { createSessionOutputStyle } = await jiti.import("./session-output-style.ts");
const { createOutputStyleExtension } = await jiti.import("./output-style-extension.ts");
const { AgentSessionWrapper } = await jiti.import("./rpc-manager.ts");
const { createOutputStyleStore } = await jiti.import("./output-style-store.ts");

function fixture(manager = SessionManager.inMemory(), options = {}) {
  const outputStyle = createSessionOutputStyle(manager, { customStyles: () => [], ...options });
  let handler;
  createOutputStyleExtension(outputStyle).factory({ on: (name, callback) => { assert.equal(name, "before_agent_start"); handler = callback; } });
  const prompts = [];
  const inner = {
    sessionId: manager.getSessionId(), isStreaming: false, isCompacting: false, isBashRunning: false,
    sessionManager: manager, agent: { state: {} }, getContextUsage: () => null, dispose: () => {},
    settingsManager: { setProjectTrusted: () => {} }, extensionRunner: { getRegisteredCommands: () => [], emit: async () => {} },
    resourceLoader: { getSkills: () => ({ skills: [] }) }, promptTemplates: [],
    getSteeringMessages: () => [], getFollowUpMessages: () => [],
    prompt: async () => {
      const event = { systemPromptOptions: { sections: { existing: "Existing system guidance" } } };
      handler(event);
      prompts.push(event.systemPromptOptions.sections);
    },
  };
  const wrapper = new AgentSessionWrapper(inner, { outputStyle });
  return { manager, wrapper, outputStyle, prompts, handler };
}

test("selecting a session output style changes the next prompt and survives a new controller", async () => {
  const { manager, wrapper, prompts } = fixture();
  try {
    const initial = await wrapper.send({ type: "get_output_style" });
    assert.equal(initial.supported, true);
    assert.equal(initial.selectedId, "default");
    assert.deepEqual(initial.styles.map(({ id }) => id), ["default", "proactive", "concise", "explanatory", "learning"]);
    const selected = await wrapper.send({ type: "set_output_style", styleId: "concise" });
    assert.equal(selected.selectedId, "concise");
    assert.equal(prompts.length, 0, "changing style never starts a prompt");
    assert.equal((await wrapper.send({ type: "get_state" })).outputStyle.selectedId, "concise");
    const restored = fixture(manager);
    assert.equal((await restored.wrapper.send({ type: "get_output_style" })).selectedId, "concise");
    restored.handler({ systemPromptOptions: { sections: {} } });
    await wrapper.send({ type: "prompt", message: "Explain this" });
    assert.match(prompts[0]["output-style"], /concise|brief/i);
    assert.equal(prompts[0].existing, "Existing system guidance");
    await restored.wrapper.destroy();
  } finally { await wrapper.destroy(); }
});

test("every built-in style reaches a subsequent prompt and Default removes only its section", async () => {
  const { wrapper, prompts, handler } = fixture();
  try {
    for (const [styleId, expected] of [["proactive", /proactive|next steps/i], ["concise", /concise|brief/i], ["explanatory", /explain|tradeoffs/i], ["learning", /learn|concepts/i]]) {
      await wrapper.send({ type: "set_output_style", styleId });
      await wrapper.send({ type: "prompt", message: "Help with my task" });
      assert.match(prompts.at(-1)["output-style"], expected);
    }
    await wrapper.send({ type: "set_output_style", styleId: "default" });
    const existing = { systemPromptOptions: { sections: { "output-style": "Old guidance", task: "Keep this instruction" } } };
    handler(existing);
    assert.deepEqual(existing.systemPromptOptions.sections, { task: "Keep this instruction" });
  } finally { await wrapper.destroy(); }
});

test("unsupported exact-prompt and subagent wrappers reject styles without changing the session", async () => {
  const { manager, outputStyle, wrapper } = fixture();
  const exact = new AgentSessionWrapper(wrapper.inner, { outputStyle, exactSystemPrompt: () => "Exact context only" });
  const subagent = new AgentSessionWrapper(wrapper.inner, { outputStyle, suppressCompletionNotifications: true });
  const chatOnly = new AgentSessionWrapper(wrapper.inner, { outputStyle, chatOnly: true });
  try {
    for (const [session, reason] of [[exact, "exact-system-prompt"], [subagent, "subagent"], [chatOnly, "exact-system-prompt"]]) {
      assert.deepEqual(await session.send({ type: "get_output_style" }), { supported: false, reason, selectedId: "default", styles: [] });
      await assert.rejects(session.send({ type: "set_output_style", styleId: "concise" }), /unavailable/);
    }
    assert.equal(manager.getEntries().length, 0);
    assert.equal((await exact.send({ type: "get_state" })).systemPrompt, "Exact context only");
  } finally { for (const session of [wrapper, exact, subagent, chatOnly]) await session.destroy(); }
});

test("unknown stored styles safely fall back to Default and unknown commands never persist", async () => {
  const { manager, wrapper, outputStyle } = fixture();
  try {
    await wrapper.send({ type: "set_output_style", styleId: "concise" });
    manager.appendCustomEntry("pi-web:output-style", { version: 1, styleId: "future-style" });
    assert.equal((await wrapper.send({ type: "get_output_style" })).selectedId, "default");
    assert.equal(outputStyle.getInstructions(), "");
    const count = manager.getEntries().length;
    await assert.rejects(wrapper.send({ type: "set_output_style", styleId: "../../private" }), /Unknown output style/);
    assert.equal(manager.getEntries().length, count);
    manager.appendCustomEntry("pi-web:output-style", { version: 2, styleId: "learning" });
    manager.appendCustomEntry("pi-web:output-style", null);
    assert.equal((await wrapper.send({ type: "get_output_style" })).selectedId, "default");
  } finally { await wrapper.destroy(); }
});

test("custom style edits change the next prompt while selection stays stable", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-style-custom-prompt-"));
  const store = createOutputStyleStore(join(directory, "styles.json"));
  const custom = store.create({ name: "Examples", instructions: "Use one small example." });
  const { wrapper, prompts } = fixture(undefined, { customStyles: () => store.list() });
  try {
    await wrapper.send({ type: "set_output_style", styleId: custom.id });
    await wrapper.send({ type: "prompt", message: "Help" });
    assert.equal(prompts.at(-1)["output-style"], "Use one small example.");
    store.update({ id: custom.id, name: "Examples", instructions: "Use two brief examples." });
    await wrapper.send({ type: "prompt", message: "Help again" });
    assert.equal(prompts.at(-1)["output-style"], "Use two brief examples.");
    assert.equal((await wrapper.send({ type: "get_output_style" })).selectedId, custom.id);
  } finally { await wrapper.destroy(); rmSync(directory, { recursive: true, force: true }); }
});

test("Pi renders each selected output style into its provider prompt using the extension hook", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pi-output-style-prompt-"));
  let session;
  try {
    const faux = fauxProvider({ models: [{ id: "style-test" }] });
    const modelRuntime = await ModelRuntime.create({ credentials: new InMemoryCredentialStore(), modelsPath: null, refreshOnCreate: false, allowModelNetwork: false, modelsStorePath: join(directory, "catalog.json") });
    modelRuntime.registerNativeProvider(faux.provider);
    const manager = SessionManager.inMemory(directory);
    const style = createSessionOutputStyle(manager, { customStyles: () => [] });
    const services = await createAgentSessionServices({ cwd: directory, agentDir: directory, settingsManager: SettingsManager.inMemory(), modelRuntime, resourceLoaderOptions: { noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true, extensionFactories: [createOutputStyleExtension(style)] } });
    ({ session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("style-test") }));
    for (const [id, pattern] of [["proactive", /proactive response style/i], ["concise", /concise response style/i], ["explanatory", /explanatory response style/i], ["learning", /learning response style/i], ["default", null]]) {
      style.setStyle(id);
      let observed;
      faux.setResponses([(context) => { observed = getCurrentSystemPrompt(context.messages); return fauxAssistantMessage([fauxText("Mock answer")]); }]);
      await session.prompt("Respond using the selected style");
      if (pattern) assert.match(observed, pattern);
      else assert.doesNotMatch(observed, /Use a (proactive|concise|explanatory|learning) response style/);
    }
  } finally { session?.dispose(); rmSync(directory, { recursive: true, force: true }); }
});

test("a damaged custom-style source leaves built-in output styles usable", async () => {
  const { wrapper } = fixture(undefined, { customStyles: () => { throw new Error("unreadable definitions"); } });
  try {
    const state = await wrapper.send({ type: "set_output_style", styleId: "learning" });
    assert.equal(state.supported, true);
    assert.equal(state.selectedId, "learning");
  } finally { await wrapper.destroy(); }
});
