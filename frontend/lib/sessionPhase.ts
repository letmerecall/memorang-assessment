import type { AgentStateShape } from "@/lib/types";

export type SessionPhase =
  | "upload"
  | "generating"
  | "approval"
  | "quiz"
  | "summary"
  | "planIdle";

export type PhaseInput = {
  awaitingUpload: boolean;
  hasPlan: boolean;
  isRunning: boolean;
  hasApprovalWidget: boolean;
  hasMcqWidget: boolean;
  hasSummaryWidget: boolean;
};

export type ResumeScreenInput = {
  storedThreadId: string | null;
  hasPlan: boolean;
  hasApprovalWidget: boolean;
  hasMcqWidget: boolean;
  hasSummaryWidget: boolean;
  isRunning: boolean;
  awaitingUpload: boolean;
};

export function derivePhase(input: PhaseInput): SessionPhase {
  if (input.awaitingUpload) return "upload";
  if (input.hasMcqWidget) return "quiz";
  if (input.hasSummaryWidget) return "summary";
  if (input.hasApprovalWidget) return "approval";
  if (input.isRunning) return "generating";
  if (input.hasPlan) return "planIdle";
  return "upload";
}

export function derivePlanApproved(
  state: AgentStateShape,
  hasApprovalWidget: boolean,
): boolean {
  if (hasApprovalWidget) return false;
  const idx = state.current_idx ?? 0;
  if (idx > 0) return true;
  if (state.current_mcq != null) return true;
  if ((state.results?.length ?? 0) > 0) return true;
  return false;
}

export function shouldShowResumeScreen(input: ResumeScreenInput): boolean {
  return (
    input.storedThreadId !== null &&
    !input.hasPlan &&
    !input.hasApprovalWidget &&
    !input.hasMcqWidget &&
    !input.hasSummaryWidget &&
    !input.isRunning &&
    !input.awaitingUpload
  );
}

export function statusLabel(phase: SessionPhase): string {
  switch (phase) {
    case "upload":
      return "Idle";
    case "generating":
      return "Generating…";
    case "approval":
      return "Awaiting your review";
    case "quiz":
      return "Answer the question";
    case "summary":
      return "Quiz complete";
    case "planIdle":
      return "Plan ready";
  }
}

export function statusLabelForPage(
  phase: SessionPhase,
  showResume: boolean,
): string {
  if (showResume) return "Resume available";
  return statusLabel(phase);
}

export function heroSubtitle(showResume: boolean): string {
  if (showResume) {
    return "Pick up where you left off, or start a new lesson.";
  }
  return "Upload a PDF to generate a lesson plan.";
}

export function showPdfUpload(phase: SessionPhase): boolean {
  return phase === "upload";
}

export function showSidebar(phase: SessionPhase, planApproved: boolean): boolean {
  return planApproved && phase !== "upload" && phase !== "approval";
}

export function showPlanReview(phase: SessionPhase): boolean {
  return phase === "planIdle";
}
