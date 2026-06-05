import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const agent = new LangGraphHttpAgent({
  url: `${process.env.AGENT_URL ?? "http://localhost:8123"}/`,
});

const runtime = new CopilotRuntime({
  agents: { learning_agent: agent },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({ runtime });

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
