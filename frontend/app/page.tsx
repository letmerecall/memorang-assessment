"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";

type LessonPlanData = {
  objectives: {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }[];
};

type AgentStateShape = {
  lesson_plan?: LessonPlanData;
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const approvalWidget = useLessonPlanApproval();
  const mcqWidget = useMcqWidget();
  const summaryWidget = useSummaryWidget(() =>
    agent.setState({
      pdf_text: null,
      lesson_plan: null,
      current_idx: 0,
      current_mcq: null,
      attempts: 0,
      results: null,
      last_answer: null,
      last_grade: null,
    })
  );

  const anyWidget = approvalWidget || mcqWidget || summaryWidget;

  function statusLabel() {
    if (agent.isRunning) return "Generating…";
    if (approvalWidget) return "Awaiting your review";
    if (mcqWidget) return "Answer the question";
    if (summaryWidget) return "Quiz complete";
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

      {!plan && !anyWidget && <PdfUpload />}

      {approvalWidget}

      {mcqWidget}

      {summaryWidget}

      {!anyWidget && !agent.isRunning && plan && (
        <LessonPlan plan={plan} />
      )}

      {!anyWidget && !agent.isRunning && plan && (
        <button
          onClick={() =>
            agent.setState({
              pdf_text: null,
              lesson_plan: null,
              current_idx: 0,
              current_mcq: null,
              attempts: 0,
              results: null,
              last_answer: null,
              last_grade: null,
            })
          }
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Upload another PDF
        </button>
      )}
    </div>
  );
}
