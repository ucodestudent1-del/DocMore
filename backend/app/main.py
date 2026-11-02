from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from app.api.routes import upload, convert, pdf, generate, history, download, formats, jobs, auth, compare, admin
from app.middleware.security import SecurityHeadersMiddleware, CSRFMiddleware, RateLimitMiddleware
from app.database import init_db
import os
from pathlib import Path

app = FastAPI(title="Universal Document Studio", version="1.0.0")


@app.on_event("startup")
async def on_startup():
    await init_db()


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
    allow_origins=["*"],  # In production, restrict to specific domains
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(upload.router, prefix="/api")
app.include_router(convert.router, prefix="/api")
app.include_router(pdf.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(download.router, prefix="/api")
app.include_router(formats.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(compare.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(payments.router, prefix="/api/payments")
app.include_router(admin.router)


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve Next.js frontend static files (built into /app/frontend/out)
FRONTEND_DIR = Path(os.environ.get("FRONTEND_DIR", str(Path(__file__).resolve().parent.parent.parent / "frontend" / "out")))
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        index = FRONTEND_DIR / "index.html"
        if index.exists():
            return FileResponse(str(index))
        return {"detail": "Not Found"}
else:
    @app.get("/")
    async def root():
        return {"detail": "Frontend not built. Visit /api/health"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)