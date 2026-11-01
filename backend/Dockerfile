FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    REDIS_URL=redis://redis:6379/0 \
    PORT=8000 \
    PYTHONPATH=/app \
    FRONTEND_DIR=/app/frontend/out

# System dependencies for full document processing:
# - libreoffice: DOCX/PPTX -> PDF conversion
# - poppler-utils: PDF page rasterization (pdf2image)
# - tesseract-ocr: OCR scanned documents
# - libmagic1: python-magic file type detection
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice poppler-utils tesseract-ocr libmagic1 fonts-dejavu-core \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Python dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Install frontend dependencies and build static export
COPY frontend/package.json frontend/package-lock.json* ./frontend/
RUN cd /app/frontend && npm install --legacy-peer-deps
COPY frontend ./frontend
RUN cd /app/frontend && npm run build

# Copy backend source code
COPY backend ./backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
