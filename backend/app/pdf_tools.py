"""PDF toolkit: merge, split, rotate, rearrange, extract, watermark, metadata, encryption."""

import io
import os
import shutil
from typing import Any, List, Optional, Tuple

from pypdf import PdfReader, PdfWriter
from pypdf.generic import NumberObject
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import letter
from PIL import Image as PILImage

from app.converters.base import ConversionResult


# ---------------------------------------------------------------------------
# Page-level operations
# ---------------------------------------------------------------------------
def merge_pdfs(inputs: List[str], output_path: str) -> ConversionResult:
    writer = PdfWriter()
    for path in inputs:
        reader = PdfReader(path)
        for page in reader.pages:
            writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def split_pdf(source_path: str, output_path: str, pages: Optional[List[int]] = None,
              ranges: Optional[str] = None) -> ConversionResult:
    """Split PDF. `pages` = 1-based page numbers to extract; `ranges` like '1-3,5'."""
    reader = PdfReader(source_path)
    total = len(reader.pages)
    selected = _parse_pages(pages, ranges, total)
    if not selected:
        return ConversionResult(ok=False, error="No pages selected", engine="pdf_tools")
    writer = PdfWriter()
    for p in selected:
        writer.add_page(reader.pages[p - 1])
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def rotate_pages(source_path: str, output_path: str, rotations: dict) -> ConversionResult:
    """rotations: {page_number: degrees} clockwise."""
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages, start=1):
        deg = rotations.get(str(i), rotations.get(i, 0))
        if deg:
            try:
                page.rotate(deg)
            except Exception:
                # pypdf rotate may not exist on all versions; skip rotation for this page
                pass
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def rearrange_pages(source_path: str, output_path: str, order: List[int]) -> ConversionResult:
    """order: list of 1-based page numbers in new order."""
    reader = PdfReader(source_path)
    total = len(reader.pages)
    for p in order:
        if p < 1 or p > total:
            return ConversionResult(ok=False, error=f"Page {p} out of range (1-{total})",
                                    engine="pdf_tools")
    writer = PdfWriter()
    for p in order:
        writer.add_page(reader.pages[p - 1])
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def extract_pages(source_path: str, output_path: str, pages: List[int]) -> ConversionResult:
    return split_pdf(source_path, output_path, pages=pages)


def delete_pages(source_path: str, output_path: str, pages: List[int]) -> ConversionResult:
    reader = PdfReader(source_path)
    total = len(reader.pages)
    remove = set(p for p in pages if 1 <= p <= total)
    writer = PdfWriter()
    for i, page in enumerate(reader.pages, start=1):
        if i in remove:
            continue
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


# ---------------------------------------------------------------------------
# Text / images / metadata
# ---------------------------------------------------------------------------
def extract_text(source_path: str, output_path: str) -> ConversionResult:
    reader = PdfReader(source_path)
    parts = []
    for page in reader.pages:
        try:
            parts.append(page.extract_text() or "")
        except Exception:
            parts.append("")
    text = "\n\n--- Page Break ---\n\n".join(p for p in parts if p.strip())
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def extract_images(source_path: str, output_dir: str) -> ConversionResult:
    os.makedirs(output_dir, exist_ok=True)
    reader = PdfReader(source_path)
    count = 0
    for i, page in enumerate(reader.pages, start=1):
        try:
            for j, img in enumerate(page.images):
                name = os.path.join(output_dir, f"page{i}_img{j+1}.bin")
                with open(name, "wb") as f:
                    f.write(img.data)
                count += 1
        except Exception:
            continue
    return ConversionResult(ok=True, output_path=output_dir, engine="pdf_tools",
                            notes=f"Extracted {count} image(s)")


def get_metadata(source_path: str) -> dict:
    reader = PdfReader(source_path)
    meta = reader.metadata or {}
    return {str(k): str(v) for k, v in meta.items()}


def set_metadata(source_path: str, output_path: str, metadata: dict) -> ConversionResult:
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    normalized = {}
    for k, v in metadata.items():
        key = str(k)
        if not key.startswith("/"):
            key = "/" + key
        normalized[key] = str(v)
    writer.add_metadata(normalized)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


# ---------------------------------------------------------------------------
# Watermarks / page numbers / headers footers
# ---------------------------------------------------------------------------
def _overlay_pdf(text: str, page_size: Tuple[float, float]) -> PdfReader:
    packet = io.BytesIO()
    c = rl_canvas.Canvas(packet, pagesize=page_size)
    c.setFont("Helvetica", 40)
    c.setFillAlpha(0.15) if hasattr(c, "setFillAlpha") else None
    c.drawCentredString(page_size[0] / 2, page_size[1] / 2, text)
    c.save()
    packet.seek(0)
    return PdfReader(packet)


def add_watermark(source_path: str, output_path: str, text: str) -> ConversionResult:
    reader = PdfReader(source_path)
    first_page = reader.pages[0]
    mediabox = first_page.mediabox
    width = float(mediabox.width)
    height = float(mediabox.height)
    overlay = _overlay_pdf(text, (width, height))
    overlay_page = overlay.pages[0]
    writer = PdfWriter()
    for page in reader.pages:
        page.merge_page(overlay_page)
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def add_page_numbers(source_path: str, output_path: str, position: str = "bottom-right") -> ConversionResult:
    reader = PdfReader(source_path)
    writer = PdfWriter()
    total = len(reader.pages)
    for i, page in enumerate(reader.pages, start=1):
        mediabox = page.mediabox
        width = float(mediabox.width)
        height = float(mediabox.height)
        packet = io.BytesIO()
        c = rl_canvas.Canvas(packet, pagesize=(width, height))
        c.setFont("Helvetica", 10)
        label = f"Page {i} of {total}"
        if position == "bottom-right":
            c.drawRightString(width - 40, 30, label)
        elif position == "bottom-center":
            c.drawCentredString(width / 2, 30, label)
        elif position == "bottom-left":
            c.drawString(40, 30, label)
        elif position == "top-right":
            c.drawRightString(width - 40, height - 30, label)
        elif position == "top-center":
            c.drawCentredString(width / 2, height - 30, label)
        else:
            c.drawString(40, height - 30, label)
        c.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def add_header_footer(source_path: str, output_path: str, header: str = "",
                      footer: str = "") -> ConversionResult:
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for page in reader.pages:
        mediabox = page.mediabox
        width = float(mediabox.width)
        height = float(mediabox.height)
        packet = io.BytesIO()
        c = rl_canvas.Canvas(packet, pagesize=(width, height))
        c.setFont("Helvetica", 9)
        if header:
            c.drawCentredString(width / 2, height - 40, header)
        if footer:
            c.drawCentredString(width / 2, 30, footer)
        c.save()
        packet.seek(0)
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


# ---------------------------------------------------------------------------
# Compress / encrypt / repair
# ---------------------------------------------------------------------------
def compress_pdf(source_path: str, output_path: str) -> ConversionResult:
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    try:
        for page in writer.pages:
            page.compress_content_streams()
    except Exception:
        pass
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def protect_pdf(source_path: str, output_path: str, password: str) -> ConversionResult:
    reader = PdfReader(source_path)
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    writer.encrypt(password)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def unlock_pdf(source_path: str, output_path: str, password: str) -> ConversionResult:
    reader = PdfReader(source_path)
    if reader.is_encrypted:
        try:
            reader.decrypt(password)
        except Exception:
            return ConversionResult(ok=False, error="Incorrect password",
                                    engine="pdf_tools")
    writer = PdfWriter()
    for page in reader.pages:
        writer.add_page(page)
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


def is_encrypted(source_path: str) -> bool:
    try:
        reader = PdfReader(source_path)
        return bool(reader.is_encrypted)
    except Exception:
        return False


def repair_pdf(source_path: str, output_path: str) -> ConversionResult:
    """Attempt repair by re-writing the document structure."""
    try:
        reader = PdfReader(source_path, strict=False)
    except Exception:
        reader = PdfReader(source_path)
    writer = PdfWriter()
    count = 0
    for page in reader.pages:
        try:
            writer.add_page(page)
            count += 1
        except Exception:
            continue
    with open(output_path, "wb") as f:
        writer.write(f)
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools",
                            notes=f"Recovered {count} page(s)")


def ocr_pdf(source_path: str, output_path: str, lang: str = "eng") -> ConversionResult:
    """OCR a scanned PDF. Requires poppler (pdftoppm) + tesseract."""
    if not shutil.which("pdftoppm"):
        return ConversionResult(
            ok=False, error="OCR requires poppler (pdftoppm) which is not installed",
            engine="pdf_tools", status="not_implemented",
        )
    try:
        import pytesseract  # type: ignore
    except Exception:
        return ConversionResult(
            ok=False, error="OCR requires pytesseract which is not installed",
            engine="pdf_tools", status="not_implemented",
        )
    if not shutil.which("tesseract"):
        return ConversionResult(
            ok=False, error="OCR requires the tesseract binary which is not installed",
            engine="pdf_tools", status="not_implemented",
        )
    try:
        import pdf2image  # type: ignore
    except Exception:
        return ConversionResult(
            ok=False, error="OCR requires pdf2image which is not installed",
            engine="pdf_tools", status="not_implemented",
        )
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas as rl_canvas
    pages = pdf2image.convert_from_path(source_path, fmt="png")
    c = rl_canvas.Canvas(output_path, pagesize=letter)
    page_w, page_h = letter
    for page_img in pages:
        text = pytesseract.image_to_string(page_img, lang=lang) or ""
        w, h = page_img.size
        scale = min(page_w / w, page_h / h)
        dw, dh = w * scale, h * scale
        c.drawImage(page_img, (page_w - dw) / 2, (page_h - dh) / 2, dw, dh)
        textobj = c.beginText(40, 40)
        textobj.setFont("Helvetica", 8)
        for line in text.split("\n")[:60]:
            textobj.textLine(line)
        c.drawText(textobj)
        c.showPage()
    c.save()
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools",
                            notes=f"OCR processed {len(pages)} page(s)")


# ---------------------------------------------------------------------------
# PDF from images (single or multiple)
# ---------------------------------------------------------------------------
def images_to_pdf(inputs: List[str], output_path: str) -> ConversionResult:
    from reportlab.lib.pagesizes import letter
    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.utils import ImageReader
    page_w, page_h = letter
    c = rl_canvas.Canvas(output_path, pagesize=letter)
    for path in inputs:
        reader = ImageReader(path)
        width, height = reader.getSize()
        scale = min(page_w / width, page_h / height)
        dw, dh = width * scale, height * scale
        c.drawImage(reader, (page_w - dw) / 2, (page_h - dh) / 2, dw, dh)
        c.showPage()
    c.save()
    return ConversionResult(ok=True, output_path=output_path, engine="pdf_tools")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _parse_pages(pages: Optional[List[int]], ranges: Optional[str], total: int) -> List[int]:
    selected = set()
    if pages:
        for p in pages:
            if 1 <= p <= total:
                selected.add(p)
    if ranges:
        for part in ranges.split(","):
            part = part.strip()
            if not part:
                continue
            if "-" in part:
                a, b = part.split("-", 1)
                try:
                    start, end = int(a), int(b)
                except ValueError:
                    continue
                for p in range(start, end + 1):
                    if 1 <= p <= total:
                        selected.add(p)
            else:
                try:
                    p = int(part)
                except ValueError:
                    continue
                if 1 <= p <= total:
                    selected.add(p)
    return sorted(selected)
