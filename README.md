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
    SummaryUI["Summary"]
    Proxy["/api/copilotkit"]
    ExtractAPI["/api/extract"]
    StateAPI["/api/state/{threadId}"]
  end

  subgraph agent["FastAPI (LangGraph agent)"]
    Extract["POST /extract"]
    Graph["LangGraph AG-UI /"]
    State["GET /state/{thread_id}"]
  end

  DB[("Postgres\n(PostgresSaver)")]

  Upload --> ExtractAPI --> Extract
  Upload --> Proxy --> Graph
  Sidebar --> Proxy
  StateAPI --> State
  Graph --> DB
  State --> DB
  Graph -. interrupt() .-> Plan
  Graph -. interrupt() .-> MCQ
  Graph -. interrupt() .-> SummaryUI
```

The browser never calls FastAPI directly. The Next.js server proxies three routes to the agent: `/api/copilotkit` (LangGraph runs), `/api/extract` (PDF text extraction), and `/api/state/{threadId}` (public checkpoint state for resume).

## How the agent works

1. **Upload** — The user uploads a PDF. The frontend calls `/api/extract` (proxied to FastAPI), seeds `pdf_text` into checkpointed `AgentState`, and starts a LangGraph run with a fresh `thread_id`.
2. **Plan** — `ingest_plan` calls `OPENAI_MODEL` (default `openai/gpt-4.1`) with structured output to produce 3–5 learning objectives (title, description, difficulty).
3. **HITL approval** — `approve` calls `interrupt()` and renders the plan in the UI. The user clicks **Approve** or **Request changes**; revisions loop back through `ingest_plan`.
4. **MCQ pre-batch** — After approval, `prebatch_mcqs` generates one MCQ per objective using `OPENAI_MCQ_MODEL` (default `openai/gpt-4o-mini`), grounded in the PDF. Options are shuffled server-side; answer keys stay in `mcq_key` (never sent to the client).
5. **Quiz loop** — For each objective: `generate_mcq` (dequeues pre-generated MCQ) → `ask_mcq` (interrupt with radio choices) → user submits or asks the tutor → `grade` (deterministic — no LLM) or `tutor` (`OPENAI_MODEL`) → retry or advance. Correct answers show green + explanation; incorrect answers show red + hint with unlimited penalty-free retries.
6. **Summary** — When all objectives are done, `summary` computes the score (first-attempt correct / total), calls `OPENAI_MODEL` for personalized study tips, and renders via `interrupt()`.

LangGraph node flow (`approve`, `ask_mcq`, and `summary` call `interrupt()` and pause for user input):

```mermaid
flowchart TB
  ingest_plan --> approve
  approve -->|request changes| ingest_plan
  approve -->|approve| prebatch_mcqs
  prebatch_mcqs --> generate_mcq --> ask_mcq

  ask_mcq -->|submit answer| grade
  ask_mcq -->|ask tutor| tutor
  tutor --> ask_mcq
  grade --> ask_mcq

  ask_mcq -->|continue, more objectives| generate_mcq
  ask_mcq -->|continue, all done| summary
```

After a wrong answer, `grade` loops back to `ask_mcq` with the hint shown (penalty-free retry). After a correct answer, the user clicks **Continue** to advance to the next objective or the summary screen.

### LLM usage

| Step | Node | Model env var | Default | Notes |
|------|------|---------------|---------|-------|
| Lesson plan | `ingest_plan` | `OPENAI_MODEL` | `openai/gpt-4.1` | Structured output (Pydantic) |
| MCQ generation | `prebatch_mcqs` | `OPENAI_MCQ_MODEL` | `openai/gpt-4o-mini` | One MCQ per objective, parallelized |
| Tutor hints | `tutor` | `OPENAI_MODEL` | `openai/gpt-4.1` | Never receives `mcq_key` / correct answer |
| Study tips | `summary` | `OPENAI_MODEL` | `openai/gpt-4.1` | Based on weak objectives |
| Grading | `grade` | — | — | Deterministic index comparison, no LLM |

All models route through OpenRouter (`OPENAI_BASE_URL`, default `https://openrouter.ai/api/v1`).

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

Edit `.env` at the **repo root** and set `OPENAI_API_KEY`. The agent reads this file automatically. Also set:

```
DATABASE_URL=postgresql://memorang:memorang@localhost:5432/memorang
```

The frontend proxies to `http://localhost:8123` by default — no extra frontend env file is needed for this layout. If the agent runs elsewhere, create `frontend/.env.local`:

```
AGENT_URL=http://your-agent-host:8123
```

### 2. Start Postgres

```bash
docker compose up -d postgres
```

### 3. Install dependencies

```bash
cd agent && uv sync --extra test
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

All agent tests use mocked LLM calls — no API key required.

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
    api/extract/      # PDF upload → agent /extract
    api/state/        # Resume → agent /state/{thread_id}
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

Copy [`.env.example`](.env.example) to `.env` at the **repo root** before starting the agent.

### Agent (Python)

Read from repo-root `.env` (or the environment). With Docker Compose, `DATABASE_URL` is set automatically for inter-container networking.

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenRouter API key | — (required) |
| `OPENAI_BASE_URL` | LLM API base URL | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | Model for plan, tutor, and summary | `openai/gpt-4.1` |
| `OPENAI_MCQ_MODEL` | Model for MCQ generation (`prebatch_mcqs`) | `openai/gpt-4o-mini` |
| `DATABASE_URL` | Postgres connection string | `postgresql://memorang:memorang@localhost:5432/memorang` (host dev); set by Compose in Docker |

### Frontend (Next.js)

Read from `frontend/.env.local` if present. Defaults work when the agent is on `localhost:8123`.

| Variable | Description | Default |
|----------|-------------|---------|
| `AGENT_URL` | FastAPI base URL (used by `/api/copilotkit`, `/api/extract`, `/api/state`) | `http://localhost:8123` |
| `NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY` | CopilotKit license (optional) | — |

With Docker Compose, the frontend service receives `AGENT_URL=http://agent:8123` automatically.

## Known limitations

These are intentional MVP trade-offs, not bugs in the HITL or grading wiring.

### PDF processing

- **Upload limit** — PDFs over **10 MB** are rejected (`MAX_PDF_BYTES` in agent and frontend).
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
