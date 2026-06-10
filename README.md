# Memorang AI Learning Agent

Transforms a PDF into an interactive lesson with a Human-in-the-Loop quiz flow.
Built with **LangGraph** (Python) + **CopilotKit** (Next.js).

```
PDF → plan → HITL approval → MCQ loop (with hints & tutor) → summary
```

## Architecture

```
Next.js (CopilotKit UI)
  └── /api/copilotkit  ──►  FastAPI (LangGraph agent)
                                 └── PostgresSaver  ──►  Postgres
```

The frontend never talks to FastAPI directly — all agent traffic proxies through `/api/copilotkit`.

## Prerequisites

| Tool | Version |
|------|---------|
| Docker + Docker Compose | any recent |
| Python | ≥ 3.12 |
| [uv](https://docs.astral.sh/uv/) | any recent |
| Node.js | ≥ 18 |
| npm | ≥ 9 |

## Setup

### 1. Clone & configure environment

```bash
git clone <repo-url>
cd memorang-assessment
cp .env.example .env
```

Edit `.env` and fill in your OpenRouter API key (`OPENAI_API_KEY`). The other defaults work as-is with the included `docker-compose.yml`.

### 2. Start Postgres

```bash
docker compose up -d
```

### 3. Install Python dependencies

```bash
cd agent
uv sync
```

### 4. Install frontend dependencies

```bash
cd frontend
npm install
```

## Running

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

For a quick end-to-end demo, upload [`sample.pdf`](sample.pdf) at the repo root.

## Running tests

```bash
cd agent
uv run pytest tests/ -v
```

```bash
cd frontend
npm test
```

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

docker-compose.yml    # postgres:16
.env.example          # required environment variables
docs/spike-notes.md   # proven CopilotKit/LangGraph symbol names & versions
```

## Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenRouter API key | — (required) |
| `OPENAI_BASE_URL` | LLM API base URL | `https://openrouter.ai/api/v1` |
| `OPENAI_MODEL` | OpenRouter model slug | `openai/gpt-4.1` |
| `DATABASE_URL` | Postgres connection string | `postgresql://memorang:memorang@localhost:5432/memorang` |
| `AGENT_URL` | FastAPI base URL (used by Next.js) | `http://localhost:8123` |
| `NEXT_PUBLIC_COPILOTKIT_PUBLIC_LICENSE_KEY` | CopilotKit license (optional) | — |

Copy [`.env.example`](.env.example) to `.env` at the **repo root** before starting the agent. The frontend works with defaults; set `AGENT_URL` in `frontend/.env.local` only if the agent is not on `localhost:8123`.

## Known limitations

These are intentional MVP trade-offs, not bugs in the HITL or grading wiring.

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
