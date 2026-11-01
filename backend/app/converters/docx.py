"""Word (DOCX/DOC) conversion engine using python-docx."""

import os
from typing import Any

from docx import Document
from docx.text.paragraph import Paragraph

from app.converters.base import ConverterEngine, ConversionResult


class DocxConverter(ConverterEngine):
    name = "docx"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("docx", "pdf"), ("docx", "txt"), ("docx", "md"),
            ("docx", "html"), ("docx", "docx"),
            ("doc", "txt"), ("doc", "docx"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "docx":
                return self._copy(source_path, target_path)
            if target_ext == "txt":
                return self._to_text(source_path, target_path)
            if target_ext == "md":
                return self._to_markdown(source_path, target_path)
            if target_ext == "html":
                return self._to_html(source_path, target_path)
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
                ok=False, error="DOCX to PDF requires LibreOffice (soffice) which is not installed",
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

    def _read(self, source_path: str) -> Document:
        # Legacy .doc (OLE2) is not natively readable by python-docx. Attempt anyway;
        # python-docx will raise a clear error which we surface as partial support.
        return Document(source_path)

    def _copy(self, source_path: str, target_path: str) -> ConversionResult:
        doc = self._read(source_path)
        doc.save(target_path)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_text(self, source_path: str, target_path: str) -> ConversionResult:
        doc = self._read(source_path)
        parts = [p.text for p in doc.paragraphs if p.text.strip()]
        for table in doc.tables:
            for row in table.rows:
                parts.append(" | ".join(cell.text for cell in row.cells))
        text = "\n".join(parts)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(text)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_markdown(self, source_path: str, target_path: str) -> ConversionResult:
        doc = self._read(source_path)
        lines = []
        for p in doc.paragraphs:
            style = p.style.name.lower() if p.style else ""
            text = p.text
            if not text:
                continue
            if "heading 1" in style:
                lines.append(f"# {text}")
            elif "heading 2" in style:
                lines.append(f"## {text}")
            elif "heading 3" in style:
                lines.append(f"### {text}")
            else:
                lines.append(text)
        for table in doc.tables:
            lines.append(self._table_to_md(table))
        with open(target_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_html(self, source_path: str, target_path: str) -> ConversionResult:
        doc = self._read(source_path)
        blocks = []
        for p in doc.paragraphs:
            text = self._escape(p.text)
            if not text:
                continue
            blocks.append(f"<p>{text}</p>")
        for table in doc.tables:
            blocks.append(self._table_to_html(table))
        html = f"<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>{''.join(blocks)}</body></html>"
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(html)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    # ---- helpers ----------------------------------------------------
    @staticmethod
    def _table_to_md(table) -> str:
        rows = []
        for i, row in enumerate(table.rows):
            cells = [cell.text.replace("|", "\\|") for cell in row.cells]
            rows.append("| " + " | ".join(cells) + " |")
            if i == 0:
                rows.append("| " + " | ".join("---" for _ in cells) + " |")
        return "\n".join(rows)

    @staticmethod
    def _table_to_html(table) -> str:
        html = ["<table border='1' cellpadding='4'>"]
        for row in table.rows:
            html.append("<tr>")
            for cell in row.cells:
                html.append(f"<td>{DocxConverter._escape(cell.text)}</td>")
            html.append("</tr>")
        html.append("</table>")
        return "\n".join(html)

    @staticmethod
    def _escape(s: str) -> str:
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    def status(self) -> str:
        return "done"
