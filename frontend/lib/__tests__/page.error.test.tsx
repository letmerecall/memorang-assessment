import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

type SubscribeCallbacks = {
  onRunErrorEvent?: () => void;
  onRunFinishedEvent?: () => void;
};

let capturedCallbacks: SubscribeCallbacks = {};
const mockRunAgent = vi.fn(() => Promise.resolve());
const mockSetState = vi.fn((update: Record<string, unknown>) => {
  Object.assign(mockAgent.state, update);
});
const mockAgent = {
  threadId: "test-thread",
  isRunning: false,
  state: {} as Record<string, unknown>,
  setState: mockSetState,
  runAgent: mockRunAgent,
  subscribe: vi.fn((cbs: SubscribeCallbacks) => {
    capturedCallbacks = cbs;
    return { unsubscribe: vi.fn() };
  }),
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
vi.mock("@/components/McqWidget", () => ({ useMcqWidget: () => null }));
vi.mock("@/components/Summary", () => ({ useSummaryWidget: () => null }));
vi.mock("@/components/ProgressSidebar", () => ({
  ProgressSidebar: () => null,
}));

const { default: HomePage } = await import("@/app/page");

describe("HomePage global error handling", () => {
  beforeEach(() => {
    capturedCallbacks = {};
    mockRunAgent.mockResolvedValue(undefined);
    mockAgent.state = { lesson_plan: { objectives: [] } };
    mockAgent.isRunning = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows ErrorCard when onRunErrorEvent fires", async () => {
    render(<HomePage />);

    act(() => {
      capturedCallbacks.onRunErrorEvent?.();
    });

    await waitFor(() => {
      expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });
    expect(mockSetState).toHaveBeenCalledWith(
      expect.objectContaining({ phase: "error" }),
    );
  });

  it("Retry clears error state and calls runAgent", async () => {
    render(<HomePage />);

    act(() => {
      capturedCallbacks.onRunErrorEvent?.();
    });

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(mockSetState).toHaveBeenCalledWith({ phase: null, error_message: null });
    expect(mockRunAgent).toHaveBeenCalled();
  });

  it("clears error after onRunFinishedEvent", async () => {
    mockAgent.state = { lesson_plan: { objectives: [] }, phase: "error" };
    render(<HomePage />);

    act(() => {
      capturedCallbacks.onRunErrorEvent?.();
    });
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();

    act(() => {
      capturedCallbacks.onRunFinishedEvent?.();
    });

    await waitFor(() => {
      expect(screen.queryByText(/something went wrong/i)).not.toBeInTheDocument();
    });
  });
});
