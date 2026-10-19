export const OUTPUT_STYLE_NAME_MAX_LENGTH = 80;
export const OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH = 16_000;

export const BUILTIN_OUTPUT_STYLE_IDS = ["default", "proactive", "concise", "explanatory", "learning"] as const;
export type BuiltinOutputStyleId = (typeof BUILTIN_OUTPUT_STYLE_IDS)[number];

export interface OutputStyleDefinition {
  id: string;
  name: string;
  instructions: string;
  builtin: boolean;
}
export type OutputStyleSummary = Omit<OutputStyleDefinition, "instructions">;
export type OutputStyleUnsupportedReason = "exact-system-prompt" | "subagent" | "unavailable";
export interface OutputStyleState {
  supported: boolean;
  reason?: OutputStyleUnsupportedReason;
  selectedId: string;
  styles: OutputStyleSummary[];
}
export type OutputStyleCommand =
  | { type: "get_output_style" }
  | { type: "set_output_style"; styleId: string };

// Product-authored behavior guidance. These styles do not alter tool access or permissions.
export const BUILTIN_OUTPUT_STYLES: readonly OutputStyleDefinition[] = [
  { id: "default", name: "Default", instructions: "", builtin: true },
  { id: "proactive", name: "Proactive", instructions: "Use a proactive response style. Carry the user's requested work through to a useful outcome, identify relevant next steps, and state material assumptions. Stay within the user's scope and permissions; ask when a consequential choice needs their input.", builtin: true },
  { id: "concise", name: "Concise", instructions: "Use a concise response style. Lead with the answer or outcome, keep explanations brief, and omit repetition. Include the essential evidence, limitations, and next action when they affect the user's decision.", builtin: true },
  { id: "explanatory", name: "Explanatory", instructions: "Use an explanatory response style. Explain the reasoning, relevant context, and tradeoffs behind the answer or change. Use a concrete example when it helps understanding, and keep the explanation focused on the user's task.", builtin: true },
  { id: "learning", name: "Learning", instructions: "Use a learning response style. Help the user understand the concepts and reasoning behind the task through clear steps and small examples. Invite a focused question or exercise when useful, while still completing the work the user requested.", builtin: true },
];

export function unsupportedOutputStyleState(reason: OutputStyleUnsupportedReason): OutputStyleState {
  return { supported: false, reason, selectedId: "default", styles: [] };
}
