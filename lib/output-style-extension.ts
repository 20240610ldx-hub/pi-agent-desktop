import type { InlineExtension } from "@earendil-works/pi-coding-agent";
import type { SessionOutputStyle } from "./session-output-style";

export const OUTPUT_STYLE_SECTION = "output-style";

/** Normal sessions only: exact system prompts retain their existing contract. */
export function createOutputStyleExtension(style: Pick<SessionOutputStyle, "getInstructions">): InlineExtension {
  return {
    name: "pi-web-output-style",
    hidden: true,
    factory: (pi) => {
      pi.on("before_agent_start", (event) => {
        const instructions = style.getInstructions();
        if (instructions) event.systemPromptOptions.sections[OUTPUT_STYLE_SECTION] = instructions;
        else delete event.systemPromptOptions.sections[OUTPUT_STYLE_SECTION];
        return undefined;
      });
    },
  };
}
