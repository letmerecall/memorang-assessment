"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { RESET_STATE } from "@/lib/agentState";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import {
  derivePhase,
  derivePlanApproved,
  heroSubtitle,
  shouldShowResumeScreen,
  showPdfUpload,
  showPlanReview,
  showSidebar,
  statusLabelForPage,
} from "@/lib/sessionPhase";
import type { AgentStateShape } from "@/lib/types";
import { useSessionManager } from "@/lib/useSessionManager";

export default function HomePage() {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const { storedThreadId, saveThreadId, clearSession, loaded } = useSessionManager();
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  const [localApproved, setLocalApproved] = useState(false);
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

  const approvalWidget = useLessonPlanApproval({
    onDecision: (decision) => {
      if (decision === "approve") setLocalApproved(true);
    },
  });
  const mcqWidget = useMcqWidget();

  function resetSession() {
    clearSession();
    agent.threadId = crypto.randomUUID();
    agent.setState(RESET_STATE);
    setAwaitingUpload(true);
    setLocalApproved(false);
    setResumeError(null);
  }

  const summaryWidget = useSummaryWidget(resetSession);

  useEffect(() => {
    if (!resuming) return;
    const sub = agent.subscribe({
      onRunErrorEvent: () => {
        setResumeError(
          "Could not resume — the session may have expired. Start a new lesson.",
        );
        setResuming(false);
      },
      onRunFinishedEvent: () => {
        setResuming(false);
      },
    });
    return () => sub.unsubscribe();
  }, [agent, resuming]);

  function handleResume() {
    setResumeError(null);
    setResuming(true);
    // Fire and forget — lifecycle handled by the subscription effect above.
    // Catch only in case CopilotKit rejects the Promise (rare).
    agent.runAgent().catch(() => {
      setResumeError(
        "Could not resume — the session may have expired. Start a new lesson.",
      );
      setResuming(false);
    });
  }

  const phase = derivePhase({
    awaitingUpload,
    hasPlan: plan !== null,
    isRunning: agent.isRunning,
    hasApprovalWidget: Boolean(approvalWidget),
    hasMcqWidget: Boolean(mcqWidget),
    hasSummaryWidget: Boolean(summaryWidget),
  });

  const planApproved =
    derivePlanApproved(state, Boolean(approvalWidget)) || localApproved;

  const showResumeScreen = shouldShowResumeScreen({
    storedThreadId,
    hasPlan: plan !== null,
    hasApprovalWidget: Boolean(approvalWidget),
    hasMcqWidget: Boolean(mcqWidget),
    hasSummaryWidget: Boolean(summaryWidget),
    isRunning: agent.isRunning,
    awaitingUpload,
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
          {heroSubtitle(showResumeScreen)}
        </p>
        <p className="text-xs text-gray-400" aria-live="polite" aria-atomic="true">
          {statusLabelForPage(phase, showResumeScreen)}
        </p>

        {loaded && showResumeScreen && (
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
              disabled={resuming}
              onClick={resetSession}
              className="text-xs text-gray-400 hover:text-gray-600 underline disabled:opacity-50"
            >
              Start new lesson
            </button>
            {resumeError && (
              <p className="text-sm text-red-600 text-center">{resumeError}</p>
            )}
          </div>
        )}

        {loaded && !showResumeScreen && showPdfUpload(phase) && (
          <PdfUpload
            onSessionStart={(threadId) => {
              saveThreadId(threadId);
              setAwaitingUpload(false);
              setLocalApproved(false);
            }}
            onRunFailed={resetSession}
          />
        )}

        {approvalWidget}

        {phase !== "upload" && mcqWidget}

        {phase !== "upload" && summaryWidget}

        {showPlanReview(phase) && plan && (
          <>
            <LessonPlan plan={plan} />
            <button
              onClick={resetSession}
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
