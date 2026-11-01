"""Unit tests for the conversion registry and format matrix."""

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.registry import registry


def test_list_formats_nonempty():
    fmts = registry.list_formats()
    assert len(fmts) > 0


def test_format_for_extension():
    f = registry.format_for_extension("pdf")
    assert f is not None
    assert "pdf" in f.extensions


def test_supported_targets():
    assert "txt" in registry.supported_targets("pdf")
    assert "html" in registry.supported_targets("md")
    assert "csv" in registry.supported_targets("xlsx")


def test_can_convert():
    assert registry.can_convert("pdf", "txt") is True
    assert registry.can_convert("png", "jpg") is True
    assert registry.can_convert("pdf", "xyz") is False


def test_get_entry():
    e = registry.get_entry("pdf", "txt")
    assert e is not None
    assert e.engine == "pdf"


def test_compatibility_matrix():
    m = registry.compatibility_matrix()
    assert "pdf" in m
    assert "txt" in m["pdf"]


def test_all_conversions():
    convs = registry.all_conversions()
    assert len(convs) > 0


def test_engine_status():
    st = registry.engine_status()
    assert "pdf" in st
