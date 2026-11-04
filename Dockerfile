FROM node:20-alpine

WORKDIR /app

# Install all deps (dev needed for builds)
COPY backend/package.json ./backend/package.json
COPY frontend/package.json ./frontend/package.json
RUN cd backend && npm install && cd ../frontend && npm install

# Copy source
COPY . .

# Build frontend + backend
RUN cd frontend && npm run build && cd ../backend && npm run build

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/app/storage

EXPOSE 3001

CMD ["node", "dist/server.js"]
