from __future__ import annotations

from collections import defaultdict, deque
from threading import Lock
from time import monotonic

MAX_TRACKED_KEYS = 50_000


class InMemoryRateLimiter:
    """Sliding-window limiter for a single process; use a shared store (e.g. Redis) for multiple workers."""

    def __init__(self) -> None:
        self._events: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    def allow(self, key: str, limit: int, window_seconds: int = 60) -> bool:
        now = monotonic()
        cutoff = now - window_seconds
        with self._lock:
            if len(self._events) > MAX_TRACKED_KEYS:
                self._prune(cutoff)
            events = self._events[key]
            while events and events[0] <= cutoff:
                events.popleft()
            if len(events) >= limit:
                return False
            events.append(now)
            return True

    def _prune(self, cutoff: float) -> None:
        for key in [key for key, events in self._events.items() if not events or events[-1] <= cutoff]:
            del self._events[key]

    def reset(self) -> None:
        with self._lock:
            self._events.clear()


rate_limiter = InMemoryRateLimiter()
login_limiter = InMemoryRateLimiter()
