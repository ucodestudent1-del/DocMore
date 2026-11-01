"""Conversion registry: maps source format -> set of target formats.

Every supported conversion must be backed by a real engine. The matrix
distinguishes fully implemented, limited, and not-implemented conversions.
"""

from dataclasses import dataclass, field
from typing import Dict, Set, Optional, List
from app.converters.base import ConverterEngine, ConversionResult


@dataclass
class FormatCapability:
    name: str
    extensions: Set[str]
    mime_types: Set[str]
    status: str = "done"  # done | partial | experimental | not_implemented
    notes: str = ""


@dataclass
class ConversionEntry:
    source: str
    target: str
    engine: str
    status: str = "done"
    notes: str = ""


class ConversionRegistry:
    def __init__(self) -> None:
        self._formats: Dict[str, FormatCapability] = {}
        self._matrix: Dict[str, Dict[str, ConversionEntry]] = {}
        self._engines: Dict[str, ConverterEngine] = {}
        self._register_formats()
        self._register_matrix()
        self._discover_engines()

    # --- formats -----------------------------------------------------
    def _register_formats(self) -> None:
        formats = [
            FormatCapability("PDF", {"pdf"}, {"application/pdf"}),
            FormatCapability("Word 2007+", {"docx"}, {"application/vnd.openxmlformats-officedocument.wordprocessingml.document"}),
            FormatCapability("Word 97-2003", {"doc"}, {"application/msword"}),
            FormatCapability("OpenDocument Text", {"odt"}, {"application/vnd.oasis.opendocument.text"}),
            FormatCapability("Rich Text", {"rtf"}, {"application/rtf"}),
            FormatCapability("Plain Text", {"txt"}, {"text/plain"}),
            FormatCapability("Markdown", {"md"}, {"text/markdown"}),
            FormatCapability("HTML", {"html", "htm"}, {"text/html"}),
            FormatCapability("XML", {"xml"}, {"application/xml"}),
            FormatCapability("JSON", {"json"}, {"application/json"}),
            FormatCapability("CSV", {"csv"}, {"text/csv"}),
            FormatCapability("TSV", {"tsv"}, {"text/tab-separated-values"}),
            FormatCapability("Excel 2007+", {"xlsx"}, {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}),
            FormatCapability("Excel 97-2003", {"xls"}, {"application/vnd.ms-excel"}),
            FormatCapability("Excel Macro", {"xlsm"}, {"application/vnd.ms-excel.sheet.macroEnabled.main"}),
            FormatCapability("OpenDocument Spreadsheet", {"ods"}, {"application/vnd.oasis.opendocument.spreadsheet"}),
            FormatCapability("PowerPoint 2007+", {"pptx"}, {"application/vnd.openxmlformats-officedocument.presentationml.presentation"}),
            FormatCapability("PowerPoint 97-2003", {"ppt"}, {"application/vnd.ms-powerpoint"}),
            FormatCapability("OpenDocument Presentation", {"odp"}, {"application/vnd.oasis.opendocument.presentation"}),
            FormatCapability("PNG", {"png"}, {"image/png"}),
            FormatCapability("JPEG", {"jpg", "jpeg"}, {"image/jpeg"}),
            FormatCapability("WEBP", {"webp"}, {"image/webp"}),
            FormatCapability("GIF", {"gif"}, {"image/gif"}),
            FormatCapability("BMP", {"bmp"}, {"image/bmp"}),
            FormatCapability("TIFF", {"tiff", "tif"}, {"image/tiff"}),
            FormatCapability("SVG", {"svg"}, {"image/svg+xml"}),
            FormatCapability("ICO", {"ico"}, {"image/x-icon"}),
            FormatCapability("HEIC", {"heic"}, {"image/heic"}),
            FormatCapability("AVIF", {"avif"}, {"image/avif"}),
            FormatCapability("EPUB", {"epub"}, {"application/epub+zip"}),
        ]
        for f in formats:
            for ext in f.extensions:
                self._formats[ext] = f

    def _register_matrix(self) -> None:
        # source -> target -> entry
        def add(src: str, tgt: str, engine: str, status: str = "done", notes: str = "") -> None:
            self._matrix.setdefault(src, {})[tgt] = ConversionEntry(src, tgt, engine, status, notes)

        # PDF conversions
        for tgt in ["docx", "txt", "html", "md", "png", "jpg", "webp", "svg"]:
            add("pdf", tgt, "pdf")
        add("pdf", "pdf", "pdf", "done", "Identity / optimization pass")

        # Word conversions
        for tgt in ["pdf", "txt", "md", "html"]:
            add("docx", tgt, "docx")
        add("docx", "docx", "docx", "done", "Identity / optimization pass")
        # .doc is OLE2; we read via antiword-free fallback only when text extractable
        add("doc", "txt", "docx", "partial", "Limited text extraction from legacy .doc")
        add("doc", "docx", "docx", "partial", "Limited legacy .doc support")

        # Spreadsheet conversions
        for tgt in ["csv", "xlsx", "ods", "pdf"]:
            add("xlsx", tgt, "xlsx")
        add("xlsx", "xlsx", "xlsx", "done", "Identity / optimization pass")
        add("csv", "xlsx", "xlsx", "done", "CSV parsed and written as XLSX")
        add("csv", "csv", "xlsx", "done", "Identity pass")
        add("ods", "xlsx", "xlsx", "partial", "ODS support limited")
        add("xlsx", "json", "xlsx", "done", "XLSX worksheets to JSON")

        # Presentation conversions
        for tgt in ["pdf", "pptx"]:
            add("pptx", tgt, "pptx")
        add("pptx", "pptx", "pptx", "done", "Identity / optimization pass")

        # Image conversions
        image_formats = ["png", "jpg", "webp", "gif", "bmp", "tiff", "svg", "ico"]
        for src in image_formats:
            for tgt in image_formats:
                add(src, tgt, "image", "partial" if src in {"svg", "ico", "heic", "avif"} else "done")
        # images -> pdf
        for src in image_formats:
            add(src, "pdf", "image", "done")
        # pdf -> images already covered

        # HTML / Markdown / Text
        add("html", "md", "html", "done")
        add("html", "txt", "html", "done")
        add("html", "pdf", "html", "done")
        add("md", "html", "md", "done")
        add("md", "pdf", "md", "done")
        add("md", "docx", "md", "done")
        add("md", "txt", "md", "done")
        add("txt", "md", "md", "done")
        add("txt", "html", "html", "done")
        add("txt", "pdf", "html", "done")
        add("txt", "docx", "md", "done")

        # JSON / XML / structured
        add("json", "csv", "html", "done", "JSON flattened to CSV")
        add("json", "xlsx", "xlsx", "done", "JSON flattened to XLSX")
        add("xml", "json", "html", "done", "XML to JSON via element tree")
        add("csv", "json", "html", "done", "CSV to JSON")

    # --- engines -----------------------------------------------------
    def _discover_engines(self) -> None:
        from app.converters.pdf import PDFConverter
        from app.converters.docx import DocxConverter
        from app.converters.xlsx import XlsxConverter
        from app.converters.pptx import PptxConverter
        from app.converters.image import ImageConverter
        from app.converters.html import HtmlConverter
        from app.converters.md import MarkdownConverter

        for engine in (
            PDFConverter(), DocxConverter(), XlsxConverter(), PptxConverter(),
            ImageConverter(), HtmlConverter(), MarkdownConverter(),
        ):
            self._engines[engine.name] = engine

    # --- public API --------------------------------------------------
    def list_formats(self) -> Dict[str, FormatCapability]:
        return dict(self._formats)

    def format_for_extension(self, ext: str) -> Optional[FormatCapability]:
        return self._formats.get(ext.lower())

    def supported_targets(self, source_ext: str) -> Set[str]:
        return set(self._matrix.get(source_ext.lower(), {}).keys())

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        return target_ext.lower() in self._matrix.get(source_ext.lower(), {})

    def get_entry(self, source_ext: str, target_ext: str) -> Optional[ConversionEntry]:
        return self._matrix.get(source_ext.lower(), {}).get(target_ext.lower())

    def get_engine(self, name: str) -> Optional[ConverterEngine]:
        return self._engines.get(name)

    def convert(self, source_ext: str, target_ext: str, source_path: str,
                target_path: str, options: dict) -> ConversionResult:
        entry = self.get_entry(source_ext, target_ext)
        if not entry:
            return ConversionResult(
                ok=False, error=f"No conversion engine for {source_ext} -> {target_ext}"
            )
        engine = self._engines.get(entry.engine)
        if not engine:
            return ConversionResult(
                ok=False, error=f"Engine '{entry.engine}' not available"
            )
        if not engine.can_convert(source_ext, target_ext):
            return ConversionResult(
                ok=False, error=f"Engine {entry.engine} cannot convert {source_ext} to {target_ext}"
            )
        return engine.convert(source_path, target_path, options)

    def compatibility_matrix(self) -> Dict[str, Dict[str, str]]:
        """Return source -> {target: status} for UI display."""
        result: Dict[str, Dict[str, str]] = {}
        for src, targets in self._matrix.items():
            result[src] = {tgt: e.status for tgt, e in targets.items()}
        return result

    def all_conversions(self) -> List[ConversionEntry]:
        out: List[ConversionEntry] = []
        for targets in self._matrix.values():
            out.extend(targets.values())
        return out

    def engine_names(self) -> list[str]:
        return list(self._engines.keys())

    def engine_status(self) -> Dict[str, str]:
        return {name: engine.status() for name, engine in self._engines.items()}

    def format_capabilities(self) -> list[FormatCapability]:
        seen: Set[str] = set()
        out: list[FormatCapability] = []
        for f in self._formats.values():
            key = frozenset(f.extensions)
            if key in seen:
                continue
            seen.add(key)
            out.append(f)
        return out


registry = ConversionRegistry()
