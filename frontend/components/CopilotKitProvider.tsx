"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";
import { LEARNING_AGENT_ID } from "@/lib/agent";

const publicLicenseKey = process.env.NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY;

export function CopilotKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agent={LEARNING_AGENT_ID}
      useSingleEndpoint={false}
      showDevConsole={false}
      enableInspector={false}
      {...(publicLicenseKey ? { publicLicenseKey } : {})}
    >
      {children}
    </CopilotKit>
  );
}
