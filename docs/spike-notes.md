# Spike notes — proven symbol names for downstream slices

Issue #1 walking skeleton verified the full interrupt round-trip.
All real nodes must be written against these APIs.

## Pinned versions

### Python (`agent/pyproject.toml`)
| Package | Version |
|---------|---------|
| `copilotkit` | 0.1.94 |
| `langgraph` | 1.2.4 |
| `langgraph-checkpoint-postgres` | 3.1.0 |
| `ag-ui-langgraph[fastapi]` | 0.0.38 |

### JavaScript (`frontend/package.json`)
| Package | Version |
|---------|---------|
| `@copilotkit/react-core` | 1.59.5 |
| `@copilotkit/runtime` | 1.59.5 |
| `@copilotkit/react-ui` | 1.59.5 |

## Proven Python symbols

```python
# State base class
from copilotkit import CopilotKitState

# Interrupt — call inside any LangGraph node; returns the resume value
from langgraph.types import interrupt
resumed_value = interrupt({"type": "...", "message": "..."})

# FastAPI endpoint wiring (AG-UI protocol)
from copilotkit import LangGraphAGUIAgent
from ag_ui_langgraph import add_langgraph_fastapi_endpoint

add_langgraph_fastapi_endpoint(
    app=app,
    agent=LangGraphAGUIAgent(name="...", description="...", graph=graph),
    path="/",
)

# PostgresSaver (needs psycopg[binary] + psycopg_pool)
from langgraph.checkpoint.postgres import PostgresSaver
from psycopg_pool import ConnectionPool
pool = ConnectionPool(DATABASE_URL, open=True)
checkpointer = PostgresSaver(pool)
checkpointer.setup()  # idempotent, run on startup
```

## Proven JavaScript/TypeScript symbols

```typescript
// CopilotKit provider (root layout wrapper, client component)
import { CopilotKit } from "@copilotkit/react-core/v2";
// usage: <CopilotKit runtimeUrl="/api/copilotkit" agent="agent_name">

// Hooks (client components)
import { useAgent, useInterrupt } from "@copilotkit/react-core/v2";

// useAgent — access agent state, start runs, seed state
//
// ⚠️  Before /api/copilotkit/info responds, useAgent returns a per-component
// provisional agent.  Two components calling useAgent independently get
// *different* provisional instances, so a runAgent() in one won't be seen
// by a subscribe() in the other.  Fix: depend on `agent` in your useEffect
// so the effect re-fires once both components share the real agent:
//
//   useEffect(() => {
//     if (!agent.isRunning) { agent.setState(...); agent.runAgent(); }
//   }, [agent]);   // ← NOT [] — must re-run when agent becomes the real one
const { agent } = useAgent();
agent.setState({ myField: value });   // seed before runAgent()
await agent.runAgent();               // programmatic start (no chat message)

// useInterrupt — renders custom widget for interrupt payloads
// renderInChat: false → returns element for manual placement
//
// ⚠️  ag_ui_langgraph serializes the Python interrupt dict to a JSON *string*
// in the CUSTOM event's `value` field.  event.value is NOT a plain object —
// you must parse it before accessing fields:
function parseInterruptValue(raw) {
  if (typeof raw === "string") {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return typeof raw === "object" && raw !== null ? raw : null;
}

const element = useInterrupt({
  renderInChat: false,
  enabled: (event) => parseInterruptValue(event.value)?.type === "my_type",
  render: ({ event, resolve }) => {
    const payload = parseInterruptValue(event.value);
    return <button onClick={() => resolve(payload)} />;
  },
});

// Next.js API route — runtime + LangGraphHttpAgent (for FastAPI / AG-UI backend)
// NOT LangGraphAgent (which targets LangGraph Platform/langgraph-cli)
import {
  CopilotRuntime,
  createCopilotEndpoint,
  InMemoryAgentRunner,
} from "@copilotkit/runtime/v2";
import { LangGraphHttpAgent } from "@copilotkit/runtime/langgraph";
import { handle } from "hono/vercel";

// CopilotChat (from top-level, not /v2)
import { CopilotChat } from "@copilotkit/react-ui";
```

## Key wiring notes

- The FastAPI agent speaks **AG-UI protocol** via `ag_ui_langgraph`.
  The frontend connects with `LangGraphHttpAgent` (not `LangGraphAgent`).
- `useInterrupt` collects events named `on_interrupt` from the agent stream.
  The interrupt UI surfaces once the run finalizes (not mid-stream).
- Seeding state before `runAgent()` injects values into the first checkpoint
  so the graph starts with `pdf_text` (real flow) or `echo` (spike) already set.
- `PostgresSaver.setup()` is idempotent — safe to call every startup.
- `psycopg[binary]` + `psycopg_pool` are the required Postgres driver packages.
