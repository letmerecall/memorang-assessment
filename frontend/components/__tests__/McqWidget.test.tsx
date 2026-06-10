import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import React from "react";

// McqForm is not exported; test the exported hook's render callback by mocking
// useInterrupt. Mutable globals let tests drive the interrupt/run lifecycle.
type MockControls = {
  __mcqFeedback?: unknown;
  __mcqInterruptActive?: boolean;
  __mcqIsRunning?: boolean;
};
const controls = globalThis as MockControls;

const mockResolve = vi.fn();

// Mirrors the real useAgent: components subscribe to run-status changes and
// force-update themselves (the held interrupt element bails out of parent
// re-renders, so this self-subscription is what keeps McqForm live).
const runStatusListeners = new Set<() => void>();

function setRunning(isRunning: boolean) {
  controls.__mcqIsRunning = isRunning;
  act(() => {
    runStatusListeners.forEach((listener) => listener());
  });
}

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0);
    React.useEffect(() => {
      runStatusListeners.add(forceUpdate);
      return () => {
        runStatusListeners.delete(forceUpdate);
      };
    }, []);
    return { agent: { isRunning: controls.__mcqIsRunning ?? false } };
  },
  useInterrupt: (opts: { render: (args: { event: { value: unknown }; resolve: (v: unknown) => void }) => React.ReactNode }) => {
    if (controls.__mcqInterruptActive === false) return null;
    const element = opts.render({
      event: {
        value: {
          type: "mcq",
          content: { question: "What is 2+2?", options: ["3", "4", "5", "6"] },
          feedback: controls.__mcqFeedback ?? null,
          tutor_reply: null,
        },
      },
      resolve: mockResolve,
    });
    return element;
  },
}));

async function renderWidget() {
  vi.resetModules();
  const { useMcqWidget } = await import("@/components/McqWidget");
  function Harness() {
    return <>{useMcqWidget()}</>;
  }
  return render(<Harness />);
}

describe("useMcqWidget", () => {
  it("renders correct feedback with explanation and Continue", async () => {
    controls.__mcqFeedback = {
      correct: true,
      explanation: "Two plus two is four.",
      source_quote: "Basic arithmetic.",
      selected_index: 1,
    };
    controls.__mcqInterruptActive = true;
    controls.__mcqIsRunning = false;
    await renderWidget();
    expect(screen.getByText(/correct!/i)).toBeInTheDocument();
    expect(screen.getByText(/two plus two is four/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continue/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /continue/i }));
    expect(mockResolve).toHaveBeenCalledWith({ kind: "continue" });
  });

  it("renders incorrect feedback with hint", async () => {
    controls.__mcqFeedback = {
      correct: false,
      hint: "Count on your fingers.",
      selected_index: 0,
    };
    controls.__mcqInterruptActive = true;
    controls.__mcqIsRunning = false;
    await renderWidget();
    expect(screen.getByText(/incorrect/i)).toBeInTheDocument();
    expect(screen.getByText(/count on your fingers/i)).toBeInTheDocument();
  });

  it("keeps the form mounted while the agent runs after resolve", async () => {
    controls.__mcqFeedback = null;
    controls.__mcqInterruptActive = true;
    controls.__mcqIsRunning = false;
    await renderWidget();
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();

    // resolve() clears the interrupt for the whole run; the form must not
    // flash-unmount while the agent is still working. (setRunning re-renders
    // subscribers, mirroring useAgent's run-status forceUpdate.)
    controls.__mcqInterruptActive = false;
    setRunning(true);
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();

    // Run ended with no new MCQ interrupt (e.g. summary next) — form goes away.
    setRunning(false);
    expect(screen.queryByText("What is 2+2?")).not.toBeInTheDocument();
    controls.__mcqInterruptActive = true;
  });

  it("shows the hint loading state after Ask while the agent runs", async () => {
    controls.__mcqFeedback = null;
    controls.__mcqInterruptActive = true;
    controls.__mcqIsRunning = false;
    await renderWidget();

    await userEvent.type(screen.getByPlaceholderText("Ask your tutor…"), "help me");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect(mockResolve).toHaveBeenCalledWith({ kind: "question", text: "help me" });

    controls.__mcqInterruptActive = false;
    setRunning(true);
    expect(screen.getByText(/getting hint/i)).toBeInTheDocument();
    expect(screen.getByText("What is 2+2?")).toBeInTheDocument();
    controls.__mcqInterruptActive = true;
    controls.__mcqIsRunning = false;
  });
});
