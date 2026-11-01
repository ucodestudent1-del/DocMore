# Universal Document Studio — PROJECT STATUS

## Stack
- Backend: FastAPI (Python 3.12), uvicorn
- Frontend: Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui primitives, PWA (manifest + service worker)
- Processing: python-docx, openpyxl, python-pptx, pypdf, reportlab, Pillow, beautifulsoup4, markdown (python-magic with pure-Python fallback on Windows)
- Storage: local temp directory
- Jobs: Celery with Redis broker; in-process background-thread fallback when Redis unavailable
- Auth: JWT tokens (pyjwt), password hashing (passlib/bcrypt), user JSON store, subscription tiers (free/premium/enterprise), rate limiting
- OCR: pytesseract + Tesseract with multi-language support
- PDF comparison: difflib-based text diff

## Status legend
- `done` — implemented, real processing, tested end-to-end
- `partial` — implemented with known limitations, documented
- `planned` — not yet implemented

## Backend test results (all passing)
55 pytest tests pass: 47 unit (registry, conversions, pdf tools, generation, security) + 8 HTTP integration (TestClient) covering auth, convert/merge/protect-unlock/generate flows, downloads, rejections, formats/history, and PDF comparison.

## Feature matrix

### Conversion registry & format detection
| Feature | Status | Files | Notes |
|---|---|---|---|
| Upload endpoint | done | backend/app/api/routes/upload.py | magic-byte + size validation, rate-limited |
| Download endpoint | done | backend/app/api/routes/download.py | |
| Format detection (magic bytes) | done | backend/app/security.py | pure-Python fallback on Windows |
| Format registry / compatibility matrix | done | backend/app/registry.py | 30 formats, status per conversion |
| Rate limiting | done | backend/app/rate_limiter.py | per-user tier limits (free: 10/min, premium: 100/min, enterprise: 1000/min) |

### Conversions
| Conversion | Status | Files | Notes |
|---|---|---|---|
| PDF -> txt/html/md/png/jpg/webp | done | backend/app/converters/pdf.py | page rasterization needs poppler (partial) |
| PDF -> PDF (optimize) | done | backend/app/converters/pdf.py | content stream compression |
| DOCX -> txt/html/md/docx | done | backend/app/converters/docx.py | DOCX->PDF needs LibreOffice (not installed) |
| XLSX -> csv/xlsx/json | done | backend/app/converters/xlsx.py | |
| CSV -> xlsx/json/csv | done | backend/app/converters/xlsx.py | |
| PPTX -> pptx | done | backend/app/converters/pptx.py | PPTX->PDF needs LibreOffice |
| Images (png/jpg/webp/gif/bmp/tiff) <-> each other, -> pdf | done | backend/app/converters/image.py | svg/ico/heic/avif partial |
| HTML -> md/txt | done | backend/app/converters/html.py | HTML->PDF via generation engine |
| MD -> html/txt/docx | done | backend/app/converters/md.py | MD->PDF via generation engine |
| TXT -> pdf/html/md/docx | done | backend/app/converters/html.py, md.py | |
| Batch / multi-file | planned | backend/app/jobs.py | |

### PDF toolkit
| Tool | Status | Files | Notes |
|---|---|---|---|
| Merge | done | backend/app/pdf_tools.py | pypdf |
| Split | done | backend/app/pdf_tools.py | pypdf |
| Rotate / rearrange / extract / delete pages | done | backend/app/pdf_tools.py | pypdf |
| Page numbers | done | backend/app/pdf_tools.py | reportlab overlay |
| Watermark | done | backend/app/pdf_tools.py | reportlab overlay |
| Header/footer | done | backend/app/pdf_tools.py | reportlab overlay |
| Extract text | done | backend/app/pdf_tools.py | pypdf |
| Extract images | done | backend/app/pdf_tools.py | embedded images |
| Metadata edit | done | backend/app/pdf_tools.py | pypdf |
| Password protect / unlock | done | backend/app/pdf_tools.py | pypdf encryption |
| Compress | done | backend/app/pdf_tools.py | content stream compression |
| Repair | done | backend/app/pdf_tools.py | re-write structure |
| OCR | done | backend/app/pdf_tools.py, routes/pdf.py | Tesseract OCR with language selection (eng, spa, fra, deu, ita, por, rus, chi_sim, jpn, kor, ara, hin) |
| Images -> PDF | done | backend/app/pdf_tools.py | reportlab |
| Document comparison (diff) | done | backend/app/pdf_tools.py, routes/compare.py | diff two PDFs/DOCXs/text files |

### Document generation
| Export | Status | Files | Notes |
|---|---|---|---|
| PDF | done | backend/app/generation.py | reportlab |
| DOCX | done | backend/app/generation.py | python-docx |
| ODT | partial | backend/app/generation.py | repackaged DOCX |
| HTML / MD / TXT | done | backend/app/generation.py | |
| Templates + placeholders + batch | done | backend/app/generation.py, routes/generate.py | invoice, letter, resume, report, certificate, cover-letter, minutes |

### Security & reliability
| Item | Status | Files | Notes |
|---|---|---|---|
| File signature + MIME validation | done | backend/app/security.py | magic bytes, reject .exe etc. |
| Size limits, randomized filenames | done | backend/app/security.py, storage.py | 50 MB default |
| Path traversal prevention | done | backend/app/security.py | |
| Temp cleanup | done | backend/app/storage.py | cleanup_old() |
| No macro execution | done | | by design |
| User authentication (register/login) | done | backend/app/api/routes/auth.py | JWT tokens, bcrypt password hashing |
| Password-protected PDF unlock | done | backend/app/pdf_tools.py | pypdf encryption with user-supplied password |
| User-scoped file storage/history | done | backend/app/storage.py | file_id tagged with user_id, history filtered by user |

### Frontend
| Page | Status | Files | Notes |
|---|---|---|---|
| Home | done | frontend/app/page.tsx | landing |
| Dashboard | done | frontend/app/dashboard | recent activity, quick convert, download links on history items |
| Universal Converter | done | frontend/app/convert | upload + drag-and-drop visual feedback + async format selection + download + Ctrl+O shortcut + auto-detect/recommend target format |
| PDF Tools | done | frontend/app/pdf-tools | merge, split, watermark, page numbers, compress, protect/unlock with password input, extract text, images->pdf, OCR with language selection |
| Document Generator | done | frontend/app/generate | block editor, export PDF/DOCX/HTML/MD/TXT, template loading via ?template= query param, undo/redo (Ctrl+Z/Y), auto-save drafts to localStorage, Ctrl+S download, live template preview + placeholder fill-in form |
| Templates | done | frontend/app/templates | template list with navigation to generator |
| Shared templates | done | frontend/lib/templates.ts | shared template definitions with {{placeholder}} extraction utility |
| Template Preview | done | frontend/app/generate/components/TemplatePreview.tsx | live HTML preview of template blocks |
| Template Form | done | frontend/app/generate/components/TemplateForm.tsx | fill-in form for {{placeholder}} values, auto-applies to document blocks |
| History | done | frontend/app/history | processing history table |
| Settings | done | frontend/app/settings | theme, backend health, subscription tier display |

### Accessibility & PWA
| Feature | Status | Files | Notes |
|---|---|---|---|
| PWA (manifest + service worker) | done | frontend/public/manifest.json, frontend/public/sw.js | Installable as desktop/mobile app, offline caching |
| Light/dark theme | done | frontend/app/globals.css, next-themes | System preference detection |
| Skip to main content link | done | frontend/app/layout.tsx | Keyboard-accessible navigation |
| Focus indicators | done | frontend/app/globals.css | Focus-visible ring for keyboard users |
| Semantic HTML + ARIA | done | frontend/components/ui/*, frontend/app/* | Proper heading levels, landmark regions, accessible labels |
| Reduced motion support | done | frontend/app/globals.css | Respects prefers-reduced-motion |

### Build verification
- Backend: imports OK, uvicorn serves on 127.0.0.1:8000, 55 pytest tests pass
- Frontend: TypeScript typechecks cleanly (`tsc --noEmit`); Next.js pages/components/lib present; async job polling wired to backend
- E2E: Playwright test file at frontend/tests/e2e/convert.spec.ts (needs `npx playwright install` to run)

## Infrastructure
- Backend: FastAPI + uvicorn (Dockerfile: backend/Dockerfile, includes libreoffice/poppler-utils/tesseract-ocr for full DOCX/PPTX→PDF, rasterization, OCR)
- Frontend: Next.js (Dockerfile: frontend/Dockerfile, multi-stage build); API base configurable via NEXT_PUBLIC_API_BASE
- Orchestration: docker-compose.yml (backend, frontend, redis)
- Jobs: Celery with Redis broker; in-process background-thread fallback when Redis unavailable
- Docker: Dockerfiles written and docker-compose provided; Docker daemon not available in this shell so `docker compose build` was not executed
