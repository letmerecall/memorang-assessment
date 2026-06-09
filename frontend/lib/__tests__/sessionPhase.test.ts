import { describe, expect, it } from "vitest";
import {
  derivePhase,
  derivePlanApproved,
  heroSubtitle,
  isInErrorState,
  shouldShowResumeScreen,
  showPdfUpload,
  showPlanReview,
  showSidebar,
  statusLabel,
  statusLabelForPage,
} from "@/lib/sessionPhase";
import type { AgentStateShape } from "@/lib/types";

const baseInput = {
  awaitingUpload: false,
  hasPlan: false,
  isRunning: false,
  hasApprovalWidget: false,
  hasMcqWidget: false,
  hasSummaryWidget: false,
};

const baseResumeInput = {
  storedThreadId: "thread-1",
  hasPlan: false,
  hasApprovalWidget: false,
  hasMcqWidget: false,
  hasSummaryWidget: false,
  isRunning: false,
  awaitingUpload: false,
};

describe("derivePhase", () => {
  it("returns upload when awaiting upload", () => {
    expect(derivePhase({ ...baseInput, awaitingUpload: true })).toBe("upload");
  });

  it("returns quiz when MCQ widget is active", () => {
    expect(derivePhase({ ...baseInput, hasMcqWidget: true })).toBe("quiz");
  });

  it("returns summary when summary widget is active", () => {
    expect(derivePhase({ ...baseInput, hasSummaryWidget: true })).toBe("summary");
  });

  it("returns approval when approval widget is active", () => {
    expect(derivePhase({ ...baseInput, hasApprovalWidget: true })).toBe("approval");
  });

  it("returns generating when agent is running", () => {
    expect(derivePhase({ ...baseInput, isRunning: true })).toBe("generating");
  });

  it("returns planIdle when plan exists and idle", () => {
    expect(derivePhase({ ...baseInput, hasPlan: true })).toBe("planIdle");
  });

  it("defaults to upload", () => {
    expect(derivePhase(baseInput)).toBe("upload");
  });

  it("returns error when hasError is true", () => {
    expect(derivePhase({ ...baseInput, hasError: true })).toBe("error");
  });
});

describe("derivePlanApproved", () => {
  const emptyState: AgentStateShape = {};

  it("returns false during approval widget", () => {
    expect(derivePlanApproved(emptyState, true)).toBe(false);
  });

  it("returns true when current_idx > 0", () => {
    expect(derivePlanApproved({ current_idx: 1 }, false)).toBe(true);
  });

  it("returns true when current_mcq is set", () => {
    expect(
      derivePlanApproved(
        { current_mcq: { question: "Q?", options: ["A", "B", "C", "D"] } },
        false,
      ),
    ).toBe(true);
  });

  it("returns true when results exist", () => {
    expect(
      derivePlanApproved(
        {
          results: [
            {
              objective: "T",
              correct_first_try: true,
              attempts: 1,
              asked_tutor: false,
            },
          ],
        },
        false,
      ),
    ).toBe(true);
  });

  it("returns false for fresh session at idx 0", () => {
    expect(derivePlanApproved({ current_idx: 0 }, false)).toBe(false);
  });
});

describe("shouldShowResumeScreen", () => {
  it("returns true when stored thread and idle", () => {
    expect(shouldShowResumeScreen(baseResumeInput)).toBe(true);
  });

  it("returns false when plan is loaded", () => {
    expect(shouldShowResumeScreen({ ...baseResumeInput, hasPlan: true })).toBe(false);
  });

  it("returns false when MCQ widget is active", () => {
    expect(shouldShowResumeScreen({ ...baseResumeInput, hasMcqWidget: true })).toBe(
      false,
    );
  });

  it("returns false when agent is running", () => {
    expect(shouldShowResumeScreen({ ...baseResumeInput, isRunning: true })).toBe(
      false,
    );
  });

  it("returns false when no stored thread", () => {
    expect(
      shouldShowResumeScreen({ ...baseResumeInput, storedThreadId: null }),
    ).toBe(false);
  });
});

describe("statusLabel", () => {
  it('uses "Plan ready" instead of "Done"', () => {
    expect(statusLabel("planIdle")).toBe("Plan ready");
    expect(statusLabel("planIdle")).not.toBe("Done");
  });

  it("shows checking answer while running during quiz", () => {
    expect(statusLabel("quiz", true)).toBe("Checking answer…");
  });

  it("shows error label for error phase", () => {
    expect(statusLabel("error")).toBe("Error — tap Retry to continue");
  });
});

describe("statusLabelForPage", () => {
  it("returns Resume available on resume screen", () => {
    expect(statusLabelForPage("upload", true)).toBe("Resume available");
  });

  it("delegates to statusLabel otherwise", () => {
    expect(statusLabelForPage("quiz", false)).toBe("Answer the question");
  });
});

describe("heroSubtitle", () => {
  it("shows resume copy on resume screen", () => {
    expect(heroSubtitle(true)).toContain("left off");
  });

  it("shows upload copy otherwise", () => {
    expect(heroSubtitle(false)).toContain("Upload a PDF");
  });
});

describe("layout helpers", () => {
  it("shows upload only in upload phase", () => {
    expect(showPdfUpload("upload")).toBe(true);
    expect(showPdfUpload("generating")).toBe(false);
  });

  it("shows plan review only in planIdle phase", () => {
    expect(showPlanReview("planIdle")).toBe(true);
    expect(showPlanReview("quiz")).toBe(false);
  });

  it("shows sidebar when approved outside upload and approval", () => {
    expect(showSidebar("quiz", true)).toBe(true);
    expect(showSidebar("approval", true)).toBe(false);
    expect(showSidebar("quiz", false)).toBe(false);
  });
});

describe("isInErrorState", () => {
  it("returns true when phase is error", () => {
    expect(isInErrorState({ phase: "error" })).toBe(true);
  });

  it("returns false otherwise", () => {
    expect(isInErrorState({ phase: null })).toBe(false);
    expect(isInErrorState({})).toBe(false);
  });
});
