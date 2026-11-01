"""Unit tests for document generation (PDF, DOCX, TXT, HTML, MD)."""

import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.generation import (
    render_blocks, HeadingBlock, ParagraphBlock, ListBlock,
    TableBlock, ImageBlock, PageBreakBlock, fill_placeholders,
)


def _blocks():
    return [
        HeadingBlock("Title", level=1),
        ParagraphBlock("Some paragraph text.", align="left"),
        ListBlock(["item a", "item b"], ordered=False),
        TableBlock([["A", "B"], ["1", "2"]]),
        PageBreakBlock(),
    ]


def test_generate_pdf():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.pdf")
    res = render_blocks(_blocks(), "pdf", out)
    assert res.ok, res.error
    assert os.path.exists(out)
    assert os.path.getsize(out) > 0


def test_generate_docx():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.docx")
    res = render_blocks(_blocks(), "docx", out)
    assert res.ok, res.error
    assert os.path.exists(out)


def test_generate_txt():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.txt")
    res = render_blocks(_blocks(), "txt", out)
    assert res.ok, res.error
    with open(out) as f:
        content = f.read()
    assert "Title" in content
    assert "Some paragraph text" in content


def test_generate_html():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.html")
    res = render_blocks(_blocks(), "html", out)
    assert res.ok, res.error
    with open(out) as f:
        content = f.read()
    assert "<h1>Title</h1>" in content


def test_generate_md():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.md")
    res = render_blocks(_blocks(), "md", out)
    assert res.ok, res.error
    with open(out) as f:
        content = f.read()
    assert "# Title" in content


def test_fill_placeholders():
    blocks = [ParagraphBlock("Hello {{name}}", align="left")]
    filled = fill_placeholders(blocks, {"name": "World"})
    assert filled[0].text == "Hello World"
    assert filled[0].text != "Hello {{name}}"


def test_unsupported_format():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.xyz")
    res = render_blocks(_blocks(), "xyz", out)
    assert res.ok is False
    assert res.error is not None


def test_generate_odt():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.odt")
    res = render_blocks(_blocks(), "odt", out)
    assert res.ok, res.error
    assert os.path.exists(out)
    assert os.path.getsize(out) > 0
    # Verify it's a valid ZIP with mimetype
    import zipfile
    with zipfile.ZipFile(out) as z:
        names = z.namelist()
        assert "mimetype" in names
        assert "content.xml" in names
        mimetype = z.read("mimetype").decode("utf-8")
        assert "opendocument.text" in mimetype


def test_generate_pdf_with_headers_footers():
    tmp = tempfile.mkdtemp()
    out = os.path.join(tmp, "out.pdf")
    res = render_blocks(_blocks(), "pdf", out, header="My Header", footer="My Footer")
    assert res.ok, res.error
    assert os.path.exists(out)
    assert os.path.getsize(out) > 0
