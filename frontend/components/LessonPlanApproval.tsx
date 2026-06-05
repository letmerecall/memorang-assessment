"use client";

import { useState } from "react";
import { useInterrupt } from "@copilotkit/react-core/v2";

type Difficulty = "beginner" | "intermediate" | "advanced";

type Objective = {
  title: string;
  description: string;
  difficulty: Difficulty;
};

type PlanApprovalPayload = {
  type: string;
  content: { objectives: Objective[] };
};

const BADGE_STYLE: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

function parseInterruptValue(raw: unknown): PlanApprovalPayload | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as PlanApprovalPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as PlanApprovalPayload;
  }
  return null;
}

export function useLessonPlanApproval() {
  const [feedback, setFeedback] = useState("");

  return useInterrupt({
    renderInChat: false,
    enabled: (event) =>
      parseInterruptValue(event.value)?.type === "plan_approval",
    render: ({ event, resolve }) => {
      const payload = parseInterruptValue(event.value);
      if (!payload) return <></>;
      const { objectives } = payload.content;

      return (
        <div className="w-full max-w-xl mt-8">
          <h2 className="text-lg font-semibold mb-1">Review Lesson Plan</h2>
          <p className="text-sm text-gray-500 mb-4">
            Approve to continue, or describe what you&apos;d like changed.
          </p>

          <ol className="space-y-4 mb-6">
            {objectives.map((obj, i) => (
              <li
                key={i}
                className="rounded border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm">{obj.title}</span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLE[obj.difficulty]}`}
                  >
                    {obj.difficulty}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{obj.description}</p>
              </li>
            ))}
          </ol>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => resolve({ decision: "approve" })}
              className="rounded bg-green-600 px-6 py-2 text-white text-sm font-medium hover:bg-green-700"
            >
              Approve
            </button>

            <div className="flex flex-col gap-2">
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Describe what you'd like changed…"
                rows={3}
                className="rounded border border-gray-300 p-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              <button
                disabled={!feedback.trim()}
                onClick={() => {
                  resolve({ decision: "revise", feedback: feedback.trim() });
                  setFeedback("");
                }}
                className="rounded bg-amber-500 px-6 py-2 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                Request changes
              </button>
            </div>
          </div>
        </div>
      );
    },
  });
}
