from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import upload, convert, pdf, generate, history, download, formats, jobs, auth, compare
import os

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

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
