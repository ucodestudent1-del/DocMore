FROM node:20-alpine

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536

# Install system deps for native module compilation (esbuild, SWC, etc.)
RUN apk add --no-cache python3 make g++

# Install backend deps (lockfile-based, reproducible; dev included for build)
COPY backend/package.json backend/package-lock.json ./backend/
RUN cd backend && npm ci --no-audit --no-fund --jobs=1 --maxsemi=1

# Install frontend deps (lockfile-based, reproducible; dev included for build)
COPY frontend/package.json frontend/package-lock.json ./frontend/
RUN cd frontend && npm ci --no-audit --no-fund --jobs=1 --maxsemi=1

# Copy source
COPY . .

# Build frontend + backend (dev deps available since NODE_ENV not yet production)
RUN cd frontend && npm run build --no-audit --no-fund && cd ../backend && ./node_modules/.bin/tsc

# Runtime environment
ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/app/storage

WORKDIR /app/backend

EXPOSE 3001

CMD ["node", "dist/server.js"]
