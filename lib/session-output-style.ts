import type { SessionManager } from "@earendil-works/pi-coding-agent";
import { BUILTIN_OUTPUT_STYLES, type OutputStyleDefinition, type OutputStyleState } from "./output-styles";
import { OutputStyleValidationError } from "./output-style-store";

export const OUTPUT_STYLE_SELECTION_TYPE = "pi-web:output-style";
export interface SessionOutputStyle {
  getState(): OutputStyleState;
  setStyle(styleId: unknown): OutputStyleState;
  getInstructions(): string;
}

export function createSessionOutputStyle(
  manager: Pick<SessionManager, "getEntries" | "appendCustomEntry">,
  options: { customStyles: () => readonly OutputStyleDefinition[] },
): SessionOutputStyle {
  const definitions = () => {
    try { return [...BUILTIN_OUTPUT_STYLES, ...options.customStyles()]; }
    catch { return [...BUILTIN_OUTPUT_STYLES]; }
  };
  // Session-wide, like the tool selection: moving to an older leaf does not
  // silently revert the user's style. Custom entries never become model text.
  const selectedId = (styles: readonly OutputStyleDefinition[]): string => {
    const entries = manager.getEntries();
    for (let index = entries.length - 1; index >= 0; index--) {
      const entry = entries[index];
      if (entry.type !== "custom" || entry.customType !== OUTPUT_STYLE_SELECTION_TYPE) continue;
      const data = entry.data as { version?: unknown; styleId?: unknown } | null;
      if (!data || data.version !== 1 || typeof data.styleId !== "string") continue;
      return styles.some((style) => style.id === data.styleId) ? data.styleId : "default";
    }
    return "default";
  };
  const getState = (): OutputStyleState => {
    const styles = definitions();
    return { supported: true, selectedId: selectedId(styles), styles: styles.map(({ id, name, builtin }) => ({ id, name, builtin })) };
  };
  return {
    getState,
    setStyle(styleId) {
      if (typeof styleId !== "string" || !definitions().some((style) => style.id === styleId)) {
        throw new OutputStyleValidationError("Unknown output style");
      }
      manager.appendCustomEntry(OUTPUT_STYLE_SELECTION_TYPE, { version: 1, styleId });
      return getState();
    },
    getInstructions() {
      const styles = definitions();
      return styles.find((style) => style.id === selectedId(styles))?.instructions ?? "";
    },
  };
}
