// frontend/components/ProgressSidebar.tsx
type Difficulty = "beginner" | "intermediate" | "advanced";

type Objective = {
  title: string;
  description: string;
  difficulty: Difficulty;
};

export type ObjectiveStatus = "pending" | "current" | "done";

export function getStatus(i: number, currentIdx: number): ObjectiveStatus {
  if (i < currentIdx) return "done";
  if (i === currentIdx) return "current";
  return "pending";
}

type ProgressSidebarProps = {
  objectives: Objective[];
  currentIdx: number;
};

const DIFFICULTY_COLOR: Record<Difficulty, string> = {
  beginner: "text-green-500",
  intermediate: "text-yellow-500",
  advanced: "text-red-500",
};

const STATUS_ICON: Record<ObjectiveStatus, string> = {
  done: "✅",
  current: "▶",
  pending: "○",
};

const ROW_STYLE: Record<ObjectiveStatus, string> = {
  done: "bg-green-50",
  current: "bg-blue-50 border border-blue-200",
  pending: "",
};

const TITLE_STYLE: Record<ObjectiveStatus, string> = {
  done: "text-green-800 font-medium",
  current: "text-blue-800 font-semibold",
  pending: "text-gray-400 font-medium",
};

export function ProgressSidebar({ objectives, currentIdx }: ProgressSidebarProps) {
  if (objectives.length === 0) return null;

  return (
    <div className="w-56 shrink-0 border-r border-gray-200 bg-gray-50 px-4 py-6 flex flex-col gap-2">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Progress
      </p>
      {objectives.map((obj, i) => {
        const status = getStatus(i, currentIdx);
        return (
          <div
            key={i}
            className={`flex items-start gap-2.5 rounded-md px-2 py-2 ${ROW_STYLE[status]}`}
          >
            <span
              className={`mt-0.5 text-sm shrink-0 ${status === "pending" ? "text-gray-300" : ""}`}
            >
              {STATUS_ICON[status]}
            </span>
            <div>
              <p className={`text-xs leading-snug ${TITLE_STYLE[status]}`}>{obj.title}</p>
              <p
                className={`mt-0.5 text-[10px] uppercase font-medium ${
                  status === "pending" ? "text-gray-300" : DIFFICULTY_COLOR[obj.difficulty]
                }`}
              >
                {obj.difficulty}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
