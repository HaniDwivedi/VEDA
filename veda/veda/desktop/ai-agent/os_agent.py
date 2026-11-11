"""Launch only allow-listed desktop applications requested by the AI router."""
import asyncio
import logging
from typing import Any

logger = logging.getLogger("OSAgent")


class OSAgent:
    def __init__(self) -> None:
        self.app_registry = {
            "chrome": "chrome.exe",
            "notepad": "notepad.exe",
            "calc": "calc.exe",
            "vscode": "code",
            "spotify": "spotify.exe"
        }

    async def execute(self, action: str, params: dict[str, Any]) -> str:
        if action != "LAUNCH_APP":
            return f"Unsupported OS action: {action or 'unknown'}."

        app_name = str(params.get("app", "")).lower().strip()
        executable = self.app_registry.get(app_name)
        if not executable:
            return f"'{app_name or 'That app'}' is not in the supported app list."

        try:
            await asyncio.create_subprocess_exec(executable)
        except OSError:
            logger.exception("Could not launch allow-listed application %s", app_name)
            return f"Could not launch {app_name} on this computer."
        return f"Application '{app_name}' launched."
