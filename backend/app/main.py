from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.api.routes import upload, convert, pdf, generate, history, download, formats, jobs, auth, compare
import os
from pathlib import Path

app = FastAPI(title="Universal Document Studio", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
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


@app.get("/api/health")
async def health():
    return {"status": "ok"}


# Serve Next.js frontend static files (built into /app/frontend/out)
FRONTEND_DIR = Path(__file__).resolve().parent.parent.parent / "frontend" / "out"
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
