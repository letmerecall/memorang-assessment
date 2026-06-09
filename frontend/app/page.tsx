"use client";

import { useEffect, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";
import { ErrorCard } from "@/components/ErrorCard";
import { RESET_STATE } from "@/lib/agentState";
import { LEARNING_AGENT_ID } from "@/lib/agent";
import {
  derivePhase,
  derivePlanApproved,
  heroSubtitle,
  isInErrorState,
  shouldShowResumeScreen,
  showPdfUpload,
  showPlanReview,
  showSidebar,
  statusLabelForPage,
} from "@/lib/sessionPhase";
import type { AgentStateShape } from "@/lib/types";
import { useSessionManager } from "@/lib/useSessionManager";

const RESUME_ERROR =
  "Could not resume — the session may have expired. Start a new lesson.";
const RUN_ERROR = "Something went wrong. Please try again.";

export default function HomePage() {
  const { agent } = useAgent({ agentId: LEARNING_AGENT_ID });
  const { storedThreadId, saveThreadId, clearSession, loaded } = useSessionManager();
  const [awaitingUpload, setAwaitingUpload] = useState(false);
  const [localApproved, setLocalApproved] = useState(false);
  const [runError, setRunError] = useState<string | null>(null);
  const [resuming, setResuming] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const currentIdx = state.current_idx ?? 0;
  const hasError = Boolean(runError) || isInErrorState(state);
  const errorMessage =
    runError ?? state.error_message ?? RUN_ERROR;

  // Restore thread ID from localStorage onto the agent so LangGraph resumes the right checkpoint.
  useEffect(() => {
    if (storedThreadId) {
      agent.threadId = storedThreadId;
    }
  }, [agent, storedThreadId]);

  const approvalWidget = useLessonPlanApproval({
    isRunning: agent.isRunning,
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
    setRunError(null);
    setResuming(false);
    setRetrying(false);
  }

  const summaryWidget = useSummaryWidget(resetSession);

  // Global run lifecycle — onRunErrorEvent is the reliable hook for server-side failures.
  useEffect(() => {
    const sub = agent.subscribe({
      onRunErrorEvent: () => {
        const msg = resuming ? RESUME_ERROR : RUN_ERROR;
        agent.setState({ phase: "error", error_message: msg });
        setRunError(msg);
        setResuming(false);
        setRetrying(false);
      },
      onRunFinishedEvent: () => {
        setResuming(false);
        setRetrying(false);
        setRunError(null);
        agent.setState({ phase: null, error_message: null });
      },
    });
    return () => sub.unsubscribe();
  }, [agent, resuming]);

  function handleResume() {
    setRunError(null);
    setResuming(true);
    agent.runAgent().catch(() => {
      setRunError(RESUME_ERROR);
      setResuming(false);
    });
  }

  function handleRetry() {
    setRetrying(true);
    setRunError(null);
    agent.setState({ phase: null, error_message: null });
    agent.runAgent().catch(() => {
      setRunError(RUN_ERROR);
      setRetrying(false);
    });
  }

  const phase = derivePhase({
    awaitingUpload,
    hasPlan: plan !== null,
    isRunning: agent.isRunning,
    hasApprovalWidget: Boolean(approvalWidget),
    hasMcqWidget: Boolean(mcqWidget),
    hasSummaryWidget: Boolean(summaryWidget),
    hasError,
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
          {statusLabelForPage(phase, showResumeScreen, agent.isRunning)}
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
            {runError && resuming === false && (
              <p className="text-sm text-red-600 text-center">{runError}</p>
            )}
          </div>
        )}

        {loaded && !showResumeScreen && hasError && (
          <ErrorCard
            message={errorMessage}
            onRetry={handleRetry}
            onReset={resetSession}
            retrying={retrying}
          />
        )}

        {loaded && !showResumeScreen && !hasError && showPdfUpload(phase) && (
          <PdfUpload
            onSessionStart={(threadId) => {
              saveThreadId(threadId);
              setAwaitingUpload(false);
              setLocalApproved(false);
            }}
          />
        )}

        {!hasError && approvalWidget}

        {!hasError && phase !== "upload" && mcqWidget}

        {!hasError && phase !== "upload" && summaryWidget}

        {!hasError && showPlanReview(phase) && plan && (
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
