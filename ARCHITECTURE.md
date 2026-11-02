# Universal Document Studio — Technical Architecture

**Version:** 1.0 (Pre-Development Phase)  
**Status:** Proposed  
**Repo:** `C:\Users\New User\Desktop\EveryDoc`

---

## 1. Executive Summary

Universal Document Studio is an all-in-one SaaS for document generation, conversion, editing, and PDF toolkit. The repository already contains a working FastAPI + Next.js monolith (auth, conversion registry, PDF toolkit, generation, Stripe billing, admin routes, PWA frontend) with 55 passing backend tests and a type-clean frontend.

This document defines the target architecture that evolves the current monolith into a modular, service-oriented platform while preserving all existing, working functionality.

**Guiding principle:** Do not overwrite working code. Refactor incrementally behind stable interfaces.

---

## 2. Current State Assessment

### What exists (done / tested)

| Area | Stack | Status |
|------|-------|--------|
| API | FastAPI 0.115, Python 3.12 | Running |
| Auth | JWT (pyjwt) + bcrypt, register/login/reset/verify | Working |
| DB | PostgreSQL 15 (asyncpg, SQLAlchemy 2.0 async) | Models + init |
| Jobs | Celery + Redis; in-process thread fallback | Working |
| Storage | Local FS + JSON history (`data/uploads`, `outputs`, `temp`, `history.json`) | Working |
| Conversion | Adapter pattern: `ConverterEngine` base + registry (PDF, DOCX, XLSX, PPTX, Image, HTML, Markdown) | 30+ formats |
| PDF toolkit | pypdf + reportlab (merge/split/rotate/watermark/protect/OCR/compress/repair/compare) | Working |
| Generation | reportlab + python-docx, placeholder templates | Working |
| Payments | Stripe Checkout + webhooks, free/premium/enterprise tiers | Working |
| Admin | User/tier management, stats | Backend routes only |
| Frontend | Next.js 15, React 18, TS, Tailwind, shadcn/ui primitives, PWA | Working (no admin panel) |
| Tests | 55 pytest (unit + integration); Playwright e2e scaffold | Passing |

### Gaps vs. vision

| Vision requirement | Current state | Gap |
|--------------------|---------------|-----|
| Modular services (Auth/Generation/Conversion/PDF/OCR/AI/Storage/Billing/Jobs) | Single FastAPI app with internal modules | Needs service boundaries / package structure |
| Conversion adapter pattern | `ConverterEngine` base + registry | Present; extend to external engines (LibreOffice, Pandoc, Tesseract, ImageMagick, Sharp) |
| RBAC + secure sessions | JWT + `user`/`admin` role | Needs refresh tokens, session revocation, granular permissions |
| Malware scanning | Magic-byte validation only | No AV/clamav/YARA scanning |
| Data retention/deletion | `cleanup_old()` (24h local) | No formal retention policy, GDPR-style deletion, per-user quotas |
| S3-compatible object storage | boto3 configured, unused; local FS only | Implement S3/MinIO backend |
| Usage-limit engine | `TIER_LIMITS` dict, rate limiter | Enforce per-user conversion quotas, file-size caps, concurrent jobs |
| AI assistant | None | New service + provider abstraction (OpenAI/Anthropic/Google), keys server-side only |
| Admin dashboard | Backend routes only | No frontend admin UI |
| Rich-text editor | Block-based generator (no real-time collaborative editor) | Needs polished editor with version history + autosave |

---

## 3. Target Architecture

### 3.1 Service boundaries (logical, deployable together or separately)

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend (Port 3000)           │
│  Dashboard / Converter / PDF Tools / Generator / Editor     │
│  Admin Panel / Settings / Auth UI                           │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS / REST + WebSocket
┌─────────────────────────────────────────────────────────────┐
│                 API Gateway (FastAPI, Port 8000)            │
│  Auth, rate limiting, CSRF, security headers, routing       │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌──────────┬──────────┬──────────┬──────────┐
        ▼          ▼          ▼          ▼          ▼
   ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐  ┌───────┐
   │ Auth  │  │ Convert│  │ PDF   │  │ Gen   │  │ AI    │
   │ Svc   │  │ Svc   │  │ Toolkit│ │ Svc   │  │ Svc   │
   └───────┘  └───────┘  └───────┘  └───────┘  └───────┘
        │          │          │          │          │
   ┌─────────────────────────────────────────────────────┐
   │  Storage Svc (S3/MinIO + local FS)   │  Jobs (Celery+Redis) │
   └─────────────────────────────────────────────────────┘
        │
   ┌─────────────────────────────────────────────────────┐
   │  PostgreSQL (users, uploads, outputs, jobs, subs)   │
   └─────────────────────────────────────────────────────┘
```

In Phase 1 these remain packages inside one FastAPI app (`backend/app/services/{auth,convert,pdf,generation,ai,storage,billing,jobs}/`) to avoid premature distribution complexity. Each package exposes a stable interface so they can be extracted into separate services later.

### 3.2 Adapter pattern (conversion)

`backend/app/converters/base.py` already defines `ConverterEngine` + `ConversionResult`. Extend it:

- **Built-in adapters** (existing): PDF, DOCX, XLSX, PPTX, Image, HTML, Markdown.
- **External-engine adapters** (new): LibreOffice headless (DOCX/PPTX→PDF fidelity), Pandoc (MD/HTML↔Docx/EPUB), Tesseract (OCR), ImageMagick/Sharp (image processing), ClamAV (malware).
- Each adapter declares `can_convert(src, tgt)` and reports `status()` (done/partial/experimental/not_implemented) so the UI can transparently communicate fidelity limits.
- Registry (`backend/app/registry.py`) maps source→target→engine; `convert()` returns `ConversionResult` with `notes` explaining any preservation loss.

### 3.3 Data model (PostgreSQL)

Existing models (`backend/app/models.py`): `User`, `Upload`, `Output`, `Job`, `Subscription`. Add:
- `Document` (folder/file entity, owner, parent folder, version head)
- `DocumentVersion` (immutable snapshots for version history)
- `Folder` (user-owned file management tree)
- `AuditLog` (security/reten­tion actions)
- `UsageRecord` (per-user, per-month conversion counters for quota enforcement)

Keep existing tables; add new ones via Alembic migrations (introduce Alembic).

### 3.4 Security & compliance

- **Auth:** JWT access (short-lived) + refresh tokens stored in http-only cookies; session table with revocation; password policy; MFA skeleton (TOTP).
- **RBAC:** roles `user`, `premium`, `enterprise`, `admin`; resource-scoped policies (documents private by default, owner + shared-with access).
- **File safety:** magic-byte validation (existing) + ClamAV/YARA malware scan on upload; randomized filenames; path-traversal prevention (existing); virus-quarantine bucket.
- **Rate limiting:** per-user, per-tier (existing `rate_limiter.py`) + per-endpoint burst limits.
- **Retention:** configurable retention per tier; automated deletion jobs; GDPR "delete my data" endpoint removing user files + DB rows + S3 objects.
- **Secrets:** never log AI API keys; server-side only; environment-variable injection.

### 3.5 Storage abstraction

`backend/app/storage.py` currently local-FS + JSON. Introduce a `StorageBackend` interface:
- `LocalStorageBackend` (existing behavior)
- `S3StorageBackend` (boto3, S3/MinIO-compatible, configurable via `AWS_S3_ENDPOINT_URL`)

Select via env `STORAGE_BACKEND=local\|s3`. History/metadata moves from JSON to PostgreSQL (`Upload`/`Output`/`Document` tables).

### 3.6 Jobs & progress

Celery + Redis (existing) with in-process fallback. Add WebSocket endpoint (`/api/jobs/{job_id}/ws`) for real-time progress polling fallback retained. Idempotency keys for batch jobs; retry/backoff; dead-letter for failed conversions.

### 3.7 AI assistant (new)

Server-side `AIService` with provider abstraction:
- Providers: OpenAI, Anthropic, Google Gemini (configurable; at least one required).
- Capabilities: generate, rewrite, summarize, translate, template-fill.
- Keys stored server-side (`AI_PROVIDER_API_KEY_*` env); frontend never sees keys; proxy endpoint `/api/ai/...` with per-user rate limits and content filtering.
- Streaming responses via SSE/WebSocket.

### 3.8 Billing & usage limits

Stripe (existing `payments.py`) + `UsageRecord` table. Enforce:
- Free: 10 conversions/day, 10 MB file, 1 concurrent job
- Premium: 100/day, 50 MB, 5 concurrent
- Enterprise: 1000/day, 100 MB, 20 concurrent
Checkout session → webhook → update `Subscription.tier` + `User.tier`.

---

## 4. Dependency List

### Backend (`backend/requirements.txt`) — additions

| Package | Purpose |
|---------|---------|
| alembic | DB migrations |
| python-jose[cryptography] | (already) JWT |
| passlib[bcrypt] | password hashing (alternative to direct bcrypt) |
| python-multipart | (already) file uploads |
| email-validator | (already) email validation |
| boto3 | (already) S3-compatible storage |
| clamd / clamav | malware scanning (system dep: clamav-daemon) |
| openai | AI provider |
| anthropic | AI provider |
| google-generativeai | AI provider |
| sse-starlette | server-sent events for AI streaming |
| websockets | job progress WS |
| stripe | (already) billing |
| sendgrid | (already) transactional email |
| pytest, pytest-asyncio, httpx | (already) testing |
| ruff | linting |

### System dependencies (Dockerfile)

Already: `libreoffice poppler-utils tesseract-ocr libmagic1 fonts-dejavu-core`.  
Add: `clamav clamav-daemon`, `imagemagick`, `poppler-utils` (already), `pandoc` (optional, for EPUB/advanced doc conversion).

### Frontend (`frontend/package.json`) — additions

| Package | Purpose |
|---------|---------|
| @tanstack/react-query | server state / job polling |
| zod | (already) form validation |
| lucide-react | (already) icons |
| sonner | (already) toasts |
| framer-motion | animations |
| pdf.js / react-pdf | PDF preview in editor |
| tiptap / lexical | rich-text editor (Phase 5) |
| aws-sdk / @aws-sdk/client-s3 | direct S3 uploads (presigned URLs) |
| chart.js / recharts | admin analytics |
| date-fns | (already) dates |

---

## 5. File / Package Layout (target)

```
backend/
  app/
    main.py                  # FastAPI app, middleware, routers
    config.py                # env config
    database.py              # async engine/session, init_db
    models.py                # SQLAlchemy models (+ Alembic)
    security.py              # validation, sanitization, malware
    auth.py                  # JWT, refresh, sessions, deps
    rate_limiter.py          # per-tier rate limiting
    jobs.py                  # enqueue/get_job (Celery + fallback)
    storage.py               # StorageBackend interface + local/s3 impls
    registry.py              # ConversionRegistry
    converters/
      base.py                # ConverterEngine, ConversionResult
      pdf.py, docx.py, xlsx.py, pptx.py, image.py, html.py, md.py
      libreoffice.py, pandoc.py, tesseract.py, imagick.py   # new external adapters
    services/
      auth_service.py
      conversion_service.py
      pdf_service.py
      generation_service.py
      ai_service.py          # new
      storage_service.py
      billing_service.py
      job_service.py
    api/routes/
      auth.py, convert.py, pdf.py, generate.py, history.py,
      download.py, formats.py, jobs.py, compare.py,
      payments.py, admin.py, ai.py, documents.py, folders.py
    celery_app.py
    tasks.py                 # registered Celery tasks
    alembic/                 # migrations (new)
  tests/
frontend/
  app/
    (pages) convert, pdf-tools, generate, dashboard, history,
    settings, login, register, templates, admin (new), editor (new)
  components/ui/             # shadcn primitives
  lib/
    api.ts                   # typed fetch client
    templates.ts
  public/
    manifest.json, sw.js
```

---

## 6. Infrastructure

| Component | Local dev | Production |
|-----------|-----------|------------|
| API | uvicorn | uvicorn / gunicorn + workers |
| Frontend | `next dev` | `next start` (static export optional) |
| DB | PostgreSQL 15 (Docker) | Managed PostgreSQL |
| Cache/Jobs | Redis 7 (Docker) | Managed Redis / ElastiCache |
| Worker | `celery -A app.celery_app worker` | dedicated worker containers |
| Storage | local `data/` | S3 / MinIO |
| Malware | clamd (optional) | ClamAV sidecar |
| Deployment | docker-compose (backend, frontend, redis, postgres) | Railway / Docker / ECS |

`docker-compose.yml` currently: backend, frontend, redis, postgres. Add `worker` service and `minio` (optional) service.

---

## 7. End-to-End Data Flow (conversion example)

1. Client uploads file → `POST /api/upload` (auth + validation + malware scan + storage).
2. Client requests conversion → `POST /api/convert` (rate limit + quota check → enqueue job → return `job_id`).
3. Celery worker picks task → `ConverterRegistry.convert()` → adapter → output to storage.
4. Progress pushed via WS or polled `GET /api/jobs/{id}`.
5. Client downloads → `GET /api/download/{file_id}` (owner-scoped, signed/presigned if S3).
6. History recorded in `Output` + `Job`; retention clock starts.

---

## 8. Pre-Development Sign-off Checklist

- [ ] Existing tests pass (`pytest backend/tests`, `tsc --noEmit` frontend)
- [ ] Alembic initialized from current SQLAlchemy models
- [ ] `.env.example` updated with new vars (S3, AI keys, ClamAV, retention)
- [ ] Architecture reviewed with stakeholders
