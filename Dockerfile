FROM node:20-alpine

WORKDIR /app

# Backend dependencies
COPY backend/package.json ./backend/package.json
RUN cd backend && npm install

# Frontend dependencies
COPY frontend/package.json ./frontend/package.json
RUN cd frontend && npm install

# Copy source
COPY . .

# Build frontend to static HTML
RUN cd frontend && npm run build

# Build backend
RUN cd backend && npm run build

WORKDIR /app/backend

ENV NODE_ENV=production
ENV PORT=3001
ENV STORAGE_PATH=/app/storage

EXPOSE 3001

CMD ["node", "dist/server.js"]
