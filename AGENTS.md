# Universal Document Studio — Project Context

**Repo:** `C:\Users\New User\Desktop\EveryDoc`  
**Phase:** Pre-Development (architecture + roadmap complete)

## Stack
- **Backend:** FastAPI 0.115, Python 3.12, PostgreSQL 15 (asyncpg/SQLAlchemy 2.0 async), Redis + Celery
- **Frontend:** Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui (Radix primitives), PWA
- **Processing:** pypdf, python-docx, openpyxl, python-pptx, reportlab, Pillow, Tesseract, LibreOffice (Docker)
- **Payments:** Stripe; **Storage:** local FS (default) + boto3 S3-compatible (config, not yet wired)
- **Tests:** pytest (55 passing), Playwright e2e scaffold; lint: ruff (backend), next lint (frontend)

## Key docs
- `ARCHITECTURE.md` — target architecture, service boundaries, adapter pattern, data model, dependencies
- `ROADMAP.md` — 8-phase roadmap, exit criteria, high-risk challenges
- `PROJECT_STATUS.md` — existing feature matrix (done/partial/planned)
- `README.md` — quick start, env vars, API endpoints

## Working directory conventions
- Python: `backend/` (uvicorn `app.main:app`, port 8000)
- Node: `frontend/` (`npm run dev`, port 3000)
- Do NOT overwrite working code; refactor behind stable interfaces.
- No AI API keys in frontend; server-side only.
- Every conversion must produce a real file; report fidelity status transparently.

## Toolchain
- Python 3.12.10, Node 24.18.0, npm 12.0.2 — Docker NOT available in this shell.
- Backend tests: `cd backend && pytest tests/`
- Frontend typecheck: `cd frontend && npx tsc --noEmit`
- Lint: `ruff check .` (backend), `npm run lint` (frontend)

## Immediate next steps
1. Run existing tests to confirm green baseline.
2. Initialize Alembic migrations from current SQLAlchemy models.
3. Add new env vars to `.env.example` (S3, AI, ClamAV, retention).
4. Create `backend/app/services/` skeleton + `StorageBackend` interface.
