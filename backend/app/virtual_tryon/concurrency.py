"""
Concurrency & Queue Limiter for DORI 3D Virtual Try-On.

Restricts concurrent 3D generation jobs to THREED_WORKERS (1 on dev CPU)
and bounds the waiting queue to THREED_MAX_QUEUE (5). Prevents CPU starvation
and keeps main FastAPI event loop unblocked.
"""

import asyncio
from typing import Dict, Any, Optional
from contextlib import asynccontextmanager
from fastapi import HTTPException, status
from .config import get_threed_workers, get_threed_max_queue


class ThreeDQueueFullException(HTTPException):
    """Raised when the 3D generation queue exceeds configured capacity."""

    def __init__(self, message: str = "3D generation queue is currently full. Please try again later."):
        super().__init__(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={
                "status": "busy",
                "message": message
            }
        )


class ThreeDConcurrencyManager:
    """Manages worker concurrency and bounded queue depth."""

    def __init__(self):
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._active_workers: int = 0
        self._queued_count: int = 0
        self._lock = asyncio.Lock()

    def _get_semaphore(self) -> asyncio.Semaphore:
        if self._semaphore is None:
            workers = get_threed_workers()
            self._semaphore = asyncio.Semaphore(workers)
        return self._semaphore

    @asynccontextmanager
    async def acquire_worker_slot(self):
        """
        Asynchronously acquires a worker slot.
        Rejects immediately with HTTP 503 / busy if queue depth is exceeded.
        """
        max_queue = get_threed_max_queue()
        workers = get_threed_workers()

        async with self._lock:
            if self._queued_count >= max_queue:
                raise ThreeDQueueFullException()
            self._queued_count += 1

        sem = self._get_semaphore()
        try:
            await sem.acquire()
            async with self._lock:
                self._queued_count -= 1
                self._active_workers += 1

            yield

        finally:
            async with self._lock:
                if self._active_workers > 0:
                    self._active_workers -= 1
            sem.release()

    def get_stats(self) -> Dict[str, Any]:
        """Returns live concurrency statistics."""
        return {
            "active_workers": self._active_workers,
            "queued_requests": self._queued_count,
            "max_workers": get_threed_workers(),
            "max_queue": get_threed_max_queue()
        }


# Singleton Concurrency Manager
concurrency_manager = ThreeDConcurrencyManager()
