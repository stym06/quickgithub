import { NextResponse } from "next/server";

// Chat is disabled until v1 Pro tier.
export async function POST() {
  return NextResponse.json(
    { error: "Chat is coming soon in Pro tier" },
    { status: 403 }
  );
}
