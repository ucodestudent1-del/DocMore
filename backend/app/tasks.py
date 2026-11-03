"""Background processing tasks: conversions and PDF toolkit operations."""

import os
import shutil
import asyncio
from typing import Optional

from app.registry import registry
from app.pdf_tools import (
    merge_pdfs, split_pdf, rotate_pages, rearrange_pages, extract_pages,
    delete_pages, add_watermark, add_page_numbers, add_header_footer,
    extract_text, extract_images, compress_pdf, protect_pdf,
    unlock_pdf, repair_pdf, images_to_pdf, ocr_pdf,
)


def _run_async(coro):
    """Run an async coroutine synchronously (used by background task workers)."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(asyncio.run, coro)
                return future.result()
        return asyncio.run(coro)
    except RuntimeError:
        return asyncio.run(coro)


def _run_conversion(job_id: str, file_id: str, target: str, options: dict, user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    from pathlib import Path
    source_entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
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
    source_entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
    original_name = source_entry.get("original_name", source.stem) if source_entry else source.stem
    _run_async(st.save_output(out_id, data, target, user_id=user_id, original_name=original_name))
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
        src_entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
        if not src_entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(src_entry["path"])
        if not src.exists():
            raise FileNotFoundError(f"Source file {file_id} not found on disk")
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")

    if tool == "merge":
        paths = []
        for fid in kwargs["file_ids"]:
            fid_entry = _run_async(st.get_file_entry(fid, user_id=user_id))
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
        source_entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
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
        _run_async(st.save_output(out_id, data, "zip", user_id=user_id, original_name=original_name or f"{out_id}.zip"))
    else:
        with open(out_path, "rb") as f:
            data = f.read()
        _run_async(st.save_output(out_id, data, "txt" if tool == "extract_text" else "pdf", user_id=user_id, original_name=original_name or out_id))
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
                      orientation: str, margins: dict, user_id: Optional[str] = None,
                      template_name: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from app.services.generation_service import service as gen_service
        from app.generation import fill_placeholders, TEMPLATES as GEN_TEMPLATES
        if template_name and not blocks:
            tpl = GEN_TEMPLATES.get(template_name)
            if not tpl:
                raise ValueError(f"Template {template_name} not found")
            blocks = [{"type": b["type"], "data": b["data"]} for b in tpl]
        blocks_obj = gen_service._to_blocks(blocks)
        if data:
            blocks_obj = fill_placeholders(blocks_obj, data or {})
        block_dicts = gen_service._blocks_to_dicts(blocks_obj)
        out_id = secrets.token_urlsafe(16)
        res = gen_service.render_sync(block_dicts, fmt=fmt, page_size=page_size,
                                      orientation=orientation, margins=margins or {})
        if not res.ok:
            raise RuntimeError(res.error or "Generation failed")
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        original_name = f"generated_document.{fmt}"
        if template_name:
            original_name = f"{template_name}.{fmt}"
        _run_async(st.save_output(out_id, file_data, fmt, user_id=user_id,
                                  original_name=original_name))
        return out_id

    @celery_app.task(bind=True, name="tasks.generate_batch")
    def generate_batch_task(self, template_name: str, rows: list, fmt: str,
                            page_size: str, orientation: str, margins: dict,
                            user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 0})
        from app.storage import storage as st
        import secrets
        from app.services.generation_service import service as gen_service
        from app.generation import fill_placeholders, TEMPLATES as GEN_TEMPLATES
        # Load template blocks
        tpl_blocks = GEN_TEMPLATES.get(template_name)
        if not tpl_blocks:
            raise ValueError(f"Template {template_name} not found")
        results = []
        total = len(rows)
        for i, row in enumerate(rows):
            blocks_obj = gen_service._to_blocks(tpl_blocks)
            blocks_obj = fill_placeholders(blocks_obj, row)
            block_dicts = gen_service._blocks_to_dicts(blocks_obj)
            out_id = secrets.token_urlsafe(16)
            res = gen_service.render_sync(block_dicts, fmt=fmt, page_size=page_size,
                                          orientation=orientation, margins=margins or {})
            if not res.ok:
                results.append({"row": i, "error": res.error})
                continue
            with open(res.output_path, "rb") as f:
                file_data = f.read()
            original_name = f"{template_name}_{i+1}.{fmt}"
            saved = _run_async(st.save_output(out_id, file_data, fmt, user_id=user_id,
                                              original_name=original_name))
            results.append({"row": i, "output_id": out_id, "name": saved.get("original_name")})
            progress = int((i + 1) / total * 100)
            self.update_state(state="STARTED", meta={"progress": progress})
        return {"format": fmt, "template": template_name, "total": total, "results": results}

    @celery_app.task(bind=True, name="tasks.image_convert")
    def image_convert_task(self, file_id: str, target_format: str, quality: int,
                           user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.image_tools import convert_image
        entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
        if not entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(entry["path"])
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{target_format}")
        res = convert_image(str(src), out_path, target_format, quality=quality)
        if not res.ok:
            raise RuntimeError(res.error or "Image conversion failed")
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        _run_async(st.save_output(out_id, file_data, target_format, user_id=user_id,
                                  original_name=f"{src.stem}.{target_format}"))
        return out_id

    @celery_app.task(bind=True, name="tasks.image_resize")
    def image_resize_task(self, file_id: str, width: Optional[int], height: Optional[int],
                          fit: str, quality: int, user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.image_tools import resize_image
        entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
        if not entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(entry["path"])
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
        res = resize_image(str(src), out_path, width=width, height=height, fit=fit, quality=quality)
        if not res.ok:
            raise RuntimeError(res.error or "Image resize failed")
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                                  original_name=f"{src.stem}_resized{src.suffix}"))
        return out_id

    @celery_app.task(bind=True, name="tasks.image_compress")
    def image_compress_task(self, file_id: str, quality: int,
                            user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.image_tools import compress_image
        entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
        if not entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(entry["path"])
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
        res = compress_image(str(src), out_path, quality=quality)
        if not res.ok:
            raise RuntimeError(res.error or "Image compress failed")
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                                  original_name=f"{src.stem}_compressed{src.suffix}"))
        return out_id

    @celery_app.task(bind=True, name="tasks.image_rotate")
    def image_rotate_task(self, file_id: str, degrees: int, expand: bool, quality: int,
                          user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.image_tools import rotate_image
        entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
        if not entry:
            raise FileNotFoundError(f"Source file {file_id} not found")
        src = Path(entry["path"])
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
        res = rotate_image(str(src), out_path, degrees=degrees, expand=expand, quality=quality)
        if not res.ok:
            raise RuntimeError(res.error or "Image rotate failed")
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                                  original_name=f"{src.stem}_rotated{src.suffix}"))
        return out_id

    @celery_app.task(bind=True, name="tasks.image_to_pdf")
    def image_to_pdf_task(self, file_ids: list, page_size: str, quality: int,
                          user_id: Optional[str] = None) -> str:
        self.update_state(state="STARTED", meta={"progress": 10})
        from app.storage import storage as st
        import secrets
        from pathlib import Path
        from app.config import OUTPUT_DIR
        from app.image_tools import images_to_pdf
        paths = []
        names = []
        for fid in file_ids:
            entry = _run_async(st.get_file_entry(fid, user_id=user_id))
            if not entry:
                raise FileNotFoundError(f"Source file {fid} not found")
            paths.append(entry["path"])
            names.append(Path(entry["path"]).stem)
        out_id = secrets.token_urlsafe(16)
        out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")
        res = images_to_pdf(paths, out_path, page_size=page_size, quality=quality)
        if not res.ok:
            raise RuntimeError(res.error or "Images to PDF failed")
        with open(out_path, "rb") as f:
            file_data = f.read()
        _run_async(st.save_output(out_id, file_data, "pdf", user_id=user_id,
                                  original_name=f"images_{'_'.join(names[:3])}.pdf"))
        return out_id
except Exception:  # celery not importable / broker down
    convert_task = None
    pdf_tool_task = None
    generate_task = None
    generate_batch_task = None
    image_convert_task = None
    image_resize_task = None
    image_compress_task = None
    image_rotate_task = None
    image_to_pdf_task = None


# ---- In-process task functions used by the job fallback ----
def convert(file_id: str, target: str, options: dict, user_id: Optional[str] = None) -> str:
    return _run_conversion(None, file_id, target, options, user_id=user_id)


def pdf_tool(tool: str, **kwargs) -> str:
    return _run_pdf_tool(None, tool, **kwargs)


def generate(blocks: list, fmt: str, data: dict, page_size: str = "letter",
             orientation: str = "portrait", margins: dict = None,
             user_id: Optional[str] = None,
             template_name: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from app.services.generation_service import service as gen_service
    from app.generation import fill_placeholders, TEMPLATES as GEN_TEMPLATES
    if template_name and not blocks:
        tpl = GEN_TEMPLATES.get(template_name)
        if not tpl:
            raise ValueError(f"Template {template_name} not found")
        blocks = [{"type": b["type"], "data": b["data"]} for b in tpl]
    blocks_obj = gen_service._to_blocks(blocks)
    if data:
        blocks_obj = fill_placeholders(blocks_obj, data or {})
    block_dicts = gen_service._blocks_to_dicts(blocks_obj)
    out_id = secrets.token_urlsafe(16)
    res = gen_service.render_sync(block_dicts, fmt=fmt, page_size=page_size,
                                  orientation=orientation, margins=margins or {})
    if not res.ok:
        raise RuntimeError(res.error or "Generation failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    original_name = f"generated_document.{fmt}"
    if template_name:
        original_name = f"{template_name}.{fmt}"
    _run_async(st.save_output(out_id, file_data, fmt, user_id=user_id,
                              original_name=original_name))
    return out_id


def generate_batch(template_name: str, rows: list, fmt: str,
                   page_size: str = "letter", orientation: str = "portrait",
                   margins: dict = None, user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from app.services.generation_service import service as gen_service
    from app.generation import fill_placeholders, TEMPLATES as GEN_TEMPLATES
    tpl_blocks = GEN_TEMPLATES.get(template_name)
    if not tpl_blocks:
        raise ValueError(f"Template {template_name} not found")
    results = []
    total = len(rows)
    for i, row in enumerate(rows):
        blocks_obj = gen_service._to_blocks(tpl_blocks)
        blocks_obj = fill_placeholders(blocks_obj, row)
        block_dicts = gen_service._blocks_to_dicts(blocks_obj)
        out_id = secrets.token_urlsafe(16)
        res = gen_service.render_sync(block_dicts, fmt=fmt, page_size=page_size,
                                      orientation=orientation, margins=margins or {})
        if not res.ok:
            results.append({"row": i, "error": res.error})
            continue
        with open(res.output_path, "rb") as f:
            file_data = f.read()
        original_name = f"{template_name}_{i+1}.{fmt}"
        saved = _run_async(st.save_output(out_id, file_data, fmt, user_id=user_id,
                                          original_name=original_name))
        results.append({"row": i, "output_id": out_id, "name": saved.get("original_name")})
    return {"format": fmt, "template": template_name, "total": total, "results": results}


def image_convert(file_id: str, target_format: str, quality: int,
                  user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.image_tools import convert_image
    entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
    if not entry:
        raise FileNotFoundError(f"Source file {file_id} not found")
    src = Path(entry["path"])
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{target_format}")
    res = convert_image(str(src), out_path, target_format, quality=quality)
    if not res.ok:
        raise RuntimeError(res.error or "Image conversion failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    _run_async(st.save_output(out_id, file_data, target_format, user_id=user_id,
                              original_name=f"{src.stem}.{target_format}"))
    return out_id


def image_resize(file_id: str, width: Optional[int], height: Optional[int],
                 fit: str, quality: int, user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.image_tools import resize_image
    entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
    if not entry:
        raise FileNotFoundError(f"Source file {file_id} not found")
    src = Path(entry["path"])
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
    res = resize_image(str(src), out_path, width=width, height=height, fit=fit, quality=quality)
    if not res.ok:
        raise RuntimeError(res.error or "Image resize failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                              original_name=f"{src.stem}_resized{src.suffix}"))
    return out_id


def image_compress(file_id: str, quality: int,
                   user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.image_tools import compress_image
    entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
    if not entry:
        raise FileNotFoundError(f"Source file {file_id} not found")
    src = Path(entry["path"])
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
    res = compress_image(str(src), out_path, quality=quality)
    if not res.ok:
        raise RuntimeError(res.error or "Image compress failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                              original_name=f"{src.stem}_compressed{src.suffix}"))
    return out_id


def image_rotate(file_id: str, degrees: int, expand: bool, quality: int,
                 user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.image_tools import rotate_image
    entry = _run_async(st.get_file_entry(file_id, user_id=user_id))
    if not entry:
        raise FileNotFoundError(f"Source file {file_id} not found")
    src = Path(entry["path"])
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.{src.suffix.lstrip('.') or 'png'}")
    res = rotate_image(str(src), out_path, degrees=degrees, expand=expand, quality=quality)
    if not res.ok:
        raise RuntimeError(res.error or "Image rotate failed")
    with open(res.output_path, "rb") as f:
        file_data = f.read()
    _run_async(st.save_output(out_id, file_data, src.suffix.lstrip(".") or "png", user_id=user_id,
                              original_name=f"{src.stem}_rotated{src.suffix}"))
    return out_id


def image_to_pdf(file_ids: list, page_size: str, quality: int,
                 user_id: Optional[str] = None) -> str:
    from app.storage import storage as st
    import secrets
    from pathlib import Path
    from app.config import OUTPUT_DIR
    from app.image_tools import images_to_pdf
    paths = []
    names = []
    for fid in file_ids:
        entry = _run_async(st.get_file_entry(fid, user_id=user_id))
        if not entry:
            raise FileNotFoundError(f"Source file {fid} not found")
        paths.append(entry["path"])
        names.append(Path(entry["path"]).stem)
    out_id = secrets.token_urlsafe(16)
    out_path = str(Path(OUTPUT_DIR) / f"{out_id}.pdf")
    res = images_to_pdf(paths, out_path, page_size=page_size, quality=quality)
    if not res.ok:
        raise RuntimeError(res.error or "Images to PDF failed")
    with open(out_path, "rb") as f:
        file_data = f.read()
    _run_async(st.save_output(out_id, file_data, "pdf", user_id=user_id,
                              original_name=f"images_{'_'.join(names[:3])}.pdf"))
    return out_id
