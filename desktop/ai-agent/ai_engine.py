"""Route recognized voice commands to the local OS agent or a spoken reply."""
import asyncio
import json
import logging
import os

import httpx

from os_agent import OSAgent
from response_agent import ResponseAgent

logger = logging.getLogger("AIEngine")


class AIEngineOrchestrator:
    def __init__(self, ollama_url=None):
        self.ollama_url = (ollama_url or os.getenv(
            "OLLAMA_URL", "http://localhost:11434"
        )).rstrip("/")
        self.os_agent = OSAgent()
        self.response_agent = ResponseAgent()

    async def parse_intent_tinyllama(self, prompt_text: str) -> dict:
        system_instruction = (
            "Convert the request to strict JSON only with format "
            '{"target_agent":"OS"|"RESPONSE","action":"LAUNCH_APP"|"CHAT",'
            '"parameters":{}}. Never return shell commands.'
        )
        payload = {
            "model": os.getenv("OLLAMA_MODEL", "tinyllama"),
            "prompt": f"<|system|>\n{system_instruction}\n"
                      f"<|user|>\n{prompt_text}\n<|assistant|>\n",
            "stream": False,
            "format": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{self.ollama_url}/api/generate", json=payload
                )
                response.raise_for_status()
                parsed = json.loads(response.json().get("response", "{}"))
                if isinstance(parsed, dict) and parsed.get("target_agent") in {
                    "OS", "RESPONSE"
                }:
                    return parsed
                logger.warning("Ollama returned an unsupported intent shape.")
        except (httpx.HTTPError, json.JSONDecodeError, TypeError, ValueError) as error:
            logger.warning("Ollama intent parsing failed; using local routing: %s", error)

        words = prompt_text.lower().strip().split()
        launch_words = {"open", "launch", "kholo", "chalao"}
        if launch_words.intersection(words):
            app = next(
                (word.strip(".,!?") for word in words if word.strip(".,!?") in self.os_agent.app_registry),
                ""
            )
            if app:
                return {
                    "target_agent": "OS",
                    "action": "LAUNCH_APP",
                    "parameters": {"app": app}
                }
        return {
            "target_agent": "RESPONSE",
            "action": "CHAT",
            "parameters": {"reply": "I couldn't map that request to a supported app."}
        }

    async def process_command(self, prompt_text: str) -> str:
        parsed = await self.parse_intent_tinyllama(prompt_text)
        parameters = parsed.get("parameters", {})
        if not isinstance(parameters, dict):
            parameters = {}

        if parsed.get("target_agent") == "OS":
            result = await self.os_agent.execute(
                parsed.get("action", ""), parameters
            )
        else:
            result = str(parameters.get("reply") or "Ready.")

        await self.response_agent.handle_response(result)
        return result


def analyze_user_intent_and_screen(prompt_text: str) -> str:
    """Provide the synchronous entry point used by the desktop agent runtime."""
    return asyncio.run(AIEngineOrchestrator().process_command(prompt_text))
