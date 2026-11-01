FROM python:3.12-slim

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    REDIS_URL=redis://redis:6379/0 \
    PORT=8000 \
    PYTHONPATH=/app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice poppler-utils tesseract-ocr libmagic1 fonts-dejavu-core \
    curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js for frontend build
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend ./backend

# Copy frontend and build
COPY frontend/package.json frontend/package-lock.json* ./
RUN cd /app && npm install --legacy-peer-deps
COPY frontend ./frontend
RUN cd /app/frontend && npm run build

EXPOSE 8000

CMD ["sh", "-c", "cd /app/backend && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]