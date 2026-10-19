import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { BUILTIN_OUTPUT_STYLES } from "@/lib/output-styles";
import { createOutputStyleStore, isOutputStyleValidationError } from "@/lib/output-style-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try { return NextResponse.json({ styles: [...BUILTIN_OUTPUT_STYLES, ...createOutputStyleStore().list()] }); }
  catch { return NextResponse.json({ error: "Output style definitions could not be loaded" }, { status: 500 }); }
}

async function mutate(request: Request, update: boolean) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  try {
    const store = createOutputStyleStore();
    const style = update ? store.update(body) : store.create(body);
    return NextResponse.json({ style }, { status: update ? 200 : 201 });
  } catch (error) {
    const validation = isOutputStyleValidationError(error);
    return NextResponse.json({ error: validation && error instanceof Error ? error.message : "Output style definitions could not be saved" }, { status: validation ? 400 : 500 });
  }
}

export const POST = (request: Request) => mutate(request, false);
export const PUT = (request: Request) => mutate(request, true);
