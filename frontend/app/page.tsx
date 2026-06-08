"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { useSessionManager } from "@/lib/useSessionManager";

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
  const { storedThreadId, saveThreadId, clearSession } = useSessionManager();
  const [resumeError, setResumeError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);

  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const currentIdx = state.current_idx ?? 0;

  // Restore thread ID from localStorage onto the agent so LangGraph resumes the right checkpoint.
  useEffect(() => {
    if (storedThreadId) {
      agent.threadId = storedThreadId;
    }
  }, [agent, storedThreadId]);

  const approvalWidget = useLessonPlanApproval();
  const mcqWidget = useMcqWidget();
  const summaryWidget = useSummaryWidget(() => {
    clearSession();
    agent.threadId = crypto.randomUUID();
    agent.setState(RESET_STATE);
  });

  const anyWidget = approvalWidget || mcqWidget || summaryWidget;
  const showSidebar = plan !== null && approvalWidget === null;

  // Show resume screen when there's a stored session but nothing is active yet.
  const showResumeScreen =
    storedThreadId !== null &&
    !plan &&
    !anyWidget &&
    !agent.isRunning;

  async function handleResume() {
    setResumeError(null);
    setResuming(true);
    try {
      await agent.runAgent();
    } catch {
      setResumeError("Could not resume — the session may have expired. Start a new lesson.");
    } finally {
      setResuming(false);
    }
  }

  function handleStartOver() {
    clearSession();
    agent.threadId = crypto.randomUUID();
    agent.setState(RESET_STATE);
  }

  function statusLabel() {
    if (agent.isRunning) return "Generating…";
    if (approvalWidget) return "Awaiting your review";
    if (mcqWidget) return "Answer the question";
    if (summaryWidget) return "Quiz complete";
    if (plan) return "Done";
    return "Idle";
  }

  const mainContent = (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">AI Learning Agent</h1>
      <p className="mb-2 text-sm text-gray-500">
        Upload a PDF to generate a lesson plan.
      </p>
      <p className="text-xs text-gray-400">{statusLabel()}</p>

      {showResumeScreen && (
        <div className="mt-8 flex flex-col items-center gap-4 rounded-lg border border-blue-200 bg-blue-50 p-6 max-w-sm w-full">
          <p className="text-sm text-blue-800 text-center font-medium">
            You have an active lesson in progress.
          </p>
          <button
            disabled={resuming}
            onClick={handleResume}
            className="w-full rounded bg-blue-600 px-4 py-2 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {resuming ? "Resuming…" : "Resume lesson"}
          </button>
          <button
            onClick={handleStartOver}
            className="text-xs text-gray-400 hover:text-gray-600 underline"
          >
            Start new lesson
          </button>
          {resumeError && (
            <p className="text-sm text-red-600 text-center">{resumeError}</p>
          )}
        </div>
      )}

      {!showResumeScreen && !plan && !anyWidget && (
        <PdfUpload onRunStarted={saveThreadId} />
      )}

      {approvalWidget}

      {mcqWidget}

      {summaryWidget}

      {!anyWidget && !agent.isRunning && plan && (
        <LessonPlan plan={plan} />
      )}

      {!anyWidget && !agent.isRunning && plan && (
        <button
          onClick={handleStartOver}
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Start over
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showSidebar && plan && (
        <ProgressSidebar
          objectives={plan.objectives}
          currentIdx={currentIdx}
        />
      )}
      <div className="flex flex-1 flex-col items-center py-16 px-4">
        {mainContent}
      </div>
    </div>
  );
}
