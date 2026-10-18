import { NextRequest, NextResponse } from "next/server";
import { getGitReview, GitReviewError } from "@/lib/git-review";
import type { GitReviewContext, GitReviewOptions, GitReviewScope } from "@/lib/git-review-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  try {
    const query = request.nextUrl.searchParams;
    const scope = query.get("scope") ?? "all";
    const context = query.get("context") ?? "3";
    const ignoreWhitespace = query.get("ignoreWhitespace");
    if (!["all", "uncommitted", "commit"].includes(scope)) {
      throw new GitReviewError(400, "scope must be all, uncommitted, or commit");
    }
    if (!["3", "20", "all"].includes(context)) throw new GitReviewError(400, "context must be 3, 20, or all");
    if (ignoreWhitespace !== null && ignoreWhitespace !== "0" && ignoreWhitespace !== "1") {
      throw new GitReviewError(400, "ignoreWhitespace must be 0 or 1");
    }
    const options: GitReviewOptions = {
      cwd: query.get("cwd") ?? "",
      scope: scope as GitReviewScope,
      context: (context === "all" ? "all" : Number(context)) as GitReviewContext,
      ignoreWhitespace: ignoreWhitespace === "1",
      ...(query.has("base") ? { base: query.get("base")! } : {}),
      ...(query.has("commit") ? { commit: query.get("commit")! } : {}),
      ...(query.has("path") ? { path: query.get("path")! } : {}),
    };
    return NextResponse.json(await getGitReview(options), { headers });
  } catch (error) {
    return NextResponse.json({ error: error instanceof GitReviewError ? error.message : "Git review failed" }, {
      status: error instanceof GitReviewError ? error.status : 500,
      headers,
    });
  }
}
