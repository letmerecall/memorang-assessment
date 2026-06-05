"use client";

import { useInterrupt } from "@copilotkit/react-core/v2";

type InterruptPayload = { type?: string; message?: string };

// The ag_ui_langgraph adapter serializes the interrupt dict to a JSON string;
// parse it defensively so both string and object shapes work.
function parseValue(raw: unknown): InterruptPayload | null {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as InterruptPayload;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as InterruptPayload;
  }
  return null;
}

export function EchoInterrupt() {
  const element = useInterrupt({
    agentId: "spike_agent",
    renderInChat: false,
    enabled: (event) => parseValue(event.value)?.type === "echo_prompt",
    render: ({ event, resolve }) => {
      const payload = parseValue(event.value);
      return (
        <div className="rounded border border-gray-300 bg-white p-4 shadow-sm max-w-sm mx-auto mt-8">
          <p className="mb-3 text-sm text-gray-700">
            {payload?.message ?? "Click the button to complete the round-trip."}
          </p>
          <button
            className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
            onClick={() => resolve("round-trip confirmed!")}
          >
            Echo back
          </button>
        </div>
      );
    },
  });

  return <>{element}</>;
}
