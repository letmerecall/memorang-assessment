"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { LEARNING_AGENT_ID } from "@/lib/agent";

type PdfUploadProps = {
  onSessionStart?: (threadId: string) => void;
};

export function PdfUpload({ onSessionStart }: PdfUploadProps) {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Upload failed.");
        return;
      }
      agent.setState({ pdf_text: data.text, lesson_plan: null });
      onSessionStart?.(agent.threadId);
      try {
        await agent.runAgent();
      } catch {
        setError("Could not generate a lesson plan. Please try a different PDF.");
      }
    } catch {
      setError("Network error — is the agent server running?");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        disabled={uploading || agent.isRunning}
        onClick={() => inputRef.current?.click()}
        className="rounded bg-blue-600 px-6 py-3 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : agent.isRunning ? "Generating plan…" : "Upload PDF"}
      </button>
      {error && (
        <p className="text-sm text-red-600 max-w-sm text-center">{error}</p>
      )}
    </div>
  );
}
