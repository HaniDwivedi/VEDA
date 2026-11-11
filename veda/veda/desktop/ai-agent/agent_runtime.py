"""Run bounded background tasks and report their state to the floating widget."""
from concurrent.futures import Future, ThreadPoolExecutor
from threading import Lock
from typing import Any, Callable, Optional


class AgentRuntime:
    def __init__(
        self,
        workers: int = 3,
        on_change: Optional[Callable[[dict[str, str]], None]] = None,
    ) -> None:
        self._executor = ThreadPoolExecutor(max_workers=workers)
        self._on_change = on_change
        self._lock = Lock()
        self._state = "ready"
        self._detail = "Ready"

    def snapshot(self) -> dict[str, str]:
        with self._lock:
            return {"state": self._state, "detail": self._detail}

    def _set_state(self, state: str, detail: str) -> None:
        with self._lock:
            self._state = state
            self._detail = detail
            snapshot = {"state": state, "detail": detail}
        if self._on_change:
            self._on_change(snapshot)

    def submit(
        self,
        label: str,
        task: Callable[[Callable[[str], None]], Any],
        attempts: int = 1,
    ) -> Future:
        if attempts < 1:
            raise ValueError("attempts must be at least 1")

        def update(detail: str) -> None:
            self._set_state("running", detail)

        def run_task():
            for attempt in range(1, attempts + 1):
                self._set_state(
                    "running" if attempt == 1 else "retrying",
                    label if attempt == 1 else f"{label} (attempt {attempt})",
                )
                try:
                    result = task(update)
                    self._set_state("ready", str(result or "Ready"))
                    return result
                except Exception:
                    if attempt == attempts:
                        self._set_state("failed", label)
                        raise
            return None

        self._set_state("queued", label)
        return self._executor.submit(run_task)

    def shutdown(self) -> None:
        self._executor.shutdown(wait=False, cancel_futures=True)
