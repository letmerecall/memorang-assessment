from typing import Optional
from copilotkit import CopilotKitState


class SpikeState(CopilotKitState):
    echo: Optional[str] = ""
