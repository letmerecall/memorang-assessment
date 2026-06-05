# Plan: AI Learning Agent (PDF → Interactive Lesson)

## Context

This is a take-home job assessment (`assessment.md`). We must build an AI learning
agent that turns an uploaded PDF into a guided, interactive lesson: it **plans** a
learning path, gets **human approval** (HITL), runs a **quiz loop** of MCQs rendered
in a custom UI widget with green/red feedback and hints-without-spoilers, and ends
with a **summary + study tips**. The repo is currently greenfield (only `assessment.md`).

The assessment explicitly steers the stack via its "Tools of the Trade" and
"Resources" sections: **CopilotKit** (React generative-UI runtime) + **LangGraph**
(agent orchestration with `interrupt()` for HITL + checkpointing) + **Postgres/Redis**.
Graders will run the app, watch a <5min Loom, and ask questions — so the bar is a
**tight, fully-working core loop that hits every acceptance criterion**, plus a couple
of standout touches that show depth, not breadth.

### Decisions (confirmed with user)
- **Architecture**: Python LangGraph agent (+ FastAPI) **+** Next.js/CopilotKit UI (two services).
- **LLM**: OpenAI (e.g. `gpt-4.1` / `gpt-4o`), via env, using structured outputs.
- **Persistence**: durable **Postgres** checkpointer (`PostgresSaver`) via docker-compose.
- **Scope**: tight, well-executed MVP covering all 9 acceptance criteria + selective wow factors.

### Standout touches (selective wow)
1. **Live progress sidebar** via CopilotKit shared state (`useCoAgent`) — objectives
   checklist with live status (pending / current / done) + running score. Directly
   demonstrates CopilotKit's shared-state superpower and films great on the Loom.
2. **Tutor side-chat with answer guardrail** — user can ask "explain more" / "give me a
   hint" mid-quiz; the agent teaches and hints but is hard-prompted to **never reveal the
   correct option** and to steer the user back to completing the lesson.

---

## Architecture

```
PDF ─upload→ Next.js (CopilotKit UI)
                │  POST /api/copilotkit  (CopilotRuntime, proxy)
                ▼
        FastAPI  /copilotkit  (CopilotKit SDK → LangGraphAgent)
                │              /extract  (server-side PDF→text, PyMuPDF)
                ▼
        LangGraph state machine  ──checkpoint──▶  Postgres (PostgresSaver)
                │
                └─ interrupt() ──▶ rendered as widgets in the UI (useInterrupt)
```

All agent traffic flows frontend → `/api/copilotkit` (Next.js) → FastAPI `/copilotkit`.
The frontend never talks to FastAPI directly except the `/extract` upload helper.

> **Version note (principal flag):** CopilotKit's Python/AG-UI API surface moves fast —
> exact symbol names (`useInterrupt` vs `useLangGraphInterrupt`, `remoteEndpoints` +
> `LangGraphHttpAgent` vs the newer AG-UI `LangGraphAgent`, `useRenderTool` vs
> `useCopilotAction(render)`) must be matched to the **installed version** at build time.
> We pin exact versions in `requirements.txt` / `package.json` and follow the docs for
> that version rather than trusting any single tutorial.

---

## Repository layout

```
/agent                         # Python LangGraph service
  pyproject.toml / requirements.txt
  agent/
    state.py                   # AgentState (extends CopilotKitState): pdf_text, plan,
                               #   objectives[], current_idx, current_mcq, attempts,
                               #   results[], score, summary, phase
    pdf.py                     # PyMuPDF text extraction + chunk/trim to token budget
    llm.py                     # OpenAI client + pydantic structured-output helpers
    prompts.py                 # plan / mcq / grade / tutor / summary prompts
    nodes/
      ingest_plan.py           # PDF text → lesson plan (objectives + difficulty)
      approve.py               # interrupt() → HITL plan approval / edit / regenerate
      generate_mcq.py          # objective + PDF → MCQ (q, 4 opts, correct, explanation, hint)
      ask_mcq.py               # interrupt() → render widget, wait for selected answer
      grade.py                 # correct → explanation+advance; wrong → hint+retry (no penalty)
      tutor.py                 # free-form "learn more"/hint chat WITH answer guardrail
      summary.py               # score + personalized study tips
    graph.py                   # wires nodes + conditional edges + PostgresSaver
    server.py                  # FastAPI: CopilotKit SDK endpoint + /extract + /health
  tests/                       # pytest: grading logic, plan/mcq schema parsing, routing
  sample.pdf                   # small fixture PDF for demo + tests

/frontend                      # Next.js (App Router) + CopilotKit
  app/
    api/copilotkit/route.ts    # CopilotRuntime → remote FastAPI agent
    layout.tsx, page.tsx       # CopilotKit provider + chat + sidebar
  components/
    PdfUpload.tsx              # upload → /extract → seed agent state, start run
    LessonPlanApproval.tsx     # interrupt renderer: objectives list + Approve/Edit
    McqWidget.tsx              # interrupt renderer: radio options + Submit + green/red + feedback
    ProgressSidebar.tsx        # useCoAgent shared-state checklist + score
    Summary.tsx                # final report + study tips
  lib/, styles/

docker-compose.yml             # postgres:16
.env.example                   # OPENAI_API_KEY, OPENAI_MODEL, DATABASE_URL, COPILOTKIT_* 
README.md                      # setup + run + demo-script + architecture diagram
```

---

## LangGraph state machine (core of the assessment)

`AgentState` (TypedDict extending `CopilotKitState`) is the single source of truth and is
checkpointed to Postgres per `thread_id`. Key fields: `pdf_text`, `lesson_plan`,
`objectives[]` (each `{title, difficulty, status}`), `current_idx`, `current_mcq`,
`attempts`, `results[]` (`{objective, correct, attempts}`), `score`, `summary`, `phase`.

**Nodes & flow:**
1. **ingest_plan** — From `pdf_text`, generate a lesson plan: 3–5 learning objectives,
   each with a difficulty label. OpenAI **structured output** (pydantic model) so the
   plan is typed, not free text. → `phase = "awaiting_approval"`.
2. **approve** — `interrupt({type:"plan_approval", content: plan})`. Frontend renders
   `LessonPlanApproval`; user **Approves** (→ start quiz) or requests changes (→ loop
   back to `ingest_plan` with feedback). *(Acceptance: plan todo-list + HITL interrupt.)*
3. **generate_mcq** — For `objectives[current_idx]`, generate one MCQ **grounded in the
   PDF** (structured: `question`, `options[4]`, `correct_index`, `explanation`, `hint`).
   *(Acceptance: MCQs generated directly from PDF content.)*
4. **ask_mcq** — `interrupt({type:"mcq", content: question+options})`. Frontend renders
   `McqWidget` (radio + submit). `resolve(selectedIndex)` resumes the graph.
   *(Acceptance: genUI widget with radio selection.)*
5. **grade** — Compare selection to `correct_index`:
   - **Correct** → mark green, emit `explanation`, record result, advance `current_idx`.
   - **Incorrect** → emit `hint`, **loop back to ask_mcq** for retry, **no score penalty**
     (only first-attempt-correct counts toward score, but retries always allowed).
   *(Acceptance: explanation on correct; hint + penalty-free retry on incorrect.)*
6. **tutor** (router branch) — If, during an MCQ, the user sends a free-form chat message
   ("explain this topic", "hint please") instead of submitting, route to `tutor`: teach /
   hint using PDF context, **hard guardrail in the system prompt: never state or strongly
   imply the correct option; always nudge back to answering**. Then return to `ask_mcq`.
   *(Acceptance / desired-flow: learn-more + hints without giving away the answer.)*
7. **summary** — When all objectives `done`, compute score and generate **personalized
   study tips** (weakest objectives, retried questions) via OpenAI. → render `Summary`.
   *(Acceptance: summary of results + study tips.)*

Conditional edges: `ingest_plan → approve → (approved? generate_mcq : ingest_plan)`;
`generate_mcq → ask_mcq → grade → (correct & more objectives? generate_mcq : correct & done? summary : ask_mcq)`;
chat-during-mcq → `tutor → ask_mcq`. Compiled with `checkpointer=PostgresSaver(...)`.

---

## Frontend (CopilotKit) details

- **Provider**: `<CopilotKit runtimeUrl="/api/copilotkit" agent="learning_agent">` wrapping
  the app; `app/api/copilotkit/route.ts` builds a `CopilotRuntime` pointed at the FastAPI
  remote endpoint (per installed-version docs).
- **Upload** (`PdfUpload.tsx`): file input → POST `/extract` (FastAPI, PyMuPDF) → receive
  text → seed agent state (`pdf_text`) and start the run. Server-side extraction = robust.
- **Plan approval** (`LessonPlanApproval.tsx`): `useInterrupt` filtered to
  `event.value.type === "plan_approval"`; renders objectives + difficulty + Approve/Request-changes;
  `resolve(...)`.
- **MCQ widget** (`McqWidget.tsx`): `useInterrupt` for `type === "mcq"`; radio list + Submit;
  on graded result, **green** highlight + explanation (correct) or **red** highlight + hint +
  keep-open-for-retry (incorrect). Disabled/locked states handled cleanly.
- **Progress sidebar** (`ProgressSidebar.tsx`): `useCoAgent` reads shared `objectives[]` +
  `score` and renders a live checklist — the headline wow factor.
- **Summary** (`Summary.tsx`): final score, per-objective breakdown, study tips.

---

## Persistence

- `docker-compose.yml` runs `postgres:16`. `DATABASE_URL` in `.env`.
- `PostgresSaver` (LangGraph) as the graph checkpointer → durable HITL: a lesson survives
  server restart and can resume from the last interrupt by `thread_id`. Run
  `PostgresSaver.setup()` once on startup to create tables.
- (Optional, only if time permits) a tiny `lesson_results` table for a cross-session
  history view — explicitly out of MVP scope.

---

## Build order (incremental, each step demoable)

1. **Scaffold**: `/agent` (FastAPI + LangGraph + OpenAI + PyMuPDF), `/frontend`
   (Next.js + CopilotKit), `docker-compose` Postgres, `.env.example`. Prove
   frontend↔FastAPI↔LangGraph round-trips with a trivial echo node.
2. **PDF ingest + plan**: `/extract` endpoint + `ingest_plan` node + structured plan model.
   Verify a real PDF yields a sensible objectives list.
3. **HITL approval**: `approve` interrupt + `LessonPlanApproval` widget. Verify pause/resume.
4. **Quiz loop**: `generate_mcq` + `ask_mcq` interrupt + `McqWidget` + `grade`. Verify
   green/red, explanation, hint, penalty-free retry, advance.
5. **Tutor guardrail**: `tutor` node + routing; verify it never leaks the answer and steers back.
6. **Summary**: `summary` node + `Summary` component.
7. **Progress sidebar**: `useCoAgent` shared-state checklist + score.
8. **Polish**: loading/streaming states, error handling (bad PDF, OpenAI errors), styling.
9. **Tests + README + record Loom**.

---

## Testing & verification

**Automated (pytest, `/agent/tests`)** — fast, deterministic, no flaky LLM assertions:
- `grade` logic: correct/incorrect branching, retry preserves no-penalty scoring.
- Schema parsing: plan + MCQ pydantic models validate/reject malformed LLM output.
- Routing: chat-during-mcq routes to `tutor`, submit routes to `grade`.
- PDF: `pdf.py` extracts non-empty text from `sample.pdf`.
- LLM calls mocked; one optional live smoke test gated behind an env flag.

**End-to-end (manual, also the Loom script):**
1. `docker compose up -d` (Postgres), `cd agent && uvicorn agent.server:app`,
   `cd frontend && pnpm dev`.
2. Upload `sample.pdf` → confirm plan appears (objectives + difficulty).
3. Approve plan (HITL) → first MCQ renders with radio buttons.
4. Submit a **wrong** answer → red + hint + retry allowed, no penalty.
5. Ask "give me a hint / explain more" → tutor responds **without** revealing the answer, nudges back.
6. Submit **correct** answer → green + explanation → advances.
7. Complete all objectives → summary + personalized study tips.
8. Restart FastAPI mid-lesson → resume same `thread_id` → state restored (Postgres durability).

**Acceptance-criteria traceability:** PDF parse → step 2 (`/extract`,`pdf.py`); plan
todo-list → step 2/3; HITL interrupt → step 3 (`approve`); MCQ from PDF → step 3
(`generate_mcq`); radio widget → step 3 (`McqWidget`); explanation on correct → step 6;
hint + penalty-free retry → step 4; proceed through all MCQs → quiz loop; summary + tips → step 7.

---

## Deliverables (per assessment)
- **Public GitHub repo** with a clear README: prerequisites, env setup, `docker compose up`,
  run commands for agent + frontend, architecture diagram, and a short "how the agent works".
- **Loom (<5 min)** following the E2E script above.

## Risks / mitigations
- *CopilotKit API churn* → pin versions, follow installed-version docs (flagged above).
- *LLM non-determinism in MCQs* → structured outputs + pydantic validation + retry-on-parse-fail.
- *Answer leakage in tutor* → strong system-prompt guardrail + a unit test asserting the
  tutor prompt withholds `correct_index`/option text.
- *Two-service run friction for grader* → README + a single `make dev` / compose convenience.
