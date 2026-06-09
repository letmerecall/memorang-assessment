import { objectiveKey } from "@/lib/keys";
import type { Difficulty, Objective } from "@/lib/types";

const BADGE_STYLE: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

type ObjectiveListProps = {
  objectives: Objective[];
  className?: string;
};

export function ObjectiveList({ objectives, className = "space-y-4" }: ObjectiveListProps) {
  return (
    <ol className={className}>
      {objectives.map((obj, i) => (
        <li
          key={objectiveKey(obj, i)}
          className="rounded border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="font-medium text-sm">{obj.title}</span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLE[obj.difficulty]}`}
            >
              {obj.difficulty}
            </span>
          </div>
          <p className="text-sm text-gray-600">{obj.description}</p>
        </li>
      ))}
    </ol>
  );
}
