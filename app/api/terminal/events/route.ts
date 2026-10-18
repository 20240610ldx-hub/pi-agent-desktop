import { terminalEventsResponse } from "@/lib/terminal-events-stream";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) { return terminalEventsResponse(req); }
