# MCQ state simplification (deferred)

This note records a **planned refactor** we are intentionally **not doing before submission**. Use it when you have time to reduce complexity without changing user-visible behavior.

## What we were trying to do

The MCQ feedback work ([`feat/mcq-feedback-and-hardening`](../README.md)) introduced a **two-field state split**:

| Field | Contents |
|-------|----------|
| `current_mcq` | Public: `{ question, options }` only |
| `mcq_key` | Server-only grading: `{ correct_index, explanation, hint, source_quote }` |

Supporting code:

- [`agent/agent/mcq_public.py`](../agent/agent/mcq_public.py) — `public_mcq()`, `split_mcq()`
- [`agent/agent/nodes/generate_mcq.py`](../agent/agent/nodes/generate_mcq.py) — writes both fields
- [`agent/agent/nodes/grade.py`](../agent/agent/nodes/grade.py) — reads from `mcq_key`
- [`agent/agent/nodes/ask_mcq.py`](../agent/agent/nodes/ask_mcq.py) — sends `public_mcq(current_mcq)` in the interrupt
- [`agent/tests/test_mcq_public.py`](../agent/tests/test_mcq_public.py) — split helper tests
- [`frontend/lib/agentState.ts`](../frontend/lib/agentState.ts) — `mcq_key` in `RESET_STATE`

**Goal of the split:** keep the answer key out of CopilotKit **shared agent state** (`agent.state` in the browser), not just out of the interrupt widget payload.

## Why we are not pursuing that now

1. **Not an assessment requirement** — [`assessment.md`](../assessment.md) does not require anti-cheat or client-side answer hiding.
2. **Unclear payoff** — CopilotKit may still sync all `AgentState` fields to the client; fully fixing that needs AG-UI / CopilotKit investigation (scope creep for a take-home).
3. **Interrupt sanitization is enough for the demo** — the MCQ widget only receives `question` + `options` via the interrupt payload. That satisfies the product flow and Loom walkthrough.
4. **Submission simplicity** — one state field is easier to read, test, and explain in a review.

We accept that `correct_index` (and related fields) may be visible in DevTools on `agent.state` after this simplification. That is an explicit MVP trade-off, not a bug in the quiz loop.

## What to do later (refactor checklist)

Revert to a **single `current_mcq`** with the full shuffled MCQ dict. **Keep** interrupt sanitization at the `ask_mcq` boundary.

### Remove

- [ ] `mcq_key` field from [`agent/agent/state.py`](../agent/agent/state.py)
- [ ] `split_mcq()` and file [`agent/agent/mcq_public.py`](../agent/agent/mcq_public.py) (or reduce to a one-liner if you prefer)
- [ ] `mcq_key` from [`frontend/lib/agentState.ts`](../frontend/lib/agentState.ts) (`RESET_STATE` + `AGENT_STATE_RESET_FIELDS`)
- [ ] [`agent/tests/test_mcq_public.py`](../agent/tests/test_mcq_public.py) (or fold into `test_graph.py`)

### Change

- [ ] **`generate_mcq`** — return full shuffled MCQ in `current_mcq` only (as before the split)
- [ ] **`grade`** — read `correct_index`, `explanation`, `hint`, `source_quote` from `current_mcq` again
- [ ] **`ask_mcq`** — keep stripping secrets for the interrupt only, e.g.:

  ```python
  mcq = state.get("current_mcq")
  content = (
      {"question": mcq["question"], "options": mcq["options"]}
      if mcq
      else None
  )
  ```

- [ ] **`test_graph.py`** — restore `_mcq_dict()` helper with full MCQ; update grade/generate_mcq tests; keep `test_ask_mcq_calls_interrupt_with_sanitized_mcq_payload` (no `correct_index` in interrupt `content`)

### Do not remove

These are unrelated to client-sync and are required for the assessment flow:

- Correct-answer **reveal** routing (`route_after_grade` → `ask_mcq`, `kind: "continue"`)
- **McqWidget** green/red highlights, explanation banner, Continue button
- **Tutor** prompt without option lists
- MCQ option **shuffle** in `generate_mcq._shuffle_mcq`

## Verification after refactor

```bash
cd agent && uv run pytest tests/ -v
cd frontend && npm test -- --run
```

Manual smoke (optional): upload [`sample.pdf`](../sample.pdf) → approve → wrong answer (red + hint) → correct (green + explanation + Continue) → summary.

## README note (optional)

If you document the trade-off in [`README.md`](../README.md) under Known limitations:

> MCQ interrupt payloads expose only `question` and `options`. Grading metadata may still be present in synced CopilotKit agent state (DevTools). Not hardened for client-side cheating.

No code change required for submission if you skip this line.
