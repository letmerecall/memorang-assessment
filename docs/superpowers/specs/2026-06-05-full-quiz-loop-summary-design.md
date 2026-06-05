# Design: Full quiz loop → summary + study tips (Issue #5)

## Overview

Close the core quiz loop: progress through all objectives lazily, then interrupt with a
final summary containing score, per-objective breakdown, and personalized study tips.
After this slice the full lesson runs: upload → plan → approve → quiz all objectives → summary.

---

## Backend changes

### `agent/agent/nodes/grade.py` — `route_after_grade`

Current behaviour: correct → `END`. New behaviour:

- incorrect → `"ask_mcq"` (unchanged)
- correct + `current_idx < len(objectives)` → `"generate_mcq"` (loop to next objective)
- correct + `current_idx == len(objectives)` → `"summary"` (all done)

`grade` already increments `current_idx` on a correct answer, so the comparison is
`state["current_idx"] >= len(objectives)` after the increment.

Updated edge map in `graph.py`:
```python
{"generate_mcq": "generate_mcq", "summary": "summary", "ask_mcq": "ask_mcq"}
```

### New `agent/agent/nodes/summary.py`

Responsibilities:
1. Compute `score = first_attempt_correct_count / N` (float 0–1).
2. Identify weak objectives: `results` entries where `attempts > 1` or `asked_tutor`.
3. Generate personalized study tips via `ChatOpenAI` (temperature 0.7). If no weak objectives,
   return a short "great job" message without an LLM call.
4. Call `interrupt({"type": "summary", "content": {"score": score, "results": results, "tips": tips}})`.
5. Return `{}`.

Graph adds a direct edge `summary → END`.

Tips prompt: passes weak objective titles + truncated PDF text; instructs 2–3 specific,
actionable tips. LLM call is plain text (no structured output needed).

### `agent/agent/mcq_schema.py` — `MCQResult`

Add `asked_tutor: bool = False`. The tutor is currently a stub that routes to END, so
this field will always be `False` in practice, but it is included per the plan (decision #8)
and the summary tips prompt references it. Forward-compatible with a real tutor later.

### `agent/agent/graph.py`

- Import and register `summary` node.
- Update `route_after_grade` edge map from `{END: END, "ask_mcq": "ask_mcq"}` to
  `{"generate_mcq": "generate_mcq", "summary": "summary", "ask_mcq": "ask_mcq"}`.
- Add direct edge `builder.add_edge("summary", END)`.

---

## Frontend changes

### New `frontend/components/Summary.tsx`

`useSummaryWidget()` hook — same `useInterrupt` pattern as `McqWidget`:

```
enabled: event.value.type === "summary"
render: <SummaryCard content={payload.content} onDone={() => resolve({})} />
```

`SummaryCard` renders:
- Final score as a percentage (e.g. "75%"), large and prominent.
- Per-objective breakdown: each objective title, a checkmark/cross for first-try status,
  and attempt count if > 1.
- Study tips section (shown only when tips string is non-empty).
- "Done" button that resolves the interrupt.

Score is shown **only here**, never during the quiz.

### `frontend/app/page.tsx`

- Import and call `useSummaryWidget()`.
- Add `summaryWidget` to the guard conditions alongside `approvalWidget` / `mcqWidget`.
- Remove the standalone "Correct!" result card (it was for the single-objective end state;
  with the full loop, correct answers advance silently to the next MCQ — no intermediate card).
- Update `statusLabel()` to include a "Summary ready" branch.
- Add `summaryWidget` to the conditional render block.
- Update the reset button's `setState` call to also clear `results` and `last_grade`
  (already present; no change needed).

---

## Tests (`agent/tests/test_graph.py`)

All LLM calls mocked. Four new tests:

1. `test_route_after_grade_correct_more_objectives_routes_to_generate_mcq`
   — `current_idx=1`, `len(objectives)=3` → `"generate_mcq"`.

2. `test_route_after_grade_correct_all_done_routes_to_summary`
   — `current_idx=3`, `len(objectives)=3` → `"summary"`.

3. `test_summary_computes_correct_score`
   — 2 of 3 results have `correct_first_try=True`; mock LLM; assert `score ≈ 0.667`.
   (Score passed in interrupt payload content.)

4. `test_summary_tips_prompt_includes_weak_objectives`
   — result with `attempts=2`; assert LLM was called and weak objective title appears in prompt.

---

## Acceptance criteria (from issue)

- [ ] Completing one objective advances and lazily generates the next objective's MCQ
- [ ] Quiz proceeds through all objectives to completion
- [ ] `summary` computes score = first-attempt-correct / N objectives
- [ ] Study tips are generated and weight weak objectives (retried or tutor-asked)
- [ ] `Summary` renders score + per-objective breakdown + tips; no score shown before summary
- [ ] Tests cover the all-done routing and score computation; LLM calls mocked
