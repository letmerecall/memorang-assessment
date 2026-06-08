"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { LEARNING_AGENT_ID } from "@/lib/agent";

export function CopilotKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent={LEARNING_AGENT_ID} useSingleEndpoint={false}>
      {children}
    </CopilotKit>
  );
}
