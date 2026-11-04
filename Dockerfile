FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048

# Install system deps for native module compilation
RUN apk add --no-cache python3 make g++

# Install backend deps
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --no-audit --no-fund --legacy-peer-deps --verbose

# Install frontend deps
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install --no-audit --no-fund --legacy-peer-deps --verbose

# Copy source
COPY . .

# Build frontend + backend
RUN cd frontend && npm run build --no-audit --no-fund && cd ../backend && npm run build

WORKDIR /app/backend

ENV PORT=3001
ENV STORAGE_PATH=/app/storage

EXPOSE 3001

CMD ["node", "dist/server.js"]
