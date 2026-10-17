import { NextResponse } from "next/server";
import { ModelsConfigReadError, readModelsConfig } from "@/lib/models-config-store";
import { mergeStoredLiteralApiKeys, redactModelsJson } from "@/lib/models-config-redaction";
import { savePilaudeModelSettings } from "@/lib/pilaude-model-settings";
import { ModelHeaderError } from "@/lib/model-header-references";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Literal API keys and request headers never return to the editor.
    return NextResponse.json(redactModelsJson(readModelsConfig()));
  } catch (error) {
    if (error instanceof ModelsConfigReadError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof ModelHeaderError) return NextResponse.json({ error: error.message }, { status: 422 });
    return NextResponse.json({ error: "Model settings could not be read. Existing data was preserved." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  if (!isApiRequestAllowed(req)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(req)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await req.json() as Record<string, unknown>;
    const existing = readModelsConfig();
    const incomingProviders = (body.providers ?? {}) as Record<string, Record<string, unknown>>;
    const existingProviders = (existing.providers ?? {}) as Record<string, Record<string, unknown>>;
    // The client never sees stored literal apiKeys (GET redacts them), so an
    // incoming provider that omits the field must keep the stored value while
    // the user edits unrelated settings. An explicit apiKey (even "") wins.
    await savePilaudeModelSettings({
      ...body,
      providers: mergeStoredLiteralApiKeys(incomingProviders, existingProviders),
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ModelsConfigReadError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error instanceof ModelHeaderError) return NextResponse.json({ error: error.message }, { status: 422 });
    if (error instanceof SyntaxError) return NextResponse.json({ error: "Invalid JSON request." }, { status: 400 });
    return NextResponse.json({ error: "Model settings could not be saved. Existing data was preserved." }, { status: 500 });
  }
}
