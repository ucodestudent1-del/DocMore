"""Background processing tasks: conversions and PDF toolkit operations."""

import os
import shutil
from typing import Optional

from app.registry import registry
from app.pdf_tools import (
    merge_pdfs, split_pdf, rotate_pages, rearrange_pages, extract_pages,
    delete_pages, add_watermark, add_page_numbers, add_header_footer,
    extract_text, extract_images, compress_pdf, protect_pdf,
    unlock_pdf, repair_pdf, images_to_pdf, ocr_pdf,
)
from app.generation import render_blocks


def _run_conversion(job_id: str, file_id: str, target: str, options: dict, user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    from pathlib import Path
    source_entry = st.get_file_entry(file_id, user_id=user_id)
    if not source_entry:
        raise FileNotFoundError(f"Source file {file_id} not found")
    source = Path(source_entry["path"])
    if not source.exists():
        raise FileNotFoundError(f"Source file {file_id} not found on disk")
    source_ext = source.suffix.lower().lstrip(".")
    out_id = os.urandom(12).hex()
    from app.config import OUTPUT_DIR
    target_path = str(Path(OUTPUT_DIR) / f"{out_id}.{target}")
    result = registry.convert(source_ext, target, str(source), target_path, options)
    if not result.ok:
        raise RuntimeError(result.error or "Conversion failed")
    with open(target_path, "rb") as f:
        data = f.read()
    # Look up the source file's original name for meaningful history display
    source_entry = st.get_file_entry(file_id, user_id=user_id)
    original_name = source_entry.get("original_name", source.stem) if source_entry else source.stem
    st.save_output(out_id, data, target, user_id=user_id, original_name=original_name)
    return out_id


def _run_pdf_tool(job_id: str, tool: str, **kwargs) -> str:
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.storage import storage as st
    out_id = os.urandom(12).hex()
    user_id = kwargs.get("user_id")

    file_id = kwargs.get("file_id")
    src = None
    if file_id:
        src_entry = st.get_file_entry(file_id, user_id=user_id)
        if not src_entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(src_entry["path"])
        if not src.exists():
            raise FileNotFoundError(f"Source file {file_id} not found on disk")
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")

    if tool == "merge":
        paths = []
        for fid in kwargs["file_ids"]:
            fid_entry = st.get_file_entry(fid, user_id=user_id)
            if not fid_entry:
                raise FileNotFoundError(f"Merge source file {fid} not found")
            p = Path(fid_entry["path"])
            if not p.exists():
                raise FileNotFoundError(f"Merge source file {fid} not found on disk")
            paths.append(str(p))
        res = merge_pdfs(paths, out_path)
    elif tool == "split":
        res = split_pdf(str(src), out_path, pages=kwargs.get("pages"), ranges=kwargs.get("ranges"))
    elif tool == "rotate":
        res = rotate_pages(str(src), out_path, kwargs["rotations"])
    elif tool == "rearrange":
        res = rearrange_pages(str(src), out_path, kwargs["order"])
    elif tool == "extract_pages":
        res = extract_pages(str(src), out_path, kwargs["pages"])
    elif tool == "delete_pages":
        res = delete_pages(str(src), out_path, kwargs["pages"])
    elif tool == "watermark":
        res = add_watermark(str(src), out_path, kwargs["text"])
    elif tool == "page_numbers":
        res = add_page_numbers(str(src), out_path, kwargs.get("position", "bottom-right"))
    elif tool == "header_footer":
        res = add_header_footer(str(src), out_path, kwargs.get("header", ""), kwargs.get("footer", ""))
    elif tool == "compress":
        res = compress_pdf(str(src), out_path)
    elif tool == "protect":
        res = protect_pdf(str(src), out_path, kwargs["password"])
    elif tool == "unlock":
        res = unlock_pdf(str(src), out_path, kwargs["password"])
    elif tool == "repair":
        res = repair_pdf(str(src), out_path)
    elif tool == "extract_text":
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.txt")
        res = extract_text(str(src), out_path)
    elif tool == "extract_images":
        out_dir = str(Path(OUTPUT_DIR) / out_id)
        res = extract_images(str(src), out_dir)
    elif tool == "images_to_pdf":
        res = images_to_pdf(kwargs["paths"], out_path)
    elif tool == "ocr":
        lang = kwargs.get("lang", "eng")
        res = ocr_pdf(str(src), out_path, lang=lang)
    else:
        raise ValueError(f"Unknown pdf tool {tool}")

    if not res.ok:
        raise RuntimeError(res.error or "PDF tool failed")

    # Determine a meaningful original name for history display
    user_id = kwargs.get("user_id")
    original_name = None
    if file_id:
        source_entry = st.get_file_entry(file_id, user_id=user_id)
        original_name = source_entry.get("original_name", src.stem) if source_entry else src.stem
    elif tool == "merge":
        original_name = "merged.pdf"
    elif tool == "images_to_pdf":
        original_name = "images_to_pdf.pdf"

    if tool in {"extract_images"}:
        zip_path = str(Path(OUTPUT_DIR) / out_id)
        shutil.make_archive(zip_path, "zip", out_dir)
        with open(f"{zip_path}.zip", "rb") as f:
            data = f.read()
        st.save_output(out_id, data, "zip", user_id=user_id, original_name=original_name or f"{out_id}.zip")
    else:
        with open(out_path, "rb") as f:
            data = f.read()
        st.save_output(out_id, data, "txt" if tool == "extract_text" else "pdf", user_id=user_id, original_name=original_name or out_id)
    return out_id


# ---- Celery task wrappers (no-op if celery unavailable) ----
try:
    from app.celery_app import celery_app

    @celery_app.task(bind=True, name="tasks.convert")
    def convert_task(self, file_id: str, target: str, options: dict, user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        return _run_conversion(self.request.id, file_id, target, options, user_id=user_id)

    @celery_app.task(bind=True, name="tasks.pdf_tool")
    def pdf_tool_task(self, tool: str, **kwargs) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        return _run_pdf_tool(self.request.id, tool, **kwargs)

    @celery_app.task(bind=True, name="tasks.generate")
    def generate_task(self, blocks: list, fmt: str, data: dict, page_size: str,
                      orientation: str, margins: dict, user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.generation import (
            HeadingBlock, ParagraphBlock, TableBlock, ListBlock,
            ImageBlock, PageBreakBlock, HorizontalRuleBlock,
        )
        BLOCK_MAP = {
            "heading": HeadingBlock, "paragraph": ParagraphBlock, "table": TableBlock,
            "list": ListBlock, "image": ImageBlock, "pagebreak": PageBreakBlock,
            "hr": HorizontalRuleBlock,
        }
        blocks_obj = [BLOCK_MAP[b["type"]](**b.get("data", {})) for b in blocks]
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{fmt}")
        res = render_blocks(blocks_obj, fmt, out_path, page_size=page_size,
                            orientation=orientation, margins=margins)
        if not res.ok:
            raise RuntimeError(res.error)
        data = open(out_path, "rb").read()
        st.save_output(out_id, data, fmt, user_id=user_id, original_name=f"generated_document.{fmt}")
        return out_id
except Exception:  # celery not importable / broker down
    convert_task = None
    pdf_tool_task = None
    generate_task = None


# ---- In-process task functions used by the job fallback ----
def convert(file_id: str, target: str, options: dict, user_id: Optional[str] = None) -> str:
    return _run_conversion(None, file_id, target, options, user_id=user_id)


def pdf_tool(tool: str, **kwargs) -> str:
    return _run_pdf_tool(None, tool, **kwargs)


def generate(blocks: list, fmt: str, data: dict, page_size: str = "letter",
             orientation: str = "portrait", margins: dict = None,
             user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.generation import (
        HeadingBlock, ParagraphBlock, TableBlock, ListBlock,
        ImageBlock, PageBreakBlock, HorizontalRuleBlock,
    )
    BLOCK_MAP = {
        "heading": HeadingBlock, "paragraph": ParagraphBlock, "table": TableBlock,
        "list": ListBlock, "image": ImageBlock, "pagebreak": PageBreakBlock,
        "hr": HorizontalRuleBlock,
    }
    blocks_obj = [BLOCK_MAP[b["type"]](**b.get("data", {})) for b in blocks]
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{fmt}")
    res = render_blocks(blocks_obj, fmt, out_path, page_size=page_size,
                        orientation=orientation, margins=margins or {})
    if not res.ok:
        raise RuntimeError(res.error)
    data = open(out_path, "rb").read()
    st.save_output(out_id, data, fmt, user_id=user_id, original_name=f"generated_document.{fmt}")
    return out_id
