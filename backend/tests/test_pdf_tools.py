"""Unit tests for the PDF toolkit (call functions directly)."""

import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.pdf_tools import (
    merge_pdfs, split_pdf, rotate_pages, rearrange_pages, extract_pages,
    delete_pages, add_watermark, add_page_numbers, add_header_footer,
    extract_text, compress_pdf, protect_pdf, unlock_pdf, repair_pdf,
    images_to_pdf, get_metadata, set_metadata, is_encrypted, ocr_pdf,
)


def _make_pdf(tmp, name="a.pdf"):
    from pypdf import PdfWriter
    p = os.path.join(tmp, name)
    w = PdfWriter()
    w.add_blank_page(72, 72)
    w.add_blank_page(72, 72)
    with open(p, "wb") as f:
        w.write(f)
    return p


def test_merge_pdfs():
    tmp = tempfile.mkdtemp()
    a = _make_pdf(tmp, "a.pdf")
    b = _make_pdf(tmp, "b.pdf")
    out = os.path.join(tmp, "merged.pdf")
    res = merge_pdfs([a, b], out)
    assert res.ok, res.error
    assert os.path.exists(out)
    from pypdf import PdfReader
    assert len(PdfReader(out).pages) == 4


def test_split_pdf():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "split.pdf")
    res = split_pdf(src, out, pages=[1])
    assert res.ok, res.error
    from pypdf import PdfReader
    assert len(PdfReader(out).pages) == 1


def test_delete_pages():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "del.pdf")
    res = delete_pages(src, out, [2])
    assert res.ok, res.error
    from pypdf import PdfReader
    assert len(PdfReader(out).pages) == 1


def test_rearrange_pages():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "rearr.pdf")
    res = rearrange_pages(src, out, [2, 1])
    assert res.ok, res.error


def test_rotate_pages():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "rot.pdf")
    res = rotate_pages(src, out, {"1": 90})
    assert res.ok, res.error


def test_extract_pages():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "ext.pdf")
    res = extract_pages(src, out, [1])
    assert res.ok, res.error


def test_watermark():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "wm.pdf")
    res = add_watermark(src, out, "DRAFT")
    assert res.ok, res.error


def test_page_numbers():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "pn.pdf")
    res = add_page_numbers(src, out, "bottom-center")
    assert res.ok, res.error


def test_header_footer():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "hf.pdf")
    res = add_header_footer(src, out, "Header", "Footer")
    assert res.ok, res.error


def test_extract_text():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "out.txt")
    res = extract_text(src, out)
    assert res.ok, res.error


def test_compress():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "comp.pdf")
    res = compress_pdf(src, out)
    assert res.ok, res.error


def test_protect_unlock():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    enc = os.path.join(tmp, "enc.pdf")
    res = protect_pdf(src, enc, "secret")
    assert res.ok, res.error
    assert is_encrypted(enc) is True
    dec = os.path.join(tmp, "dec.pdf")
    res = unlock_pdf(enc, dec, "secret")
    assert res.ok, res.error
    assert is_encrypted(dec) is False


def test_metadata():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "meta.pdf")
    res = set_metadata(src, out, {"Title": "Test Doc"})
    assert res.ok, res.error
    meta = get_metadata(out)
    assert meta.get("/Title") == "Test Doc"


def test_repair():
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "rep.pdf")
    res = repair_pdf(src, out)
    assert res.ok, res.error


def test_images_to_pdf():
    tmp = tempfile.mkdtemp()
    from PIL import Image
    p1 = os.path.join(tmp, "i1.png")
    p2 = os.path.join(tmp, "i2.png")
    Image.new("RGB", (40, 40), (255, 0, 0)).save(p1, "PNG")
    Image.new("RGB", (40, 40), (0, 255, 0)).save(p2, "PNG")
    out = os.path.join(tmp, "out.pdf")
    res = images_to_pdf([p1, p2], out)
    assert res.ok, res.error
    assert os.path.exists(out)


def test_ocr_not_available_without_binaries():
    """OCR should gracefully report not-implemented when tesseract/poppler missing."""
    tmp = tempfile.mkdtemp()
    src = _make_pdf(tmp, "src.pdf")
    out = os.path.join(tmp, "ocr.pdf")
    res = ocr_pdf(src, out)
    # On this environment tesseract/poppler are not installed -> not_implemented
    assert res.ok is False
    assert res.status == "not_implemented"
    assert res.error is not None
