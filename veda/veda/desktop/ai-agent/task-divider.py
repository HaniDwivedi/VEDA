import asyncio
import json
import httpx
import subprocess

class OSExecutionSpecialist:
    """Ek dedicated agent jo sirf OS/Laptop tasks handle karta hai."""
    
    def __init__(self):
        self.app_routes = {
            "chrome": "chrome.exe",
            "vscode": "code",
            "notepad": "notepad.exe",
            "spotify": "spotify.exe"
        }

    async def execute_task(self, task: dict) -> str:
        action = task.get("action")
        target = task.get("target", "").lower()

        if action == "LAUNCH_APP":
            exe = self.app_routes.get(target, target)
            await asyncio.create_subprocess_shell(exe)
            return f"{target} open kar diya."

        elif action == "KILL_APP":
            await asyncio.create_subprocess_shell(f"taskkill /f /im {target}.exe")
            return f"{target} close kar diya."

        elif action == "SYSTEM_CONTROL":
            # Volume, Brightness, Mute routines
            return f"System command {target} processed."

        return "Unknown OS Task"


class VedaCoreOrchestrator:
    def __init__(self):
        self.os_agent = OSExecutionSpecialist()

    async def parse_multi_tasks(self, user_prompt: str) -> list:
        """TinyLlama parse karega ki 1 message me kitne alag alag tasks hain."""
        
        system_instruction = (
            "You are a task decomposer. Extract all tasks from user input into a JSON list of objects.\n"
            'Format: [{"type": "OS"|"RESPONSE", "action": "LAUNCH_APP"|"KILL_APP"|"CHAT", "target": "name"}]\n'
            "Example: 'chrome open karo aur gaana chalao' -> "
            '[{"type": "OS", "action": "LAUNCH_APP", "target": "chrome"}, {"type": "RESPONSE", "action": "CHAT", "target": "music"}]'
        )

        payload = {
            "model": "tinyllama",
            "prompt": f"<|system|>\n{system_instruction}\n<|user|>\n{user_prompt}\n<|assistant|>\n",
            "stream": False,
            "format": "json"
        }

        try:
            async with httpx.AsyncClient(timeout=3.0) as client:
                res = await client.post("http://localhost:11434/api/generate", json=payload)
                if res.status_code == 200:
                    data = json.loads(res.json().get("response", "[]"))
                    # Ensure output is list
                    return data if isinstance(data, list) else [data]
        except Exception:
            pass

        # Fallback heuristic multi-task router
        tasks = []
        if "chrome" in user_prompt.lower():
            tasks.append({"type": "OS", "action": "LAUNCH_APP", "target": "chrome"})
        if "notepad" in user_prompt.lower():
            tasks.append({"type": "OS", "action": "LAUNCH_APP", "target": "notepad"})
        return tasks

    async def process_user_input(self, user_prompt: str):
        # Step 1: LLM splits multiple tasks
        task_list = await self.parse_multi_tasks(user_prompt)

        # Step 2: Run all OS tasks concurrently using asyncio.gather
        os_coroutines = []
        for task in task_list:
            if task.get("type") == "OS":
                os_coroutines.append(self.os_agent.execute_task(task))
            else:
                print(f"[Response Agent Task]: {task.get('target')}")

        # Non-blocking concurrent execution
        results = await asyncio.gather(*os_coroutines)
        
        for res in results:
            print(f"[V.E.D.A Output]: {res}")

# Pipeline Run
async def main():
    orchestrator = VedaCoreOrchestrator()
    print("--- User Command: Open chrome and notepad ---")
    await orchestrator.process_user_input("chrome open karo aur notepad bhi kholo")

if __name__ == "__main__":
    asyncio.run(main())