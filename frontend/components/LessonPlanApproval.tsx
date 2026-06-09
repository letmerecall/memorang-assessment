"use client";

import { useState } from "react";
import { useInterrupt } from "@copilotkit/react-core/v2";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import { parseInterruptValue } from "@/lib/parseInterrupt";
import type { Objective, PlanApprovalPayload } from "@/lib/types";
import { ObjectiveList } from "@/components/ObjectiveList";

type PlanApprovalFormProps = {
  objectives: Objective[];
  resolve: (response: unknown) => void;
  onDecision?: (decision: "approve" | "revise") => void;
  isRunning?: boolean;
};

function PlanApprovalForm({ objectives, resolve, onDecision, isRunning = false }: PlanApprovalFormProps) {
  const [feedback, setFeedback] = useState("");

  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold mb-1">Review Lesson Plan</h2>
      <p className="text-sm text-gray-500 mb-4">
        Approve to continue, or describe what you&apos;d like changed.
      </p>

      <ObjectiveList objectives={objectives} className="space-y-4 mb-6" />

      <div className="flex flex-col gap-3">
        <button
          disabled={isRunning}
          onClick={() => {
            onDecision?.("approve");
            resolve({ decision: "approve" });
          }}
          className="rounded bg-green-600 px-6 py-2 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          Approve
        </button>

        <div className="flex flex-col gap-2">
          <textarea
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Describe what you'd like changed…"
            rows={3}
            disabled={isRunning}
            className="rounded border border-gray-300 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:bg-gray-50"
          />
          <button
            disabled={!feedback.trim() || isRunning}
            onClick={() => {
              onDecision?.("revise");
              resolve({ decision: "revise", feedback: feedback.trim() });
              setFeedback("");
            }}
            className="rounded bg-amber-500 px-6 py-2 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
          >
            {isRunning ? "Regenerating plan…" : "Request changes"}
          </button>
        </div>
        {isRunning && (
          <p className="text-xs text-amber-600">Regenerating plan…</p>
        )}
      </div>
    </div>
  );
}

type UseLessonPlanApprovalOptions = {
  onDecision?: (decision: "approve" | "revise") => void;
  isRunning?: boolean;
};

export function useLessonPlanApproval(options?: UseLessonPlanApprovalOptions) {
  const onDecision = options?.onDecision;
  const isRunning = options?.isRunning ?? false;
  return useInterrupt({
    agentId: LEARNING_AGENT_ID,
    renderInChat: false,
    enabled: (event) =>
      parseInterruptValue<PlanApprovalPayload>(event.value)?.type === "plan_approval",
    render: ({ event, resolve }) => {
      const payload = parseInterruptValue<PlanApprovalPayload>(event.value);
      if (!payload) return <></>;

      return (
        <PlanApprovalForm
          key={JSON.stringify(payload.content.objectives)}
          objectives={payload.content.objectives}
          resolve={resolve}
          onDecision={onDecision}
          isRunning={isRunning}
        />
      );
    },
  });
}
