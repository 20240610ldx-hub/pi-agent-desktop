import { NextResponse } from "next/server";
import {
  createRpcForkSendDeps,
  forkAndSend,
  ForkSendError,
  type ForkSendImage,
} from "@/lib/fork-send";

// POST /api/agent/[id]/fork-send — fork the session at its latest settled entry and send
// the composer draft as the first new message of the fork. Body:
//   { requestKey: string, message: string, images?: [{ type: "image", data, mimeType }] }
// Success: { success: true, data: { newSessionId, promptSent: true } }.
// Failure: { error, code, accepted: false, promptSent: false, newSessionId? }; newSessionId
// is present when the fork was created and kept.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const body = await req.json().catch(() => null) as {
      requestKey?: unknown;
      message?: unknown;
      images?: unknown;
    } | null;
    if (!body || typeof body !== "object") throw new ForkSendError("invalid_request", "Invalid JSON body");
    if (typeof body.requestKey !== "string") throw new ForkSendError("invalid_request", "requestKey must be a string");
    if (typeof body.message !== "string") throw new ForkSendError("invalid_request", "message must be a string");
    const images = parseImages(body.images);
    const data = await forkAndSend(
      { sourceId: id, requestKey: body.requestKey, message: body.message, images, signal: req.signal },
      createRpcForkSendDeps(),
    );
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof ForkSendError) {
      return NextResponse.json({
        error: error.message,
        code: error.code,
        accepted: false,
        promptSent: false,
        ...(error.newSessionId ? { newSessionId: error.newSessionId } : {}),
      }, { status: error.status });
    }
    return NextResponse.json({
      error: error instanceof Error ? error.message : String(error),
      code: "fork_write_failed",
      accepted: false,
      promptSent: false,
    }, { status: 500 });
  }
}

function parseImages(value: unknown): ForkSendImage[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new ForkSendError("invalid_request", "images must be an array");
  return value.map((image) => {
    const candidate = image as Partial<ForkSendImage> | null;
    if (
      !candidate
      || candidate.type !== "image"
      || typeof candidate.data !== "string"
      || typeof candidate.mimeType !== "string"
    ) {
      throw new ForkSendError("invalid_request", "Each image needs type \"image\", data and mimeType");
    }
    return { type: "image", data: candidate.data, mimeType: candidate.mimeType };
  });
}
