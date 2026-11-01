"""Presentation (PPTX) conversion engine using python-pptx."""

import os
from typing import Any

from pptx import Presentation
from pptx.util import Inches

from app.converters.base import ConverterEngine, ConversionResult


class PptxConverter(ConverterEngine):
    name = "pptx"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("pptx", "pdf"), ("pptx", "pptx"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "pptx":
                prs = Presentation(source_path)
                prs.save(target_path)
                return ConversionResult(ok=True, output_path=target_path, engine=self.name)
            if target_ext == "pdf":
                return self._to_pdf_libreoffice(source_path, target_path)
            return ConversionResult(
                ok=False, error=f"Unsupported target {target_ext}",
                engine=self.name, status="not_implemented",
            )
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    def _to_pdf_libreoffice(self, source_path: str, target_path: str) -> ConversionResult:
        import subprocess, shutil
        soffice = shutil.which("soffice") or shutil.which("libreoffice")
        if not soffice:
            return ConversionResult(
                ok=False, error="PPTX to PDF requires LibreOffice (soffice) which is not installed",
                engine=self.name, status="not_implemented",
            )
        out_dir = os.path.dirname(target_path) or "."
        try:
            subprocess.run(
                [soffice, "--headless", "--convert-to", "pdf", "--outdir", out_dir, source_path],
                check=True, capture_output=True, timeout=120,
            )
        except subprocess.CalledProcessError as exc:
            return ConversionResult(
                ok=False, error=f"LibreOffice failed: {exc.stderr.decode(errors='replace')[:500] if exc.stderr else exc}",
                engine=self.name, status="partial",
            )
        except subprocess.TimeoutExpired:
            return ConversionResult(
                ok=False, error="LibreOffice conversion timed out",
                engine=self.name, status="partial",
            )
        produced = os.path.join(out_dir, os.path.splitext(os.path.basename(source_path))[0] + ".pdf")
        if not os.path.exists(produced):
            return ConversionResult(
                ok=False, error="LibreOffice did not produce a PDF",
                engine=self.name, status="partial",
            )
        if produced != target_path:
            os.replace(produced, target_path)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def status(self) -> str:
        return "done"
