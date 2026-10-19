import { NextResponse } from "next/server";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { sessionOutputStyleCommand, OutputStyleUnavailableError } from "@/lib/rpc-manager";
import { isOutputStyleValidationError } from "@/lib/output-style-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

function failure(error: unknown): Response {
  const status = isOutputStyleValidationError(error) ? 400 : error instanceof OutputStyleUnavailableError ? 409 : 500;
  const message = status === 400 && error instanceof Error ? error.message
    : status === 409 ? "Output styles are unavailable for this session"
      : "Session output style could not be accessed";
  return NextResponse.json({ error: message }, { status });
}

export async function GET(_request: Request, { params }: Context) {
  try {
    const state = await sessionOutputStyleCommand((await params).id, { type: "get_output_style" });
    return state ? NextResponse.json(state) : NextResponse.json({ error: "Session not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}

export async function PUT(request: Request, { params }: Context) {
  if (!isApiRequestAllowed(request)) return NextResponse.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return NextResponse.json({ error: "Content-Type must be application/json" }, { status: 415 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  if (body === null || typeof body !== "object" || !("styleId" in body) || typeof body.styleId !== "string" || body.styleId.length > 80) {
    return NextResponse.json({ error: "A valid styleId is required" }, { status: 400 });
  }
  try {
    const state = await sessionOutputStyleCommand((await params).id, { type: "set_output_style", styleId: body.styleId });
    return state ? NextResponse.json(state) : NextResponse.json({ error: "Session not found" }, { status: 404 });
  } catch (error) { return failure(error); }
}
