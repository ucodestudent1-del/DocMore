"""PDF conversion engine using pypdf + Pillow + reportlab."""

import io
import os
import shutil
import subprocess
from typing import Any, Optional

from PIL import Image
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen import canvas as rl_canvas
from reportlab.lib.pagesizes import letter

from app.converters.base import ConverterEngine, ConversionResult


class PDFConverter(ConverterEngine):
    name = "pdf"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("pdf", "docx"), ("pdf", "txt"), ("pdf", "html"),
            ("pdf", "md"), ("pdf", "png"), ("pdf", "jpg"),
            ("pdf", "webp"), ("pdf", "svg"), ("pdf", "pdf"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "txt":
                return self._to_text(source_path, target_path)
            if target_ext == "html":
                return self._to_html(source_path, target_path)
            if target_ext == "md":
                return self._to_markdown(source_path, target_path)
            if target_ext in {"png", "jpg", "jpeg", "webp"}:
                return self._to_images(source_path, target_path, target_ext, options)
            if target_ext == "svg":
                return ConversionResult(
                    ok=False, error="PDF to SVG is not implemented without vector tools",
                    engine=self.name, status="not_implemented",
                )
            if target_ext == "pdf":
                return self._optimize(source_path, target_path, options)
            if target_ext == "docx":
                return ConversionResult(
                    ok=False, error="PDF to DOCX requires LibreOffice; not installed",
                    engine=self.name, status="not_implemented",
                )
            return ConversionResult(
                ok=False, error=f"Unsupported target {target_ext} for PDF engine",
                engine=self.name, status="not_implemented",
            )
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    # ---- helpers ----------------------------------------------------
    def _extract_text(self, source_path: str) -> str:
        reader = PdfReader(source_path)
        parts = []
        for page in reader.pages:
            try:
                parts.append(page.extract_text() or "")
            except Exception:
                parts.append("")
        return "\n\n".join(parts).strip()

    def _to_text(self, source_path: str, target_path: str) -> ConversionResult:
        text = self._extract_text(source_path)
        if not text.strip():
            return ConversionResult(
                ok=False, error="No extractable text (scanned image PDF?)",
                engine=self.name, status="partial",
            )
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(text)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_html(self, source_path: str, target_path: str) -> ConversionResult:
        text = self._extract_text(source_path)
        paragraphs = [p for p in text.split("\n\n") if p.strip()]
        body = "".join(f"<p>{self._escape(p)}</p>" for p in paragraphs)
        html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>Converted</title></head><body>{body}</body></html>"
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(html)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_markdown(self, source_path: str, target_path: str) -> ConversionResult:
        text = self._extract_text(source_path)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(text)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_images(self, source_path: str, target_path: str, ext: str, options: dict) -> ConversionResult:
        # Try real page rasterization via pdf2image + poppler when available.
        if shutil.which("pdftoppm"):
            try:
                import pdf2image  # type: ignore
            except Exception:
                pdf2image = None
            if pdf2image:
                try:
                    pages = pdf2image.convert_from_path(source_path, fmt=ext if ext != "jpg" else "jpeg")
                    saved = []
                    for i, page in enumerate(pages):
                        out = target_path.replace(".", f"_p{i+1}.") if i > 0 else target_path
                        page.save(out, ext.upper() if ext != "jpg" else "JPEG")
                        saved.append(out)
                    return ConversionResult(ok=True, output_path=saved[0] if saved else target_path,
                                            engine=self.name, notes=f"Rendered {len(saved)} page(s)")
                except Exception as exc:  # noqa: BLE001
                    return ConversionResult(
                        ok=False, error=f"Poppler rasterization failed: {exc}",
                        engine=self.name, status="partial",
                    )
        # Fallback: extract embedded images only (no full-page rasterization).
        reader = PdfReader(source_path)
        count = len(reader.pages)
        extracted = 0
        for i, page in enumerate(reader.pages):
            try:
                for img in page.images:
                    data = img.data
                    img_path = target_path.replace(".", f"_p{i+1}_img{extracted}.")
                    with open(img_path, "wb") as f:
                        f.write(data)
                    extracted += 1
            except Exception:
                continue
        if extracted == 0:
            return ConversionResult(
                ok=False,
                error="PDF page rasterization requires poppler/pdf2image (not installed). "
                      "No embedded images found to extract.",
                engine=self.name, status="not_implemented",
            )
        return ConversionResult(
            ok=True, output_path=target_path, engine=self.name, status="partial",
            notes=f"Extracted {embedded_images_found(reader)} embedded image(s); full-page rasterization unavailable",
        )

    def _optimize(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        reader = PdfReader(source_path)
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        # basic compression: compress content streams where possible
        try:
            for page in writer.pages:
                page.compress_content_streams()
        except Exception:
            pass
        with open(target_path, "wb") as f:
            writer.write(f)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    @staticmethod
    def _escape(s: str) -> str:
        return (s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))

    def status(self) -> str:
        return "done"


def embedded_images_found(reader) -> int:
    total = 0
    for page in reader.pages:
        try:
            total += len(page.images)
        except Exception:
            continue
    return total
