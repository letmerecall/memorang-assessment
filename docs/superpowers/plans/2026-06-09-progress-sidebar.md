# Progress Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `ProgressSidebar` component that reads objectives and current progress from agent state and renders a live pending/current/done checklist on the left of the quiz screen.

**Architecture:** `page.tsx` already owns the `useAgent` call and holds all agent state. `ProgressSidebar` is a pure presentational component that receives `objectives[]` and `currentIdx` as props — no second `useAgent` call. When plan approval is complete (`plan` is non-null, `approvalWidget` is null), `page.tsx` switches to a two-column layout with the sidebar on the left.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, `@copilotkit/react-core` v1.59.5 (v2 API path).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Create | `frontend/components/ProgressSidebar.tsx` | Presentational sidebar component |
| Modify | `frontend/app/page.tsx` | Extend state type, derive props, restructure layout |

> **Note on tests:** Per project decision in `plan.md` §Testing, there are no automated frontend tests for MVP. The `getStatus` helper is written as a pure exported function so it *can* be tested later if needed; manual verification is the acceptance gate.

---

## Task 1: Create ProgressSidebar component

**Files:**
- Create: `frontend/components/ProgressSidebar.tsx`

- [ ] **Step 1: Create the file**

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ProgressSidebar.tsx
git commit -m "feat: add ProgressSidebar component"
```

---

## Task 2: Wire ProgressSidebar into page.tsx

**Files:**
- Modify: `frontend/app/page.tsx`

Current file: `frontend/app/page.tsx`

- [ ] **Step 1: Replace the full file contents**

The changes are:
1. Import `ProgressSidebar`
2. Add `current_idx?: number` to `AgentStateShape`
3. Derive `currentIdx` and `showSidebar`
4. Restructure the outer layout: always `flex min-h-screen bg-gray-50`; sidebar conditionally on the left; existing content in an inner `flex-1 flex-col items-center` div

```tsx
"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";
import { useLessonPlanApproval } from "@/components/LessonPlanApproval";
import { useMcqWidget } from "@/components/McqWidget";
import { useSummaryWidget } from "@/components/Summary";
import { ProgressSidebar } from "@/components/ProgressSidebar";

type LessonPlanData = {
  objectives: {
    title: string;
    description: string;
    difficulty: "beginner" | "intermediate" | "advanced";
  }[];
};

type AgentStateShape = {
  lesson_plan?: LessonPlanData;
  current_idx?: number;
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const state = (agent.state as AgentStateShape) ?? {};
  const plan = state.lesson_plan ?? null;
  const currentIdx = state.current_idx ?? 0;
  const approvalWidget = useLessonPlanApproval();
  const mcqWidget = useMcqWidget();
  const summaryWidget = useSummaryWidget(() =>
    agent.setState({
      pdf_text: null,
      lesson_plan: null,
      current_idx: 0,
      current_mcq: null,
      attempts: 0,
      results: null,
      last_answer: null,
      last_grade: null,
    })
  );

  const anyWidget = approvalWidget || mcqWidget || summaryWidget;
  const showSidebar = plan !== null && approvalWidget === null;

  function statusLabel() {
    if (agent.isRunning) return "Generating…";
    if (approvalWidget) return "Awaiting your review";
    if (mcqWidget) return "Answer the question";
    if (summaryWidget) return "Quiz complete";
    if (plan) return "Done";
    return "Idle";
  }

  const mainContent = (
    <>
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">AI Learning Agent</h1>
      <p className="mb-2 text-sm text-gray-500">
        Upload a PDF to generate a lesson plan.
      </p>
      <p className="text-xs text-gray-400">{statusLabel()}</p>

      {!plan && !anyWidget && <PdfUpload />}

      {approvalWidget}

      {mcqWidget}

      {summaryWidget}

      {!anyWidget && !agent.isRunning && plan && (
        <LessonPlan plan={plan} />
      )}

      {!anyWidget && !agent.isRunning && plan && (
        <button
          onClick={() =>
            agent.setState({
              pdf_text: null,
              lesson_plan: null,
              current_idx: 0,
              current_mcq: null,
              attempts: 0,
              results: null,
              last_answer: null,
              last_grade: null,
            })
          }
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Upload another PDF
        </button>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-gray-50">
      {showSidebar && (
        <ProgressSidebar
          objectives={plan!.objectives}
          currentIdx={currentIdx}
        />
      )}
      <div className="flex flex-1 flex-col items-center py-16 px-4">
        {mainContent}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: wire ProgressSidebar into page layout"
```

---

## Task 3: Manual smoke test

**Files:** none — verification only

- [ ] **Step 1: Start the services**

In one terminal:
```bash
cd agent && uvicorn agent.server:app --reload --port 8000
```

In another terminal:
```bash
cd frontend && pnpm dev
```

Open `http://localhost:3000`.

- [ ] **Step 2: Upload phase — sidebar must NOT appear**

Upload a PDF. While the lesson plan is generating (spinner) and during the plan approval step, confirm no sidebar is visible. Layout should be the same single-column centered view as before.

- [ ] **Step 3: After approval — sidebar must appear**

Click Approve on the lesson plan. The sidebar should immediately appear on the left with all objectives showing **○ pending** (grey). The first objective should flip to **▶ current** (blue highlight) as `generate_mcq` runs.

- [ ] **Step 4: Status transitions**

Answer each MCQ:
- On correct first answer: the objective row should flip to **✅ done** (green) and the next row should become **▶ current**.
- On incorrect answer: the current objective stays **▶ current** (no change — same `currentIdx`).

- [ ] **Step 5: Quiz complete**

After the last correct answer, all objectives should show **✅ done** and the summary widget should render on the right.

- [ ] **Step 6: Reset**

Click "Upload another PDF". Confirm the sidebar disappears and the upload screen returns (back to single-column layout).
