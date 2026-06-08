"use client";

import { useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";

type LessonPlanData = {
  objectives: {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }[];
};

type AgentStateShape = {
  lesson_plan?: LessonPlanData;
  current_idx?: number;
};

const RESET_STATE = {
  pdf_text: null,
  lesson_plan: null,
  current_idx: 0,
  current_mcq: null,
  attempts: 0,
  results: null,
  last_answer: null,
  last_grade: null,
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const currentIdx = state.current_idx ?? 0;
  const approvalWidget = useLessonPlanApproval();
  const mcqWidget = useMcqWidget();

  function resetToUpload() {
    agent.threadId = crypto.randomUUID();
    agent.setState(RESET_STATE);
    setAwaitingUpload(true);
  }

  const summaryWidget = useSummaryWidget(resetToUpload);

  const showPdfUpload =
    awaitingUpload ||
    (!plan && !approvalWidget && !mcqWidget && !summaryWidget);
  const showSidebar = !awaitingUpload && plan !== null && approvalWidget === null;

  function statusLabel() {
    if (awaitingUpload) return "Idle";
    if (mcqWidget) return "Answer the question";
    if (agent.isRunning) return "Generating…";
    if (approvalWidget) return "Awaiting your review";
    if (summaryWidget) return "Quiz complete";
    if (plan) return "Done";
    return "Idle";
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showSidebar && plan && (
        <ProgressSidebar
          objectives={plan.objectives}
          currentIdx={currentIdx}
        />
      )}
      <div className="flex flex-1 flex-col items-center py-16 px-4">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">AI Learning Agent</h1>
        <p className="mb-2 text-sm text-gray-500">
          Upload a PDF to generate a lesson plan.
        </p>
        <p className="text-xs text-gray-400">{statusLabel()}</p>

        {showPdfUpload && (
          <PdfUpload onSessionStart={() => setAwaitingUpload(false)} />
        )}

        {approvalWidget}

        {!awaitingUpload && mcqWidget}

        {!awaitingUpload && summaryWidget}

        {!awaitingUpload && !approvalWidget && !mcqWidget && !summaryWidget && !agent.isRunning && plan && (
          <LessonPlan plan={plan} />
        )}

        {!awaitingUpload && !approvalWidget && !mcqWidget && !summaryWidget && !agent.isRunning && plan && (
          <button
            onClick={resetToUpload}
            className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Upload another PDF
          </button>
        )}
      </div>
    </div>
  );
}
