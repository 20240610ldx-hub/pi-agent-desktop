import { existsSync, readFileSync } from "node:fs";
import * as nodeModule from "node:module";
import { dirname, join, resolve } from "node:path";
import type { ExtensionAPI, ExtensionContext, ExtensionFactory, ExtensionUIContext, InlineExtension, ReadonlyFooterDataProvider } from "@earendil-works/pi-coding-agent";

const missingWarningKey = Symbol.for("pilaude.powerline.missing-package-warning");
const runtimeRequire = () => Reflect.apply(Reflect.get(nodeModule, "createRequire"), undefined, [import.meta.url]) as NodeRequire;
const resolvePackageManifest = () => {
  // Keep Node's resolver at runtime: webpack must not turn resolve into a module id.
  const require = runtimeRequire();
  return require.resolve("pi-powerline-footer/package.json");
};

/** Execute the package-declared extension; only adapt its paths and Web UI boundary. */
export function createBuiltinPowerlineExtension(
  { agentDir, resolveManifest = resolvePackageManifest }: { agentDir: string; resolveManifest?: () => string },
): InlineExtension {
  return { name: "pilaude-powerline", factory: async (pi) => {
    let manifestPath: string;
    try {
      manifestPath = resolveManifest();
    } catch (error) {
      if (!Reflect.get(globalThis, missingWarningKey)) {
        Reflect.set(globalThis, missingWarningKey, true);
        console.warn(`[pilaude-powerline] pi-powerline-footer is not installed; status row disabled (${(error as { code?: string })?.code ?? "unresolved"})`);
      }
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown; version?: unknown; pi?: { extensions?: string[] } };
    if (manifest.name !== "pi-powerline-footer" || manifest.version !== "0.20.2") {
      throw new Error("The powerline adapter requires pi-powerline-footer@0.20.2");
    }
    if (!manifest.pi?.extensions?.length) throw new Error("The published powerline extension entry is unavailable");
    const packageDir = dirname(manifestPath);
    const ownedAgentDir = resolve(agentDir);
    const paths = {
      getAgentDir: () => ownedAgentDir,
      getAgentPath: (...segments: string[]) => join(ownedAgentDir, ...segments),
      // Welcome/history discovery stays in this agent's data tree, including
      // upstream's legacy lookup. Never fall back to a different user's Pi data.
      getHomeDir: () => resolve(ownedAgentDir, "..", ".."),
      getLegacyPiPath: (...segments: string[]) => join(ownedAgentDir, "..", ...segments),
    };
    // Jiti's own createRequire must also execute in Node, outside webpack.
    const { createJiti } = runtimeRequire()("jiti") as typeof import("jiti");
    const gitLoader = createJiti(import.meta.url, { fsCache: false, moduleCache: false });
    const git = await gitLoader.import<typeof import("pi-powerline-footer/git-status.ts")>(join(packageDir, "git-status.ts"));
    const hasRepository = (cwd: string): boolean => {
      if (process.env.GIT_DIR) return true;
      let directory = resolve(cwd);
      for (;;) {
        if (existsSync(join(directory, ".git"))) return true;
        const parent = dirname(directory);
        if (parent === directory) return false;
        directory = parent;
      }
    };
    const hostGit: typeof git = {
      ...git,
      // Git cannot report a branch/status outside a repository. Avoid transient
      // cwd-pinning children there (Windows cannot remove a cwd held by a child).
      getGitStatus: (branch, polling, cwd = process.cwd()) => hasRepository(cwd)
        ? git.getGitStatus(branch, polling, cwd)
        : { branch, staged: 0, unstaged: 0, untracked: 0 },
      getGitRemoteHost: (cwd = process.cwd()) => hasRepository(cwd) ? git.getGitRemoteHost(cwd) : null,
    };
    const loader = createJiti(import.meta.url, {
      fsCache: false,
      moduleCache: false,
      virtualModules: { "./paths.ts": paths, "../paths.ts": paths, "./git-status.ts": hostGit },
    });

    // The Web host has no TUI editor/footer. Mount the package's actual footer
    // component as a widget so its own scheduler can repaint all its widgets.
    // Other extensions' statuses are not exposed by this host's footer API;
    // those remain visible in the existing ExtensionStatusLine.
    const statuses = new Map<string, string>();
    const renders = new Map<string, () => void>();
    const keys = new Set<string>();
    const repaint = () => { for (const render of renders.values()) render(); };
    const uiCache = new WeakMap<ExtensionUIContext, ExtensionUIContext>();
    const adaptContext = <T extends ExtensionContext>(ctx: T): T => {
      let ui = uiCache.get(ctx.ui);
      if (!ui) {
        const host = ctx.ui;
        const setWidget: ExtensionUIContext["setWidget"] = (key, content, options) => {
          keys.add(key);
          renders.delete(key);
          if (typeof content !== "function") return host.setWidget(key, content, options);
          host.setWidget(key, (tui, theme) => {
            const render = () => tui.requestRender();
            renders.set(key, render);
            const component = content(tui, theme);
            return {
              ...component,
              render: width => component.render(width),
              invalidate: () => component.invalidate(),
              dispose: () => {
                if (renders.get(key) === render) renders.delete(key);
                component.dispose?.();
              },
            };
          }, options);
        };
        const footerData: ReadonlyFooterDataProvider = {
          getGitBranch: () => null, // Upstream falls back to its own cwd-aware Git reader.
          getExtensionStatuses: () => statuses,
          getAvailableProviderCount: () => new Set(ctx.modelRegistry.getAvailable().map(model => model.provider)).size,
          onBranchChange: () => () => {}, // Upstream subscribeGitUpdates owns Git refresh.
        };
        ui = new Proxy(host, { get(target, key, receiver) {
          if (key === "setWidget") return setWidget;
          if (key === "setStatus") return (key: string, text: string | undefined) => {
            if (text === undefined) statuses.delete(key); else statuses.set(key, text);
            target.setStatus(key, text);
            repaint();
          };
          if (key === "setFooter") return (factory: Parameters<ExtensionUIContext["setFooter"]>[0]) => {
            setWidget("powerline-secondary", factory ? (tui, theme) => {
              const repaintTui = Object.create(tui) as typeof tui;
              Object.defineProperty(repaintTui, "requestRender", { value: repaint });
              return factory(repaintTui, theme, footerData);
            } : undefined, { placement: "belowEditor" });
          };
          return Reflect.get(target, key, receiver);
        } });
        uiCache.set(host, ui);
      }
      return new Proxy(ctx, { get(target, key, receiver) { return key === "ui" ? ui : Reflect.get(target, key, receiver); } });
    };
    const adaptedPi = new Proxy(pi, { get(target, key, receiver) {
      if (key === "on") return (name: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) => {
        Reflect.apply(target.on, target, [name, async (event: unknown, ctx: ExtensionContext) => {
          try {
            const result = await handler(event, adaptContext(ctx));
            // Upstream starts asynchronous readonly Git children while rendering.
            // Settle them before the host completes an event/disposes the cwd.
            await git.waitForGitUpdates();
            return result;
          }
          finally {
            if (name === "session_shutdown") {
              for (const key of keys) ctx.ui.setWidget(key, undefined);
              keys.clear(); renders.clear(); statuses.clear();
            }
          }
        }]);
      };
      if (key === "registerCommand") return (name: string, options: Parameters<ExtensionAPI["registerCommand"]>[1]) => {
        target.registerCommand(name, { ...options, handler: (args, ctx) => options.handler(args, adaptContext(ctx)) });
      };
      return Reflect.get(target, key, receiver);
    } });
    for (const entry of manifest.pi.extensions) {
      const upstream = await loader.import<{ default: ExtensionFactory }>(join(packageDir, entry));
      if (typeof upstream.default !== "function") throw new Error("The published powerline factory is unavailable");
      await upstream.default(adaptedPi);
    }
  } };
}
