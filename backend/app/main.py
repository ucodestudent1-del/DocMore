from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from starlette.types import Scope
from app.api.routes import (
    auth,
    analysis,
)
from app.config import FRONTEND_URL
from app.middleware.security import SecurityHeadersMiddleware, CSRFMiddleware, RateLimitMiddleware
from app.database import init_db
from app.prisma_client import connect_db, disconnect_db
import os
from pathlib import Path

app = FastAPI(title="Rental Property Analyzer", version="1.0.0")


@app.on_event("startup")
async def on_startup():
    await init_db()
    await connect_db()


@app.on_event("shutdown")
async def on_shutdown():
    await disconnect_db()


# Consistent error response format
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": True, "message": exc.detail, "status_code": exc.status_code},
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={"error": True, "message": "Internal server error", "status_code": 500},
    )


# Security middleware (order matters - outer middleware wraps inner)
app.add_middleware(SecurityHeadersMiddleware)
app.add_middleware(CSRFMiddleware)
app.add_middleware(RateLimitMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL] if FRONTEND_URL else ["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth")
app.include_router(analysis.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve Next.js frontend static files (built into /app/frontend/out)
FRONTEND_DIR = Path(os.environ.get("FRONTEND_DIR", str(Path(__file__).resolve().parent.parent.parent / "frontend" / "out")))
if FRONTEND_DIR.exists():

    class SPAStaticFiles(StaticFiles):
        """StaticFiles that falls back to index.html for SPA routing (Next.js export).

        Static assets under /_next/ are never rewritten to index.html —
        they must return proper 404s if missing so browsers don't interpret
        HTML as CSS/JavaScript (strict MIME type checking).

        Extensionless routes (e.g. /analyzer) are resolved to their .html
        counterpart (e.g. /analyzer.html) for Next.js static export compatibility.
        """

        async def get_response(self, path: str, scope: Scope):
            # Never apply SPA fallback to Next.js static/data assets.
            if path.startswith("_next/"):
                return await super().get_response(path, scope)

            # Try the exact path first
            response = await super().get_response(path, scope)
            if response.status_code != 404:
                return response

            # Try path + ".html" for Next.js static export routes
            html_response = await super().get_response(path + ".html", scope)
            if html_response.status_code != 404:
                return html_response

            # Fall back to index.html for SPA routing
            index = FRONTEND_DIR / "index.html"
            if index.exists():
                return FileResponse(str(index))
            return response

    app.mount("/", SPAStaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
else:
    @app.get("/")
    async def root():
        return {"detail": "Frontend not built. Visit /api/health"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
