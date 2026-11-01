"""Base class for conversion engines."""

from dataclasses import dataclass
from typing import Any, Optional


@dataclass
class ConversionResult:
    ok: bool
    output_path: Optional[str] = None
    error: Optional[str] = None
    engine: Optional[str] = None
    status: str = "done"  # done | partial | experimental | not_implemented
    notes: Optional[str] = None


class ConverterEngine:
    name: str = "base"

    def can_convert(self, source_ext: str, target_ext: str) -> bool:
        raise NotImplementedError

    def convert(self, source_path: str, target_path: str, options: dict) -> ConversionResult:
        raise NotImplementedError

    def status(self) -> str:
        return "done"
