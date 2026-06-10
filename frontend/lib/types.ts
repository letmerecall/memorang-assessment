export type Difficulty = "beginner" | "intermediate" | "advanced";

export type Objective = {
  title: string;
  description: string;
  difficulty: Difficulty;
};

export type LessonPlanData = {
  objectives: Objective[];
};

export type PlanApprovalPayload = {
  type: string;
  content: { objectives: Objective[] };
};

export type MCQContent = {
  question: string;
  options: string[];
};

export type MCQFeedback = {
  correct: boolean;
  hint?: string;
  explanation?: string;
  source_quote?: string;
  selected_index?: number;
} | null;

export type MCQPayload = {
  type: string;
  content: MCQContent;
  feedback: MCQFeedback;
  tutor_reply?: string | null;
};

export type SummaryResult = {
  objective: string;
  correct_first_try: boolean;
  attempts: number;
  asked_tutor: boolean;
};

export type SummaryContent = {
  score: number;
  results: SummaryResult[];
  tips: string;
};

export type SummaryPayload = {
  type: "summary";
  content: SummaryContent;
};

export type StoredMcq = MCQContent;

export type AgentStateShape = {
  lesson_plan?: LessonPlanData;
  current_idx?: number;
  current_mcq?: StoredMcq | null;
  results?: SummaryResult[] | null;
  asked_tutor?: boolean;
  last_tutor_reply?: string | null;
  phase?: string | null;
  error_message?: string | null;
};
