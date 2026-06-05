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
  Rationale: Python LangGraph is the more mature path for the two features this leans on
  hardest (`interrupt()` HITL + `PostgresSaver`); OpenAI structured outputs are cleanest in
  Pydantic; CopilotKit's CoAgents docs feature the LangGraph-Python integration; **and the
  candidate is fastest in Python + TS** — tool comfort wins in a time-boxed build.
- **LLM**: OpenAI (e.g. `gpt-4.1` / `gpt-4o`), via env, using structured outputs.
- **Persistence**: durable **Postgres** checkpointer (`PostgresSaver`) via docker-compose.
- **Scope**: tight, well-executed MVP covering all 9 acceptance criteria + selective wow factors.

### Resolved during design interview (running log)
- **#1 Stack split** — HELD Python agent + TS UI (see rationale above).
- **#2 Integration is the #1 risk; candidate has not wired CopilotKit↔LangGraph-Python before.**
  → **Day-1 disposable spike** proves the full interrupt round-trip (interrupt → custom React
  widget → button → `Command(resume=...)` → echo) with a trivial graph *before any real node is
  written*. Real plan/symbol names get rewritten against the proven, installed-version API.
  → **Interrupt-driven for BOTH plan-approval and MCQ** (canonical HITL, checkpoints cleanly,
  survives the restart-durability demo). Actions reserved only for non-blocking needs.
- **#3 Tutor-during-quiz** — kept **lean** (it maps to Desired Flow §3, and is the build's best
  *agentic* talking point; marginal cost is low once the MCQ router exists). Architecture:
  the "ask a question while paused at an MCQ interrupt" problem is solved deterministically by
  an **in-widget ask box** (NOT the uncertain global-chat-during-interrupt path):
  - `ask_mcq`'s `interrupt()` is resumed by a **discriminated payload**:
    `{kind:"answer", index}` → `grade`; `{kind:"question", text}` → `tutor`.
  - A **router** node classifies the resume payload and branches.
  - `tutor` is guardrailed **by construction**: it receives question + options + PDF context but
    **never `correct_index`/explanation**, so it cannot leak the answer; it teaches/hints and
    steers back, then loops to a fresh `ask_mcq` interrupt with the same MCQ.
  - **Fallback if time-pressed**: demote to a non-LLM "Hint" button that reveals the pre-generated
    `hint` without penalty (weaker review story, near-zero cost).
- **#4 MCQ generation** — **one MCQ per objective** for the MVP (state shaped as a list so
  N-per-objective is a trivial later bump), generated **lazily** by `generate_mcq` *inside the
  loop* keyed on `current_idx` (NOT batch-upfront). Keeps the <5-min Loom feasible, spreads LLM
  latency into per-step loading states, and survives plan edits.
- **#5 Grounding** — **full (trimmed) PDF text in-context, NO RAG/vector DB** (unneeded infra for
  assessment-sized PDFs). MCQ prompt instructs "answerable solely from the provided text" +
  structured output = anti-hallucination. MCQ schema gains a **`source_quote`** field (the PDF
  passage the question is based on) — cheap proof-of-grounding, surfaced *after* answering only.
  PDF text trimmed to a ~15–20k-token budget (documented). Scanned/empty-text PDFs → friendly
  "no extractable text" error (no OCR).
- **#6 Entry point** — `/extract` (FastAPI+PyMuPDF) returns text → frontend seeds `pdf_text`
  **into the checkpointed `AgentState`** via `useCoAgent` and **programmatically starts the run**
  (no user chat message needed; upload IS the trigger). `pdf_text` lives in state (NOT a side
  store) so the restart-durability demo restores it for free. A fresh `thread_id` (uuid) is
  minted per upload and held as the resume handle. **"Seed state + auto-start" is added to the
  Day-1 spike scope** (same version-churny API surface as interrupts).
- **#7 Plan approval** — **Approve + free-text "Request changes" regenerate loop** (NOT inline
  editing for MVP). Discriminated resume `{decision:"approve"}`→`generate_mcq` /
  `{decision:"revise", feedback}`→`ingest_plan`. Shows a real bidirectional HITL loop; uniform
  discriminated-resume idiom shared with the MCQ widget. Inline editing → future work.
- **#8 Scoring** — **score = # correct on first attempt / N objectives**. Retries unlimited,
  no penalty, always advance on eventual correct (completion always reachable). `results[]`
  tracks `{objective, correct_first_try, attempts, asked_tutor}` → powers summary + personalized
  study tips (weak = `attempts>1` or `asked_tutor`). **Score shown ONLY at the summary**, not
  live (a live score reads as punitive). Sidebar shows objective *status* only. No retry cap.
- **#9 Session/durability** — **single active lesson, one `thread_id` in `localStorage`**; on
  load, re-attach if present else wait for upload to mint one. "Start over" clears + re-mints.
  Durability is free from checkpointed state (incl. `pdf_text`). **Spike must verify whether a
  pending interrupt auto-re-surfaces on reconnect**; if not, fallback = a **"Resume lesson"
  button** that re-triggers the run on the stored `thread_id` (graph resumes from checkpoint).
  Multi-lesson history/list stays OUT of scope (the durability *demo* needs only single-thread
  resume).
- **#10 Sidebar state sync** — **automatic node-boundary sync** (least code, least risk; rides
  the channel the spike already proves). Status flips at node boundaries: `generate_mcq` →
  "current", `grade` first-correct → "done"+advance. Manual `copilotkit_emit_state` only as a
  fallback if node-boundary sync proves laggy in the installed version.
- **#11 LLM + robustness** — model `OPENAI_MODEL=gpt-4.1` default, **env-overridable**. **Native
  OpenAI structured outputs** (Pydantic-typed) for plan/MCQ/summary; per call: parse →
  validate → **one retry feeding back the validation error** → typed error. Runtime errors:
  transient OpenAI errors → small retry-with-backoff (2–3); persistent failure → `phase="error"`
  + message → UI **error card with "Retry"** (re-runs the node); bad/empty PDF handled at
  `/extract`. Bar = never show a raw traceback or an infinite spinner. No fancier resilience.
- **#12 Testing** — **TDD the deterministic Python core** (`grade` branching + first-attempt
  scoring + no-penalty retry; `route_mcq` classification; Pydantic schema accept/reject;
  `pdf.py` extract/trim/empty-error). **Mock all LLM calls; assert on boundaries, never on
  generated content.** Plus a cheap **tutor-guardrail prompt test** (assert assembled prompt
  excludes `correct_index`/correct option text/explanation). **One live smoke test gated behind
  `RUN_LIVE_LLM=1`** (off by default). **No automated frontend tests for MVP** — rely on manual
  E2E (= Loom script); documented as a deliberate scope choice. (Stretch: one `McqWidget`
  green/red render test, last.)
- **#13 UI surface** — interrupt widgets render **inside a CopilotKit chat thread** (idiomatic
  CoAgents; interrupt plumbing + streaming for free), **left `ProgressSidebar`**, upload as the
  initial screen. **Tailwind** styles the custom widgets (plan card, MCQ, sidebar, summary);
  CopilotKit default theme for the chat shell (not re-skinned). Center thread sequences:
  plan card → MCQ cards → tutor replies → summary.

### Standout touches (selective wow)
1. **Live progress sidebar** via CopilotKit shared state (`useCoAgent`) — objectives
   checklist with live status (pending / current / done). **No running score shown** (a live
   score during a no-penalty learning loop reads as punitive) — score is revealed only at the
   summary. Directly demonstrates CopilotKit's shared-state superpower and films great on the Loom.
2. **Lean guardrailed tutor (in-widget)** — an "Ask / need a hint" box inside the MCQ widget;
   asking resumes the interrupt as `{kind:"question"}` → `tutor` node. The tutor is guardrailed
   **by construction** (never receives `correct_index`/explanation) so it *cannot* reveal the
   answer; it teaches/hints and steers back, then re-renders the same MCQ. Single-turn, no
   sidebar — minimum that satisfies Desired Flow §3 while staying a strong agentic talking point.

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
   `LessonPlanApproval` (objectives + difficulty, **Approve** button + **Request-changes**
   free-text box). Discriminated resume (same idiom as MCQ): `{decision:"approve"}` →
   `generate_mcq`; `{decision:"revise", feedback}` → back to `ingest_plan` with feedback
   injected into the prompt → fresh plan → re-interrupt. Demonstrates a real **bidirectional**
   HITL loop, not just a yes-gate. (Inline plan editing → future work.)
   *(Acceptance: plan todo-list + HITL interrupt.)*
3. **generate_mcq** — For `objectives[current_idx]`, generate one MCQ **grounded in the
   PDF** (structured: `question`, `options[4]`, `correct_index`, `explanation`, `hint`,
   **`source_quote`**). Full trimmed PDF text passed in-context (no RAG); prompt requires the
   question be **answerable solely from the provided text**. `source_quote` = the PDF passage
   the question derives from, shown *after* answering as proof-of-grounding.
   *(Acceptance: MCQs generated directly from PDF content.)*
4. **ask_mcq** — `interrupt({type:"mcq", content: question+options})`. Frontend renders
   `McqWidget` (radio + submit **+ in-widget "Ask / need a hint" box**). Resume payload is a
   **discriminated union**: `{kind:"answer", index}` or `{kind:"question", text}`.
   *(Acceptance: genUI widget with radio selection.)*
5. **route_mcq** (conditional router) — classify the resume payload:
   `kind=="answer"` → `grade`; `kind=="question"` → `tutor`.
6. **grade** — Compare selection to `correct_index`:
   - **Correct** → mark green, emit `explanation`, record result, advance `current_idx`.
   - **Incorrect** → emit `hint`, **loop back to ask_mcq** for retry, **no score penalty**
     (only first-attempt-correct counts toward score, but retries always allowed).
   *(Acceptance: explanation on correct; hint + penalty-free retry on incorrect.)*
7. **tutor** — teach / hint using PDF context. Guardrailed **by construction**: the prompt
   receives question + options + PDF context but **never `correct_index`/explanation**, so it
   cannot leak the answer; it nudges back to answering, then loops to a fresh `ask_mcq` with
   the same MCQ. *(Desired Flow §3: learn-more + hints without giving away the answer.)*
8. **summary** — When all objectives `done`, compute score and generate **personalized
   study tips** (weakest objectives, retried questions) via OpenAI. → render `Summary`.
   *(Acceptance: summary of results + study tips.)*

Conditional edges: `ingest_plan → approve → (approved? generate_mcq : ingest_plan)`;
`generate_mcq → ask_mcq → grade → (correct & more objectives? generate_mcq : correct & done? summary : ask_mcq)`;
chat-during-mcq → `tutor → ask_mcq`. Compiled with `checkpointer=PostgresSaver(...)`.

---

## Frontend (CopilotKit) details

- **Surface/layout**: interrupt widgets render **inside a CopilotKit chat thread** (idiomatic
  CoAgents — interrupt plumbing + streaming for free). Layout = **left `ProgressSidebar`** +
  **center chat thread** (plan card → MCQ cards → tutor replies → summary); `PdfUpload` is the
  initial screen before a thread exists. **Tailwind** styles custom widgets; CopilotKit default
  theme for the chat shell (not re-skinned).
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
- **Progress sidebar** (`ProgressSidebar.tsx`): `useCoAgent` reads shared `objectives[]`
  status and renders a live checklist (pending/current/done) — the headline wow factor.
  **Score is intentionally NOT shown here** (revealed at summary).
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

1. **Scaffold + Day-1 integration spike (DISPOSABLE)**: `/agent` (FastAPI + LangGraph + OpenAI
   + PyMuPDF), `/frontend` (Next.js + CopilotKit), `docker-compose` Postgres, `.env.example`.
   Before any real node, prove the full round-trip with a trivial graph: **seed agent state +
   programmatically start a run → `interrupt()` → custom React widget → button →
   `Command(resume=...)` → echo back**. This retires ~70% of the project risk and pins the exact
   installed-version symbol names; the real plan is then written against the proven API.
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

## Known limitations / future work (state explicitly in README)
- **Large PDFs are truncated** to a ~15–20k-token budget (head/sampling). Future work:
  chunked/map-reduce planning or RAG retrieval over the full document.
- **No OCR** — scanned/image-only PDFs (no embedded text) are rejected with a friendly error.
  Future work: OCR fallback (e.g. Tesseract) for image PDFs.
- One MCQ per objective in the MVP (state is list-shaped to allow N later).
- Single-document, single-user lesson at a time (no multi-doc library / accounts).

## Risks / mitigations
- *CopilotKit API churn* → pin versions, follow installed-version docs (flagged above).
- *LLM non-determinism in MCQs* → structured outputs + pydantic validation + retry-on-parse-fail.
- *Answer leakage in tutor* → strong system-prompt guardrail + a unit test asserting the
  tutor prompt withholds `correct_index`/option text.
- *Two-service run friction for grader* → README + a single `make dev` / compose convenience.
