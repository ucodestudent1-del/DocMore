# Universal Document Studio — Development Roadmap

**Version:** 1.0 (Pre-Development Phase)  
**Base:** existing working FastAPI + Next.js monolith (55 backend tests passing, type-clean frontend)

---

## Guiding Principles

1. **No simulated behavior:** every button performs a real action; no fake conversions or placeholder successes.
2. **Don't break working code:** refactor behind stable interfaces; existing converters and routes keep functioning.
3. **Transparency:** if a conversion cannot preserve formatting, report it explicitly (`ConversionResult.status` + `notes`).
4. **Security by default:** documents private; AI keys server-side; malware scan on upload; RBAC enforced.

---

## Phase 1 — Foundation (Auth, Database, File Storage, Dashboard)

**Goal:** Harden the existing foundation; introduce DB-backed storage, Alembic migrations, S3 abstraction, refresh tokens, and a clean dashboard.

### Deliverables
1. **Alembic migrations** from current SQLAlchemy models (`alembic init`, autogenerate baseline).
2. **Storage abstraction** (`StorageBackend` interface): keep local FS as default; add `S3StorageBackend` (boto3) selectable via `STORAGE_BACKEND`. Move history/metadata from `history.json` to PostgreSQL `Upload`/`Output` tables.
3. **Auth hardening:** refresh tokens (http-only cookie) + session revocation table; access-token short TTL; password-reset/email-verify flows backed by DB (not in-memory `_USERS`).
4. **RBAC:** roles `user`/`admin` (enterprise via subscription tier); resource-scoped document access (private by default).
5. **Malware scan on upload:** ClamAV via `clamd` (optional; graceful degradation if unavailable).
6. **Dashboard (frontend):** file/folder list, recent conversions, quick-convert upload, download, delete; type-safe API client (`lib/api.ts`).
7. **Tests:** unit + integration for storage backends, auth flows, RBAC; target 60+ backend tests.

### Exit criteria
- Local PostgreSQL + Redis running via docker-compose; backend imports and serves on 8000.
- Upload → store → download round-trip works via DB-backed storage.
- Refresh token rotation + revocation tested.

### High-risk items
- Migrating JSON history to Postgres without data loss (one-time migration script).
- ClamAV not available on Windows dev (graceful fallback required).

---

## Phase 2 — Document Generation & Template Engine

**Goal:** Production-grade template-driven generation with placeholders, batch support, and multiple export formats.

### Deliverables
1. **Generation service** (`services/generation_service.py`) wrapping existing `generation.py` converters (reportlab PDF, python-docx DOCX, HTML/MD/TXT).
2. **Template library:** Invoice, Resume, Report, Certificate, Cover Letter, Meeting Minutes (existing `frontend/lib/templates.ts`).
3. **Placeholder fill-in:** `{{placeholder}}` extraction + form-driven fill (existing `TemplateForm.tsx`) wired to real generation endpoint.
4. **Batch generation:** multiple documents from one template + CSV/JSON data source (Celery job).
5. **Export formats:** PDF, DOCX, ODT, HTML, MD, TXT; EPUB added via Pandoc adapter.
6. **Fidelity notes:** report exact output format; flag ODT as repackaged DOCX (partial).

### Exit criteria
- Generate a real DOCX/PDF from a template with filled placeholders; downloadable output.
- Batch job produces N files; progress tracked via `Job` model.

### High-risk items
- Formatting preservation DOCX↔PDF (requires LibreOffice; mark as partial if absent).

---

## Phase 3 — Universal Conversion Engine

**Goal:** Complete the conversion matrix with adapter pattern and external engines.

### Deliverables
1. **External engine adapters:** LibreOffice headless (DOCX/PPTX→PDF), Pandoc (MD/HTML↔Docx/EPUB), ImageMagick/Sharp (image transforms), Tesseract (OCR) — all conforming to `ConverterEngine`.
2. **Registry completion:** full source→target matrix; `can_convert` + `status()` per entry; UI shows fidelity status per target.
3. **Format validation:** magic-byte + MIME + extension cross-check (existing `security.py`) extended to all 30 formats.
4. **Batch conversion:** multi-file upload → one job → per-file results; zip download option.
5. **Conversion API:** `POST /api/convert`, `GET /api/formats`, `GET /api/jobs/{id}` with WS progress.
6. **Tests:** conversion matrix tests for every done/partial entry; 55 → 80+ backend tests.

### Exit criteria
- Any supported source converts to every listed target (real files, real output).
- Unsupported/invalid input rejected with clear error + status code.

### High-risk items
- LibreOffice headless reliability in containers; headless profile timeouts.
- Format fidelity loss (fonts, complex tables) — must be surfaced in `notes`.

---

## Phase 4 — PDF Toolkit & Image Processing

**Goal:** Full PDF toolkit with real pypdf/reportlab processing + image pipeline.

### Deliverables
1. **PDF tools (existing, harden):** merge, split, rotate, rearrange, extract/delete pages, page numbers, watermark, header/footer, extract text/images/metadata, password protect/unlock, compress, repair, images→PDF, document comparison.
2. **OCR:** Tesseract multi-language; scanned PDF → searchable PDF; language selection UI.
3. **Image processing:** convert between PNG/JPG/WEBP/GIF/BMP/TIFF/SVG/ICO; resize/compress; images→PDF.
4. **Security:** password-protected PDF unlock with user-supplied password (never logged).
5. **Tests:** extend `test_pdf_tools.py`; every tool returns real processed bytes.

### Exit criteria
- Merge/split/protect/OCR produce valid, openable output files.
- Invalid/corrupt input rejected without crashing the worker.

### High-risk items
- OCR accuracy on low-quality scans; language pack availability (tesseract-ocr-all).
- pypdf encryption edge cases (older PDF versions).

---

## Phase 5 — Integrated Document Editor

**Goal:** Polished rich-text editor with autosave, version history, export.

### Deliverables
1. **Rich-text editor:** Tiptap or Lexical (server-side rendering of existing block generator as migration path).
2. **Autosave:** drafts saved to DB (`Document` + `DocumentVersion`) on change debounce; localStorage fallback offline.
3. **Version history:** list versions, diff view, restore to previous version.
4. **Export:** PDF/DOCX/HTML/MD via generation service; real file download.
5. **Collaboration skeleton:** document sharing (owner + invited users), permission model.

### Exit criteria
- Create/edit a document; autosave persists; restore a prior version; export real PDF/DOCX.

### High-risk items
- Rich-text ↔ DOCX/PDF round-trip formatting fidelity.
- Concurrent edit conflict resolution (last-write-wins acceptable for MVP).

---

## Phase 6 — AI Assistant Integration

**Goal:** Modular AI assistant for generation, rewrite, summarize, translate; keys never exposed to frontend.

### Deliverables
1. **AI service** (`services/ai_service.py`): provider abstraction (OpenAI, Anthropic, Google); server-side API keys only.
2. **Endpoints:** `POST /api/ai/generate`, `/ai/rewrite`, `/ai/summarize`, `/ai/translate`, `/ai/template-fill` (SSE streaming).
3. **Frontend:** AI panel in editor + generator; provider selection (admin-configurable); usage counted against tier limits.
4. **Safety:** content-length limits, basic profanity/PII scrub option, rate limiting per user.
5. **Tests:** mock provider responses; verify keys never appear in frontend bundles.

### Exit criteria
- Real AI-generated text inserted into a document; streamed to frontend; no API key in client code.

### High-risk items
- Provider API cost/rate limits; streaming disconnect handling.
- Prompt injection / PII leakage — server-side scrubbing required.

---

## Phase 7 — SaaS Subscription, Billing (Stripe), Usage Limits

**Goal:** Enforce tier-based usage quotas end-to-end with real Stripe payments.

### Deliverables
1. **Usage-limit engine:** `UsageRecord` per user/month; enforce conversions/day, file-size MB, concurrent jobs by tier (free/premium/enterprise).
2. **Stripe integration:** Checkout + customer portal; webhook idempotency; `customer.subscription.updated/deleted` → tier change.
3. **Pricing page:** tier comparison; upgrade/downgrade flow; invoice history.
4. **Quota middleware:** reject conversion/generation/job when limit reached (`402`/`403` with clear message).
5. **Tests:** webhook handler with stripe-mock; quota enforcement unit tests.

### Exit criteria
- Real Stripe checkout creates subscription; webhook updates user tier; quota blocks over-limit actions.

### High-risk items
- Stripe webhook signature verification in local dev (use stripe-cli / stripe-mock).
- Idempotent webhook handling (duplicate events must not double-charge/upgrade).

---

## Phase 8 — Admin Dashboard, Testing, Optimization, Deployment

**Goal:** Admin panel, full test suite, performance tuning, production deployment.

### Deliverables
1. **Admin frontend:** user management, tier override, system health (DB/Redis/worker status), revenue analytics (Stripe sync), job queue monitoring.
2. **Retention & deletion:** configurable retention per tier; automated cleanup job; GDPR "delete my data" endpoint (files + DB rows + S3 objects).
3. **Performance:** output caching, S3 presigned uploads/downloads, worker autoscaling hints, compression.
4. **Observability:** structured logging, request IDs, health endpoints (`/api/health`, `/api/ready`, `/api/live`).
5. **Testing:** 100+ backend tests; Playwright e2e for critical paths (upload→convert→download, auth, checkout); frontend `tsc --noEmit` clean; `ruff` clean.
6. **Deployment:** docker-compose (backend, frontend, worker, redis, postgres, minio optional); Railway deploy config; env var checklist.

### Exit criteria
- Admin panel manages users/tiers and views stats.
- Full test suite passes; lint clean; production build succeeds.

### High-risk items
- Admin panel security (must require `admin` role; audit log all actions).
- Production S3 credentials and Stripe keys must never be committed.

---

## High-Risk Technical Challenges & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Format fidelity loss (DOCX↔PDF, rich text) | User-visible broken layouts | LibreOffice headless adapter; `status()`/`notes` per conversion; mark complex cases "partial" |
| OCR accuracy / language packs | Unusable searchable PDFs | tesseract-ocr-all; language selection; warn on low-confidence scans |
| Batch job reliability at scale | Lost conversions | Celery + Redis with retries; idempotency keys; dead-letter queue; DB-backed job state |
| S3 migration from local FS | Data loss / broken links | Dual-write during transition; migration script with verification; keep local fallback |
| Stripe webhook security/duplicate events | Billing errors | Idempotency keys; stripe-mock in tests; signature verification |
| AI key leakage to frontend | Secret exposure | Server-side proxy only; grep CI for keys in frontend bundles; never log keys |
| GDPR deletion / retention | Compliance failure | Centralized deletion service; audit log; retention scheduler |
| Windows dev: no Docker / clamav | Inconsistent dev-prod | In-process job fallback; graceful ClamAV degradation; CI runs Linux |

---

## Immediate Next Steps (Week 1)

1. Run existing tests: `pytest backend/tests` and `cd frontend && npx tsc --noEmit`.
2. Initialize Alembic from current models; generate baseline migration.
3. Add new env vars to `.env.example` (S3, AI keys, ClamAV, retention hours).
4. Create `backend/app/services/` package skeleton + `StorageBackend` interface.
5. Update `docker-compose.yml` with `worker` service.
