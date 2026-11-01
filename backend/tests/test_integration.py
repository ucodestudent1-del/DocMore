"""HTTP integration tests using FastAPI TestClient (no separate server needed)."""

import io, os, tempfile
from fastapi.testclient import TestClient
from app.main import app


def _register_and_login(client):
    """Register a test user and return the auth token."""
    client.post("/api/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
    })
    r = client.post("/api/auth/token", json={"username": "testuser", "password": "testpass123"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _auth_headers(token):
    return {"Authorization": f"Bearer {token}"}


def _upload_pdf(client, token, name="a.pdf"):
    from pypdf import PdfWriter
    buf = io.BytesIO()
    w = PdfWriter(); w.add_blank_page(72, 72); w.write(buf)
    buf.seek(0)
    files = {"file": (name, buf, "application/pdf")}
    r = client.post("/api/upload", files=files, headers=_auth_headers(token))
    assert r.status_code == 200, r.text
    return r.json()["id"]


def _await(client, job_id, token, timeout=30):
    import time
    deadline = time.time() + timeout
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job_id}", headers=_auth_headers(token))
        assert r.status_code == 200
        st = r.json().get("status")
        if st in ("success", "failure"):
            return r.json()
        time.sleep(0.2)
    raise AssertionError(f"Job {job_id} timed out")


def test_unauthenticated_upload_rejected():
    client = TestClient(app)
    r = client.post("/api/upload", files={"file": ("t.txt", io.BytesIO(b"hello"), "text/plain")})
    assert r.status_code == 401


def test_unauthenticated_convert_rejected():
    client = TestClient(app)
    r = client.post("/api/convert", json={"file_id": "xyz", "target": "pdf"})
    assert r.status_code == 401


def test_unauthenticated_generate_rejected():
    client = TestClient(app)
    r = client.post("/api/generate", json={"blocks": [], "format": "pdf"})
    assert r.status_code == 401


def test_unauthenticated_history_rejected():
    client = TestClient(app)
    r = client.get("/api/history")
    assert r.status_code == 401


def test_unauthenticated_download_rejected():
    client = TestClient(app)
    r = client.get("/api/download/somefile")
    assert r.status_code == 401


def test_convert_txt_to_pdf_flow():
    client = TestClient(app)
    token = _register_and_login(client)

    # upload txt
    r = client.post("/api/upload", files={"file": ("t.txt", io.BytesIO(b"hello world\nline two"), "text/plain")}, headers=_auth_headers(token))
    assert r.status_code == 200
    file_id = r.json()["id"]

    # convert async
    r = client.post("/api/convert", json={"file_id": file_id, "target": "pdf"}, headers=_auth_headers(token))
    assert r.status_code == 200
    job = r.json()
    assert "job_id" in job

    # Need to use the token from the closure
    import time as _time
    deadline = _time.time() + 30
    while _time.time() < deadline:
        r = client.get(f"/api/jobs/{job['job_id']}", headers=_auth_headers(token))
        assert r.status_code == 200
        st = r.json().get("status")
        if st in ("success", "failure"):
            break
        _time.sleep(0.2)
    else:
        raise AssertionError(f"Job {job['job_id']} timed out")

    assert r.json()["status"] == "success", r.json().get("error")
    out_id = r.json()["result"]
    assert out_id is not None

    # download
    r = client.get(f"/api/download/{out_id}", headers=_auth_headers(token))
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_user_cannot_access_another_users_file():
    """Verify user data isolation - user B cannot download user A's file."""
    client = TestClient(app)

    # Register and login as user A
    client.post("/api/auth/register", json={
        "username": "usera", "email": "a@example.com", "password": "pass123",
    })
    r = client.post("/api/auth/token", json={"username": "usera", "password": "pass123"})
    token_a = r.json()["access_token"]

    # Register and login as user B
    client.post("/api/auth/register", json={
        "username": "userb", "email": "b@example.com", "password": "pass123",
    })
    r = client.post("/api/auth/token", json={"username": "userb", "password": "pass123"})
    token_b = r.json()["access_token"]

    # User A uploads a file
    r = client.post("/api/upload", files={"file": ("secret.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")}, headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    file_id = r.json()["id"]

    # User B tries to download user A's file - should be 403
    r = client.get(f"/api/download/{file_id}", headers={"Authorization": f"Bearer {token_b}"})
    assert r.status_code == 403, f"Expected 403, got {r.status_code}: {r.text}"

    # User A can download their own file
    r = client.get(f"/api/download/{file_id}", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200


def test_pdf_merge_flow():
    client = TestClient(app)
    token = _register_and_login(client)
    fid1 = _upload_pdf(client, token, "a.pdf")
    fid2 = _upload_pdf(client, token, "b.pdf")
    r = client.post("/api/pdf/merge", json={"file_ids": [fid1, fid2]}, headers=_auth_headers(token))
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"], token)
    assert job["status"] == "success", job.get("error")
    out_id = job["result"]
    r = client.get(f"/api/download/{out_id}", headers=_auth_headers(token))
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_pdf_protect_unlock_flow():
    client = TestClient(app)
    token = _register_and_login(client)
    fid = _upload_pdf(client, token, "secret.pdf")
    r = client.post("/api/pdf/protect", json={"file_id": fid, "password": "abc"}, headers=_auth_headers(token))
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"], token)
    assert job["status"] == "success", job.get("error")
    enc_id = job["result"]

    r = client.get(f"/api/pdf/encrypted/{enc_id}", headers=_auth_headers(token))
    assert r.status_code == 200
    assert r.json()["encrypted"] is True

    r = client.post("/api/pdf/unlock", json={"file_id": enc_id, "password": "abc"}, headers=_auth_headers(token))
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"], token)
    assert job["status"] == "success", job.get("error")

    r = client.get(f"/api/pdf/encrypted/{job['result']}", headers=_auth_headers(token))
    assert r.json()["encrypted"] is False


def test_generate_document_flow():
    client = TestClient(app)
    token = _register_and_login(client)
    blocks = [
        {"type": "heading", "data": {"text": "Hello", "level": 1}},
        {"type": "paragraph", "data": {"text": "Generated document."}},
    ]
    r = client.post("/api/generate", json={"blocks": blocks, "format": "pdf"}, headers=_auth_headers(token))
    assert r.status_code == 200
    job = _await(client, r.json()["job_id"], token)
    assert job["status"] == "success", job.get("error")
    out_id = job["result"]
    r = client.get(f"/api/download/{out_id}", headers=_auth_headers(token))
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")


def test_rejects_unsupported_conversion():
    client = TestClient(app)
    token = _register_and_login(client)
    fid = _upload_pdf(client, token, "a.pdf")
    r = client.post("/api/convert", json={"file_id": fid, "target": "notaformat"}, headers=_auth_headers(token))
    assert r.status_code == 400


def test_rejects_exe():
    client = TestClient(app)
    token = _register_and_login(client)
    r = client.post("/api/upload", files={"file": ("evil.exe", io.BytesIO(b"MZ\x90\x00"), "application/octet-stream")}, headers=_auth_headers(token))
    assert r.status_code == 400


def test_formats_and_history():
    client = TestClient(app)
    token = _register_and_login(client)
    r = client.get("/api/formats")
    assert r.status_code == 200
    assert len(r.json()["formats"]) > 0
    r = client.get("/api/history", headers=_auth_headers(token))
    assert r.status_code == 200
    assert "history" in r.json()


def test_pdf_compare():
    client = TestClient(app)
    token = _register_and_login(client)
    from pypdf import PdfWriter
    from docx import Document

    # Create two PDFs with different text
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

    r1 = client.post("/api/upload", files={"file": ("a.pdf", buf1, "application/pdf")}, headers=_auth_headers(token))
    assert r1.status_code == 200
    r2 = client.post("/api/upload", files={"file": ("b.pdf", buf2, "application/pdf")}, headers=_auth_headers(token))
    assert r2.status_code == 200

    fid1 = r1.json()["id"]
    fid2 = r2.json()["id"]

    r = client.post("/api/compare", files={
        "file1": ("a.pdf", buf1, "application/pdf"),
        "file2": ("b.pdf", buf2, "application/pdf"),
    }, headers=_auth_headers(token))
    assert r.status_code == 200, r.text
    result = r.json()
    assert "file1" in result
    assert "file2" in result
    assert "diff" in result
    assert result["diff"]["added"] >= 0
    assert result["diff"]["removed"] >= 0


def test_full_user_journey():
    """Complete end-to-end user journey: register, login, upload, convert, generate, download, logout, relogin."""
    client = TestClient(app)

    # 1. Register (may already exist from prior run)
    r = client.post("/api/auth/register", json={
        "username": "journey_user",
        "email": "journey@example.com",
        "password": "journeypass123",
    })
    if r.status_code == 400 and "already registered" in r.text:
        pass  # user already exists, continue to login
    else:
        assert r.status_code == 200, r.text

    # 2. Login
    r = client.post("/api/auth/token", json={"username": "journey_user", "password": "journeypass123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = _auth_headers(token)

    # 3. Verify /me works
    r = client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200
    assert r.json()["username"] == "journey_user"

    # 4. Upload a document
    from reportlab.pdfgen import canvas as rl_canvas
    buf = io.BytesIO()
    c = rl_canvas.Canvas(buf)
    c.drawString(72, 720, "Test Document for Journey")
    c.drawString(72, 700, "This is a test file.")
    c.save()
    buf.seek(0)

    r = client.post("/api/upload", files={"file": ("journey.pdf", buf, "application/pdf")}, headers=headers)
    assert r.status_code == 200
    file_id = r.json()["id"]

    # 5. Convert the document to txt
    r = client.post("/api/convert", json={"file_id": file_id, "target": "txt"}, headers=headers)
    assert r.status_code == 200
    job = r.json()
    assert "job_id" in job

    import time
    deadline = time.time() + 30
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job['job_id']}", headers=headers)
        st = r.json().get("status")
        if st in ("success", "failure"):
            break
        time.sleep(0.2)
    assert st == "success", r.json().get("error")
    converted_id = r.json()["result"]

    # 6. Download the converted file
    r = client.get(f"/api/download/{converted_id}", headers=headers)
    assert r.status_code == 200

    # 7. Generate a new document
    blocks = [
        {"type": "heading", "data": {"text": "Journey Document", "level": 1}},
        {"type": "paragraph", "data": {"text": "Generated during end-to-end test."}},
    ]
    r = client.post("/api/generate", json={"blocks": blocks, "format": "pdf"}, headers=headers)
    assert r.status_code == 200
    job = r.json()
    deadline = time.time() + 30
    while time.time() < deadline:
        r = client.get(f"/api/jobs/{job['job_id']}", headers=headers)
        st = r.json().get("status")
        if st in ("success", "failure"):
            break
        time.sleep(0.2)
    assert st == "success", r.json().get("error")
    generated_id = r.json()["result"]

    # 8. Download the generated file
    r = client.get(f"/api/download/{generated_id}", headers=headers)
    assert r.status_code == 200
    assert r.content.startswith(b"%PDF")

    # 9. Check history shows the user's files
    r = client.get("/api/history", headers=headers)
    assert r.status_code == 200
    history = r.json()["history"]
    assert len(history) > 0
    # All history items should belong to this user
    for item in history:
        assert item.get("user_id") == "journey_user"

    # 10. Logout (client-side: clear token)
    headers = {}  # Simulate logout by removing token

    # 11. Verify unauthenticated access is rejected
    r = client.get("/api/history", headers=headers)
    assert r.status_code == 401

    # 12. Relogin and verify data persistence
    r = client.post("/api/auth/token", json={"username": "journey_user", "password": "journeypass123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    headers = _auth_headers(token)

    r = client.get("/api/history", headers=headers)
    assert r.status_code == 200
    history = r.json()["history"]
    assert len(history) > 0
    for item in history:
        assert item.get("user_id") == "journey_user"
