import { existsSync } from "node:fs";
import { join } from "node:path";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { userHome } from "@/lib/user-home";
import { hasJsonContentType, isApiRequestAllowed } from "@/lib/request-security";
import { executePiImport, previewPiImport } from "@/lib/pilaude-import";

export const dynamic = "force-dynamic";

/** Local storage metadata for settings/import; never returns credential contents. */
export function GET() {
  const legacyAgentDir = join(userHome(), ".pi", "agent");
  return Response.json({
    agentDir: getAgentDir(), legacyAgentDir, legacyAvailable: existsSync(legacyAgentDir),
    credentialStorage: process.platform === "win32" ? "windows-dpapi" : "environment-only",
  });
}

/** The request selects an action, never an arbitrary filesystem source or target. */
export async function POST(request: Request) {
  if (!isApiRequestAllowed(request)) return Response.json({ error: "Untrusted API request" }, { status: 403 });
  if (!hasJsonContentType(request)) return Response.json({ error: "Content-Type must be application/json" }, { status: 415 });
  try {
    const body = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)
      || Object.keys(body).some(key => key !== "action" && key !== "digest")) {
      return Response.json({ error: "Invalid import request" }, { status: 400 });
    }
    const source = join(userHome(), ".pi", "agent");
    const target = getAgentDir();
    if (body.action === "preview") return Response.json(await previewPiImport(source, target));
    if (body.action === "import" && typeof body.digest === "string" && /^[a-f0-9]{64}$/.test(body.digest)) {
      return Response.json(await executePiImport(source, target, body.digest));
    }
    return Response.json({ error: "Invalid import action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Import failed" }, { status: 409 });
  }
}
