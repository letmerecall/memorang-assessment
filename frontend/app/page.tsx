"use client";

import { useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import {
  derivePhase,
  showPdfUpload,
  showPlanReview,
  showSidebar,
  statusLabel,
} from "@/lib/sessionPhase";
import type { AgentStateShape } from "@/lib/types";

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
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  const [planApproved, setPlanApproved] = useState(false);
  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const currentIdx = state.current_idx ?? 0;
  const approvalWidget = useLessonPlanApproval({
    onDecision: (decision) => {
      if (decision === "approve") setPlanApproved(true);
    },
  });
  const mcqWidget = useMcqWidget();

  function resetToUpload() {
    agent.threadId = crypto.randomUUID();
    agent.setState(RESET_STATE);
    setAwaitingUpload(true);
    setPlanApproved(false);
  }

  const summaryWidget = useSummaryWidget(resetToUpload);

  const phase = derivePhase({
    awaitingUpload,
    hasPlan: plan !== null,
    isRunning: agent.isRunning,
    hasApprovalWidget: Boolean(approvalWidget),
    hasMcqWidget: Boolean(mcqWidget),
    hasSummaryWidget: Boolean(summaryWidget),
  });

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showSidebar(phase, planApproved) && plan && (
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
        <p className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">
          {statusLabel(phase)}
        </p>

        {showPdfUpload(phase) && (
          <PdfUpload
            onSessionStart={() => {
              setAwaitingUpload(false);
              setPlanApproved(false);
            }}
          />
        )}

        {approvalWidget}

        {phase !== "upload" && mcqWidget}

        {phase !== "upload" && summaryWidget}

        {showPlanReview(phase) && plan && (
          <>
            <LessonPlan plan={plan} />
            <button
              onClick={resetToUpload}
              className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Upload another PDF
            </button>
          </>
        )}
      </div>
    </div>
  );
}
