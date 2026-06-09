import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import type { SummaryPayload } from "@/lib/types";

type InterruptConfig = {
  render: (args: {
    event: { value: unknown };
    resolve: (value: unknown) => void;
  }) => React.ReactNode;
  enabled?: (event: { value: unknown }) => boolean;
};

let interruptConfig: InterruptConfig | null = null;
const mockResolve = vi.fn();

vi.mock("@copilotkit/react-core/v2", () => ({
  useInterrupt: (config: InterruptConfig) => {
    interruptConfig = config;
    return <div data-testid="summary-widget" />;
  },
}));

const { useSummaryWidget } = await import("@/components/Summary");

const samplePayload: SummaryPayload = {
  type: "summary",
  content: {
    score: 0.75,
    results: [
      {
        objective: "Objective A",
        correct_first_try: true,
        attempts: 1,
        asked_tutor: false,
      },
    ],
    tips: "Review chapter 2.",
  },
};

function SummaryTestWrapper({ onDone }: { onDone: () => void }) {
  useSummaryWidget(onDone);
  if (!interruptConfig) return null;
  return interruptConfig.render({
    event: { value: samplePayload },
    resolve: mockResolve,
  });
}

describe("useSummaryWidget Done button", () => {
  beforeEach(() => {
    interruptConfig = null;
    mockResolve.mockClear();
  });

  it("calls onDone but not resolve when Done is clicked", async () => {
    const onDone = vi.fn();
    render(<SummaryTestWrapper onDone={onDone} />);

    await userEvent.click(screen.getByRole("button", { name: /done/i }));

    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mockResolve).not.toHaveBeenCalled();
  });
});
