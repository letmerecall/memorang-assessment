"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";

type LessonPlanData = {
  objectives: { title: string; description: string; difficulty: "beginner" | "intermediate" | "advanced" }[];
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const plan = (agent.state as { lesson_plan?: LessonPlanData })?.lesson_plan ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 py-16 px-4">
      <h1 className="mb-2 text-2xl font-semibold">AI Learning Agent</h1>
      <p className="mb-2 text-sm text-gray-500">
        Upload a PDF to generate a lesson plan.
      </p>
      <p className="text-xs text-gray-400">
        {agent.isRunning ? "Generating…" : plan ? "Done" : "Idle"}
      </p>

      {!plan && <PdfUpload />}
      {plan && <LessonPlan plan={plan} />}
      {plan && (
        <button
          onClick={() => agent.setState({ pdf_text: null, lesson_plan: null })}
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Upload another PDF
        </button>
      )}
    </div>
  );
}
