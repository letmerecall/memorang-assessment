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

Edit `.env` and fill in your `OPENAI_API_KEY`. The other defaults work as-is with the included `docker-compose.yml`.

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

## Running tests

```bash
cd agent
uv run pytest tests/ -v
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
| `OPENAI_API_KEY` | OpenAI API key | — (required) |
| `OPENAI_MODEL` | Model to use | `gpt-4.1` |
| `DATABASE_URL` | Postgres connection string | `postgresql://memorang:memorang@localhost:5432/memorang` |
| `AGENT_URL` | FastAPI base URL (used by Next.js) | `http://localhost:8123` |
