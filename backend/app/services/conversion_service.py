"""Conversion service skeleton.

Wraps the conversion registry and job system behind a stable interface.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.jobs import enqueue as _enqueue
from app.registry import registry as _registry


class ConversionService:
    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        return _registry.can_convert(source_ext, target_ext)

    def supported_targets(self, source_ext: str):
        return _registry.supported_targets(source_ext)

    def convert(
        self,
        source_path: str,
        target_path: str,
        source_ext: str,
        target_ext: str,
        options: Optional[Dict[str, Any]] = None,
    ):
        options = options or {}
        return _registry.convert(source_ext, target_ext, source_path, target_path, options)

    def enqueue_conversion(
        self,
        task_name: str,
        *args,
        user_id: Optional[str] = None,
        **kwargs,
    ) -> str:
        return _enqueue(task_name, *args, user_id=user_id, **kwargs)

    def engine_status(self) -> Dict[str, str]:
        return _registry.engine_status()

    def compatibility_matrix(self) -> Dict[str, Dict[str, str]]:
        return _registry.compatibility_matrix()
