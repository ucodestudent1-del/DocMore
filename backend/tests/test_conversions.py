"""Unit tests for conversions (call engines directly, no HTTP server)."""

import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.registry import registry


def _write(path, data, mode="wb"):
    with open(path, mode) as f:
        f.write(data)


def test_txt_to_pdf():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "t.txt")
    out = os.path.join(tmp, "t.pdf")
    with open(src, "w") as f:
        f.write("hello world\nsecond line")
    res = registry.convert("txt", "pdf", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)
    assert os.path.getsize(out) > 0


def test_txt_to_html():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "t.txt")
    out = os.path.join(tmp, "t.html")
    with open(src, "w") as f:
        f.write("hello")
    res = registry.convert("txt", "html", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)


def test_md_to_docx():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "t.md")
    out = os.path.join(tmp, "t.docx")
    with open(src, "w") as f:
        f.write("# Title\n\nSome content.")
    res = registry.convert("md", "docx", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)


def test_csv_to_xlsx():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "s.csv")
    out = os.path.join(tmp, "s.xlsx")
    with open(src, "w") as f:
        f.write("A,B\n1,2\n")
    res = registry.convert("csv", "xlsx", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)


def test_png_to_jpg():
    tmp = tempfile.mkdtemp()
    from PIL import Image
    src = os.path.join(tmp, "in.png")
    out = os.path.join(tmp, "out.jpg")
    Image.new("RGB", (50, 50), (255, 0, 0)).save(src, "PNG")
    res = registry.convert("png", "jpg", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)


def test_png_to_pdf():
    tmp = tempfile.mkdtemp()
    from PIL import Image
    src = os.path.join(tmp, "in.png")
    out = os.path.join(tmp, "out.pdf")
    Image.new("RGB", (50, 50), (0, 255, 0)).save(src, "PNG")
    res = registry.convert("png", "pdf", src, out, {})
    assert res.ok, res.error
    assert os.path.exists(out)


def test_unsupported_conversion():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "x.pdf")
    open(src, "wb").write(b"%PDF-1.4\n")
    out = os.path.join(tmp, "x.docx")
    res = registry.convert("pdf", "docx", src, out, {})
    assert res.ok is False
    assert res.error is not None


def test_unknown_conversion():
    tmp = tempfile.mkdtemp()
    src = os.path.join(tmp, "x.pdf")
    open(src, "wb").write(b"%PDF-1.4\n")
    out = os.path.join(tmp, "x.zzz")
    res = registry.convert("pdf", "zzz", src, out, {})
    assert res.ok is False
