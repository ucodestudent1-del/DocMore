"""HTML conversion engine using beautifulsoup4 and reportlab."""

import os
from typing import Any

from bs4 import BeautifulSoup

from app.converters.base import ConverterEngine, ConversionResult


class HtmlConverter(ConverterEngine):
    name = "html"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("html", "md"), ("html", "txt"), ("html", "pdf"),
            ("txt", "html"), ("txt", "pdf"), ("md", "html"),
            ("json", "csv"), ("json", "xlsx"), ("xml", "json"), ("csv", "json"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        source_ext = os.path.splitext(source_path)[1].lower().lstrip(".")
        try:
            if target_ext == "md":
                return self._html_to_md(source_path, target_path)
            if target_ext == "txt":
                return self._html_to_txt(source_path, target_path)
            if target_ext == "pdf":
                if source_ext == "txt":
                    return self._txt_to_pdf(source_path, target_path)
                # HTML -> PDF: extract text blocks and render via reportlab
                return self._html_to_pdf(source_path, target_path)
            if target_ext == "html":
                return self._copy(source_path, target_path)
            if target_ext in {"csv", "xlsx", "json"}:
                return self._structured(source_path, target_path, target_ext)
            return ConversionResult(
                ok=False, error=f"Unsupported target {target_ext}",
                engine=self.name, status="not_implemented",
            )
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    def _copy(self, source_path: str, target_path: str) -> ConversionResult:
        with open(source_path, "rb") as f:
            data = f.read()
        with open(target_path, "wb") as f:
            f.write(data)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _html_to_md(self, source_path: str, target_path: str) -> ConversionResult:
        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            soup = BeautifulSoup(f, "html.parser")
        # Remove scripts/styles
        for tag in soup(["script", "style"]):
            tag.decompose()
        lines = []
        for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
            text = el.get_text(" ", strip=True)
            if not text:
                continue
            level = int(el.name[1]) if el.name.startswith("h") else None
            if level == 1:
                lines.append(f"# {text}")
            elif level == 2:
                lines.append(f"## {text}")
            elif level == 3:
                lines.append(f"### {text}")
            elif el.name == "li":
                lines.append(f"- {text}")
            else:
                lines.append(text)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _html_to_txt(self, source_path: str, target_path: str) -> ConversionResult:
        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            soup = BeautifulSoup(f, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()
        text = soup.get_text("\n", strip=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(text)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _html_to_pdf(self, source_path: str, target_path: str) -> ConversionResult:
        """Render HTML to PDF using reportlab."""
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            soup = BeautifulSoup(f, "html.parser")
        for tag in soup(["script", "style"]):
            tag.decompose()

        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(target_path, pagesize=letter)
        story = []

        for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p", "li"]):
            text = el.get_text(" ", strip=True)
            if not text:
                continue
            if el.name.startswith("h"):
                level = int(el.name[1])
                style_name = f"Heading{min(level, 4)}"
                story.append(Paragraph(text, styles[style_name]))
            elif el.name == "li":
                story.append(Paragraph(f"• {text}", styles["Normal"]))
            else:
                story.append(Paragraph(text, styles["Normal"]))
            story.append(Spacer(1, 6))

        doc.build(story)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _txt_to_pdf(self, source_path: str, target_path: str) -> ConversionResult:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet
        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
        styles = getSampleStyleSheet()
        doc = SimpleDocTemplate(target_path, pagesize=letter)
        story = []
        for para in text.split("\n"):
            story.append(Paragraph(para, styles["Normal"]))
            story.append(Spacer(1, 4))
        doc.build(story)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _structured(self, source_path: str, target_path: str, ext: str) -> ConversionResult:
        import json
        import csv
        with open(source_path, "r", encoding="utf-8", errors="replace") as f:
            data = json.load(f)
        if ext == "json":
            with open(target_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
            return ConversionResult(ok=True, output_path=target_path, engine=self.name)
        if ext == "csv":
            rows = self._flatten_to_rows(data)
            with open(target_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerows(rows)
            return ConversionResult(ok=True, output_path=target_path, engine=self.name)
        if ext == "xlsx":
            from openpyxl import Workbook
            wb = Workbook()
            ws = wb.active
            rows = self._flatten_to_rows(data)
            for row in rows:
                ws.append(row)
            wb.save(target_path)
            return ConversionResult(ok=True, output_path=target_path, engine=self.name)
        return ConversionResult(ok=False, error=f"Unsupported {ext}", engine=self.name)

    @staticmethod
    def _flatten_to_rows(data: Any) -> list:
        if isinstance(data, list) and data and all(isinstance(r, dict) for r in data):
            header = list(data[0].keys())
            rows = [header]
            for r in data:
                rows.append([r.get(h, "") for h in header])
            return rows
        if isinstance(data, dict):
            rows = [["key", "value"]]
            for k, v in data.items():
                rows.append([k, json.dumps(v) if not isinstance(v, (str, int, float, bool)) or v is None else v])
            return rows
        return [["value"], [json.dumps(data)]]

    def status(self) -> str:
        return "done"
