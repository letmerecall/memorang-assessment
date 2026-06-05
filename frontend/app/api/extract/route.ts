import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const agentUrl = process.env.AGENT_URL ?? "http://localhost:8123";
  const body = await req.formData();
  const res = await fetch(`${agentUrl}/extract`, { method: "POST", body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
