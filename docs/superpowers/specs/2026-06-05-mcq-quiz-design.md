# MCQ Quiz — Single Objective (Issue #4)

## Scope

End-to-end quiz primitive for a **single** learning objective: generate a grounded MCQ, render it as a widget, accept an answer, grade with feedback, and allow penalty-free retry until correct. Looping across all objectives is the next slice. The `tutor` branch (`kind:"question"`) is classified by `route_mcq` but not wired to a node in this slice — the seam is kept clean for the next issue.

---

## State changes (`agent/agent/state.py`)

Six new fields added to `AgentState`:

| Field | Type | Default | Purpose |
|---|---|---|---|
| `current_idx` | `int` | `0` | Index of the objective currently being quizzed |
| `current_mcq` | `Optional[dict]` | `None` | Active MCQ dict (set by `generate_mcq`, cleared on advance) |
| `attempts` | `int` | `0` | Attempt count for the current MCQ; resets when `generate_mcq` runs |
| `results` | `list` | `[]` | Accumulated `{objective, correct_first_try, attempts}` records |
| `last_answer` | `Optional[dict]` | `None` | Raw resume payload from `ask_mcq`; consumed by `route_mcq` / `grade` |
| `last_grade` | `Optional[dict]` | `None` | Grade result: `{correct, explanation, source_quote}` or `{correct, hint}`; read by next `ask_mcq` interrupt payload and by the frontend result card |

---

## New schema file (`agent/agent/mcq_schema.py`)

```python
class MCQ(BaseModel):
    question: str
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: int = Field(ge=0, le=3)
    explanation: str
    hint: str
    source_quote: str

class MCQResult(BaseModel):
    objective: str
    correct_first_try: bool
    attempts: int
```

`MCQ` is the structured-output target for `generate_mcq`. `MCQResult` is used when appending to `results[]` in `grade`.

---

## Node refactor & file layout

`graph.py` is split into a `nodes/` package. `_parse_resume` stays in `graph.py` (wiring-level utility). `graph.py` re-exports moved symbols so existing tests don't break.

```
agent/agent/
  nodes/
    __init__.py          (empty)
    ingest_plan.py       (moved: generate_plan + ingest_plan)
    approve.py           (moved: approve + route_after_approve)
    generate_mcq.py      (new)
    ask_mcq.py           (new)
    grade.py             (new: grade + route_mcq + route_after_grade)
  graph.py               (keeps: _parse_resume + build_graph + re-exports)
  mcq_schema.py          (new)
  plan_schema.py         (unchanged)
  state.py               (updated)
```

`graph.py` re-exports for backward compat:
```python
from agent.agent.nodes.ingest_plan import generate_plan, ingest_plan
from agent.agent.nodes.approve import approve, route_after_approve
```

---

## Graph flow

```
ingest_plan → approve → route_after_approve
                              ├─ revise ──────────────→ ingest_plan
                              └─ approved → generate_mcq → ask_mcq → route_mcq
                                                                          └─ answer → grade → route_after_grade
                                                                                                ├─ correct  → END
                                                                                                └─ incorrect → ask_mcq
```

---

## Node logic

### `generate_mcq` (`nodes/generate_mcq.py`)
- Calls LLM with `objectives[current_idx]` title + full trimmed PDF text, structured output → `MCQ`.
- Stores result as `current_mcq` (`.model_dump()`).
- Resets `attempts` to `0` and clears `last_grade` to `None`.

### `ask_mcq` (`nodes/ask_mcq.py`)
- Calls `interrupt({"type": "mcq", "content": current_mcq, "feedback": last_grade})`.
  - `feedback` is `None` on the first attempt; `{"correct": False, "hint": "..."}` on retry.
- Parses the resume payload via `_parse_resume` → stores in `last_answer`.

### `route_mcq` (`nodes/grade.py` — routing function, not a node)
- Reads `last_answer["kind"]`:
  - `"answer"` → `"grade"`
  - `"question"` → `"tutor"` (classified but edge not compiled in this slice)

### `grade` (`nodes/grade.py`)
- Increments `attempts` by 1.
- Compares `last_answer["index"]` to `current_mcq["correct_index"]`:
  - **Correct**: appends `MCQResult(objective=..., correct_first_try=(attempts==1), attempts=attempts)` to `results`; advances `current_idx`; sets `last_grade = {"correct": True, "explanation": ..., "source_quote": ...}`.
  - **Incorrect**: sets `last_grade = {"correct": False, "hint": ...}`. Does not append to `results`.

### `route_after_grade` (`nodes/grade.py` — routing function)
- `last_grade["correct"]` → `END`
- else → `"ask_mcq"`

---

## Frontend

### `McqWidget.tsx` (new)
- `useInterrupt` filtered to `event.value.type === "mcq"`.
- Renders question + 4 radio options.
- If `payload.feedback` is present and `feedback.correct === false`: shows the hint above the options so the user understands the previous miss before retrying.
- Submit resumes `{kind: "answer", index: selectedIndex}`; button disabled until an option is chosen.

### `page.tsx` updates
- Read `last_grade` from agent state via `useAgent`.
- Add `useMcqWidget` (mirrors `useLessonPlanApproval` pattern) or inline the `useInterrupt` hook call.
- Render a grade-result card (inline JSX, no new component file) when no interrupt is active and `last_grade?.correct === true`: shows green "Correct!", `explanation`, and `source_quote`.

**Page render priority:**
1. No plan + no active interrupt → `PdfUpload`
2. Plan-approval interrupt active → `LessonPlanApproval` widget
3. MCQ interrupt active → `McqWidget`
4. No interrupt + `last_grade.correct === true` → grade result card
5. No interrupt + plan present → `LessonPlan` (read-only)

---

## Tests

### New file: `agent/tests/test_mcq_schema.py`
- Valid MCQ dict with all 6 fields → passes validation
- `options` list with 3 items → `ValidationError`
- `correct_index = 4` (out of range) → `ValidationError`
- Missing `source_quote` → `ValidationError`

### Additions to `agent/tests/test_graph.py`
- `grade`: correct first attempt → `correct_first_try=True`, `attempts=1`, `current_idx` incremented, `last_grade.correct=True`
- `grade`: incorrect first attempt → no result recorded, `attempts=1`, `last_grade.correct=False` with hint
- `grade`: correct on second attempt → `correct_first_try=False`, `attempts=2`
- `route_mcq`: `{kind:"answer"}` → `"grade"`
- `route_mcq`: `{kind:"question"}` → `"tutor"`
- `ask_mcq`: calls `interrupt` with correct payload shape (`type`, `content`, `feedback`)
- `generate_mcq`: resets `attempts` to `0`, clears `last_grade` to `None`
