"""Central cancellable timer ownership for duration-based rules."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable, Coroutine
from typing import Any, Protocol


class TaskHandle(Protocol):
    def cancel(self) -> bool: ...

    def done(self) -> bool: ...


Sleep = Callable[[float], Awaitable[None]]
CreateTask = Callable[[Coroutine[Any, Any, None]], TaskHandle]
TimerCallback = Callable[[], Awaitable[None]]


class TimerManager:
    """Own at most one pending duration timer per rule."""

    def __init__(
        self,
        *,
        sleep: Sleep = asyncio.sleep,
        create_task: CreateTask = asyncio.create_task,
    ) -> None:
        self._sleep = sleep
        self._create_task = create_task
        self._tasks: dict[str, TaskHandle] = {}
        self._generations: dict[str, int] = {}

    def schedule(self, rule_id: str, delay_seconds: float, callback: TimerCallback) -> None:
        if delay_seconds <= 0:
            raise ValueError("Timer delay must be greater than zero")
        self.cancel_rule(rule_id)
        generation = self._generations.get(rule_id, 0) + 1
        self._generations[rule_id] = generation

        async def run() -> None:
            try:
                await self._sleep(delay_seconds)
                if self._generations.get(rule_id) == generation:
                    self._tasks.pop(rule_id, None)
                    await callback()
            except asyncio.CancelledError:
                return
            finally:
                if self._generations.get(rule_id) == generation:
                    self._tasks.pop(rule_id, None)

        self._tasks[rule_id] = self._create_task(run())

    def cancel_rule(self, rule_id: str) -> bool:
        self._generations[rule_id] = self._generations.get(rule_id, 0) + 1
        task = self._tasks.pop(rule_id, None)
        if task is None or task.done():
            return False
        task.cancel()
        return True

    def cancel_all(self) -> None:
        for rule_id in tuple(self._tasks):
            self.cancel_rule(rule_id)

    @property
    def pending_rule_ids(self) -> tuple[str, ...]:
        return tuple(sorted(rule_id for rule_id, task in self._tasks.items() if not task.done()))


__all__ = ["TimerManager"]
