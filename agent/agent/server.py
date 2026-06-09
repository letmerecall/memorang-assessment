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

MAX_PDF_BYTES = 10 * 1024 * 1024


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
    if len(file_bytes) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail="PDF exceeds 10 MB limit.")
    try:
        text = extract_text(file_bytes)
    except NoExtractableTextError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"text": trim_to_budget(text)}


def main():
    uvicorn.run("agent.server:app", host="0.0.0.0", port=8123, reload=True)


if __name__ == "__main__":
    main()
