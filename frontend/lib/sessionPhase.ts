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

export function derivePhase(input: PhaseInput): SessionPhase {
  if (input.awaitingUpload) return "upload";
  if (input.hasMcqWidget) return "quiz";
  if (input.hasSummaryWidget) return "summary";
  if (input.hasApprovalWidget) return "approval";
  if (input.isRunning) return "generating";
  if (input.hasPlan) return "planIdle";
  return "upload";
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

export function showPdfUpload(phase: SessionPhase): boolean {
  return phase === "upload";
}

export function showSidebar(phase: SessionPhase, planApproved: boolean): boolean {
  return planApproved && phase !== "upload" && phase !== "approval";
}

export function showPlanReview(phase: SessionPhase): boolean {
  return phase === "planIdle";
}
