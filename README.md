# Memorang AI Learning Agent

Transforms a PDF into an interactive lesson with a Human-in-the-Loop quiz flow.
Built with **LangGraph** (Python) + **CopilotKit** (Next.js).

```
PDF → plan → HITL approval → MCQ loop (with hints & tutor) → summary
```

## Architecture

```mermaid
flowchart TB
  subgraph frontend["Next.js (CopilotKit UI)"]
    Upload["PdfUpload"]
    Plan["LessonPlanApproval"]
    MCQ["McqWidget"]
    Sidebar["ProgressSidebar"]
    Summary["Summary"]
    Proxy["/api/copilotkit"]
  end

  subgraph agent["FastAPI (LangGraph agent)"]
    Extract["/extract"]
    Graph["LangGraph state machine"]
    State["/state/{thread_id}"]
  end

  DB[("Postgres\n(PostgresSaver)")]

  Upload --> Extract
  Upload --> Proxy
  Proxy --> Graph
  Graph --> DB
  State --> DB
  Graph -. interrupt() .-> Plan
  Graph -. interrupt() .-> MCQ
  Sidebar --> Proxy
  Graph --> Summary
```

The frontend proxies all agent traffic through `/api/copilotkit`. PDF text extraction is the only direct call to FastAPI (`POST /extract`). On resume, the UI fetches public checkpoint state from `/state/{thread_id}`.

## How the agent works

1. **Upload** — The user uploads a PDF. The frontend extracts text via `/extract`, seeds `pdf_text` into checkpointed `AgentState`, and starts a LangGraph run with a fresh `thread_id`.
2. **Plan** — `ingest_plan` calls the LLM with structured output to produce 3–5 learning objectives (title, description, difficulty).
3. **HITL approval** — `approve` calls `interrupt()` and renders the plan in the UI. The user approves or requests changes; revisions loop back through `ingest_plan`.
4. **MCQ pre-batch** — After approval, `prebatch_mcqs` generates one MCQ per objective (grounded in the PDF). Options are shuffled server-side; answer keys stay in `mcq_key` (never sent to the client).
5. **Quiz loop** — For each objective: `generate_mcq` → `ask_mcq` (interrupt with radio choices) → user submits or asks the tutor → `grade` or `tutor` → retry or advance. Correct answers show green + explanation; incorrect answers show red + hint with unlimited penalty-free retries.
6. **Summary** — When all objectives are done, `summary` computes the score (first-attempt correct / total) and generates personalized study tips.

LangGraph checkpoints every step to Postgres, so a lesson survives server restarts and can resume from the last interrupt.

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | any recent |
| OpenRouter API key | [openrouter.ai/keys](https://openrouter.ai/keys) |

For local development without Docker you also need Python ≥ 3.12, [uv](https://docs.astral.sh/uv/), Node.js ≥ 18, and npm ≥ 9.

## Quick start (Docker — recommended)

```bash
git clone https://github.com/letmerecall/memorang-assessment.git
cd memorang-assessment
cp .env.example .env
# Edit .env and set OPENAI_API_KEY
make dev
# or: docker compose up --build
```

Open **http://localhost:3000** and upload [`sample.pdf`](sample.pdf) for a quick end-to-end demo.

Services:

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Agent API | http://localhost:8123/health |
| Postgres | `localhost:5432` |

Stop with `make down` or `docker compose down`. Add `-v` to also remove the Postgres volume.

## Local development (optional)

Use this if you prefer running the agent and frontend on the host while keeping Postgres in Docker.

### 1. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and set `OPENAI_API_KEY`. For host-based dev, also set:

```
DATABASE_URL=postgresql://memorang:memorang@localhost:5432/memorang
AGENT_URL=http://localhost:8123
```

### 2. Start Postgres

```bash
docker compose up -d postgres
```

### 3. Install dependencies

```bash
cd agent && uv sync
cd ../frontend && npm install
```

### 4. Run services

Open **two terminals** from the repo root.

**Terminal 1 — Python agent (FastAPI + LangGraph):**

```bash
cd agent
uv run python -m agent.server
```

The agent starts on `http://localhost:8123`. On first run it creates the LangGraph checkpoint tables in Postgres automatically.

**Terminal 2 — Next.js frontend:**

```bash
cd frontend
npm run dev
```

The UI is available at `http://localhost:3000`.

## Running tests

```bash
make test
```

Or individually:

```bash
cd agent && uv run pytest tests/ -v
cd frontend && npm test
```

All agent tests use mocked LLM calls — no API key required. End-to-end behavior is verified manually (see Loom script below).

## Loom walkthrough script (< 5 min)

Use this script when recording the submission demo:

1. `make dev` (or `docker compose up --build`) — wait for all services healthy.
2. Open **http://localhost:3000**, upload [`sample.pdf`](sample.pdf).
3. Review the generated lesson plan → click **Approve**.
4. Submit a **wrong** MCQ answer → confirm red highlight + hint, retry allowed.
5. Use the in-widget **Ask / need a hint** box → tutor responds without revealing the answer, steers back to the question.
6. Submit the **correct** answer → green highlight + explanation → advances to next objective.
7. Complete all objectives → summary with score and study tips.
8. **Durability demo**: restart the agent container mid-lesson (`docker compose restart agent`), click **Resume lesson** → same `thread_id`, state restored from Postgres.

## Project structure

```
agent/
  agent/
    state.py          # AgentState (extends CopilotKitState)
    graph.py          # LangGraph state machine
    server.py         # FastAPI: /health + AG-UI endpoint
  tests/              # pytest: deterministic logic only, LLM calls mocked
  pyproject.toml      # pinned Python dependencies

frontend/
  app/
    api/copilotkit/   # CopilotRuntime → FastAPI proxy
    layout.tsx        # CopilotKit provider
    page.tsx          # main page
  components/         # interrupt widgets, UI components
  package.json        # pinned JS dependencies

docker-compose.yml    # postgres + agent + frontend (one-command setup)
Makefile              # make dev / make test convenience targets
agent/Dockerfile
frontend/Dockerfile
.env.example          # required environment variables
docs/spike-notes.md   # proven CopilotKit/LangGraph symbol names & versions
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenRouter API key | — (required) |
| `OPENAI_BASE_URL` | LLM API base URL | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | OpenRouter model slug | `openai/gpt-4.1` |
| `DATABASE_URL` | Postgres connection string (local dev only) | `postgresql://memorang:memorang@localhost:5432/memorang` |
| `AGENT_URL` | FastAPI base URL for Next.js (local dev only) | `http://localhost:8123` |
| `NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY` | CopilotKit license (optional) | — |

Copy [`.env.example`](.env.example) to `.env` at the **repo root** before starting the agent. With Docker Compose, `DATABASE_URL` and `AGENT_URL` are set automatically for inter-container networking. Set `AGENT_URL` in `frontend/.env.local` only if the agent is not on `localhost:8123`.

## Known limitations

These are intentional MVP trade-offs, not bugs in the HITL or grading wiring.

### PDF processing

- **Large PDFs are truncated** to an ~80k-character budget (`trim_to_budget` in `pdf.py`). Future work: chunked planning or RAG over the full document.
- **No OCR** — scanned/image-only PDFs with no embedded text are rejected with a friendly error.

### Scope

- **One MCQ per objective** in the MVP (state is list-shaped to allow N later).
- **Single-document, single-user** lesson at a time (no multi-doc library or accounts).

### Session durability

- Only one active lesson is tracked (`lesson_thread_id` in `localStorage`). Opening the app in multiple tabs can race on the same thread ID.
- If "Resume lesson" fails (expired checkpoint), you must click "Start new lesson" to clear the stored thread.
- Retries after a failed plan generation reuse the same thread ID; click "Start new lesson" to mint a fresh thread.

### Plan revision feedback

"Request changes" on the lesson plan **does** route back through the agent with your feedback, but revisions are best-effort:

- The prompt and schema require **3–5 objectives** (`plan_schema.py`). Requests for fewer than 3 (e.g. "give me only 2") cannot be satisfied — validation and retry logic enforce the 3–5 range.
- Feedback is appended as a soft hint (`Previous feedback to incorporate: …`), not as a hard override of the default rules.
- Each revision **regenerates** a plan from the PDF rather than editing the plan you just saw, so targeted edits ("drop objective 2") are unreliable.

### MCQ option order

Options are **shuffled server-side** after generation (seeded by question text) to reduce LLM positional bias. The answer key stays server-side in `mcq_key` and is not sent to the client interrupt payload.
