import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

const mockAgent = {
  threadId: "test-thread",
  isRunning: false,
  state: {} as Record<string, unknown>,
  setState: vi.fn(),
  runAgent: vi.fn(() => Promise.resolve()),
  subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })),
};

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent: mockAgent }),
  useInterrupt: () => null,
}));

vi.mock("@/lib/useSessionManager", () => ({
  useSessionManager: () => ({
    storedThreadId: null,
    saveThreadId: vi.fn(),
    clearSession: vi.fn(),
    loaded: true,
  }),
}));

vi.mock("@/components/PdfUpload", () => ({ PdfUpload: () => null }));
vi.mock("@/components/LessonPlan", () => ({ LessonPlan: () => null }));
vi.mock("@/components/LessonPlanApproval", () => ({
  useLessonPlanApproval: () => null,
}));
vi.mock("@/components/Summary", () => ({ useSummaryWidget: () => null }));

const mockMcq = <div data-testid="mcq-widget">MCQ</div>;
vi.mock("@/components/McqWidget", () => ({
  useMcqWidget: () => mockMcq,
}));

const { default: HomePage } = await import("@/app/page");

describe("HomePage progress sidebar", () => {
  beforeEach(() => {
    mockAgent.isRunning = false;
    mockAgent.state = {
      lesson_plan: {
        objectives: [
          {
            title: "Objective 1",
            description: "Desc",
            difficulty: "beginner",
          },
        ],
      },
      current_idx: 0,
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows sidebar during quiz even without quiz progress in agent state", () => {
    render(<HomePage />);

    expect(screen.getByTestId("mcq-widget")).toBeInTheDocument();
    expect(screen.getByText("Progress")).toBeInTheDocument();
    expect(screen.getByText("Objective 1")).toBeInTheDocument();
  });
});
