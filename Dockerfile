FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    REDIS_URL=redis://redis:6379/0 \
    PORT=8000 \
    PYTHONPATH=/app \
    STORAGE_BACKEND=local

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice poppler-utils tesseract-ocr libmagic1 fonts-dejavu-core \
    clamav clamav-daemon imagemagick pandoc \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/* \
    && freshclam 2>/dev/null || true

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Generate Prisma client
RUN cd /app/backend && prisma generate

# Install frontend dependencies and build static export
COPY frontend/package.json ./frontend/package.json
RUN cd /app/frontend && npm install --legacy-peer-deps
COPY frontend ./frontend
RUN cd /app/frontend && npm run build

EXPOSE 8000

# Default: run the API server. Override command for the worker service:
#   celery -A app.celery_app worker --loglevel=info --concurrency=2
CMD ["sh", "-c", "cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
