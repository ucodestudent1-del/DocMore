FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    REDIS_URL=redis://redis:6379/0 \
    PORT=8000 \
    NEXT_PUBLIC_API_BASE=http://127.0.0.1:8000

# System dependencies for document processing
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice poppler-utils tesseract-ocr libmagic1 fonts-dejavu-core \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for Next.js build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Backend Python deps
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Build Next.js frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN cd /app && npm install --legacy-peer-deps 2>/dev/null || npm install --legacy-peer-deps
COPY frontend ./frontend
RUN cd /app/frontend && npm run build

# Backend code
COPY backend ./backend

EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
