"""Document generation service skeleton.

Wraps existing generation logic in app/generation.py behind a stable interface.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from app.generation import render_blocks as _render_blocks
from app.jobs import enqueue as _enqueue


class GenerationService:
    def enqueue_generate(
        self,
        blocks: List[Dict[str, Any]],
        fmt: str,
        data: Optional[Dict[str, Any]] = None,
        page_size: str = "letter",
        orientation: str = "portrait",
        margins: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue(
            "generate",
            blocks,
            fmt,
            data or {},
            page_size,
            orientation,
            margins or {},
            user_id=user_id,
        )

    def render_blocks(self, blocks, format: str = "pdf", **kwargs):
        return _render_blocks(blocks, format=format, **kwargs)
