import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

type SubscribeCallbacks = {
  onRunErrorEvent?: () => void;
  onRunFinishedEvent?: () => void;
};

let capturedCallbacks: SubscribeCallbacks = {};
let pdfUploadProps: Record<string, unknown> = {};
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

vi.mock("@/components/PdfUpload", () => ({
  PdfUpload: (props: Record<string, unknown>) => {
    pdfUploadProps = props;
    return props.agentRunError ? (
      <p data-testid="upload-error">{props.agentRunError as string}</p>
    ) : (
      <button>Upload PDF</button>
    );
  },
}));
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

describe("HomePage pre-plan upload error routing", () => {
  beforeEach(() => {
    capturedCallbacks = {};
    pdfUploadProps = {};
    mockRunAgent.mockResolvedValue(undefined);
    mockAgent.state = { pdf_text: "extracted content" };
    mockAgent.isRunning = false;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("routes pre-plan onRunErrorEvent to PdfUpload, not global ErrorCard", async () => {
    render(<HomePage />);

    act(() => {
      capturedCallbacks.onRunErrorEvent?.();
    });

    await waitFor(() => {
      expect(screen.getByTestId("upload-error")).toHaveTextContent(
        /could not generate a lesson plan/i,
      );
    });
    expect(screen.queryByRole("button", { name: /retry/i })).not.toBeInTheDocument();
    expect(mockSetState).not.toHaveBeenCalledWith(
      expect.objectContaining({ phase: "error" }),
    );
    expect(pdfUploadProps.agentRunError).toMatch(/could not generate a lesson plan/i);
  });
});
