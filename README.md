# Universal Document Studio

A complete universal document converter and generator built with FastAPI (backend) and Next.js (frontend).

## Structure
- `backend/` — FastAPI document processing API
- `frontend/` — Next.js web application

## Backend setup
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

## Features
- Universal document conversion (PDF, DOCX, XLSX, PPTX, images, HTML, Markdown, CSV, JSON)
- PDF toolkit (merge, split, rotate, rearrange, watermark, page numbers, metadata, encryption)
- Document generation studio (PDF, DOCX, ODT, HTML, Markdown, TXT)
- Template library with placeholders and batch generation
- File security validation (magic bytes, size limits, path traversal prevention)

## Status
See `PROJECT_STATUS.md` for the implementation matrix.
