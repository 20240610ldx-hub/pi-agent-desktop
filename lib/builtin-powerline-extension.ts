import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import type { ExtensionContext, InlineExtension } from "@earendil-works/pi-coding-agent";
import type { RenderedSegment, SegmentContext } from "pi-powerline-footer/types.ts";
import { createJiti } from "jiti";

type PrimarySegmentContext = Pick<SegmentContext,
  "model" | "thinkingLevel" | "contextTokens" | "contextPercent" | "contextWindow"
  | "contextApproximate" | "autoCompactEnabled" | "customCompactionEnabled"
  | "options" | "theme" | "colors"
>;
type PrimaryRenderer = {
  renderSegment: (id: "model" | "context_pct", context: PrimarySegmentContext) => RenderedSegment;
};

/**
 * Primary model/context adapter for Nico Bailon's pi-powerline-footer 0.20.2 (MIT).
 * Consume its published renderer, without starting the editor/queue/shell factory.
 * See THIRD_PARTY_NOTICES.md for the package's license-source limitation.
 */
let warnedMissing = false;
const resolvePackageManifest = () => createRequire(import.meta.url).resolve("pi-powerline-footer/package.json");

export function createBuiltinPowerlineExtension(
  { agentDir, resolveManifest = resolvePackageManifest }: { agentDir: string; resolveManifest?: () => string },
): InlineExtension {
  return { name: "pilaude-powerline", factory: async (pi) => {
    // Packaged builds do not ship the package yet (license pending): register nothing.
    let manifestPath: string;
    try {
      manifestPath = resolveManifest();
    } catch (error) {
      if (!warnedMissing) {
        warnedMissing = true;
        console.warn(`[pilaude-powerline] pi-powerline-footer is not installed; status row disabled (${(error as { code?: string })?.code ?? "unresolved"})`);
      }
      return;
    }
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { name?: unknown; version?: unknown };
    if (manifest.name !== "pi-powerline-footer" || manifest.version !== "0.20.2") {
      throw new Error("The primary adapter requires pi-powerline-footer@0.20.2");
    }
    const packageDir = dirname(manifestPath);
    const ownedAgentDir = resolve(agentDir);
    const loader = createJiti(import.meta.url, {
      fsCache: false,
      moduleCache: false,
      // Theme/currency path lookup is scoped to this session's configured agent
      // directory. Leave the renderer, validation and process HOME/XDG untouched.
      virtualModules: {
        "./paths.ts": {
          getAgentDir: () => ownedAgentDir,
          getAgentPath: (...segments: string[]) => join(ownedAgentDir, ...segments),
        },
      },
    });
    const { renderSegment } = await loader.import<PrimaryRenderer>(join(packageDir, "segments.ts"));
    if (typeof renderSegment !== "function") throw new Error("The published powerline primary renderer is unavailable");

    let current: ExtensionContext | undefined;
    let active: { requestRender: () => void } | undefined;
    const refresh = (_event: unknown, ctx: ExtensionContext) => {
      if (!current) return;
      current = ctx;
      active?.requestRender();
    };

    pi.on("session_start", (_event, ctx) => {
      if (!ctx.hasUI) return;
      current = ctx;
      ctx.ui.setWidget("powerline-top", (tui, theme) => {
        const token = { requestRender: () => tui.requestRender() };
        active = token;
        let disposed = false;
        return {
          render() {
            if (disposed || !current) return [];
            const usage = current.getContextUsage();
            // These are the complete fields read by the two audited upstream
            // segments. Do not invent unused Git, queue, currency or usage state.
            const context: PrimarySegmentContext = {
              model: current.model,
              thinkingLevel: current.thinkingLevel ?? "off",
              contextTokens: usage?.tokens ?? null,
              contextPercent: usage?.percent ?? null,
              contextWindow: usage?.contextWindow ?? current.model?.contextWindow ?? 0,
              contextApproximate: false,
              autoCompactEnabled: pi.getSettings().compaction?.enabled !== false,
              customCompactionEnabled: false,
              options: { model: { showThinkingLevel: true }, context: { format: "full" } },
              theme,
              colors: {},
            };
            const content = [renderSegment("model", context), renderSegment("context_pct", context)]
              .filter(segment => segment.visible && segment.content)
              .map(segment => segment.content)
              .join(" · ");
            return content ? [content] : [];
          },
          invalidate() {},
          dispose() {
            disposed = true;
            if (active === token) active = undefined;
          },
        };
      }, { placement: "aboveEditor" });
    });
    pi.on("model_select", refresh);
    pi.on("thinking_level_select", refresh);
    pi.on("session_tree", refresh);
    pi.on("session_compact", refresh);
    pi.on("agent_start", refresh);
    pi.on("message_end", refresh);
    pi.on("agent_end", refresh);
    pi.on("agent_settled", refresh);
    pi.on("session_shutdown", (_event, ctx) => {
      current = undefined;
      active = undefined;
      if (ctx.hasUI) ctx.ui.setWidget("powerline-top", undefined);
    });
  } };
}
