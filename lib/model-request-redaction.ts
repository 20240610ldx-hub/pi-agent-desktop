import type { AssistantMessageEvent } from "@earendil-works/pi-ai";
import { mapModelHeaderValues } from "./model-header-references";

export function modelConfigSecretValues(config: Record<string, unknown>): string[] {
  const values: string[] = [];
  mapModelHeaderValues(config, value => { values.push(value); return value; });
  for (const provider of Object.values((config.providers ?? {}) as Record<string, { apiKey?: unknown }>)) {
    if (typeof provider?.apiKey === "string") values.push(provider.apiKey);
  }
  return values;
}

/** Mask before clipping/serialization, including a gateway echoing only a bearer token. */
export function createModelRequestRedactor(values: readonly unknown[]): (text: string) => string {
  const secrets = new Set<string>();
  for (const value of values) {
    if (typeof value !== "string" || !value) continue;
    secrets.add(value);
    if (value.startsWith("!")) secrets.add(value.slice(1).trim());
    for (const word of value.split(/\s+/)) if (word && !/^(Bearer|Basic|Digest)$/i.test(word)) secrets.add(word);
    secrets.add(JSON.stringify(value).slice(1, -1));
  }
  const ordered = [...secrets].filter(Boolean).sort((a, b) => b.length - a.length);
  return text => ordered.reduce((result, secret) => result.split(secret).join("[redacted]"), text);
}

export function redactModelError<T>(value: T, redact: (text: string) => string): T {
  if (value && typeof value === "object") {
    // Providers mutate the same partial message while streaming. Snapshot even
    // before an error exists so a queued event cannot acquire a later secret.
    return "errorMessage" in value && typeof value.errorMessage === "string"
      ? { ...value, errorMessage: redact(value.errorMessage) }
      : { ...value };
  }
  return value;
}

export function redactModelEvent(event: AssistantMessageEvent, redact: (text: string) => string): AssistantMessageEvent {
  if (event.type === "error") return { ...event, error: redactModelError(event.error, redact) };
  if (event.type === "done") return { ...event, message: redactModelError(event.message, redact) };
  if ("partial" in event) return { ...event, partial: redactModelError(event.partial, redact) };
  return event;
}
