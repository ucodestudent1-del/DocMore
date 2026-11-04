FROM node:20-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV NODE_OPTIONS=--max-old-space-size=2048

# Install backend deps
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install --no-audit --no-fund --legacy-peer-deps

# Install frontend deps
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install --no-audit --no-fund --legacy-peer-deps

# Copy source
COPY . .

# Build frontend + backend
RUN cd frontend && npm run build --no-audit --no-fund && cd ../backend && npm run build

WORKDIR /app/backend

ENV PORT=3001
ENV STORAGE_PATH=/app/storage

EXPOSE 3001

CMD ["node", "dist/server.js"]
