"""HTTP integration tests using FastAPI TestClient (no separate server needed)."""

import io, os, tempfile
from fastapi.testclient import TestClient
from app.main import app


def _upload_pdf(client, name="a.pdf"):
    from pypdf import PdfWriter
    buf = io.BytesIO()
    w = PdfWriter(); w.add_blank_page(72, 72); w.write(buf)
    buf.seek(0)
    files = {"file": (name, buf, "application/pdf")}
    r = client.post("/api/upload", files=files)
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _await(client, job_id, timeout=30):
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job_id}")
        assert r.status_code == 200
        st = r.json().get("status")
        if st in ("success", "failure"):
            return r.json()
        time.sleep(0.2)
    raise AssertionError(f"Job {job_id} timed out")


def test_convert_txt_to_pdf_flow():
    client = TestClient(app)
    # upload txt
    r = client.post("/api/upload", files={"file": ("t.txt", io.BytesIO(b"hello world\nline two"), "text/plain")})
    assert r.status_code == 200
    file_id = r.json()["id"]

    # convert async
    r = client.post("/api/convert", json={"file_id": file_id, "target": "pdf"})
    assert r.status_code == 200
    job = r.json()
    assert "job_id" in job

    result = _await(client, job["job_id"])
    assert result["status"] == "success", result.get("error")
    out_id = result["result"]
    assert out_id is not None

    # download
    r = client.get(f"/api/download/{out_id}")
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_pdf_merge_flow():
    client = TestClient(app)
    fid1 = _upload_pdf(client, "a.pdf")
    fid2 = _upload_pdf(client, "b.pdf")
    r = client.post("/api/pdf/merge", json={"file_ids": [fid1, fid2]})
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"])
    assert job["status"] == "success", job.get("error")
    out_id = job["result"]
    r = client.get(f"/api/download/{out_id}")
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_pdf_protect_unlock_flow():
    client = TestClient(app)
    fid = _upload_pdf(client, "secret.pdf")
    r = client.post("/api/pdf/protect", json={"file_id": fid, "password": "abc"})
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"])
    assert job["status"] == "success", job.get("error")
    enc_id = job["result"]

    r = client.get(f"/api/pdf/encrypted/{enc_id}")
    assert r.status_code == 200
    assert r.json()["encrypted"] is True

    r = client.post("/api/pdf/unlock", json={"file_id": enc_id, "password": "abc"})
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"])
    assert job["status"] == "success", job.get("error")

    r = client.get(f"/api/pdf/encrypted/{job['result']}")
    assert r.json()["encrypted"] is False


def test_generate_document_flow():
    client = TestClient(app)
    blocks = [
        {"type": "heading", "data": {"text": "Hello", "level": 1}},
        {"type": "paragraph", "data": {"text": "Generated document."}},
    ]
    r = client.post("/api/generate", json={"blocks": blocks, "format": "pdf"})
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"])
    assert job["status"] == "success", job.get("error")
    out_id = job["result"]
    r = client.get(f"/api/download/{out_id}")
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_rejects_unsupported_conversion():
    client = TestClient(app)
    fid = _upload_pdf(client, "a.pdf")
    r = client.post("/api/convert", json={"file_id": fid, "target": "notaformat"})
    assert r.status_code == 400


def test_rejects_exe():
    client = TestClient(app)
    r = client.post("/api/upload", files={"file": ("evil.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")})
    assert r.status_code == 400


def test_formats_and_history():
    client = TestClient(app)
    r = client.get("/api/formats")
    assert r.status_code == 200
    assert len(r.json()["formats"]) > 0
    r = client.get("/api/history")
    assert r.status_code == 200
    assert "history" in r.json()


def test_formats_and_history():
    client = TestClient(app)
    r = client.get("/api/formats")
    assert r.status_code == 200
    assert len(r.json()["formats"]) > 0
    r = client.get("/api/history")
    assert r.status_code == 200
    assert "history" in r.json()


def test_pdf_compare():
    client = TestClient(app)
    from pypdf import PdfWriter
    from docx import Document

    # Create two PDFs with different text
    buf1 = io.BytesIO()
    w = PdfWriter(); w.add_blank_page(72, 72)
    # pypdf can't easily add text, so use reportlab instead
    from reportlab.pdfgen import canvas as rl_canvas
    buf1 = io.BytesIO()
    c = rl_canvas.Canvas(buf1)
    c.drawString(72, 720, "Hello World")
    c.drawString(72, 700, "Line one")
    c.save()
    buf1.seek(0)

    buf2 = io.BytesIO()
    c = rl_canvas.Canvas(buf2)
    c.drawString(72, 720, "Hello World")
    c.drawString(72, 700, "Line two")
    c.save()
    buf2.seek(0)

    r1 = client.post("/api/upload", files={"file": ("a.pdf", buf1, "application/pdf")})
    assert r1.status_code == 200
    r2 = client.post("/api/upload", files={"file": ("b.pdf", buf2, "application/pdf")})
    assert r2.status_code == 200

    fid1 = r1.json()["id"]
    fid2 = r2.json()["id"]

    r = client.post("/api/compare", files={
        "file1": ("a.pdf", buf1, "application/pdf"),
        "file2": ("b.pdf", buf2, "application/pdf"),
    })
    assert r.status_code == 200, r.text
    result = r.json()
    assert "file1" in result
    assert "file2" in result
    assert "diff" in result
    assert result["diff"]["added"] >= 0
    assert result["diff"]["removed"] >= 0
