# EveryDoc — Site-Wide Technical Audit & Fix Plan

**Status:** Implementation-ready plan.  
**Scope:** Entire FastAPI backend + Next.js frontend. All findings reference `file:line`.

---

## COMPLETED (already implemented in prior code phase)

### Phase 1 — Auth unification & authorization (critical) ✅
1. Migrated `app/auth.py` to SQLAlchemy/PostgreSQL-backed auth — removed in-memory `_USERS` dict; all lookups/mutations now hit the DB via `async_session`.
2. Fixed `app/api/routes/admin.py` — removed invalid `await` on sync functions; `get_user_by_username(db, username)` signature fixed; `role` applied on update; real `created_at` returned; `delete_user` cascades.
3. Fixed auth flows — `generate_email_verification` 2-arg call; `request_password_reset`/`reset_password` use consistent email identifier; `verify-email` sets `is_verified=true`.
4. Authorization hardening — removed `tier` from user-updatable fields; `require_admin` checks `role=="admin"` not `tier=="enterprise"`.

### Phase 2 — Router & job/history plumbing ✅
5. Router hygiene (`main.py`) — removed duplicate `auth.router` mount; added `jobs.router`; removed duplicate `/jobs/{job_id}` from `pdf.py`.
6. History persistence (`app/storage.py`) — `_load_history()` called at module import so `history.json` survives restarts.

### Phase 3 — Functional fixes ✅
7. `frontend/lib/api.ts:runAsyncJob` — propagates real output `ext`/`name` from history instead of hardcoding `"pdf"`/`"result"`.
8. `app/tasks.py` extract-images — zips extracted images into real `.zip` output instead of `b"images-extracted"` ext `"dir"`.
9. `app/api/routes/pdf.py:images_to_pdf` — routes through `storage.save_upload`+`validate_upload`; removed unvalidated temp-file writes.
10. `app/api/routes/pdf.py:pdf_metadata` — closed file handle with `with open(...) as f`.
11. `app/auth.py:delete_account` — cascades deletes user uploads/outputs/jobs via ORM relationships.

### Phase 4 — Assets & environment ✅
12. Added `/icon-192.png` and `/icon-512.png` to `frontend/public/`.
13. Frontend build verified — `npm run build` succeeds, all 13 pages exported to `frontend/out/`.
14. Backend mounts `frontend/out` via `StaticFiles(html=True)` at `/` (`main.py:80-83`).

---

## REMAINING ISSUES — NOT YET FIXED (need implementation)

### Critical — will crash at runtime

**A. `rate_limiter.py` calls `get_tier` with wrong signature** (`app/rate_limiter.py:11,46`)
- Imports `from app.auth import get_tier` and calls `await get_tier(username)`.
- The new `get_tier(db: AsyncSession, username: str)` requires a db session as first arg.
- **Result:** `TypeError: get_tier() missing 1 required positional argument: 'db'` → every rate-limited endpoint (upload, convert, generate, pdf) crashes with 500.
- **Fix:** Replace `get_tier` import with direct DB lookup using `async_session` + `select(User)` inside rate_limiter (no dependency on auth.get_tier).

**B. `convert.py` has no file-ownership check** (`app/api/routes/convert.py:26-28`)
- `storage.read_file(req.file_id)` finds a file by stem but never checks `user_id`.
- **Result:** Any authenticated user can convert any file by guessing its `file_id` — broken access control / data isolation violation.
- **Fix:** Add `storage.get_file_entry(file_id, current_user["username"])` check before conversion, same pattern as `pdf.py:_require_file`.

**C. `tasks.py` `_run_conversion` / `_run_pdf_tool` re-read files without ownership** (`app/tasks.py:21,49`)
- Tasks re-read source files via `st.read_file(file_id)` which doesn't filter by user.
- Though PDF routes pre-check ownership via `_require_file`, the task layer itself is not isolated.
- **Fix:** Pass `user_id` into `_run_conversion`/`_run_pdf_tool` and use `get_file_entry(file_id, user_id)` instead of `read_file`.

### High — security / configuration

**D. CORS `allow_origins=["*"]` + `allow_credentials=True`** (`app/main.py:41-46`)
- Browsers reject wildcard origin when credentials are enabled; frontend API calls may fail in production.
- **Fix:** Replace `allow_origins=["*"]` with explicit origins from `FRONTEND_URL` env var.

**E. `rate_limiter.py` imports `get_tier` from auth** — creates coupling and will break (see A above).
- **Fix:** Remove auth dependency; do direct DB tier lookup.

**F. `storage.py` S3Backend `save_upload`/`save_output` don't call `_load_history()`** (`app/storage.py:280-284, 319-322`)
- Local backend calls `_load_history()`; S3 backend doesn't, so S3 history starts empty and is never persisted to a file (it's only in-memory per-instance).
- **Fix:** Add `_load_history()` calls in S3 backend methods, mirroring LocalStorageBackend.

### Medium — correctness / deprecation

**G. `generation.py` uses deprecated `datetime.utcnow()`** (`app/generation.py:348`)
- `datetime.utcnow()` is deprecated in Python 3.12; emits DeprecationWarning on ODT generation.
- **Fix:** Replace with `datetime.now(timezone.utc)`.

**H. `generation.py` `_escape` defined after use** (`app/generation.py:485`, used at line 379)
- Works due to Python late binding but is poor style / fragile.
- **Fix:** Move `_escape` definition above `_render_html`.

**I. CSRF is pass-through** (`app/middleware/security.py:113-115`)
- CSRF enforcement explicitly deferred; frontend never sends `X-CSRF-Token`.
- Known deferred issue — document as requiring frontend CSRF token flow before enabling enforcement.

---

## IMPLEMENTATION TASKS (remaining, in order)

1. Fix `rate_limiter.py` — direct DB tier lookup via `async_session` + `select(User)`; remove `from app.auth import get_tier`.
2. Fix `convert.py` — add `storage.get_file_entry(file_id, current_user["username"])` ownership check before `read_file`.
3. Fix `tasks.py` — pass `user_id` into `_run_conversion`/`_run_pdf_tool`; use `get_file_entry(file_id, user_id)` instead of `read_file`.
4. Fix `main.py` — CORS: replace `allow_origins=["*"]` with explicit origins from `FRONTEND_URL`.
5. Fix `storage.py` S3Backend — add `_load_history()` calls in `save_upload`/`save_output`.
6. Fix `generation.py` — `datetime.utcnow()` → `datetime.now(timezone.utc)`; move `_escape` above `_render_html`.
7. Add regression tests: rate limiter with DB, convert ownership rejection, CORS preflight, history persistence.
8. Run full test suite + `npx tsc --noEmit` + `ruff check .` + `next lint`.
9. Build frontend (`npm run build`) and verify `frontend/out/` is complete.

---

## VALIDATION PLAN

- Backend: `pytest tests/` — all tests must pass (20 integration/auth tests require PostgreSQL via `docker-compose up`; 62 non-DB tests pass without it).
- Frontend: `npx tsc --noEmit` — clean; `npm run build` — successful export.
- Lint: `ruff check .` (backend), `next lint` (frontend).
- E2E smoke: register → login → upload → convert → download; verify correct ext/name label; admin (role=admin) can list/update users; non-admin gets 403 on `/api/admin/*`; convert of another user's file returns 403; extract-images returns real image bytes.
- Confirm `history.json` loads on server restart.
- Confirm no `ConnectionRefusedError` when PostgreSQL is running.

---

## EXTERNAL SERVICES / CREDENTIALS REQUIRED (not simulated)

- **PostgreSQL 15** — required for DB-backed auth, admin, stats, rate limits (`docker-compose.yml`).
- **Redis** — required for Celery background jobs and Redis rate limiting (`docker-compose.yml`).
- **Stripe** — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` needed for real payments; without them `/api/payments/checkout` returns 503.
- **SendGrid** — `SENDGRID_API_KEY` needed for real email delivery; without it, email verification/reset tokens are generated but not sent (returned in response for testing).
- **S3/MinIO** — only needed if `STORAGE_BACKEND=s3`; local filesystem is default.
- **poppler-utils, tesseract-ocr, libreoffice** — needed for OCR, DOCX→PDF, PPTX→PDF; Dockerfile installs these. Without them, those endpoints return "not available" errors.
- **libmagic / python-magic** — needed for MIME detection; pure-Python fallback available on Windows.

---

## ROLLOUT

Apply remaining fixes 1–6 in order (rate_limiter and convert ownership are crash/security blockers), then tests 7–9. Do not commit unless explicitly requested.