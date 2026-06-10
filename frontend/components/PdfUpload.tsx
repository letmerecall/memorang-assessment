"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { ErrorCard } from "@/components/ErrorCard";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import { patchAgentState } from "@/lib/agentState";

type PdfUploadProps = {
  onSessionStart?: (threadId: string) => void;
  agentRunError?: string | null;
  onAgentRetry?: () => void;
  onClearAgentRunError?: () => void;
};

export function PdfUpload({
  onSessionStart,
  agentRunError,
  onAgentRetry,
  onClearAgentRunError,
}: PdfUploadProps) {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    onClearAgentRunError?.();
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
      patchAgentState(agent, { pdf_text: data.text, lesson_plan: null, phase: null, error_message: null });
      onSessionStart?.(agent.threadId);
      await agent.runAgent();
    } catch {
      setError("Network error — is the agent server running?");
    } finally {
      setUploading(false);
      setRetrying(false);
    }
  }

  function openFilePicker() {
    inputRef.current?.click();
  }

  function handleRetry() {
    setRetrying(true);
    setError(null);
    patchAgentState(agent, { phase: null, error_message: null });
    agent.runAgent().catch(() => {
      setError("Could not generate a lesson plan. Please try again.");
      setRetrying(false);
    });
  }

  const displayError = error ?? agentRunError ?? null;
  const busy = uploading || agent.isRunning;

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
      {displayError ? (
        <ErrorCard
          message={displayError}
          onRetry={
            agentRunError
              ? () => onAgentRetry?.()
              : agent.state && (agent.state as { pdf_text?: string }).pdf_text
                ? handleRetry
                : openFilePicker
          }
          retryLabel={
            agentRunError || (agent.state && (agent.state as { pdf_text?: string }).pdf_text)
              ? "Retry"
              : "Try again"
          }
          retrying={retrying}
        />
      ) : (
        <button
          disabled={busy}
          onClick={openFilePicker}
          className="rounded bg-blue-600 px-6 py-3 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {uploading ? "Uploading…" : agent.isRunning ? "Generating plan…" : "Upload PDF"}
        </button>
      )}
    </div>
  );
}
