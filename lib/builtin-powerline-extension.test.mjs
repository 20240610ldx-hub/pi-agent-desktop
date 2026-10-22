import assert from "node:assert/strict";
import fs from "node:fs";
import childProcess from "node:child_process";
import { createRequire, syncBuiltinESMExports } from "node:module";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fauxAssistantMessage, fauxProvider, fauxText } from "@earendil-works/pi-ai";
import { createAgentSessionFromServices, createAgentSessionServices, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { fsCache: false, tsconfigPaths: true });
const { createBuiltinPowerlineExtension } = await jiti.import("./builtin-powerline-extension.ts");
const { AgentSessionWrapper } = await jiti.import("./rpc-manager.ts");
const plain = lines => stripVTControlCharacters((lines ?? []).join("\n"));

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "pilaude-builtin-powerline-"));
  const agentDir = join(root, "agent");
  const cwd = join(root, "project");
  await mkdir(agentDir); await mkdir(cwd);
  await writeFile(join(agentDir, "settings.json"), JSON.stringify({ powerline: { welcome: false, layout: { left: ["model", "thinking", "context_pct"], right: [], secondary: [] } } }));
  const faux = fauxProvider({ models: [
    { id: "primary-a", name: "Claude Primary A", reasoning: true, contextWindow: 200000 },
    { id: "primary-b", name: "Primary B", reasoning: true, contextWindow: 64000 },
  ] });
  const modelRuntime = await ModelRuntime.create({ authPath: join(root, "auth.json"), modelsPath: null, refreshOnCreate: false });
  modelRuntime.registerNativeProvider(faux.provider);
  const opened = [];
  const open = async (manager = SessionManager.create(cwd, join(root, "sessions")), directory = agentDir) => {
    const services = await createAgentSessionServices({ cwd, agentDir: directory, modelRuntime, settingsManager: SettingsManager.inMemory(), resourceLoaderOptions: {
      noExtensions: true, noSkills: true, noPromptTemplates: true, noThemes: true, noContextFiles: true,
      extensionFactories: [createBuiltinPowerlineExtension({ agentDir: directory })],
    } });
    assert.deepEqual(services.resourceLoader.getExtensions().errors, [], "the published renderer module loads through the real SDK factory");
    const { session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("primary-a"), thinkingLevel: "medium" });
    const wrapper = new AgentSessionWrapper(session);
    const events = [];
    wrapper.onEvent(event => events.push(event));
    opened.push({ session, wrapper });
    wrapper.beginExtensionBinding();
    await wrapper.waitUntilReady();
    return { session, wrapper, manager, events };
  };
  return { root, agentDir, cwd, faux, open, cleanup: async () => {
    for (const { session, wrapper } of opened) {
      if (wrapper.isAlive()) await session.extensionRunner?.emit({ type: "session_shutdown", reason: "quit" });
      wrapper.destroy();
      await wrapper.waitUntilDisposed();
    }
    await rm(root, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  } };
}

const widgets = async f => (await f.wrapper.send({ type: "get_state" })).extensionWidgets;
const primary = async f => {
  const values = await widgets(f);
  assert.deepEqual(values.map(widget => widget.key).sort(), ["powerline-secondary", "powerline-top"], "full package primary and footer are installed");
  const value = values.find(widget => widget.key === "powerline-top");
  assert.equal(value.placement, "aboveEditor");
  return plain(value.lines);
};

function expectedContext(usage) {
  const tokens = value => value < 1000 ? String(value) : value < 10000 ? `${(value / 1000).toFixed(1)}k` : value < 1000000 ? `${Math.round(value / 1000)}k` : `${(value / 1000000).toFixed(1)}M`;
  return usage.tokens === null || usage.percent === null
    ? `?/${tokens(usage.contextWindow)}`
    : `${tokens(usage.tokens)}/${tokens(usage.contextWindow)} (${usage.percent.toFixed(1)}%)`;
}

test("real published entry registers its complete commands and renders SDK model/context through wrapper wire and state", async () => {
  const f = await fixture();
  try {
    const first = await f.open();
    const text = await primary(first);
    assert.match(text, /Primary A/);
    assert.doesNotMatch(text, /Claude Primary A/, "published model renderer owns its name normalization");
    assert.match(text, /\[med\]|med/, "published renderer consumes actual SDK thinking level");
    assert.ok(text.includes(expectedContext(first.session.getContextUsage())));
    assert.ok(first.events.some(event => event.method === "setWidget" && event.widgetKey === "powerline-top" && plain(event.widgetLines) === text));
    assert.deepEqual(first.session.extensionRunner.getRegisteredCommands().map(command => command.name).sort(), ["bash-mode", "bash-reset", "cd", "powerline", "powerline-perf", "queue", "reply", "stash-history", "vibe"], "the package factory registers all author commands");
    assert.equal(f.faux.state.callCount, 0);
    assert.equal(first.events.some(event => event.type === "extension_error"), false);
  } finally { await f.cleanup(); }
});

test("real model/thinking and branch/compaction events refresh SDK truth, retaining unknown context", async () => {
  const f = await fixture();
  try {
    const first = await f.open();
    await first.session.setModel(f.faux.getModel("primary-b"));
    first.session.setThinkingLevel("high");
    await delay(80);
    let text = await primary(first);
    assert.match(text, /Primary B/);
    assert.match(text, /\[high\]|high/);
    assert.match(text, /\/64k/);
    const beforePrompt = first.events.length;
    f.faux.setResponses([fauxAssistantMessage([fauxText("Generated primary renderer response.")])]);
    await first.wrapper.send({ type: "prompt", message: "Use only the generated local provider." });
    await first.session.waitForIdle();
    await delay(80);
    text = await primary(first);
    assert.ok(text.includes(expectedContext(first.session.getContextUsage())));
    assert.ok(first.events.slice(beforePrompt).some(event => event.method === "setWidget" && plain(event.widgetLines) === text), "actual agent/message lifecycle requests a new widget render");
    const selectedLeaf = first.manager.getLeafId();
    first.manager.appendCompaction("Generated local compaction, no model call.", selectedLeaf, 100);
    await first.session.extensionRunner.emit({ type: "session_compact", compactionEntry: first.manager.getLeafEntry(), fromExtension: true });
    assert.deepEqual(first.session.getContextUsage(), { tokens: null, percent: null, contextWindow: 64000 });
    await delay(80);
    text = await primary(first);
    assert.match(text, /~.*\/64k/, "full package estimates unknown post-compaction context");
    assert.notEqual(first.session.getContextUsage().tokens, 0, "SDK still reports unknown, never a fabricated zero");
    await first.session.navigateTree(selectedLeaf, { summarize: false });
    await delay(80);
    text = await primary(first);
    assert.doesNotMatch(text, /~/);
    assert.ok(text.includes(expectedContext(first.session.getContextUsage())));
    assert.equal(first.events.some(event => event.type === "extension_error"), false);
    assert.equal(f.faux.state.callCount, 1, "tree navigation and compaction fixture never call a real model");
  } finally { await f.cleanup(); }
});

test("unsupported installed renderer versions fail before binding instead of trusting a changed segment contract", async () => {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("pi-powerline-footer/package.json");
  const readFileSync = fs.readFileSync;
  const settingsBefore = { HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME };
  fs.readFileSync = (path, ...args) => path === manifestPath
    ? JSON.stringify({ name: "pi-powerline-footer", version: "0.20.3" })
    : readFileSync(path, ...args);
  syncBuiltinESMExports();
  try {
    const freshLoader = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
    const fresh = await freshLoader.import("./builtin-powerline-extension.ts");
    await assert.rejects(fresh.createBuiltinPowerlineExtension({ agentDir: tmpdir() }).factory({}), /requires pi-powerline-footer@0\.20\.2/);
    assert.deepEqual({ HOME: process.env.HOME, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME }, settingsBefore);
  } finally {
    fs.readFileSync = readFileSync;
    syncBuiltinESMExports();
  }
});

test("isolated full-package graphs retain owned paths across replace/reload/shutdown/destroy; only readonly Git work is allowed", async () => {
  const f = await fixture();
  const restored = [];
  const blocked = [];
  const themeReads = [];
  const envBefore = { HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR };
  const secondDir = join(f.root, "second-agent");
  for (const [directory, icon] of [[f.agentDir, "Context-A"], [secondDir, "Context-B"]]) {
    await mkdir(join(directory, "extensions", "powerline-footer"), { recursive: true });
    await writeFile(join(directory, "settings.json"), JSON.stringify({ powerline: { welcome: false, layout: { left: ["model", "thinking", "context_pct"], right: [], secondary: [] } } }));
    await writeFile(join(directory, "extensions", "powerline-footer", "theme.json"), JSON.stringify({ icons: { context: icon } }));
  }
  const block = (object, name) => {
    const original = object[name];
    object[name] = () => { blocked.push(name); throw new Error(`Footer fixture refuses ${name}`); };
    restored.push(() => { object[name] = original; });
  };
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    const original = childProcess[name];
    childProcess[name] = (...args) => {
      if (args[0] !== "git") { blocked.push(name); throw new Error(`Only package readonly Git is allowed: ${name}`); }
      assert.ok(args[1].some(arg => ["status", "symbolic-ref", "remote", "config", "rev-parse"].includes(arg)), "package Git only queries metadata");
      return original(...args);
    };
    restored.push(() => { childProcess[name] = original; });
  }
  block(globalThis, "fetch");
  block(globalThis, "setInterval");
  for (const name of ["existsSync", "readFileSync"]) {
    const original = fs[name];
    fs[name] = (path, ...args) => {
      if (typeof path === "string" && /[\\/]powerline-footer[\\/]theme\.json$/.test(path)) themeReads.push(path);
      return original(path, ...args);
    };
    restored.push(() => { fs[name] = original; });
  }
  syncBuiltinESMExports();
  try {
    const first = await f.open();
    const second = await f.open(undefined, secondDir);
    assert.match(await primary(first), /Context-A/);
    assert.doesNotMatch(await primary(first), /Context-B/);
    assert.match(await primary(second), /Context-B/);
    first.session.setThinkingLevel("high");
    await delay(80);
    assert.match(await primary(first), /Context-A/);
    assert.doesNotMatch(await primary(second), /high/, "model/thinking state is per SDK session");

    await first.session.extensionRunner.emit({ type: "session_start", reason: "reload" });
    assert.equal((await widgets(first)).length, 2, "widget replacement does not duplicate primary consumers");
    assert.match(await primary(first), /Context-A/);
    await first.wrapper.send({ type: "reload" });
    assert.match(await primary(first), /Context-A/);
    assert.equal((await widgets(first)).length, 2);
    assert.match(await primary(second), /Context-B/);
    const updates = first.events.filter(event => event.method === "setWidget" && event.widgetLines?.length).length;
    first.session.setThinkingLevel("low");
    await delay(80);
    assert.equal(first.events.filter(event => event.method === "setWidget" && event.widgetLines?.length).length, updates + 1, "reload leaves one live primary refresh owner");

    await first.session.extensionRunner.emit({ type: "session_shutdown", reason: "quit" });
    assert.deepEqual(await widgets(first), []);
    const shutdownEvents = first.events.length;
    await first.session.extensionRunner.emit({ type: "thinking_level_select", level: "medium", previousLevel: "low" });
    await delay(80);
    assert.equal(first.events.length, shutdownEvents, "late events after shutdown cannot resurrect a widget");
    assert.match(await primary(second), /Context-B/);
    const destroyedEvents = second.events.length;
    second.wrapper.destroy();
    assert.equal(second.wrapper.isAlive(), false);
    await second.wrapper.waitUntilDisposed();
    assert.equal(second.events.slice(destroyedEvents).some(event => event.type === "extension_ui_request"), false, "destroy disposes the existing component without new UI requests");
    assert.deepEqual(blocked, []);
    assert.ok(themeReads.length > 0);
    assert.ok(themeReads.every(path => [f.agentDir, secondDir].some(directory => path === join(directory, "extensions", "powerline-footer", "theme.json"))), "optional theme reads never fall back to host HOME/XDG");
    assert.deepEqual({ HOME: process.env.HOME, USERPROFILE: process.env.USERPROFILE, XDG_CONFIG_HOME: process.env.XDG_CONFIG_HOME, PI_CODING_AGENT_DIR: process.env.PI_CODING_AGENT_DIR }, envBefore);
    assert.equal(f.faux.state.callCount, 0);
    assert.equal([...first.events, ...second.events].some(event => event.type === "extension_error"), false);
  } finally {
    for (const restore of restored.reverse()) restore();
    syncBuiltinESMExports();
    await f.cleanup();
  }
});

test("missing package skips registration without throwing and warns once; resolvable package registers", async () => {
  const warnings = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args.join(" "));
  const registered = [];
  const pi = { on: name => registered.push(name), registerCommand() {}, registerShortcut() {}, getSettings: () => ({}) };
  try {
    const missing = createBuiltinPowerlineExtension({
      agentDir: tmpdir(),
      resolveManifest: () => { throw Object.assign(new Error("Cannot find module"), { code: "MODULE_NOT_FOUND" }); },
    });
    await assert.doesNotReject(() => missing.factory(pi));
    await assert.doesNotReject(() => missing.factory(pi));
    assert.deepEqual(registered, [], "no handlers are registered when the package is absent");
    assert.equal(warnings.filter(w => w.includes("pilaude-powerline")).length, 1, "diagnostic is logged once");
  } finally {
    console.warn = originalWarn;
  }
  const present = createBuiltinPowerlineExtension({ agentDir: tmpdir() });
  await present.factory(pi);
  assert.ok(registered.includes("session_start"), "resolvable package registers its handlers");
});

test("full entry honors upstream presets, secondary segments, custom items, placement, options and disabled segments", async () => {
  const f = await fixture();
  try {
    const current = await f.open();
    const configure = async powerline => {
      await writeFile(join(f.agentDir, "settings.json"), JSON.stringify({ powerline: { welcome: false, ...powerline } }));
      await current.wrapper.send({ type: "reload" });
      return widgets(current);
    };
    for (const preset of ["default", "minimal", "compact", "full", "nerd", "ascii"]) {
      await configure({ preset, secondaryOverflow: "wrap" });
      const text = await primary(current);
      if (preset === "minimal") assert.doesNotMatch(text, /Primary A/);
      else assert.match(text, /Primary A/);
      assert.match(plain((await widgets(current)).flatMap(w => w.lines)), /200k/, `${preset}: upstream keeps context in primary or secondary layout`);
    }
    const layout = { left: ["hostname", "path", "session", "time", "context_total", "custom:probe"], right: [], secondary: ["model", "thinking", "context_pct", "token_in", "token_out", "token_total", "cost", "cache_read", "cache_write"] };
    const config = { layout, separator: "pipe", secondaryOverflow: "wrap", placement: "below", customItems: [{ id: "probe", prefix: "Custom-Hit", hideWhenMissing: false }] };
    current.manager.appendSessionInfo("Config");
    const assistant = fauxAssistantMessage([fauxText("Generated usage fixture")]);
    assistant.usage = { input: 1234, output: 567, cacheRead: 890, cacheWrite: 321, totalTokens: 3012, cost: { input: 0.1, output: 0.2, cacheRead: 0.3, cacheWrite: 0.4, total: 1 } };
    current.manager.appendMessage(assistant);
    let configured = await configure(config);
    const top = configured.find(w => w.key === "powerline-top");
    assert.equal(top.placement, "belowEditor");
    const text = plain(top.lines);
    assert.ok(text.includes(hostname()));
    assert.match(text, /project/);
    assert.match(text, /Config/);
    assert.match(text, /\d{1,2}:\d{2}/);
    assert.match(text, /200k/);
    assert.match(text, /Custom-Hit/);
    assert.match(text, /\|/);
    const allRows = plain(configured.flatMap(w => w.lines));
    for (const marker of [/Primary A/, /med/, /200k/, /1\.2k/, /567/, /890/, /321/, /\$1\.00/]) assert.match(allRows, marker);
    assert.ok(configured.find(w => w.key === "powerline-secondary").lines.length > 0, "upstream overflow renders through the footer bridge");
    configured = await configure({ ...config, disabledSegments: ["model", "custom:probe"], context: { format: "percent" } });
    assert.doesNotMatch(plain(configured.find(w => w.key === "powerline-top").lines), /Custom-Hit/);
    const disabledFooter = plain(configured.find(w => w.key === "powerline-secondary").lines);
    assert.doesNotMatch(disabledFooter, /Primary A|200k/);
    assert.match(plain(configured.flatMap(w => w.lines)), /%/);
    await current.wrapper.send({ type: "prompt", message: "/powerline" });
    assert.deepEqual(await widgets(current), [], "the actual package toggle clears its UI");
    await current.wrapper.send({ type: "prompt", message: "/powerline" });
    assert.ok((await widgets(current)).some(w => w.key === "powerline-top" && w.lines.length));
    assert.equal(f.faux.state.callCount, 0, "package commands/configuration never call a model");
    assert.equal(current.events.some(e => e.type === "extension_error"), false);
  } finally { await f.cleanup(); }
});
