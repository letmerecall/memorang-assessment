import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

// ── Minimal stubs for CopilotKit hooks ──────────────────────────────────────

type SubscribeCallbacks = {
  onRunErrorEvent?: () => void;
  onRunFinishedEvent?: () => void;
};

let capturedCallbacks: SubscribeCallbacks = {};
const mockRunAgent = vi.fn(() => Promise.resolve());
const mockAgent = {
  threadId: "test-thread",
  isRunning: false,
  state: {},
  setState: vi.fn(),
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
    storedThreadId: "stored-thread-id",
    saveThreadId: vi.fn(),
    clearSession: vi.fn(),
    loaded: true,
  }),
}));

// Stub out every component/hook that page.tsx imports so the test is isolated
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

// Import the page AFTER mocks are set up
const { default: HomePage } = await import("@/app/page");

// ─────────────────────────────────────────────────────────────────────────────

describe("HomePage resume error handling", () => {
  beforeEach(() => {
    capturedCallbacks = {};
    mockRunAgent.mockResolvedValue(undefined);
    mockAgent.state = {};
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Resuming…' label while the run is in progress", async () => {
    // runAgent never resolves during this test
    mockRunAgent.mockReturnValue(new Promise(() => {}));

    render(<HomePage />);
    const btn = screen.getByRole("button", { name: /Resume lesson/i });

    await userEvent.click(btn);

    expect(screen.getByRole("button", { name: /Resuming/i })).toBeInTheDocument();
    expect(btn).toBeDisabled();
  });

  it("shows error message when onRunErrorEvent fires", async () => {
    render(<HomePage />);
    await userEvent.click(screen.getByRole("button", { name: /Resume lesson/i }));

    // Simulate CopilotKit firing the error callback
    act(() => {
      capturedCallbacks.onRunErrorEvent?.();
    });

    await waitFor(() => {
      expect(
        screen.getByText(/could not resume/i),
      ).toBeInTheDocument();
    });
  });

  it("clears resuming state when onRunFinishedEvent fires", async () => {
    mockRunAgent.mockReturnValue(new Promise(() => {}));
    render(<HomePage />);
    await userEvent.click(screen.getByRole("button", { name: /Resume lesson/i }));

    act(() => {
      capturedCallbacks.onRunFinishedEvent?.();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /Resume lesson/i }),
      ).not.toBeDisabled();
    });
  });

  it("shows error message when runAgent Promise rejects", async () => {
    mockRunAgent.mockRejectedValue(new Error("network"));
    render(<HomePage />);
    await userEvent.click(screen.getByRole("button", { name: /Resume lesson/i }));
    await waitFor(() =>
      expect(screen.getByText(/could not resume/i)).toBeInTheDocument(),
    );
  });

  it("hydrates agent state from the state endpoint on Resume", async () => {
    // The agent backend short-circuits interrupted runs without emitting a
    // STATE_SNAPSHOT, so the page must fetch checkpoint state itself.
    const statePayload = {
      lesson_plan: { objectives: [{ title: "O1", description: "D", difficulty: "beginner" }] },
      current_idx: 2,
    };
    const fetchMock = vi.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve(statePayload) }),
    );
    vi.stubGlobal("fetch", fetchMock);
    try {
      render(<HomePage />);
      await userEvent.click(screen.getByRole("button", { name: /Resume lesson/i }));

      expect(fetchMock).toHaveBeenCalledWith("/api/state/stored-thread-id");
      await waitFor(() => {
        expect(mockAgent.setState).toHaveBeenCalledWith(
          expect.objectContaining(statePayload),
        );
      });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("subscribes once and does not resubscribe on Resume click", async () => {
    render(<HomePage />);
    expect(mockAgent.subscribe).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole("button", { name: /Resume lesson/i }));

    expect(mockAgent.subscribe).toHaveBeenCalledTimes(1);
  });
});
