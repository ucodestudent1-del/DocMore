"""Markdown conversion engine using the markdown package + python-docx."""

import os
import json
from typing import Any

import markdown as md_lib
from bs4 import BeautifulSoup

from app.converters.base import ConverterEngine, ConversionResult


class MarkdownConverter(ConverterEngine):
    name = "md"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("md", "html"), ("md", "pdf"), ("md", "docx"),
            ("md", "txt"), ("txt", "md"), ("txt", "html"),
            ("txt", "pdf"), ("txt", "docx"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "html":
                return self._md_to_html(source_path, target_path)
            if target_ext == "txt":
                return self._md_to_txt(source_path, target_path)
            if target_ext == "docx":
                return self._md_to_docx(source_path, target_path)
            if target_ext == "pdf":
                return ConversionResult(
                    ok=False, error="Markdown to PDF requires reportlab rendering (engine: generation)",
                    engine=self.name, status="not_implemented",
                )
            if source_ext == "txt" and target_ext in {"md", "html", "pdf", "docx"}:
                return self._txt_to(source_path, target_path, target_ext)
            return ConversionResult(
                ok=False, error=f"Unsupported target {target_ext}",
                engine=self.name, status="not_implemented",
            )
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    def _md_to_html(self, source_path: str, target_path: str) -> ConversionResult:
        with open(source_path, "r", encoding="utf-8") as f:
            text = f.read()
        html_body = md_lib.markdown(text, extensions=["extra", "toc"])
        html = f"<!DOCTYPE html><html><head><meta charset='utf-8'></head><body>{html_body}</body></html>"
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(html)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _md_to_txt(self, source_path: str, target_path: str) -> ConversionResult:
        with open(source_path, "r", encoding="utf-8") as f:
            text = f.read()
        html_body = md_lib.markdown(text)
        soup = BeautifulSoup(html_body, "html.parser")
        plain = soup.get_text("\n", strip=True)
        with open(target_path, "w", encoding="utf-8") as f:
            f.write(plain)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _md_to_docx(self, source_path: str, target_path: str) -> ConversionResult:
        from docx import Document
        with open(source_path, "r", encoding="utf-8") as f:
            text = f.read()
        html_body = md_lib.markdown(text, extensions=["extra"])
        soup = BeautifulSoup(html_body, "html.parser")
        doc = Document()
        for el in soup.find_all(["h1", "h2", "h3", "h4", "h5", "h6", "p"]):
            t = el.get_text(" ", strip=True)
            if not t:
                continue
            if el.name == "h1":
                doc.add_heading(t, level=1)
            elif el.name == "h2":
                doc.add_heading(t, level=2)
            elif el.name == "h3":
                doc.add_heading(t, level=3)
            else:
                doc.add_paragraph(t)
        doc.save(target_path)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _txt_to(self, source_path: str, target_path: str, target_ext: str) -> ConversionResult:
        """Handle txt-based conversions. A .txt file is valid markdown as-is."""
        try:
            with open(source_path, "r", encoding="utf-8", errors="replace") as f:
                text = f.read()
        except Exception:
            text = ""
        if target_ext == "md":
            with open(target_path, "w", encoding="utf-8") as f:
                f.write(text)
            return ConversionResult(ok=True, output_path=target_path, engine=self.name)
        return ConversionResult(ok=False, error=f"txt to {target_ext} not supported",
                                engine=self.name, status="not_implemented")

    def status(self) -> str:
        return "done"
