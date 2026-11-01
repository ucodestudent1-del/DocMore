"""API routes: document comparison (diff two PDFs/DOCXs)."""

import difflib
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Depends
from pydantic import BaseModel

from app.storage import storage
from app.api.routes.auth import get_current_user

router = APIRouter(tags=["compare"])


class DiffResult(BaseModel):
    file1: dict
    file2: dict
    added: int
    removed: int
    unchanged: int
    diff: list


def _extract_text_from_pdf(file_path: Path) -> str:
    from pypdf import PdfReader
    reader = PdfReader(str(file_path))
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    return "\n".join(parts)


def _extract_text_from_docx(file_path: Path) -> str:
    from docx import Document
    doc = Document(str(file_path))
    parts = []
    for p in doc.paragraphs:
        if p.text:
            parts.append(p.text)
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text:
                    parts.append(cell.text)
    return "\n".join(parts)


def _extract_text_from_file(file_path: Path, ext: str) -> str:
    ext = ext.lower().lstrip(".")
    if ext == "pdf":
        return _extract_text_from_pdf(file_path)
    elif ext in {"docx", "doc"}:
        return _extract_text_from_docx(file_path)
    elif ext in {"txt", "md", "html", "htm", "csv", "json", "xml", "rtf"}:
        try:
            return file_path.read_text(encoding="utf-8", errors="replace")
        except Exception:
            return ""
    else:
        return ""


def _compute_diff(text1: str, text2: str) -> dict:
    lines1 = text1.splitlines()
    lines2 = text2.splitlines()
    diff = list(difflib.unified_diff(lines1, lines2, lineterm=""))

    added = sum(1 for line in diff if line.startswith("+") and not line.startswith("+++ "))
    removed = sum(1 for line in diff if line.startswith("-") and not line.startswith("--- "))
    unchanged = sum(1 for line in diff if line.startswith(" ") and not line.startswith("  "))

    return {
        "added": added,
        "removed": removed,
        "unchanged": unchanged,
        "diff": diff,
    }


@router.post("/compare")
async def compare_documents(
    file1: UploadFile = File(...),
    file2: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    content1 = await file1.read()
    content2 = await file2.read()

    entry1 = storage.save_upload(content1, file1.filename or "file1",
                                 user_id=current_user["username"])
    entry2 = storage.save_upload(content2, file2.filename or "file2",
                                 user_id=current_user["username"])

    path1 = Path(entry1["path"])
    path2 = Path(entry2["path"])

    text1 = _extract_text_from_file(path1, entry1["ext"])
    text2 = _extract_text_from_file(path2, entry2["ext"])

    if not text1 and not text2:
        raise HTTPException(
            status_code=400,
            detail="Could not extract text from either file",
        )

    result = _compute_diff(text1, text2)

    return {
        "file1": {
            "id": entry1["id"],
            "name": entry1["original_name"],
            "ext": entry1["ext"],
        },
        "file2": {
            "id": entry2["id"],
            "name": entry2["original_name"],
            "ext": entry2["ext"],
        },
        "diff": result,
    }
