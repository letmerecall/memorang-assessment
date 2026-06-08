import { NextRequest, NextResponse } from "next/server";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const EXTRACT_TIMEOUT_MS = 30_000;

function isPdfFile(file: File, bytes: Uint8Array): boolean {
  if (file.type === "application/pdf") return true;
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46
  );
}

export async function POST(req: NextRequest) {
  const agentUrl = process.env.AGENT_URL ?? "http://localhost:8123";
  const body = await req.formData();
  const file = body.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ detail: "Missing file field." }, { status: 400 });
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer());

  if (fileBytes.byteLength > MAX_PDF_BYTES) {
    return NextResponse.json({ detail: "PDF exceeds 10 MB limit." }, { status: 413 });
  }

  if (!isPdfFile(file, fileBytes)) {
    return NextResponse.json({ detail: "File must be a PDF." }, { status: 400 });
  }

  const proxyForm = new FormData();
  proxyForm.append("file", new Blob([fileBytes], { type: "application/pdf" }), file.name);

  try {
    const res = await fetch(`${agentUrl}/extract`, {
      method: "POST",
      body: proxyForm,
      signal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return NextResponse.json({ detail: "Extract request timed out." }, { status: 504 });
    }
    throw error;
  }
}
