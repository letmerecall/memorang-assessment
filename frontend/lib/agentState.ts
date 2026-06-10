/** Mirrors agent/agent/state.py fields used by the UI. */
export const RESET_STATE = {
  pdf_text: null,
  lesson_plan: null,
  revision_feedback: null,
  current_idx: 0,
  current_mcq: null,
  mcq_key: null,
  attempts: 0,
  results: null,
  last_answer: null,
  last_grade: null,
  asked_tutor: false,
  last_tutor_reply: null,
  phase: null,
  error_message: null,
} as const;

/** Field names on AgentState that RESET_STATE must clear. */
export const AGENT_STATE_RESET_FIELDS = [
  "pdf_text",
  "lesson_plan",
  "revision_feedback",
  "current_idx",
  "current_mcq",
  "mcq_key",
  "attempts",
  "results",
  "last_answer",
  "last_grade",
  "asked_tutor",
  "last_tutor_reply",
  "phase",
  "error_message",
] as const;
