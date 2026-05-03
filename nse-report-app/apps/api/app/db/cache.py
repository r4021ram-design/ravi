"""
Local In-Memory Cache
Provides a simple dict-based cache for the MVP to avoid strict Redis dependencies,
while maintaining the same interface for easy swap later.
"""

import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class LocalCache:
    """Simple TTL-based local dictionary cache."""

    def __init__(self):
        self._cache = {}

    def get(self, key: str) -> Optional[Any]:
        if key in self._cache:
            entry = self._cache[key]
            if entry["expiry"] and time.time() > entry["expiry"]:
                del self._cache[key]
                return None
            return entry["value"]
        return None

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        expiry = time.time() + ttl if ttl else None
        self._cache[key] = {"value": value, "expiry": expiry}

    def delete(self, key: str) -> None:
        if key in self._cache:
            del self._cache[key]

    def clear(self) -> None:
        self._cache.clear()


# Global singleton cache instance
cache = LocalCache()
