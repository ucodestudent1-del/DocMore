"""Document generation studio: build documents from rich content blocks.

Supports export to PDF, DOCX, ODT, HTML, Markdown, TXT.
"""

import os
import zipfile
from typing import Any, List, Optional

from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.units import inch
from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer, Table,
                                TableStyle, PageBreak, Image as RLImage)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT, TA_JUSTIFY
from reportlab.platypus.flowables import Flowable

from app.converters.base import ConversionResult

PAGE_SIZES = {"letter": letter, "A4": A4}
ALIGN_MAP = {"left": TA_LEFT, "center": TA_CENTER, "right": TA_RIGHT, "justify": TA_JUSTIFY}


class Block:
    pass


class HeadingBlock(Block):
    def __init__(self, text: str, level: int = 1) -> None:
        self.text = text
        self.level = level


class ParagraphBlock(Block):
    def __init__(self, text: str, align: str = "left") -> None:
        self.text = text
        self.align = align


class TableBlock(Block):
    def __init__(self, rows: List[List[str]]) -> None:
        self.rows = rows


class ListBlock(Block):
    def __init__(self, items: List[str], ordered: bool = False) -> None:
        self.items = items
        self.ordered = ordered


class ImageBlock(Block):
    def __init__(self, path: str, width: Optional[float] = None) -> None:
        self.path = path
        self.width = width


class PageBreakBlock(Block):
    pass


class HorizontalRuleBlock(Block):
    pass


def render_blocks(blocks: List[Block], fmt: str, output_path: str,
                  page_size: str = "letter", orientation: str = "portrait",
                  margins: Optional[dict] = None) -> ConversionResult:
    """Render a list of blocks to the requested format."""
    try:
        if fmt == "pdf":
            return _render_pdf(blocks, output_path, page_size, orientation, margins)
        if fmt == "docx":
            return _render_docx(blocks, output_path)
        if fmt == "odt":
            return _render_odt(blocks, output_path)
        if fmt == "html":
            return _render_html(blocks, output_path)
        if fmt == "md":
            return _render_md(blocks, output_path)
        if fmt == "txt":
            return _render_txt(blocks, output_path)
        return ConversionResult(ok=False, error=f"Unsupported export format {fmt}")
    except Exception as exc:  # noqa: BLE001
        return ConversionResult(ok=False, error=str(exc))


class HRFlowable(Flowable):
    def __init__(self, width: float = 400, height: float = 1) -> None:
        super().__init__()
        self.width = width
        self.height = height

    def draw(self) -> None:
        self.canv.setStrokeColor(colors.grey)
        self.canv.setLineWidth(0.5)
        self.canv.line(0, 0, self.width, 0)


# ---------------------------------------------------------------------------
# PDF (reportlab)
# ---------------------------------------------------------------------------
def _render_pdf(blocks: List[Block], output_path: str, page_size: str,
                orientation: str, margins: Optional[dict]) -> ConversionResult:
    psize = PAGE_SIZES.get(page_size, letter)
    if orientation == "landscape":
        psize = (psize[1], psize[0])
    m = margins or {}
    left = m.get("left", 0.75) * inch
    right = m.get("right", 0.75) * inch
    top = m.get("top", 0.75) * inch
    bottom = m.get("bottom", 0.75) * inch

    styles = getSampleStyleSheet()
    story = []
    for block in blocks:
        if isinstance(block, HeadingBlock):
            style = styles[f"Heading{min(block.level, 4)}"]
            story.append(Paragraph(block.text, style))
            story.append(Spacer(1, 8))
        elif isinstance(block, ParagraphBlock):
            pstyle = ParagraphStyle("p", parent=styles["Normal"],
                                    alignment=ALIGN_MAP.get(block.align, TA_LEFT))
            story.append(Paragraph(block.text, pstyle))
            story.append(Spacer(1, 6))
        elif isinstance(block, ListBlock):
            list_style = ParagraphStyle("li", parent=styles["Normal"],
                                        leftIndent=18, bulletIndent=6)
            for item in block.items:
                marker = "1." if block.ordered else "•"
                story.append(Paragraph(f"{marker} {item}", list_style))
            story.append(Spacer(1, 6))
        elif isinstance(block, TableBlock):
            table = Table(block.rows)
            table.setStyle(TableStyle([
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("BACKGROUND", (0, 0), (-1, 0), colors.lightgrey),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING", (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            story.append(table)
            story.append(Spacer(1, 10))
        elif isinstance(block, ImageBlock):
            if block.path and os.path.exists(block.path):
                img = RLImage(block.path)
                if block.width:
                    aspect = img.imageHeight / img.imageWidth
                    img.drawWidth = block.width * inch
                    img.drawHeight = img.drawWidth * aspect
                story.append(img)
                story.append(Spacer(1, 8))
        elif isinstance(block, PageBreakBlock):
            story.append(PageBreak())
        elif isinstance(block, HorizontalRuleBlock):
            story.append(HRFlowable())

    doc = SimpleDocTemplate(output_path, pagesize=psize,
                            leftMargin=left, rightMargin=right,
                            topMargin=top, bottomMargin=bottom)
    doc.build(story)
    return ConversionResult(ok=True, output_path=output_path, engine="generation")


# ---------------------------------------------------------------------------
# DOCX
# ---------------------------------------------------------------------------
def _render_docx(blocks: List[Block], output_path: str) -> ConversionResult:
    doc = Document()
    for block in blocks:
        if isinstance(block, HeadingBlock):
            doc.add_heading(block.text, level=min(block.level, 4))
        elif isinstance(block, ParagraphBlock):
            p = doc.add_paragraph(block.text)
            align = getattr(WD_ALIGN_PARAGRAPH, block.align.upper(), WD_ALIGN_PARAGRAPH.LEFT)
            p.alignment = align
        elif isinstance(block, ListBlock):
            style = "List Number" if block.ordered else "List Bullet"
            for item in block.items:
                doc.add_paragraph(item, style=style)
        elif isinstance(block, TableBlock):
            cols = len(block.rows[0]) if block.rows else 0
            t = doc.add_table(rows=len(block.rows), cols=cols)
            t.style = "Table Grid"
            for i, row in enumerate(block.rows):
                for j, cell in enumerate(row):
                    t.cell(i, j).text = cell
        elif isinstance(block, ImageBlock):
            if block.path and os.path.exists(block.path):
                doc.add_picture(block.path, width=Inches(block.width or 4))
        elif isinstance(block, PageBreakBlock):
            doc.add_page_break()
    doc.save(output_path)
    return ConversionResult(ok=True, output_path=output_path, engine="generation")


# ---------------------------------------------------------------------------
# ODT (repackage DOCX as ODT package)
# ---------------------------------------------------------------------------
def _render_odt(blocks: List[Block], output_path: str) -> ConversionResult:
    tmp_docx = output_path + ".tmp.docx"
    res = _render_docx(blocks, tmp_docx)
    if not res.ok:
        return res
    try:
        with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("mimetype", "application/vnd.oasis.opendocument.text",
                       compress_type=zipfile.ZIP_STORED)
            with zipfile.ZipFile(tmp_docx, "r") as src:
                for item in src.infolist():
                    z.writestr(item.filename, src.read(item.filename))
    finally:
        try:
            os.remove(tmp_docx)
        except OSError:
            pass
    return ConversionResult(ok=True, output_path=output_path, engine="generation",
                            status="partial", notes="ODT repackaged from DOCX")


# ---------------------------------------------------------------------------
# HTML / MD / TXT
# ---------------------------------------------------------------------------
def _render_html(blocks: List[Block], output_path: str) -> ConversionResult:
    parts = ["<!DOCTYPE html><html><head><meta charset='utf-8'><title>Document</title></head><body>"]
    for block in blocks:
        if isinstance(block, HeadingBlock):
            tag = f"h{min(block.level, 4)}"
            parts.append(f"<{tag}>{_escape(block.text)}</{tag}>")
        elif isinstance(block, ParagraphBlock):
            parts.append(f"<p>{_escape(block.text)}</p>")
        elif isinstance(block, ListBlock):
            tag = "ol" if block.ordered else "ul"
            items = "".join(f"<li>{_escape(i)}</li>" for i in block.items)
            parts.append(f"<{tag}>{items}</{tag}>")
        elif isinstance(block, TableBlock):
            parts.append("<table border='1' cellpadding='4'>")
            for row in block.rows:
                parts.append("<tr>" + "".join(f"<td>{_escape(c)}</td>" for c in row) + "</tr>")
            parts.append("</table>")
        elif isinstance(block, ImageBlock):
            if block.path:
                parts.append(f"<img src='{block.path}' width='{block.width or 300}'>")
        elif isinstance(block, PageBreakBlock):
            parts.append("<div style='page-break-after:always;'></div>")
        elif isinstance(block, HorizontalRuleBlock):
            parts.append("<hr>")
    parts.append("</body></html>")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("".join(parts))
    return ConversionResult(ok=True, output_path=output_path, engine="generation")


def _render_md(blocks: List[Block], output_path: str) -> ConversionResult:
    lines = []
    for block in blocks:
        if isinstance(block, HeadingBlock):
            lines.append(f"{'#' * min(block.level, 4)} {block.text}")
        elif isinstance(block, ParagraphBlock):
            lines.append(block.text)
            lines.append("")
        elif isinstance(block, ListBlock):
            for i, item in enumerate(block.items):
                marker = f"{i+1}." if block.ordered else "-"
                lines.append(f"{marker} {item}")
            lines.append("")
        elif isinstance(block, TableBlock):
            lines.append(_md_table(block.rows))
            lines.append("")
        elif isinstance(block, ImageBlock):
            lines.append(f"![image]({block.path})")
        elif isinstance(block, PageBreakBlock):
            lines.append("---\n")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return ConversionResult(ok=True, output_path=output_path, engine="generation")


def _md_table(rows: List[List[str]]) -> str:
    out = []
    for i, row in enumerate(rows):
        out.append("| " + " | ".join(row) + " |")
        if i == 0:
            out.append("| " + " | ".join("---" for _ in row) + " |")
    return "\n".join(out)


def _render_txt(blocks: List[Block], output_path: str) -> ConversionResult:
    lines = []
    for block in blocks:
        if isinstance(block, HeadingBlock):
            lines.append(block.text)
            lines.append("=" * len(block.text) if block.level == 1 else "-" * len(block.text))
        elif isinstance(block, ParagraphBlock):
            lines.append(block.text)
        elif isinstance(block, ListBlock):
            for item in block.items:
                lines.append(f"- {item}")
        elif isinstance(block, TableBlock):
            for row in block.rows:
                lines.append(" | ".join(row))
        elif isinstance(block, ImageBlock):
            lines.append(f"[image: {block.path}]")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    return ConversionResult(ok=True, output_path=output_path, engine="generation")


# ---------------------------------------------------------------------------
# Placeholders / batch
# ---------------------------------------------------------------------------
def fill_placeholders(blocks: List[Block], data: dict) -> List[Block]:
    """Replace {{key}} placeholders in block text with values from data."""
    import re
    pattern = re.compile(r"{{\s*([\w.]+)\s*}}")

    def repl(text: str) -> str:
        return pattern.sub(lambda m: str(data.get(m.group(1), m.group(0))), text)

    filled = []
    for block in blocks:
        if isinstance(block, HeadingBlock):
            filled.append(HeadingBlock(repl(block.text), block.level))
        elif isinstance(block, ParagraphBlock):
            filled.append(ParagraphBlock(repl(block.text), block.align))
        elif isinstance(block, ListBlock):
            filled.append(ListBlock([repl(i) for i in block.items], block.ordered))
        elif isinstance(block, TableBlock):
            filled.append(TableBlock([[repl(c) for c in row] for row in block.rows]))
        else:
            filled.append(block)
    return filled


def _escape(s: str) -> str:
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
