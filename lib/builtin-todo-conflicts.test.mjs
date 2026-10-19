import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { fauxAssistantMessage, fauxProvider, fauxText, fauxToolCall } from "@earendil-works/pi-ai";
import { createAgentSessionServices, createAgentSessionFromServices, ModelRuntime, SessionManager, SettingsManager } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { fsCache: false });
const { createBuiltinTodoExtension, HOST_BUILTIN_TODO_EXTENSION_PATH } = await jiti.import("./builtin-todo-extension.ts");
const { preferBuiltinTodoExtension } = await jiti.import("./builtin-todo-conflicts.ts");

const extension = (path, source, hasTodo = true) => ({ path, sourceInfo: { source }, tools: new Map(hasTodo ? [["todo", {}]] : []), handlers: new Map(), commands: new Map(), flags: new Map() });

test("only an identified Todo package is displaced when the host Todo is actually registered", () => {
  const host = extension(HOST_BUILTIN_TODO_EXTENSION_PATH, "inline:pilaude-todo");
  const raw = extension("/generated/old/index.ts", "npm:@juicesharp/rpiv-todo@2.13.9");
  const alias = extension("/generated/alias/index.ts", "npm:owned-alias@npm:@juicesharp/rpiv-todo@2.13.9");
  const unrelated = extension("/generated/@juicesharp/rpiv-todo/index.ts", "npm:@juicesharp/rpiv-todo@npm:other-package@1.0.0");
  const sameName = extension("/generated/local-todo.ts", "local-todo");
  const noTodo = extension("/generated/config-only.ts", "npm:@juicesharp/rpiv-todo@2.13.9", false);
  const base = { extensions: [raw, alias, unrelated, sameName, noTodo, host], errors: [
    { path: host.path, error: `Tool "todo" conflicts with ${raw.path}` },
    { path: alias.path, error: "duplicate" },
    { path: host.path, error: "Unrelated error" },
  ] };
  const result = preferBuiltinTodoExtension(base);
  assert.deepEqual(result.extensions, [unrelated, sameName, noTodo, host]);
  assert.deepEqual(result.errors, [{ path: host.path, error: "Unrelated error" }]);
  assert.equal(preferBuiltinTodoExtension({ ...base, extensions: [raw] }).extensions[0], raw);
  assert.equal(preferBuiltinTodoExtension({ ...base, extensions: [raw, { ...host, tools: new Map() }] }).extensions[0], raw);
});

test("the actual SDK keeps one Todo tool and one package lifecycle after alias migration", async () => {
  const dir = await mkdtemp(join(tmpdir(), "pilaude-todo-conflict-"));
  let session; let rawStarts = 0; let rawExecutions = 0;
  try {
    const faux = fauxProvider({ models: [{ id: "todo-conflict" }] });
    const runtime = await ModelRuntime.create({ authPath: join(dir, "auth.json"), modelsPath: null, refreshOnCreate: false });
    runtime.registerNativeProvider(faux.provider);
    const rawFactory = async (pi) => {
      const loader = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
      const { default: real } = await loader.import(fileURLToPath(new URL("../node_modules/@juicesharp/rpiv-todo/index.ts", import.meta.url)));
      await real({ ...pi, registerTool(tool) {
        pi.registerTool({ ...tool, async execute(...args) { rawExecutions++; return tool.execute(...args); } });
      }, on(name, handler) {
        pi.on(name, async (...args) => { if (name === "session_start") rawStarts++; return handler(...args); });
      } });
    };
    const aliasDir = join(dir, "node_modules", "owned-todo-alias");
    await mkdir(aliasDir, { recursive: true });
    await writeFile(join(aliasDir, "package.json"), JSON.stringify({ name: "@juicesharp/rpiv-todo", version: "2.13.9", type: "module" }));
    // Let the actual SDK import a package-shaped alias entry. Its metadata is
    // attached after extensionsOverride, so the filter must inspect the nearest
    // package manifest rather than rely on our assigning sourceInfo in a test.
    const slot = Symbol.for(`pilaude-todo-alias-${dir}`);
    globalThis[slot] = rawFactory;
    await writeFile(join(aliasDir, "index.mjs"), `export default globalThis[Symbol.for(${JSON.stringify(`pilaude-todo-alias-${dir}`)})];`);
    const services = await createAgentSessionServices({ cwd: dir, agentDir: dir, modelRuntime: runtime, settingsManager: SettingsManager.inMemory(), resourceLoaderOptions: {
      noExtensions: true, noSkills: true, noThemes: true, noPromptTemplates: true, noContextFiles: true,
      additionalExtensionPaths: [join(aliasDir, "index.mjs")],
      extensionFactories: [createBuiltinTodoExtension({ agentDir: dir })],
      extensionsOverride: preferBuiltinTodoExtension,
    } });
    delete globalThis[slot];
    const manager = SessionManager.create(dir, join(dir, "sessions"));
    ({ session } = await createAgentSessionFromServices({ services, sessionManager: manager, model: faux.getModel("todo-conflict") }));
    await session.bindExtensions({ mode: "rpc" });
    faux.setResponses([
      fauxAssistantMessage([fauxToolCall("todo", { action: "create", subject: "Use one registered Todo" }, { id: "single-todo" })], { stopReason: "toolUse" }),
      fauxAssistantMessage([fauxText("Generated migration complete.")]),
    ]);
    await session.prompt("Perform the generated Todo migration fixture.");
    assert.equal(rawStarts, 0, "the migrated package lifecycle is not bound");
    assert.equal(rawExecutions, 0, "the migrated tool never wins by earlier registration");
    assert.equal(manager.getBranch().filter((item) => item.customType === "rpiv-todo-state").length, 1);
    assert.equal(session.getAllTools().filter((tool) => tool.name === "todo").length, 1);
  } finally { session?.dispose(); await rm(dir, { recursive: true, force: true }); }
});
