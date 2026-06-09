import type { LessonPlanData } from "@/lib/types";
import { ObjectiveList } from "@/components/ObjectiveList";

export function LessonPlan({ plan }: { plan: LessonPlanData }) {
  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold mb-4">Lesson Plan</h2>
      <ObjectiveList objectives={plan.objectives} />
    </div>
  );
}
