"""Deliver AI agent responses through the desktop text-to-speech engine."""
from voice import speak


class ResponseAgent:
    async def handle_response(self, response: str) -> None:
        speak(response)
