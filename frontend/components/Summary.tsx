"use client";

import { useInterrupt } from "@copilotkit/react-core/v2";

type SummaryResult = {
  objective: string;
  correct_first_try: boolean;
  attempts: number;
  asked_tutor: boolean;
};

type SummaryContent = {
  score: number;
  results: SummaryResult[];
  tips: string;
};

type SummaryPayload = {
  type: string;
  content: SummaryContent;
};

function parseSummaryPayload(raw: unknown): SummaryPayload | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as SummaryPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as SummaryPayload;
  }
  return null;
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
          <div key={i} className="flex items-center gap-2">
            <span className={r.correct_first_try ? "text-green-600" : "text-orange-500"}>
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
          <p className="text-sm text-gray-700 whitespace-pre-wrap">{content.tips}</p>
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

export function useSummaryWidget() {
  return useInterrupt({
    agentId: "learning_agent",
    renderInChat: false,
    enabled: (event) => parseSummaryPayload(event.value)?.type === "summary",
    render: ({ event, resolve }) => {
      const payload = parseSummaryPayload(event.value);
      if (!payload) return <></>;
      return (
        <SummaryCard
          content={payload.content}
          onDone={() => resolve({})}
        />
      );
    },
  });
}
