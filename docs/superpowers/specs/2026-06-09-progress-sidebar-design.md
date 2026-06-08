# Progress Sidebar Design

**Issue:** #7 — Live progress sidebar (shared state)
**Date:** 2026-06-09

## Overview

A fixed left-hand `ProgressSidebar` that reflects lesson progress live using CopilotKit shared state. It reads `objectives[]` and `current_idx` from the agent state already held in `page.tsx` and renders a checklist with per-objective status: pending, current, or done. No score is ever shown in the sidebar.

## Architecture

- **New file:** `frontend/components/ProgressSidebar.tsx` — pure presentational component.
- **Modified file:** `frontend/app/page.tsx` — passes state props to the sidebar and switches the page layout when the quiz loop is active.
- **No backend changes.** No new hooks. No new dependencies.

The sidebar receives its data as props from `page.tsx`, which already owns the `useAgent` call. This avoids the provisional-instance hazard documented in the spike notes (two independent `useAgent` calls can receive different provisional agents during the CopilotKit startup window).

## Component Interface

```ts
// frontend/components/ProgressSidebar.tsx
type Objective = {
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
};

type ProgressSidebarProps = {
  objectives: Objective[];
  currentIdx: number;
  isRunning: boolean;
};
```

## Status Derivation

For each objective at index `i`, given `currentIdx` (the index of the objective currently being quizzed):

| Condition | Status |
|-----------|--------|
| `i < currentIdx` | **done** — correct answer recorded, agent has advanced past it |
| `i === currentIdx` | **current** — agent is generating MCQ, waiting for answer, or grading |
| `i > currentIdx` | **pending** — not yet reached |

When `currentIdx === objectives.length` (quiz complete, summary shown), every objective evaluates to **done**. This is correct — all objectives have been completed.

The `isRunning` prop is not used to gate status (the current objective is "current" whether the agent is mid-node or paused at an interrupt); it is passed for potential future use (e.g., a pulsing indicator on the current row).

## Layout Change in page.tsx

The sidebar is mounted only after plan approval — never during PDF upload or the plan review step. Concretely: it appears when `plan` is non-null and `approvalWidget` is null (approval is resolved).

When the sidebar is active, the outer wrapper switches from single-column (`flex-col items-center`) to two-column (`flex-row min-h-screen`):

- **Left:** `ProgressSidebar` at a fixed ~220px width with a right border.
- **Right:** existing content area (`flex-1`, centered internally) unchanged.

When the sidebar is not active (upload, plan review), the layout remains exactly as it is today.

## Visual Design

Each objective row contains:
- A status icon: `✅` (done), `▶` (current, blue highlight), `○` (pending, muted)
- The objective title
- A muted difficulty badge (beginner / intermediate / advanced)

No score. No percentage. No count of correct answers.

## Error Handling

- If `objectives` is empty, the sidebar renders nothing (guards against an unexpected empty plan).
- Status derivation is a pure function of index vs `currentIdx` — no async, no network, no failure modes.

## Testing

Status derivation can be unit-tested by rendering `ProgressSidebar` with mock props and asserting the correct icon/class per row. No integration test needed for this component — the agent state transitions are covered by existing graph tests.
