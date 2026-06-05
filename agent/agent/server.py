import os
from contextlib import asynccontextmanager
from pathlib import Path
from dotenv import load_dotenv

for _p in (Path(__file__).parent.parent.parent / ".env", Path(".env")):
    if _p.is_file():
        load_dotenv(_p)
        break

from fastapi import FastAPI
import uvicorn
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

from agent.graph import build_graph


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
            name="spike_agent",
            description="Disposable integration spike agent.",
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


def main():
    uvicorn.run("agent.server:app", host="0.0.0.0", port=8123, reload=True)


if __name__ == "__main__":
    main()
