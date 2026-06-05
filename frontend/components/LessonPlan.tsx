type Difficulty = "beginner" | "intermediate" | "advanced";

type Objective = {
  title: string;
  description: string;
  difficulty: Difficulty;
};

type LessonPlanData = {
  objectives: Objective[];
};

const BADGE_STYLE: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

export function LessonPlan({ plan }: { plan: LessonPlanData }) {
  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold mb-4">Lesson Plan</h2>
      <ol className="space-y-4">
        {plan.objectives.map((obj, i) => (
          <li key={i} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{obj.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLE[obj.difficulty]}`}>
                {obj.difficulty}
              </span>
            </div>
            <p className="text-sm text-gray-600">{obj.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
