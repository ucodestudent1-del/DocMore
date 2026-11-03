"""Document generation service.

Wraps existing generation logic in app/generation.py behind a stable interface.
Adds batch generation, placeholder extraction, Prisma-backed document/output
records, and fidelity notes per export format.
"""

from __future__ import annotations

import csv
import io
import json
import re
import uuid
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.generation import (
    render_blocks as _render_blocks,
    fill_placeholders as _fill_placeholders,
    HeadingBlock, ParagraphBlock, TableBlock, ListBlock,
    ImageBlock, PageBreakBlock, HorizontalRuleBlock,
    ConversionResult,
)
from app.jobs import enqueue as _enqueue
from app.prisma_client import get_prisma


# Formats that render natively via app/generation.py
NATIVE_FORMATS = {"pdf", "docx", "odt", "html", "md", "txt"}

# Fidelity notes per format (transparency about preservation limits)
FIDELITY_NOTES: Dict[str, str] = {
    "pdf": "done",
    "docx": "done",
    "odt": "done",
    "html": "done",
    "md": "done",
    "txt": "done",
    "epub": "partial",  # DOCX repackaged as EPUB via Pandoc
}

PLACEHOLDER_PATTERN = re.compile(r"{{\s*([\w.]+)\s*}}")


class GenerationError(Exception):
    pass


class GenerationService:
    def __init__(self) -> None:
        self._block_map = {
            "heading": HeadingBlock,
            "paragraph": ParagraphBlock,
            "table": TableBlock,
            "list": ListBlock,
            "image": ImageBlock,
            "pagebreak": PageBreakBlock,
            "hr": HorizontalRuleBlock,
        }

    # ------------------------------------------------------------------ #
    # Block helpers
    # ------------------------------------------------------------------ #
    def _to_blocks(self, blocks_in: List[Dict[str, Any]]) -> List[Any]:
        blocks: List[Any] = []
        for b in blocks_in:
            btype = b.get("type")
            bdata = b.get("data", {}) or {}
            cls = self._block_map.get(btype)
            if not cls:
                raise GenerationError(f"Unknown block type {btype}")
            blocks.append(cls(**bdata))
        return blocks

    def _blocks_to_dicts(self, blocks: List[Any]) -> List[Dict[str, Any]]:
        type_by_class = {
            "HeadingBlock": "heading",
            "ParagraphBlock": "paragraph",
            "TableBlock": "table",
            "ListBlock": "list",
            "ImageBlock": "image",
            "PageBreakBlock": "pagebreak",
            "HorizontalRuleBlock": "hr",
        }
        out: List[Dict[str, Any]] = []
        for b in blocks:
            t = type_by_class.get(b.__class__.__name__, "paragraph")
            if t == "heading":
                data = {"text": getattr(b, "text", ""), "level": getattr(b, "level", 1)}
            elif t == "paragraph":
                data = {"text": getattr(b, "text", ""), "align": getattr(b, "align", "left")}
            elif t == "list":
                data = {"items": getattr(b, "items", []), "ordered": getattr(b, "ordered", False)}
            elif t == "table":
                data = {"rows": getattr(b, "rows", [])}
            elif t == "image":
                data = {"path": getattr(b, "path", ""), "width": getattr(b, "width", 4)}
            else:
                data = {}
            out.append({"type": t, "data": data})
        return out

    def extract_placeholders(self, blocks_in: List[Dict[str, Any]]) -> List[str]:
        """Extract unique {{placeholder}} keys from block definitions."""
        blocks = self._to_blocks(blocks_in)
        text_sources: List[str] = []
        for b in blocks:
            if isinstance(b, (HeadingBlock, ParagraphBlock)):
                text_sources.append(b.text)
            elif isinstance(b, ListBlock):
                text_sources.extend(b.items)
            elif isinstance(b, TableBlock):
                for row in b.rows:
                    text_sources.extend(row)
        seen: List[str] = []
        seen_set: set = set()
        for text in text_sources:
            for m in PLACEHOLDER_PATTERN.finditer(text):
                key = m.group(1)
                if key not in seen_set:
                    seen_set.add(key)
                    seen.append(key)
        return seen

    # ------------------------------------------------------------------ #
    # Single generation
    # ------------------------------------------------------------------ #
    def enqueue_generate(
        self,
        blocks: List[Dict[str, Any]],
        fmt: str,
        data: Optional[Dict[str, Any]] = None,
        page_size: str = "letter",
        orientation: str = "portrait",
        margins: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
        template_name: Optional[str] = None,
    ) -> str:
        """Enqueue a single document generation job. Returns job id."""
        fmt = fmt.lower()
        if fmt not in NATIVE_FORMATS and fmt != "epub":
            raise GenerationError(f"Unsupported export format {fmt}")
        block_dicts = self._blocks_to_dicts(self._to_blocks(blocks))
        return _enqueue(
            "generate",
            block_dicts,
            fmt,
            data or {},
            page_size,
            orientation,
            margins or {},
            user_id=user_id,
            template_name=template_name,
        )

    def render_sync(
        self,
        blocks: List[Dict[str, Any]],
        fmt: str = "pdf",
        data: Optional[Dict[str, Any]] = None,
        page_size: str = "letter",
        orientation: str = "portrait",
        margins: Optional[Dict[str, Any]] = None,
    ) -> ConversionResult:
        """Render synchronously (used by workers)."""
        fmt = fmt.lower()
        block_objs = self._to_blocks(blocks)
        if data:
            block_objs = _fill_placeholders(block_objs, data or {})
        if fmt == "epub":
            return self._render_epub(block_objs)
        return _render_blocks(block_objs, fmt=fmt, page_size=page_size,
                              orientation=orientation, margins=margins or {})

    # ------------------------------------------------------------------ #
    # EPUB via Pandoc (DOCX -> EPUB)
    # ------------------------------------------------------------------ #
    def _render_epub(self, blocks: List[Any]) -> ConversionResult:
        """Render EPUB by generating DOCX then converting via Pandoc."""
        import subprocess
        import tempfile
        import os

        try:
            subprocess.run(["pandoc", "--version"], capture_output=True, check=True)
        except (FileNotFoundError, subprocess.CalledProcessError):
            return ConversionResult(
                ok=False, error="Pandoc not installed; EPUB export unavailable",
                status="not_implemented",
            )

        with tempfile.TemporaryDirectory() as td:
            docx_path = os.path.join(td, "document.docx")
            epub_path = os.path.join(td, "document.epub")
            res = _render_blocks(blocks, fmt="docx", output_path=docx_path)
            if not res.ok:
                return res
            try:
                subprocess.run(
                    ["pandoc", docx_path, "-o", epub_path],
                    capture_output=True, check=True,
                )
            except subprocess.CalledProcessError as exc:
                return ConversionResult(
                    ok=False, error=f"Pandoc conversion failed: {exc.stderr.decode(errors='ignore')}",
                    status="partial",
                )
            with open(epub_path, "rb") as f:
                data = f.read()
            out_id = uuid.uuid4().hex
            from app.config import OUTPUT_DIR
            out_path = str(Path(OUTPUT_DIR) / f"{out_id}.epub")
            with open(out_path, "wb") as f:
                f.write(data)
            return ConversionResult(
                ok=True, output_path=out_path, engine="pandoc",
                status="partial",
                notes="EPUB produced via Pandoc from DOCX; some formatting may differ",
            )

    # ------------------------------------------------------------------ #
    # Batch generation
    # ------------------------------------------------------------------ #
    def enqueue_batch(
        self,
        template_name: str,
        rows: List[Dict[str, Any]],
        fmt: str = "pdf",
        page_size: str = "letter",
        orientation: str = "portrait",
        margins: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None,
    ) -> str:
        """Enqueue a batch generation job: one document per data row.

        Returns a single batch job id; per-document results are tracked in
        the job result JSON.
        """
        fmt = fmt.lower()
        if fmt not in NATIVE_FORMATS and fmt != "epub":
            raise GenerationError(f"Unsupported export format {fmt}")
        if not rows:
            raise GenerationError("Batch requires at least one data row")
        return _enqueue(
            "generate_batch",
            template_name,
            rows,
            fmt,
            page_size,
            orientation,
            margins or {},
            user_id=user_id,
        )

    def parse_csv_batch(self, csv_text: str) -> List[Dict[str, Any]]:
        """Parse CSV text into a list of dict rows."""
        reader = csv.DictReader(io.StringIO(csv_text))
        return [dict(row) for row in reader]

    def parse_json_batch(self, json_text: str) -> List[Dict[str, Any]]:
        """Parse JSON text (array of objects or object with 'rows' key)."""
        data = json.loads(json_text)
        if isinstance(data, dict) and "rows" in data:
            return data["rows"]
        if isinstance(data, list):
            return data
        raise GenerationError("JSON batch must be an array of objects or {rows: [...]}")

    # ------------------------------------------------------------------ #
    # Prisma-backed records
    # ------------------------------------------------------------------ #
    async def record_output(
        self,
        *,
        file_id: str,
        content: bytes,
        ext: str,
        user_id: Optional[str],
        original_name: Optional[str] = None,
        document_id: Optional[str] = None,
        job_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Persist an output file record via Prisma."""
        prisma = get_prisma()
        record = await prisma.output.create({
            "id": file_id,
            "documentId": document_id,
            "userId": user_id,
            "originalName": original_name or file_id,
            "storedName": f"{file_id}.{ext}",
            "mime": self._mime_for(ext),
            "ext": ext,
            "size": len(content),
            "storagePath": str(Path(__file__).resolve().parent.parent / "data" / "outputs" / f"{file_id}.{ext}"),
            "storageBackend": "local",
            "jobId": job_id,
        })
        return {
            "id": record.id,
            "document_id": record.documentId,
            "user_id": record.userId,
            "original_name": record.originalName,
            "stored_name": record.storedName,
            "path": record.storagePath,
            "mime": record.mime,
            "ext": record.ext,
            "size": record.size,
            "kind": "output",
        }

    def _mime_for(self, ext: str) -> str:
        return {
            "pdf": "application/pdf",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "odt": "application/vnd.oasis.opendocument.text",
            "html": "text/html",
            "md": "text/markdown",
            "txt": "text/plain",
            "epub": "application/epub+zip",
        }.get(ext.lower(), "application/octet-stream")


service = GenerationService()

__all__ = [
    "GenerationService",
    "GenerationError",
    "service",
    "NATIVE_FORMATS",
    "FIDELITY_NOTES",
]
