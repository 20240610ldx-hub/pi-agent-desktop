import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { writePrivateFileAtomicSync } from "./atomic-file";
import { readRegularFileText } from "./regular-file";
import { OUTPUT_STYLE_NAME_MAX_LENGTH, OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH, type OutputStyleDefinition } from "./output-styles";

export const OUTPUT_STYLE_STORE_MAX_BYTES = 1024 * 1024;
export const OUTPUT_STYLE_CUSTOM_LIMIT = 100;
const CUSTOM_ID = /^custom:[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/;

export class OutputStyleValidationError extends Error {
  readonly code = "output_style_invalid";
  constructor(message: string) { super(message); this.name = "OutputStyleValidationError"; }
}

export function isOutputStyleValidationError(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "output_style_invalid";
}
export interface OutputStyleStore {
  list(): OutputStyleDefinition[];
  create(input: unknown): OutputStyleDefinition;
  update(input: unknown): OutputStyleDefinition;
}

export function getOutputStyleStorePath(agentDir = getAgentDir()): string {
  return join(agentDir, "pi-web", "output-styles.json");
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fields(input: unknown): { name: string; instructions: string } {
  if (!record(input)) throw new OutputStyleValidationError("Expected an output style object");
  const { name, instructions } = input;
  if (typeof name !== "string" || !name.trim() || name.length > OUTPUT_STYLE_NAME_MAX_LENGTH || /[\x00-\x1f\x7f]/.test(name)) {
    throw new OutputStyleValidationError(`name must contain 1–${OUTPUT_STYLE_NAME_MAX_LENGTH} characters without control characters`);
  }
  if (typeof instructions !== "string" || !instructions.trim() || instructions.length > OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(instructions)) {
    throw new OutputStyleValidationError(`instructions must contain 1–${OUTPUT_STYLE_INSTRUCTIONS_MAX_LENGTH} characters without control characters`);
  }
  return { name: name.trim(), instructions: instructions.trim() };
}

export function createOutputStyleStore(path = getOutputStyleStorePath()): OutputStyleStore {
  const read = (): { stored: Record<string, unknown>; styles: OutputStyleDefinition[] } => {
    try {
      const text = readRegularFileText(path, OUTPUT_STYLE_STORE_MAX_BYTES);
      if (text === undefined) return { stored: {}, styles: [] };
      const stored: unknown = JSON.parse(text);
      if (!record(stored) || stored.version !== 1 || !Array.isArray(stored.styles) || stored.styles.length > OUTPUT_STYLE_CUSTOM_LIMIT) {
        throw new Error("Invalid output style store");
      }
      const seen = new Set<string>();
      const styles = stored.styles.map((value) => {
        if (!record(value) || typeof value.id !== "string" || !CUSTOM_ID.test(value.id) || seen.has(value.id)) {
          throw new Error("Invalid custom output style ID");
        }
        seen.add(value.id);
        return { id: value.id, ...fields(value), builtin: false };
      });
      return { stored, styles };
    } catch {
      // JSON.parse and filesystem errors may contain instructions or private
      // paths. Store reads never return those diagnostics to a caller.
      throw new Error("Output style definitions could not be read");
    }
  };
  const save = (stored: Record<string, unknown>, styles: OutputStyleDefinition[]) => {
    const text = JSON.stringify({ ...stored, version: 1, styles }, null, 2);
    if (Buffer.byteLength(text, "utf8") > OUTPUT_STYLE_STORE_MAX_BYTES) throw new OutputStyleValidationError("Output style store is full");
    try {
      mkdirSync(dirname(path), { recursive: true });
      writePrivateFileAtomicSync(path, text);
    } catch { throw new Error("Output style definitions could not be saved"); }
  };
  return {
    list: () => read().styles,
    create(input) {
      const value = fields(input);
      const { stored, styles } = read();
      if (styles.length >= OUTPUT_STYLE_CUSTOM_LIMIT) throw new OutputStyleValidationError("Too many custom output styles");
      const style = { id: `custom:${randomUUID()}`, ...value, builtin: false };
      save(stored, [...styles, style]);
      return style;
    },
    update(input) {
      const value = fields(input);
      if (!record(input) || typeof input.id !== "string" || !CUSTOM_ID.test(input.id)) throw new OutputStyleValidationError("A custom output style ID is required");
      const { stored, styles } = read();
      const index = styles.findIndex((style) => style.id === input.id);
      if (index < 0) throw new OutputStyleValidationError("Unknown custom output style");
      const style = { id: input.id, ...value, builtin: false };
      styles[index] = style;
      save(stored, styles);
      return style;
    },
  };
}
