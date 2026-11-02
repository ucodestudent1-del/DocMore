"""PDF toolkit service skeleton.

Wraps existing PDF processing in app/pdf_tools.py behind a stable interface.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from app.jobs import enqueue as _enqueue


class PdfService:
    def enqueue_pdf_tool(
        self,
        tool: str,
        file_id: str,
        user_id: Optional[str] = None,
        **kwargs,
    ) -> str:
        return _enqueue("pdf_tool", tool, file_id=file_id, user_id=user_id, **kwargs)

    def enqueue_merge(
        self,
        file_ids: list,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue("pdf_tool", "merge", file_ids=file_ids, user_id=user_id)

    def enqueue_split(
        self,
        file_id: str,
        user_id: Optional[str] = None,
        pages: Optional[list] = None,
        ranges: Optional[str] = None,
    ) -> str:
        return _enqueue(
            "pdf_tool", "split", file_id=file_id, pages=pages, ranges=ranges, user_id=user_id
        )

    def enqueue_protect(
        self,
        file_id: str,
        password: str,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue(
            "pdf_tool", "protect", file_id=file_id, password=password, user_id=user_id
        )

    def enqueue_unlock(
        self,
        file_id: str,
        password: str,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue(
            "pdf_tool", "unlock", file_id=file_id, password=password, user_id=user_id
        )

    def enqueue_ocr(
        self,
        file_id: str,
        lang: str = "eng",
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue("pdf_tool", "ocr", file_id=file_id, lang=lang, user_id=user_id)

    def enqueue_compress(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue("pdf_tool", "compress", file_id=file_id, user_id=user_id)

    def enqueue_repair(
        self,
        file_id: str,
        user_id: Optional[str] = None,
    ) -> str:
        return _enqueue("pdf_tool", "repair", file_id=file_id, user_id=user_id)
