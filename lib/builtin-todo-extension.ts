import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { ExtensionFactory, InlineExtension } from "@earendil-works/pi-coding-agent";
import { createJiti } from "jiti";

type ConfigModule = {
  loadJsonConfig: (path: string) => unknown;
  saveJsonConfig: (path: string, data: unknown) => boolean;
} & Record<string, unknown>;

export const HOST_BUILTIN_TODO_EXTENSION_PATH = "<inline:pilaude-todo>";

/** Load the published Todo implementation with configuration owned by this agent directory. */
export function createBuiltinTodoExtension({ agentDir }: { agentDir: string }): InlineExtension {
  const configFile = resolve(agentDir, "extensions", "rpiv-todo", "config.json");
  return { name: "pilaude-todo", factory: async (pi) => {
    const require = createRequire(import.meta.url);
    const entry = join(dirname(require.resolve("@juicesharp/rpiv-todo/package.json")), "index.ts");
    const configLoader = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
    const config = await configLoader.import<ConfigModule>("@juicesharp/rpiv-config");
    // Keep upstream validation/defaults. Only config I/O is redirected; neither
    // the host XDG/HOME nor the package's Todo reducer/store is replaced.
    const loader = createJiti(import.meta.url, {
      fsCache: false,
      moduleCache: false,
      virtualModules: {
        "@juicesharp/rpiv-config": {
          ...config,
          configPath: () => configFile,
          loadJsonConfig: () => config.loadJsonConfig(configFile),
          loadJsonConfigWithLegacyFallback: () => config.loadJsonConfig(configFile),
          saveJsonConfig: (_path: string, data: unknown) => config.saveJsonConfig(configFile, data),
        },
      },
    });
    const upstream = await loader.import<{ default: ExtensionFactory }>(entry);
    if (typeof upstream.default !== "function") throw new Error("The published Todo factory is unavailable");
    await upstream.default(pi);
  } };
}
