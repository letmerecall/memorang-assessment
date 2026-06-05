"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";

type LessonPlanData = {
  objectives: {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }[];
};

type LastGrade = {
  correct: boolean;
  explanation?: string;
  source_quote?: string;
  hint?: string;
};

type AgentStateShape = {
  lesson_plan?: LessonPlanData;
  last_grade?: LastGrade;
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const lastGrade = state.last_grade ?? null;
  const approvalWidget = useLessonPlanApproval();
  const mcqWidget = useMcqWidget();

  function statusLabel() {
    if (agent.isRunning) return "Generating…";
    if (approvalWidget) return "Awaiting your review";
    if (mcqWidget) return "Answer the question";
    if (plan) return "Done";
    return "Idle";
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 py-16 px-4">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">AI Learning Agent</h1>
      <p className="mb-2 text-sm text-gray-500">
        Upload a PDF to generate a lesson plan.
      </p>
      <p className="text-xs text-gray-400">{statusLabel()}</p>

      {!plan && !approvalWidget && !mcqWidget && <PdfUpload />}

      {approvalWidget}

      {mcqWidget}

      {!approvalWidget && !mcqWidget && lastGrade?.correct && (
        <div className="w-full max-w-xl mt-8 rounded border border-green-200 bg-green-50 p-6">
          <p className="font-semibold text-green-800 mb-2">Correct!</p>
          <p className="text-sm text-gray-700 mb-3">{lastGrade.explanation}</p>
          {lastGrade.source_quote && (
            <blockquote className="border-l-4 border-green-300 pl-3 text-xs text-gray-500 italic">
              {lastGrade.source_quote}
            </blockquote>
          )}
        </div>
      )}

      {!approvalWidget && !mcqWidget && plan && (
        <LessonPlan plan={plan} />
      )}

      {!approvalWidget && !mcqWidget && plan && (
        <button
          onClick={() =>
            agent.setState({ pdf_text: null, lesson_plan: null })
          }
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Upload another PDF
        </button>
      )}
    </div>
  );
}
