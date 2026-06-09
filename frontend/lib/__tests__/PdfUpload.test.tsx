import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";

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
};

vi.mock("@copilotkit/react-core/v2", () => ({
  useAgent: () => ({ agent: mockAgent }),
}));

const { PdfUpload } = await import("@/components/PdfUpload");

describe("PdfUpload error handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAgent.state = {};
    mockAgent.isRunning = false;
    global.fetch = vi.fn();
  });

  it("shows extract error in ErrorCard", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "no extractable text found in this PDF" }),
    } as Response);

    render(<PdfUpload />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF"], "blank.pdf", { type: "application/pdf" });

    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(screen.getByText(/no extractable text/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /try again/i })).toBeInTheDocument();
    });
  });

  it("Retry re-runs agent when pdf_text is already seeded", async () => {
    mockAgent.state = { pdf_text: "content" };

    render(<PdfUpload />);

    vi.mocked(global.fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Upload failed." }),
    } as Response);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    await userEvent.upload(input, new File(["%PDF"], "bad.pdf", { type: "application/pdf" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));

    expect(mockRunAgent).toHaveBeenCalled();
  });
});
