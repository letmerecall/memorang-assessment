import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const agentUrl = process.env.AGENT_URL ?? "http://localhost:8123";
  try {
    const res = await fetch(
      `${agentUrl}/state/${encodeURIComponent(threadId)}`,
      { cache: "no-store" },
    );
    if (!res.ok) {
      return NextResponse.json(
        { detail: "State unavailable." },
        { status: res.status },
      );
    }
    return NextResponse.json(await res.json());
  } catch {
    return NextResponse.json({ detail: "Agent unreachable." }, { status: 502 });
  }
}
