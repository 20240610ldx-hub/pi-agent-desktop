const PREFIX = "pilaude-secret://";

export class ModelHeaderError extends Error {}

export function isModelHeaderReference(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function legacyModelHeaderReference(path: readonly string[]): string {
  return `${PREFIX}legacy/${encodeURIComponent(JSON.stringify(path))}`;
}

/** Visit only SDK request-header fields, preserving other configuration. */
export function mapModelHeaderValues(
  config: Record<string, unknown>,
  transform: (value: string, path: readonly string[]) => string,
): Record<string, unknown> {
  const copy = structuredClone(config);
  const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  const visit = (entry: unknown, path: string[]) => {
    if (!record(entry) || entry.headers === undefined) return;
    if (!record(entry.headers) || Object.values(entry.headers).some(value => typeof value !== "string")) {
      throw new ModelHeaderError("Request headers must be an object of string values. Existing configuration was preserved.");
    }
    entry.headers = Object.fromEntries(Object.entries(entry.headers).map(([name, value]) => [name, transform(value as string, [...path, "headers", name])]));
  };
  if (record(copy.providers)) for (const [name, provider] of Object.entries(copy.providers)) {
    if (!record(provider)) continue;
    visit(provider, ["providers", name]);
    if (Array.isArray(provider.models)) provider.models.forEach((model, index) => visit(model, ["providers", name, "models", String(index)]));
    if (record(provider.modelOverrides)) for (const [id, override] of Object.entries(provider.modelOverrides)) visit(override, ["providers", name, "modelOverrides", id]);
  }
  return copy;
}
