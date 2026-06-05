"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export function CopilotKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="learning_agent" useSingleEndpoint={false}>
      {children}
    </CopilotKit>
  );
}
