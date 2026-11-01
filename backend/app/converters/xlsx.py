"""Spreadsheet (XLSX/CSV/ODS) conversion engine using openpyxl."""

import csv
import io
import os
from typing import Any

import openpyxl
from openpyxl import Workbook
from openpyxl.reader.excel import load_workbook

from app.converters.base import ConverterEngine, ConversionResult


class XlsxConverter(ConverterEngine):
    name = "xlsx"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        pairs = {
            ("xlsx", "csv"), ("xlsx", "xlsx"), ("xlsx", "ods"),
            ("xlsx", "pdf"), ("xlsx", "json"),
            ("csv", "xlsx"), ("csv", "csv"),
            ("ods", "xlsx"), ("json", "xlsx"), ("csv", "json"),
        }
        return (source_ext.lower(), target_ext.lower()) in pairs

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        target_ext = os.path.splitext(target_path)[1].lower().lstrip(".")
        try:
            if target_ext == "xlsx":
                return self._to_xlsx(source_path, target_path)
            if target_ext == "csv":
                return self._to_csv(source_path, target_path)
            if target_ext == "ods":
                return ConversionResult(
                    ok=False, error="ODS writing requires LibreOffice; not installed",
                    engine=self.name, status="not_implemented",
                )
            if target_ext == "pdf":
                return ConversionResult(
                    ok=False, error="Spreadsheet to PDF requires reportlab rendering",
                    engine=self.name, status="not_implemented",
                )
            if target_ext == "json":
                return self._to_json(source_path, target_path)
            return ConversionResult(
                ok=False, error=f"Unsupported target {target_ext}",
                engine=self.name, status="not_implemented",
            )
        except Exception as exc:  # noqa: BLE001
            return ConversionResult(ok=False, error=str(exc), engine=self.name)

    def _to_xlsx(self, source_path: str, target_path: str) -> ConversionResult:
        src_ext = os.path.splitext(source_path)[1].lower()
        if src_ext == ".csv":
            wb = Workbook()
            ws = wb.active
            with open(source_path, newline="", encoding="utf-8") as f:
                for row in csv.reader(f):
                    ws.append(row)
            wb.save(target_path)
        elif src_ext in {".xlsx", ".xlsm"}:
            wb = load_workbook(source_path)
            wb.save(target_path)
        else:
            return ConversionResult(
                ok=False, error=f"Cannot convert {src_ext} to XLSX",
                engine=self.name, status="not_implemented",
            )
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_csv(self, source_path: str, target_path: str) -> ConversionResult:
        wb = load_workbook(source_path)
        ws = wb.active
        with open(target_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            for row in ws.iter_rows(values_only=True):
                writer.writerow(["" if v is None else str(v) for v in row])
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def _to_json(self, source_path: str, target_path: str) -> ConversionResult:
        import json
        wb = load_workbook(source_path)
        ws = wb.active
        rows = list(ws.iter_rows(values_only=True))
        if not rows:
            data = []
        else:
            header = [str(h) if h is not None else f"col{i}" for i, h in enumerate(rows[0])]
            data = []
            for row in rows[1:]:
                data.append({header[i]: ("" if v is None else v) for i, v in enumerate(row)})
        with open(target_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
        return ConversionResult(ok=True, output_path=target_path, engine=self.name)

    def status(self) -> str:
        return "done"
