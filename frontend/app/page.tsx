"use client";

import { useEffect } from "react";
import { useAgent } from "@copilotkit/react-core/v2";
import { EchoInterrupt } from "@/components/EchoInterrupt";

export default function SpikePage() {
  const { agent } = useAgent({ agentId: "spike_agent" });

  // Re-run when agent switches from provisional (pre-info) to the real shared instance.
  // useAgent returns a provisional agent before /api/copilotkit/info responds;
  // EchoInterrupt's useInterrupt gets a different provisional instance, so events
  // from a run on the provisional agent never reach that subscription. By depending
  // on `agent`, we re-fire once the real shared agent is available and both hooks
  // point at the same object.
  useEffect(() => {
    if (!agent.isRunning) {
      agent.setState({ echo: "" });
      agent.runAgent();
    }
  }, [agent]);

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 py-16 px-4">
      <h1 className="mb-2 text-2xl font-semibold">
        Spike — interrupt round-trip
      </h1>
      <p className="mb-8 text-sm text-gray-500">
        {agent.isRunning ? "Agent is running…" : "Agent idle"}
      </p>

      {agent.state?.echo ? (
        <div className="rounded border border-green-300 bg-green-50 p-4 text-green-800">
          ✓ Echo received: <strong>{agent.state.echo}</strong>
        </div>
      ) : (
        <EchoInterrupt />
      )}
    </div>
  );
}
