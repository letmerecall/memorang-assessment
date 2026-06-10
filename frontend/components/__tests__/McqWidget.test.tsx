import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent: { isRunning: false } }),
  useInterrupt: () => null,
}));

// Import McqForm by re-exporting from module — test the form via a thin wrapper
// McqForm is not exported; we test via duplicated minimal render by importing the module internals.
// Instead, test the exported hook's render callback by mocking useInterrupt.

const mockResolve = vi.fn();

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent: { isRunning: false } }),
  useInterrupt: (opts: { render: (args: { event: { value: unknown }; resolve: (v: unknown) => void }) => React.ReactNode }) => {
    const element = opts.render({
      event: {
        value: {
          type: "mcq",
          content: { question: "What is 2+2?", options: ["3", "4", "5", "6"] },
          feedback: (globalThis as { __mcqFeedback?: unknown }).__mcqFeedback ?? null,
          tutor_reply: null,
        },
      },
      resolve: mockResolve,
    });
    return element;
  },
}));

describe("useMcqWidget", () => {
  it("renders correct feedback with explanation and Continue", async () => {
    (globalThis as { __mcqFeedback?: unknown }).__mcqFeedback = {
      correct: true,
      explanation: "Two plus two is four.",
      source_quote: "Basic arithmetic.",
      selected_index: 1,
    };
    const { useMcqWidget } = await import("@/components/McqWidget");
    render(<>{useMcqWidget()}</>);
    expect(screen.getByText(/correct!/i)).toBeInTheDocument();
    expect(screen.getByText(/two plus two is four/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(mockResolve).toHaveBeenCalledWith({ kind: "continue" });
  });

  it("renders incorrect feedback with hint", async () => {
    (globalThis as { __mcqFeedback?: unknown }).__mcqFeedback = {
      correct: false,
      hint: "Count on your fingers.",
      selected_index: 0,
    };
    vi.resetModules();
    const { useMcqWidget } = await import("@/components/McqWidget");
    render(<>{useMcqWidget()}</>);
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByText(/count on your fingers/i)).toBeInTheDocument();
  });
});
