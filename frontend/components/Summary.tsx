"use client";

import ReactMarkdown from "react-markdown";
import { useInterrupt } from "@copilotkit/react-core/v2";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import { markdownComponents } from "@/lib/markdownComponents";
import { parseInterruptValue } from "@/lib/parseInterrupt";
import type { SummaryContent, SummaryPayload } from "@/lib/types";

function parseSummaryPayload(raw: unknown): SummaryPayload | null {
  const payload = parseInterruptValue<SummaryPayload>(raw);
  return payload?.type === "summary" ? payload : null;
}

type SummaryCardProps = {
  content: SummaryContent;
  onDone: () => void;
};

function SummaryCard({ content, onDone }: SummaryCardProps) {
  const pct = Math.round(content.score * 100);
  return (
    <div className="w-full max-w-xl mt-8 rounded border border-blue-200 bg-blue-50 p-6">
      <h2 className="text-xl font-semibold text-blue-900 mb-1">Quiz Complete!</h2>
      <p className="text-4xl font-bold text-blue-700 mb-6">{pct}%</p>

      <div className="mb-4 space-y-1">
        {content.results.map((r, i) => (
          <div key={`${i}:${r.objective}`} className="flex items-center gap-2">
            <span
              className={r.correct_first_try ? "text-green-600" : "text-orange-500"}
              aria-label={r.correct_first_try ? "Correct" : "Incorrect"}
            >
              {r.correct_first_try ? "✓" : "✗"}
            </span>
            <span className="text-sm text-gray-700">{r.objective}</span>
            {!r.correct_first_try && (
              <span className="text-xs text-gray-400">({r.attempts} attempts)</span>
            )}
          </div>
        ))}
      </div>

      {content.tips && (
        <div className="border-t border-blue-200 pt-4 mb-4">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">Study Tips</h3>
          <ReactMarkdown components={markdownComponents}>{content.tips}</ReactMarkdown>
        </div>
      )}

      <button
        onClick={onDone}
        className="rounded bg-blue-600 px-6 py-2 text-white text-sm font-medium hover:bg-blue-700"
      >
        Done
      </button>
    </div>
  );
}

export function useSummaryWidget(onDone?: () => void) {
  return useInterrupt({
    agentId: LEARNING_AGENT_ID,
    renderInChat: false,
    enabled: (event) => parseSummaryPayload(event.value) !== null,
    render: ({ event }) => {
      const payload = parseSummaryPayload(event.value);
      if (!payload) return <></>;
      return (
        <SummaryCard
          content={payload.content}
          onDone={() => {
            // Do not call resolve() here. It triggers async runAgent(), which can
            // race with resetSession() and restart ingest_plan on a fresh empty thread.
            // resetSession() assigns a new threadId and sets awaitingUpload, which
            // hides this widget and returns the user to the upload screen.
            onDone?.();
          }}
        />
      );
    },
  });
}
