import { describe, expect, it } from "vitest";
import {
  derivePhase,
  showPdfUpload,
  showPlanReview,
  showSidebar,
  statusLabel,
} from "@/lib/sessionPhase";

const baseInput = {
  awaitingUpload: false,
  hasPlan: false,
  isRunning: false,
  hasApprovalWidget: false,
  hasMcqWidget: false,
  hasSummaryWidget: false,
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
});

describe("statusLabel", () => {
  it('uses "Plan ready" instead of "Done"', () => {
    expect(statusLabel("planIdle")).toBe("Plan ready");
    expect(statusLabel("planIdle")).not.toBe("Done");
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
