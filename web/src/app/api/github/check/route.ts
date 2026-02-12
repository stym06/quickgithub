import { NextRequest, NextResponse } from "next/server";

const VALID_SLUG = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$/;

export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get("owner");
  const repo = request.nextUrl.searchParams.get("repo");

  if (!owner || !repo || !VALID_SLUG.test(owner) || !VALID_SLUG.test(repo)) {
    return NextResponse.json(
      { exists: false, error: "Invalid owner/repo format" },
      { status: 400 }
    );
  }

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    method: "HEAD",
    headers: { "User-Agent": "QuickGitHub" },
    next: { revalidate: 60 },
  });

  if (ghRes.ok) {
    return NextResponse.json({ exists: true });
  }

  if (ghRes.status === 404) {
    return NextResponse.json(
      { exists: false, error: "Repository not found on GitHub" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { exists: false, error: "Could not verify repository" },
    { status: 502 }
  );
}
