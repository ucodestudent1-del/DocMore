# EveryDoc — Site-Wide Technical Audit & Fix Plan

**Status:** Implementation-ready plan (no source changes made in this turn).  
**Scope:** Entire FastAPI backend + Next.js frontend. All findings reference `file:line`.

---

## Audit summary — identified issues (detailed report)

### Critical — correctness / security (block operational integrity)

1. **Dual user stores; admin panel broken (privilege + data isolation).**
   - Auth is in-memory `_USERS` dict: `app/auth.py:18,97` (`create_user`, `get_user_by_username`, `verify_password`, `update_user_profile`, `delete_account` all touch `_USERS`).
   - Admin routes use SQLAlchemy PostgreSQL `User` model: `app/api/routes/admin.py`, `app/database.py`, `app/models.py`.
   - `admin.py:75` — `await get_user_by_username(db, username)` but `auth.get_user_by_username` is a **sync, 1-arg** function → `TypeError` → `GET /api/admin/users/{username}` 500s.
   - `admin.py:96` — `await update_user_profile(username, tier=..., role=...)` but `auth.update_user_profile` is sync and ignores `role` → 500 / role never applied.
   - Consequence: registered users exist only in-memory; admin sees zero users; stats always zero; admin cannot manage real accounts.
2. **Privilege escalation to admin.** `require_admin` checks `tier=="enterprise"` (`auth.py:286`), not `role=="admin"`. `PUT /api/auth/me` allows any user to set `tier` (`auth.py:226` updates `email`/`tier`) → a free user can self-assign `enterprise` and then access all admin routes.
3. **Resend-verification crashes.** Route calls `generate_email_verification(req.username)` with 1 arg (`auth.py:146`) but the function requires `(username, email)` (`auth.py:180`) → `TypeError`.
4. **Password-reset / email-verification flows broken.** `request_password_reset` passes `req.username` into `create_password_reset_token(email=…)` then looks up `get_user_by_email(req.username)` (`auth.py` routes:156-164) — identifier mismatch; `verify-email` never sets `is_verified`, so verification never activates an account.
5. **History not persisted.** `storage._load_history()` is defined but never called (`app/storage.py:25-34`); `_history` starts `[]`, is in-memory only, and `_save_history` overwrites `history.json` with session-only data → lost on restart.
6. **Job router never registered.** `jobs.router` (`app/api/routes/jobs.py`) is never `include_router`'d in `main.py`, so `/api/jobs` list endpoint is unavailable. `/api/jobs/{job_id}` only works because `pdf.py:248` duplicates it.
7. **Duplicate `auth.router` inclusion** — `main.py:55` and `main.py:57` both mount `/api/auth`.

### High — functional / reliability

8. **`runAsyncJob` mislabels every result.** `frontend/lib/api.ts:253` hardcodes `ext:"pdf"` and `name:"result"` → convert-to-txt/docx/jpg cards display "PDF"/"result" regardless of actual output. (Download link itself works via file_id.)
9. **PDF extract-images doesn't deliver images.** `app/tasks.py:113-114` saves `b"images-extracted"` with ext `"dir"`; download returns a placeholder text file, not extracted images.
10. **`/pdf/images-to-pdf` bypasses validation & leaks temp files.** `app/api/routes/pdf.py:235-245` writes to `tempfile.gettempdir()` without `validate_upload`, size/magic checks, or cleanup.
11. **Missing PWA icons → 404 broken links.** `manifest.json:11,17` and `frontend/app/layout.tsx:16-17` reference `/icon-192.png` and `/icon-512.png`, but `frontend/public/` contains only `manifest.json` and `sw.js` (no icons).
12. **Optional features error without system binaries.** OCR (`pdf_tools.py:319-364`) needs poppler/tesseract/pdf2image/pytesseract; DOCX→PDF & PPTX→PDF need LibreOffice (`soffice`); ODS/sheet→PDF not implemented. These return errors in environments without them (not installed here). Mark as gracefully unavailable rather than hard errors.
13. **File-handle leak.** `app/api/routes/pdf.py:182` `open(out_path,"rb").read()` never closed.
14. **`delete_account` orphans data.** `auth.py:220-224` removes the user from `_USERS` only; that user's uploads/outputs/history remain.

### Medium — correctness / hygiene / perf

15. **`read_file` O(n) directory scan** on every read/download (`app/storage.py:80-86`).
16. **RateLimitMiddleware is a no-op** for upload/convert/generate/pdf (`middleware/security.py:141-151`); route-level `check_rate_limit_dependency` covers those. CSRF enforcement is explicitly deferred/pass-through (`middleware/security.py:113-115`) and the frontend never sends `X-CSRF-Token`.
17. **CORS `allow_origins=["*"]` + `allow_credentials=True`** (`main.py:41-46`) — browsers reject wildcard origin with credentials.
18. **Hardcoded external `metadataBase`** `https://docstudio.app` (`layout.tsx:14`) may not resolve.
19. **`dashboard.tsx` iconForExtension is dead code** — both branches return `File`.
20. **`settings.tsx` tier limits hardcoded**, drift risk vs backend `TIER_LIMITS` (`models.py:19-38`).
21. **Alembic baseline migration exists** (`alembic/versions/14426b91ddcc_baseline.py`) and `env.py` is wired, but `init_db()` uses `create_all` (`database.py:39-42`) and the DB is never stamped/migrated at startup.

---

## Implementation tasks (ordered)

**Phase 1 — Auth unification & authorization (critical)**
1. Migrate `app/auth.py` user store to SQLAlchemy/PostgreSQL via `get_db`/`async_session` (`app/database.py`): `get_user_by_username/email`, `create_user`, `verify_password`, `update_user_profile`, `change_password`, `reset_password_with_token`, `delete_account`. Remove/reduce reliance on in-memory `_USERS`.
2. Fix `app/api/routes/admin.py`: remove invalid `await` on sync auth functions / make DB-async; fix `get_user_by_username(db, username)` signature mismatch; apply `role` on update; return real `created_at`; make `delete_user` cascade user files/outputs.
3. Fix auth flows: `generate_email_verification` 2-arg call; `request_password_reset`/`reset_password` use a consistent identifier (email); `verify-email` sets `is_verified=true`.
4. Authorization hardening: remove `tier` from user-updatable fields (`auth.py:226`); `require_admin` checks `role=="admin"` not `tier=="enterprise"`.

**Phase 2 — Router & job/history plumbing**
5. Router hygiene (`main.py`): remove duplicate `auth.router` mount; `include_router(jobs.router, prefix="/api")`; de-dupe `/jobs/{job_id}` (keep one canonical, likely `jobs.router`, remove pdf's duplicate `pdf.py:248`).
6. History persistence (`app/storage.py`): call `_load_history()` at module import / `init_db` startup so `history.json` is loaded and not clobbered on restart.

**Phase 3 — Functional fixes**
7. `frontend/lib/api.ts:runAsyncJob` — propagate the real output `ext` and `name` from the job result instead of hardcoding `"pdf"`/`"result"`.
8. `app/tasks.py` extract-images — return the actual extracted images (zip `out_dir`) with a real ext/file, not `b"images-extracted"` ext `"dir"`.
9. `app/api/routes/pdf.py:images_to_pdf` — route through `storage.save_upload`+`validate_upload`; enforce size/magic validation; clean up temp files after enqueue.
10. `app/api/routes/pdf.py:pdf_metadata` — close the file handle (`with open(...) as f`).
11. `app/auth.py:delete_account` — delete the user's uploads/outputs/history entries (cascade).

**Phase 4 — Assets & environment**
12. Add `/icon-192.png` and `/icon-512.png` to `frontend/public/` (or generate placeholder PNGs); confirm `manifest.json` and `sw.js` reference only existing assets.
13. Alembic: stamp the baseline revision; align `init_db()` with migrations (replace/guard `create_all` so `alembic upgrade head` is the source of truth).
14. Document OCR/LibreOffice/poppler as optional system dependencies; where missing, endpoints should return a clear "not available in this environment" status rather than an unhandled error.

**Phase 5 — Validation tests**
15. Add regression tests: admin user list/get/update/delete (ex-fix for the 500s), self-tier-escalation rejection, history persistence across reload, convert-to-txt returns correct ext label, extract-images returns images.
16. Confirm full suite green.

---

## Validation plan

- Backend: `cd backend && pytest tests/` — existing suite plus new admin/regression tests must pass.
- Frontend: `cd frontend && npx tsc --noEmit` — clean typecheck.
- End-to-end smoke: register → login → upload → convert (txt→pdf and txt→txt) → download; verify result card shows correct ext/name; admin (role=admin user) can list/update users; non-admin cannot reach `/api/admin/*`; `extract-images` returns image bytes.
- Confirm `history.json` is loaded on server restart (persistence).

---

## Decisions needed / open questions

1. **Auth store target:** Fully DB-backed auth (recommended, matches existing SQLAlchemy models) vs. keeping in-memory `_USERS` and only making admin consistent. Recommendation: DB-backed, since `models.py`/`database.py`/Alembic already exist.
2. **Optional binary features (OCR, DOCX→PDF, PPTX→PDF):** Install poppler/tesseract/LibreOffice in target env, or gate those endpoints behind an "unavailable in this environment" status. Recommendation: install where possible, else graceful status.
3. **PWA icons:** Generate real 192x192/512x512 PNGs or point manifest/layout at existing assets.
4. **Frontend build output:** Backend mounts `frontend/out` (`main.py:68-70`) — requires `next build` before serving the frontend; confirm deployment step.

---

## Rollout

Apply Phase 1–4 in order (auth/authorization first, since other features depend on correct user context), then Phase 5 tests. Do not commit unless explicitly requested.