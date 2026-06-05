# PDF Upload → Lesson Plan (Read-Only) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow a user to upload a PDF, extract its text on the server, seed it into agent state, run an `ingest_plan` LangGraph node that calls OpenAI structured output to produce 3-5 learning objectives with difficulty labels, and render the plan read-only in the UI.

**Architecture:** The FastAPI backend gains a `POST /extract` endpoint (PyMuPDF) and an `ingest_plan` node (LangGraph + OpenAI structured output with one retry). The frontend calls `/api/extract` (a Next.js proxy), seeds `pdf_text` into agent state, auto-starts the run, and reads `lesson_plan` from state to render an objectives list. No interrupts in this slice — the graph runs straight through.

**Tech Stack:** Python 3.12, FastAPI, LangGraph 1.2.4, PyMuPDF, LangChain OpenAI, Pydantic v2; Next.js, CopilotKit 1.59.5, TypeScript, Tailwind CSS.

---

## File Map

**New files:**
- `agent/agent/pdf.py` — `extract_text(bytes) -> str`, `trim_to_budget(str, int) -> str`, `NoExtractableTextError`
- `agent/agent/plan_schema.py` — `Difficulty`, `LearningObjective`, `LessonPlan`, `PlanGenerationError`
- `agent/tests/test_pdf.py` — unit tests for pdf.py (no LLM calls)
- `agent/tests/test_plan_schema.py` — unit tests for plan_schema.py (no LLM calls)
- `frontend/app/api/extract/route.ts` — server-side proxy: POST → FastAPI `/extract`
- `frontend/components/PdfUpload.tsx` — file picker, calls `/api/extract`, seeds state, starts run
- `frontend/components/LessonPlan.tsx` — read-only objectives list with difficulty badges

**Modified files:**
- `agent/pyproject.toml` — add `python-multipart`
- `agent/agent/state.py` — replace `SpikeState` with `AgentState` (`pdf_text`, `lesson_plan`)
- `agent/agent/graph.py` — replace spike graph with `ingest_plan` node + `generate_plan` helper
- `agent/agent/server.py` — add `/extract` endpoint; rename agent `spike_agent` → `learning_agent`
- `agent/tests/test_graph.py` — update for new graph (replaces spike tests)
- `frontend/app/page.tsx` — replace spike UI with `PdfUpload` + `LessonPlan`
- `frontend/components/CopilotKitProvider.tsx` — rename agent prop to `learning_agent`
- `frontend/app/api/copilotkit/[[...slug]]/route.ts` — rename agents key to `learning_agent`

---

## Task 1: AgentState schema

Replace `SpikeState` with `AgentState` carrying `pdf_text` and `lesson_plan`.

**Files:**
- Modify: `agent/agent/state.py`
- Modify: `agent/tests/test_graph.py` (update imports — full rewrite comes in Task 4)

- [ ] **Step 1: Write the failing tests**

`agent/tests/test_graph.py` — replace file contents:

```python
"""Tests for AgentState and graph components."""
import pytest
from agent.state import AgentState


def test_agent_state_defaults():
    state = AgentState(messages=[])
    assert state["pdf_text"] is None
    assert state["lesson_plan"] is None


def test_agent_state_stores_pdf_text():
    state = AgentState(messages=[], pdf_text="hello pdf")
    assert state["pdf_text"] == "hello pdf"


def test_agent_state_stores_lesson_plan():
    plan = {"objectives": []}
    state = AgentState(messages=[], lesson_plan=plan)
    assert state["lesson_plan"] == plan
```

- [ ] **Step 2: Run to verify failure**

```bash
cd agent && uv run pytest tests/test_graph.py -v
```

Expected: `ImportError` — `AgentState` not yet defined.

- [ ] **Step 3: Implement AgentState**

Replace `agent/agent/state.py`:

```python
from typing import Optional
from copilotkit import CopilotKitState


class AgentState(CopilotKitState):
    pdf_text: Optional[str] = None
    lesson_plan: Optional[dict] = None
```

- [ ] **Step 4: Run to verify pass**

```bash
cd agent && uv run pytest tests/test_graph.py -v
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/agent/state.py agent/tests/test_graph.py
git commit -m "feat: replace SpikeState with AgentState (pdf_text, lesson_plan)"
```

---

## Task 2: PDF extraction module

`pdf.py` exposes `extract_text` (PyMuPDF), `trim_to_budget` (char-based token budget), and `NoExtractableTextError`.

**Files:**
- Create: `agent/agent/pdf.py`
- Create: `agent/tests/test_pdf.py`

- [ ] **Step 1: Write the failing tests**

Create `agent/tests/test_pdf.py`:

```python
"""Tests for PDF text extraction — no LLM calls."""
import pytest
import fitz  # PyMuPDF
from agent.pdf import extract_text, trim_to_budget, NoExtractableTextError


def _make_pdf(text: str | None = None) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((50, 100), text)
    return doc.tobytes()


def test_extract_text_returns_content_from_valid_pdf():
    pdf_bytes = _make_pdf("Hello World")
    result = extract_text(pdf_bytes)
    assert "Hello World" in result


def test_extract_text_raises_for_blank_page():
    pdf_bytes = _make_pdf()  # no text inserted
    with pytest.raises(NoExtractableTextError, match="no extractable text"):
        extract_text(pdf_bytes)


def test_trim_to_budget_truncates_long_text():
    long_text = "a" * 100_000
    result = trim_to_budget(long_text, max_chars=80_000)
    assert len(result) == 80_000


def test_trim_to_budget_leaves_short_text_unchanged():
    short_text = "hello world"
    result = trim_to_budget(short_text, max_chars=80_000)
    assert result == short_text


def test_trim_to_budget_uses_80k_default():
    long_text = "x" * 100_000
    result = trim_to_budget(long_text)
    assert len(result) == 80_000
```

- [ ] **Step 2: Run to verify failure**

```bash
cd agent && uv run pytest tests/test_pdf.py -v
```

Expected: `ModuleNotFoundError: No module named 'agent.pdf'`

- [ ] **Step 3: Implement pdf.py**

Create `agent/agent/pdf.py`:

```python
import fitz  # PyMuPDF


class NoExtractableTextError(ValueError):
    pass


def extract_text(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    text = "".join(page.get_text() for page in doc)
    doc.close()
    text = text.strip()
    if not text:
        raise NoExtractableTextError("no extractable text found in this PDF")
    return text


def trim_to_budget(text: str, max_chars: int = 80_000) -> str:
    return text[:max_chars]
```

- [ ] **Step 4: Run to verify pass**

```bash
cd agent && uv run pytest tests/test_pdf.py -v
```

Expected: 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/agent/pdf.py agent/tests/test_pdf.py
git commit -m "feat: add pdf extraction module with token-budget trim and empty-PDF error"
```

---

## Task 3: Lesson plan Pydantic schema

`plan_schema.py` defines `LearningObjective`, `LessonPlan` (3-5 objectives), `PlanGenerationError`.

**Files:**
- Create: `agent/agent/plan_schema.py`
- Create: `agent/tests/test_plan_schema.py`

- [ ] **Step 1: Write the failing tests**

Create `agent/tests/test_plan_schema.py`:

```python
"""Tests for LessonPlan Pydantic schema — no LLM calls."""
import pytest
from pydantic import ValidationError
from agent.plan_schema import LessonPlan, LearningObjective


def _obj(title: str = "T", description: str = "D", difficulty: str = "beginner") -> dict:
    return {"title": title, "description": description, "difficulty": difficulty}


def test_lesson_plan_validates_three_objectives():
    plan = LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(3)]})
    assert len(plan.objectives) == 3


def test_lesson_plan_validates_five_objectives():
    plan = LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(5)]})
    assert len(plan.objectives) == 5


def test_lesson_plan_rejects_two_objectives():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(2)]})


def test_lesson_plan_rejects_six_objectives():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate({"objectives": [_obj(str(i)) for i in range(6)]})


def test_lesson_plan_rejects_invalid_difficulty():
    with pytest.raises(ValidationError):
        LessonPlan.model_validate(
            {"objectives": [_obj("T", "D", "expert")] * 3}
        )


def test_learning_objective_accepts_all_difficulty_levels():
    for diff in ("beginner", "intermediate", "advanced"):
        obj = LearningObjective.model_validate(_obj("T", "D", diff))
        assert obj.difficulty == diff
```

- [ ] **Step 2: Run to verify failure**

```bash
cd agent && uv run pytest tests/test_plan_schema.py -v
```

Expected: `ModuleNotFoundError: No module named 'agent.plan_schema'`

- [ ] **Step 3: Implement plan_schema.py**

Create `agent/agent/plan_schema.py`:

```python
from typing import Literal
from pydantic import BaseModel, Field


Difficulty = Literal["beginner", "intermediate", "advanced"]


class LearningObjective(BaseModel):
    title: str
    description: str
    difficulty: Difficulty


class LessonPlan(BaseModel):
    objectives: list[LearningObjective] = Field(min_length=3, max_length=5)


class PlanGenerationError(RuntimeError):
    pass
```

- [ ] **Step 4: Run to verify pass**

```bash
cd agent && uv run pytest tests/test_plan_schema.py -v
```

Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add agent/agent/plan_schema.py agent/tests/test_plan_schema.py
git commit -m "feat: add LessonPlan Pydantic schema (3-5 objectives, difficulty)"
```

---

## Task 4: `ingest_plan` LangGraph node + graph

Replace the spike graph with a straight-through `ingest_plan` node. `generate_plan` calls OpenAI structured output with one retry.

**Files:**
- Modify: `agent/agent/graph.py`
- Modify: `agent/tests/test_graph.py`

- [ ] **Step 1: Write the failing tests**

Append to `agent/tests/test_graph.py`:

```python
from unittest.mock import patch
from agent.graph import ingest_plan, build_graph
from agent.plan_schema import LessonPlan, LearningObjective


def _mock_plan() -> LessonPlan:
    return LessonPlan(objectives=[
        LearningObjective(title=f"T{i}", description=f"D{i}", difficulty="beginner")
        for i in range(3)
    ])


def test_ingest_plan_sets_lesson_plan_in_state():
    state = AgentState(messages=[], pdf_text="some content", lesson_plan=None)
    with patch("agent.graph.generate_plan", return_value=_mock_plan()):
        result = ingest_plan(state)
    assert result["lesson_plan"]["objectives"][0]["title"] == "T0"
    assert len(result["lesson_plan"]["objectives"]) == 3


def test_ingest_plan_skips_when_no_pdf_text():
    state = AgentState(messages=[], pdf_text=None, lesson_plan=None)
    with patch("agent.graph.generate_plan") as mock_gen:
        result = ingest_plan(state)
    mock_gen.assert_not_called()
    assert result == {}


def test_graph_compiles_with_memory_checkpointer():
    from langgraph.checkpoint.memory import MemorySaver
    graph = build_graph(checkpointer=MemorySaver())
    assert graph is not None
```

- [ ] **Step 2: Run to verify failure**

```bash
cd agent && uv run pytest tests/test_graph.py -v
```

Expected: `ImportError` — `ingest_plan` and `generate_plan` not defined yet.

- [ ] **Step 3: Implement graph.py**

Replace `agent/agent/graph.py`:

```python
import os
from typing import Any
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

from agent.state import AgentState
from agent.plan_schema import LessonPlan, PlanGenerationError


def generate_plan(pdf_text: str) -> LessonPlan:
    model = os.environ.get("OPENAI_MODEL", "gpt-4.1")
    llm = ChatOpenAI(model=model, temperature=0).with_structured_output(LessonPlan)
    prompt = (
        "Create a lesson plan from the following educational content. "
        "Return exactly 3 to 5 learning objectives, each with a title, "
        "a one-sentence description, and a difficulty of beginner, intermediate, or advanced.\n\n"
        f"Content:\n{pdf_text}"
    )
    try:
        return llm.invoke(prompt)
    except Exception as first_err:
        retry_prompt = (
            f"{prompt}\n\nYour previous response was invalid: {first_err}. "
            "Ensure objectives list has 3-5 items and difficulty is one of: "
            "beginner, intermediate, advanced."
        )
        try:
            return llm.invoke(retry_prompt)
        except Exception as second_err:
            raise PlanGenerationError(str(second_err)) from second_err


def ingest_plan(state: AgentState) -> dict:
    pdf_text = state.get("pdf_text")
    if not pdf_text:
        return {}
    plan = generate_plan(pdf_text)
    return {"lesson_plan": plan.model_dump()}


def build_graph(checkpointer: Any = None):
    builder = StateGraph(AgentState)
    builder.add_node("ingest_plan", ingest_plan)
    builder.set_entry_point("ingest_plan")
    builder.add_edge("ingest_plan", END)
    return builder.compile(checkpointer=checkpointer)
```

- [ ] **Step 4: Run to verify pass**

```bash
cd agent && uv run pytest tests/test_graph.py -v
```

Expected: all tests PASS (generate_plan is mocked so no API call).

- [ ] **Step 5: Commit**

```bash
git add agent/agent/graph.py agent/tests/test_graph.py
git commit -m "feat: add ingest_plan node with OpenAI structured output + one-retry logic"
```

---

## Task 5: FastAPI `/extract` endpoint

Add `POST /extract` (multipart file upload → PyMuPDF extract → trimmed text or friendly 422), rename agent, add `python-multipart` dependency.

**Files:**
- Modify: `agent/pyproject.toml`
- Modify: `agent/agent/server.py`
- Modify: `agent/tests/test_server.py`

- [ ] **Step 1: Add python-multipart dependency**

Edit `agent/pyproject.toml` — add `python-multipart` to the dependencies list:

```toml
[project]
name = "agent"
version = "0.1.0"
description = "AI Learning Agent — Python LangGraph service"
requires-python = ">=3.12"
dependencies = [
  "copilotkit==0.1.94",
  "ag-ui-langgraph[fastapi]==0.0.38",
  "langgraph==1.2.4",
  "langgraph-checkpoint-postgres==3.1.0",
  "langchain-openai>=0.3.0",
  "langchain>=1.2.0",
  "fastapi>=0.115.5,<1.0.0",
  "uvicorn>=0.29.0,<1.0.0",
  "python-dotenv>=1.0.0,<2.0.0",
  "pymupdf>=1.24.0,<2.0.0",
  "openai>=1.0.0,<2.0.0",
  "pydantic>=2.0.0,<3.0.0",
  "psycopg[binary]>=3.1.0,<4.0.0",
  "python-multipart>=0.0.9,<1.0.0",
]
```

Install it:

```bash
cd agent && uv sync
```

Expected: resolves and installs without errors.

- [ ] **Step 2: Write the failing tests**

Replace `agent/tests/test_server.py`:

```python
"""Smoke tests for FastAPI endpoints. LLM calls are mocked."""
import fitz
from unittest.mock import patch
from fastapi.testclient import TestClient
from agent.server import app
from agent.plan_schema import LessonPlan, LearningObjective


def _pdf_bytes(text: str | None = None) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    if text:
        page.insert_text((50, 100), text)
    return doc.tobytes()


def test_health_endpoint_returns_ok():
    with TestClient(app) as client:
        resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_copilotkit_endpoint_registered():
    with TestClient(app, raise_server_exceptions=False) as client:
        resp = client.post("/", json={})
    assert resp.status_code != 404


def test_extract_returns_text_for_valid_pdf():
    with TestClient(app) as client:
        resp = client.post(
            "/extract",
            files={"file": ("test.pdf", _pdf_bytes("Hello World"), "application/pdf")},
        )
    assert resp.status_code == 200
    assert "Hello World" in resp.json()["text"]


def test_extract_returns_422_for_blank_pdf():
    with TestClient(app) as client:
        resp = client.post(
            "/extract",
            files={"file": ("blank.pdf", _pdf_bytes(), "application/pdf")},
        )
    assert resp.status_code == 422
    assert "no extractable text" in resp.json()["detail"].lower()
```

- [ ] **Step 3: Run to verify failure**

```bash
cd agent && uv run pytest tests/test_server.py -v
```

Expected: `test_extract_*` tests FAIL with 404 — `/extract` not yet defined.

- [ ] **Step 4: Implement `/extract` and rename agent in server.py**

Replace `agent/agent/server.py`:

```python
import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

for _p in (Path(__file__).parent.parent.parent / ".env", Path(".env")):
    if _p.is_file():
        load_dotenv(_p)
        break

from fastapi import FastAPI, File, HTTPException, UploadFile
import uvicorn
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from agent.graph import build_graph
from agent.pdf import extract_text, trim_to_budget, NoExtractableTextError


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_url = os.getenv("DATABASE_URL")
    if db_url:
        from psycopg_pool import AsyncConnectionPool
        from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver

        pool = AsyncConnectionPool(
            db_url,
            kwargs={"autocommit": True, "prepare_threshold": 0},
            open=False,
        )
        await pool.open()
        checkpointer = AsyncPostgresSaver(pool)
        await checkpointer.setup()
    else:
        from langgraph.checkpoint.memory import MemorySaver
        pool = None
        checkpointer = MemorySaver()

    graph = build_graph(checkpointer=checkpointer)
    add_langgraph_fastapi_endpoint(
        app=app,
        agent=LangGraphAGUIAgent(
            name="learning_agent",
            description="AI learning agent — generates lesson plans from PDFs.",
            graph=graph,
        ),
        path="/",
    )

    yield

    if pool:
        await pool.close()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    file_bytes = await file.read()
    try:
        text = extract_text(file_bytes)
    except NoExtractableTextError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"text": trim_to_budget(text)}


def main():
    uvicorn.run("agent.server:app", host="0.0.0.0", port=8123, reload=True)


if __name__ == "__main__":
    main()
```

- [ ] **Step 5: Run to verify pass**

```bash
cd agent && uv run pytest tests/test_server.py -v
```

Expected: all 4 tests PASS.

- [ ] **Step 6: Run full test suite**

```bash
cd agent && uv run pytest -v
```

Expected: all tests PASS (test_health.py, test_graph.py, test_pdf.py, test_plan_schema.py, test_server.py).

- [ ] **Step 7: Commit**

```bash
git add agent/pyproject.toml agent/uv.lock agent/agent/server.py agent/tests/test_server.py
git commit -m "feat: add POST /extract endpoint; rename agent to learning_agent"
```

---

## Task 6: Frontend wiring — rename agent + proxy route

Update the CopilotKit runtime and provider to use `learning_agent`; add a Next.js proxy route for `/api/extract`.

**Files:**
- Modify: `frontend/app/api/copilotkit/[[...slug]]/route.ts`
- Modify: `frontend/components/CopilotKitProvider.tsx`
- Create: `frontend/app/api/extract/route.ts`

- [ ] **Step 1: Rename agent in CopilotKit runtime route**

Replace `frontend/app/api/copilotkit/[[...slug]]/route.ts`:

```typescript
import {
  CopilotRuntime,
  createCopilotRuntimeHandler,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";

const agent = new LangGraphHttpAgent({
  url: `${process.env.AGENT_URL ?? "http://localhost:8123"}/`,
});

const runtime = new CopilotRuntime({
  agents: { learning_agent: agent },
  runner: new InMemoryAgentRunner(),
});

const handler = createCopilotRuntimeHandler({ runtime });

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const DELETE = handler;
```

- [ ] **Step 2: Rename agent in CopilotKitProvider**

Replace `frontend/components/CopilotKitProvider.tsx`:

```typescript
"use client";

import { CopilotKit } from "@copilotkit/react-core/v2";
import "@copilotkit/react-core/v2/styles.css";

export function CopilotKitProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit" agent="learning_agent" useSingleEndpoint={false}>
      {children}
    </CopilotKit>
  );
}
```

- [ ] **Step 3: Create the extract proxy route**

Create `frontend/app/api/extract/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const agentUrl = process.env.AGENT_URL ?? "http://localhost:8123";
  const body = await req.formData();
  const res = await fetch(`${agentUrl}/extract`, { method: "POST", body });
  const data = await res.json();
  return NextResponse.json(data, { status: res.status });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/copilotkit/[[...slug]]/route.ts \
        frontend/components/CopilotKitProvider.tsx \
        frontend/app/api/extract/route.ts
git commit -m "feat: rename frontend agent to learning_agent; add /api/extract proxy"
```

---

## Task 7: `PdfUpload` component

File picker that calls `/api/extract`, displays a friendly error for empty PDFs, then seeds `pdf_text` into agent state and auto-starts the run.

**Files:**
- Create: `frontend/components/PdfUpload.tsx`

- [ ] **Step 1: Create PdfUpload.tsx**

```typescript
"use client";

import { useRef, useState } from "react";
import { useAgent } from "@copilotkit/react-core/v2";

export function PdfUpload() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/extract", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.detail ?? "Upload failed.");
        return;
      }
      agent.setState({ pdf_text: data.text, lesson_plan: null });
      await agent.runAgent();
    } catch {
      setError("Network error — is the agent server running?");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 mt-8">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        disabled={uploading || agent.isRunning}
        onClick={() => inputRef.current?.click()}
        className="rounded bg-blue-600 px-6 py-3 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
      >
        {uploading ? "Uploading…" : agent.isRunning ? "Generating plan…" : "Upload PDF"}
      </button>
      {error && (
        <p className="text-sm text-red-600 max-w-sm text-center">{error}</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/PdfUpload.tsx
git commit -m "feat: add PdfUpload component — extract, seed state, auto-start agent"
```

---

## Task 8: `LessonPlan` display component

Read-only list of objectives with difficulty colour-coded badges.

**Files:**
- Create: `frontend/components/LessonPlan.tsx`

- [ ] **Step 1: Create LessonPlan.tsx**

```typescript
type Difficulty = "beginner" | "intermediate" | "advanced";

type Objective = {
  title: string;
  description: string;
  difficulty: Difficulty;
};

type LessonPlanData = {
  objectives: Objective[];
};

const BADGE_STYLE: Record<Difficulty, string> = {
  beginner: "bg-green-100 text-green-800",
  intermediate: "bg-yellow-100 text-yellow-800",
  advanced: "bg-red-100 text-red-800",
};

export function LessonPlan({ plan }: { plan: LessonPlanData }) {
  return (
    <div className="w-full max-w-xl mt-8">
      <h2 className="text-lg font-semibold mb-4">Lesson Plan</h2>
      <ol className="space-y-4">
        {plan.objectives.map((obj, i) => (
          <li key={i} className="rounded border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-medium text-sm">{obj.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE_STYLE[obj.difficulty]}`}>
                {obj.difficulty}
              </span>
            </div>
            <p className="text-sm text-gray-600">{obj.description}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/LessonPlan.tsx
git commit -m "feat: add LessonPlan read-only display with difficulty badges"
```

---

## Task 9: Wire up page.tsx — full end-to-end UI

Replace the spike page with the PDF upload + lesson plan flow.

**Files:**
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Replace page.tsx**

```typescript
"use client";

import { useAgent } from "@copilotkit/react-core/v2";
import { PdfUpload } from "@/components/PdfUpload";
import { LessonPlan } from "@/components/LessonPlan";

type LessonPlanData = {
  objectives: { title: string; description: string; difficulty: "beginner" | "intermediate" | "advanced" }[];
};

export default function HomePage() {
  const { agent } = useAgent({ agentId: "learning_agent" });
  const plan = (agent.state as { lesson_plan?: LessonPlanData })?.lesson_plan ?? null;

  return (
    <div className="flex min-h-screen flex-col items-center bg-gray-50 py-16 px-4">
      <h1 className="mb-2 text-2xl font-semibold">AI Learning Agent</h1>
      <p className="mb-2 text-sm text-gray-500">
        Upload a PDF to generate a lesson plan.
      </p>
      <p className="text-xs text-gray-400">
        {agent.isRunning ? "Generating…" : plan ? "Done" : "Idle"}
      </p>

      {!plan && <PdfUpload />}
      {plan && <LessonPlan plan={plan} />}
      {plan && (
        <button
          onClick={() => agent.setState({ pdf_text: null, lesson_plan: null })}
          className="mt-6 text-xs text-gray-400 hover:text-gray-600 underline"
        >
          Upload another PDF
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run full backend test suite one final time**

```bash
cd agent && uv run pytest -v
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: wire up PDF upload → lesson plan UI (issue #2)"
```

---

## Self-Review Checklist

- [x] **Spec coverage**
  - `/extract` endpoint (PyMuPDF, token trim, empty-PDF 422) → Tasks 2 + 5
  - `pdf_text` seeded into checkpointed `AgentState` → Tasks 1 + 7
  - `ingest_plan` structured-output + retry → Task 4
  - Objectives list renders in UI with difficulty → Tasks 8 + 9
  - Empty/scanned PDF → friendly error, not traceback → Tasks 2 + 5 + 7
  - Tests for `pdf.py` and plan schema, LLM mocked → Tasks 2 + 3 + 4
  - `OPENAI_MODEL` env-var default `gpt-4.1` → Task 4 (`graph.py`)

- [x] **No placeholders** — every step has complete code

- [x] **Type consistency**
  - `AgentState` defined in Task 1, imported in Tasks 4 + 5
  - `LessonPlan`, `LearningObjective`, `PlanGenerationError` defined in Task 3, used in Task 4
  - `NoExtractableTextError` defined in Task 2, imported in Task 5
  - `generate_plan` defined at module level in `graph.py` (Task 4), patched by name `agent.graph.generate_plan` in tests
  - `LessonPlanData` type repeated in `page.tsx` — consistent shape with `plan_schema.py`'s `model_dump()` output
