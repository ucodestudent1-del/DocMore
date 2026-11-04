FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_OPTIONS=--max-old-space-size=1536

# Install system deps for native module compilation (esbuild, SWC, etc.)
RUN apk add --no-cache python3 make g++

# Install backend deps
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --no-audit --no-fund --jobs=1 --maxsemi=1

# Install frontend deps
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install --no-audit --no-fund --jobs=1 --maxsemi=1

# Copy source
COPY . .

# Build frontend + backend
RUN cd frontend && npm run build --no-audit --no-fund && cd ../backend && npx tsc

WORKDIR /app/backend

ENV PORT=3001
ENV STORAGE_PATH=/app/storage

EXPOSE 3001

CMD ["node", "dist/server.js"]
