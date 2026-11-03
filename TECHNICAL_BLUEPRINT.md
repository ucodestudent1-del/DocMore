# DocStudio — Technical Blueprint

**Version:** 1.0  
**Phase:** Phase 1 — Audit & Strategic Planning  
**Repo:** `C:\Users\New User\Desktop\EveryDoc`  
**Generated:** 2026-11-03

---

## 1. Executive Summary

DocStudio is a commercial-grade SaaS document-processing platform. The existing codebase is a functional FastAPI + Next.js monolith with real conversion logic (30+ formats), PDF toolkit, template generation, Stripe billing, JWT auth, and 55 passing backend tests. This blueprint preserves all working functionality while elevating the platform to production-grade SaaS status: database-backed storage, refresh-token auth with session revocation, S3-compatible object storage with signed URLs, Redis-backed job queue with retry logic, usage-quota enforcement, malware scanning, GDPR deletion, and a full admin dashboard.

Key principle: **do not overwrite working code.** Refactor incrementally behind stable interfaces.

---

## 2. Functional Audit

### 2.1 What Works (Preserve)

| Area | Status | Notes |
|------|--------|-------|
| Auth (register/login/verify/reset) | Working | JWT + bcrypt, DB-backed users |
| Upload endpoint | Working | Magic-byte validation, rate-limited |
| Download endpoint | Working | File serving, owner-scoped |
| Conversion registry | Working | 30+ formats, adapter pattern, fidelity notes |
| PDF toolkit | Working | pypdf + reportlab (merge/split/watermark/protect/OCR/compress/repair/compare) |
| Document generation | Working | reportlab + python-docx, templates + placeholders |
| Payments | Working | Stripe Checkout + webhooks, free/premium/enterprise |
| Background jobs | Working | Celery + Redis, in-process fallback |
| Frontend | Working | Next.js 15, TS, Tailwind, shadcn/ui, PWA, type-clean |
| Tests | Passing | 55 pytest, all green |

### 2.2 Broken Logic & Architectural Flaws

| # | Issue | Severity | Detail |
|---|-------|----------|--------|
| 1 | JSON history instead of DB metadata | High | `storage.py` uses `history.json` + in-memory list; no transactional consistency, no audit trail, doesn't scale |
| 2 | JWT-only auth, no refresh tokens | High | Access tokens live in localStorage (XSS-vulnerable), no session revocation, no rotation |
| 3 | Local FS storage only | High | No S3 abstraction, no signed URLs, files tied to single container |
| 4 | No malware scanning | High | Magic-byte validation only; no ClamAV/YARA on upload |
| 5 | No usage-quota enforcement | High | `TIER_LIMITS` defined but never enforced at request time |
| 6 | No per-user file/folder model | Medium | `Upload.user_id` references `username` (string) not `id`; no folder tree, no versions |
| 7 | Polling-only job progress | Medium | No WebSocket/SSE for real-time progress |
| 8 | No admin frontend | Medium | Admin backend routes exist but no UI |
| 9 | Rate limiting not enforced per-endpoint | Medium | Rate limiter exists but middleware application is inconsistent |
| 10 | No data retention/GDPR deletion | Medium | `cleanup_old()` is a 24h local sweep; no per-tier retention, no GDPR endpoint |
| 11 | Frontend auth token in localStorage | Medium | XSS theft risk; should be httpOnly cookie |
| 12 | Stripe webhook uses `asyncio.run` in handler | Low | Fragile in async FastAPI context |

### 2.3 Technical Debt

- Alembic not initialized (schema drifts via `create_all`)
- `storage.py` thread lock + JSON file is a bottleneck
- `delete_account` reaches into `storage._history` (private member)
- No structured logging / request IDs / health endpoints beyond `/api/health`
- No OpenAPI auth enforcement consistency
- `payments.py` webhook tier update is fire-and-forget (`ensure_future`), no idempotency

---

## 3. Technical Architecture

### 3.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────┐
│                  Next.js Frontend (Port 3000)               │
│  Dashboard / Converter / PDF Tools / Generator / Editor     │
│  Auth UI / Settings / Admin Panel / Pricing                 │
│  Tokens: httpOnly cookies + CSRF                            │
└─────────────────────────────────────────────────────────────┘
                              │ HTTPS / REST
┌─────────────────────────────────────────────────────────────┐
│              API Gateway (FastAPI, Port 8000)               │
│  Auth, rate limiting, CSRF, security headers, routing       │
│  OpenAPI docs, /health, /ready, /live                       │
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
    │  Storage Svc (S3/MinIO + local FS, signed URLs)     │
    │  Jobs (Celery + Redis, retry + dead-letter)         │
    └─────────────────────────────────────────────────────┘
                              │
                    ┌─────────▼─────────┐
                    │  PostgreSQL 15    │
                    │ (users, docs, jobs,│
                    │  subs, usage, audit)│
                    └───────────────────┘
```

### 3.2 Service Boundaries (logical packages, deployable together or separately)

1. **Auth Service** — register, login, email verify, password reset, refresh tokens, session revocation, RBAC
2. **Conversion Service** — upload, validate, malware scan, enqueue conversion, format registry
3. **PDF Toolkit Service** — merge/split/watermark/protect/OCR/compress/repair/compare
4. **Generation Service** — template-driven document generation (PDF/DOCX/HTML/MD/TXT)
5. **AI Service** — provider abstraction (OpenAI/Anthropic/Google), server-side keys only
6. **Storage Service** — `StorageBackend` interface, local + S3, signed URLs
7. **Billing Service** — Stripe Checkout, webhooks, subscription tiers, usage quotas
8. **Jobs Service** — Celery + Redis, status tracking, retry logic, dead-letter

### 3.3 Adapter Pattern (Conversion)

Existing `ConverterEngine` base + `ConversionResult`. Extend with:
- **Built-in adapters** (existing): PDF, DOCX, XLSX, PPTX, Image, HTML, Markdown
- **External adapters** (new): LibreOffice headless (DOCX/PPTX→PDF), Pandoc (MD/HTML↔Docx/EPUB), Tesseract (OCR), ImageMagick (image transforms), ClamAV (malware)
- Each adapter reports `status()` (done/partial/experimental/not_implemented) + `notes` for fidelity transparency

### 3.4 Security Model

- **Auth:** JWT access (short-lived, 15 min) + refresh tokens (httpOnly cookie, 7 days) + session table with revocation
- **RBAC:** roles `user`/`admin`; tiers `free`/`premium`/`enterprise`; resource-scoped access (owner + shared-with)
- **File safety:** magic-byte validation + ClamAV scan on upload; randomized filenames; path-traversal prevention; quarantine bucket for infected files
- **Rate limiting:** per-user per-tier + per-endpoint burst limits
- **Secrets:** server-side only; never logged; never in frontend bundles
- **Transport:** HTTPS, HSTS, CSP, CSRF

---

## 4. Schema & API Design

### 4.1 Prisma Schema (`prisma/schema.prisma`)

```prisma
generator client {
  provider = "prisma-client-py"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  USER
  ADMIN
}

enum SubscriptionTier {
  FREE
  PREMIUM
  ENTERPRISE
}

enum SubscriptionStatus {
  INCOMPLETE
  ACTIVE
  PAST_DUE
  CANCELED
}

enum JobStatus {
  PENDING
  RUNNING
  COMPLETED
  FAILED
  CANCELLED
}

enum DocumentKind {
  UPLOAD
  OUTPUT
  TEMPLATE
}

enum AuditAction {
  CREATE
  READ
  UPDATE
  DELETE
  LOGIN
  LOGOUT
  PASSWORD_RESET
  EMAIL_VERIFY
  TIER_CHANGE
  FILE_DELETE
  GDPR_DELETE
}

model User {
  id                String   @id @default(uuid()) @db.Uuid
  username          String   @unique @db.VarChar(255)
  email             String   @unique @db.VarChar(255)
  hashedPassword    String   @db.VarChar(255)
  tier              SubscriptionTier @default(FREE)
  role              UserRole @default(USER)
  isVerified        Boolean  @default(false)
  emailVerifiedAt   DateTime?
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  sessions          Session[]
  documents         Document[]
  jobs              Job[]
  subscriptions     Subscription[]
  usageRecords      UsageRecord[]
  auditLogs         AuditLog[]

  @@index([email])
  @@index([username])
  @@index([tier])
}

model Session {
  id           String   @id @default(uuid()) @db.Uuid
  userId       String   @db.Uuid
  refreshToken String   @unique @db.VarChar(512)
  userAgent    String?  @db.VarChar(512)
  ipAddress    String?  @db.VarChar(64)
  expiresAt    DateTime
  revokedAt    DateTime?
  createdAt    DateTime @default(now())

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([refreshToken])
  @@index([expiresAt])
}

model Document {
  id          String      @id @default(uuid()) @db.Uuid
  userId      String      @db.Uuid
  folderId    String?     @db.Uuid
  kind        DocumentKind @default(UPLOAD)
  originalName String     @db.VarChar(255)
  storedName   String     @db.VarChar(255)
  mime         String     @db.VarChar(100)
  ext          String     @db.VarChar(20)
  size         Int
  storagePath  String     @db.VarChar(500)
  storageBackend String   @default("local") @db.VarChar(20)
  checksum     String?    @db.VarChar(64)
  isInfected   Boolean    @default(false)
  versionHead  Int        @default(1)
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  expiresAt    DateTime?  // retention

  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  folder       Folder?     @relation(fields: [folderId], references: [id], onDelete: SetNull)
  versions     DocumentVersion[]
  outputs      Output[]
  jobs         Job[]
  shares       DocumentShare[]

  @@index([userId])
  @@index([folderId])
  @@index([kind])
  @@index([expiresAt])
}

model DocumentVersion {
  id          String   @id @default(uuid()) @db.Uuid
  documentId  String   @db.Uuid
  version     Int
  fileId      String   @db.Uuid
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  file        Document @relation(fields: [fileId], references: [id])

  @@index([documentId])
  @@index([documentId, version])
}

model Folder {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  parentId    String?  @db.Uuid
  name        String   @db.VarChar(255)
  createdAt   DateTime @default(now())

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  parent      Folder?  @relation("FolderHierarchy", fields: [parentId], references: [id], onDelete: Cascade)
  children    Folder[] @relation("FolderHierarchy")
  documents   Document[]

  @@index([userId])
  @@index([parentId])
}

model Output {
  id          String   @id @default(uuid()) @db.Uuid
  documentId  String?  @db.Uuid
  userId      String   @db.Uuid
  originalName String  @db.VarChar(255)
  storedName   String  @db.VarChar(255)
  mime         String  @db.VarChar(100)
  ext          String  @db.VarChar(20)
  size         Int
  storagePath  String  @db.VarChar(500)
  storageBackend String @default("local") @db.VarChar(20)
  createdAt    DateTime @default(now())
  expiresAt    DateTime?

  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  document     Document? @relation(fields: [documentId], references: [id], onDelete: SetNull)
  job          Job?     @relation(fields: [jobId], references: [id], onDelete: SetNull)
  jobId        String?

  @@index([userId])
  @@index([documentId])
  @@index([jobId])
}

model Job {
  id          String     @id @default(uuid()) @db.Uuid
  userId      String?    @db.Uuid
  taskName    String     @db.VarChar(100)
  status      JobStatus  @default(PENDING)
  progress    Int        @default(0)
  result      String?    @db.Text
  error       String?    @db.Text
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt
  completedAt DateTime?

  user        User?      @relation(fields: [userId], references: [id], onDelete: SetNull)
  documents   Document[]
  outputs     Output[]

  @@index([userId])
  @@index([status])
  @@index([createdAt])
}

model Subscription {
  id                   String             @id @default(uuid()) @db.Uuid
  userId               String             @db.Uuid
  stripeCustomerId     String?            @unique @db.VarChar(255)
  stripeSubscriptionId String?            @unique @db.VarChar(255)
  stripePriceId        String?            @db.VarChar(255)
  status               SubscriptionStatus @default(INCOMPLETE)
  tier                 SubscriptionTier   @default(FREE)
  interval             String             @default("monthly") @db.VarChar(20)
  currentPeriodStart   DateTime?
  currentPeriodEnd     DateTime?
  cancelAtPeriodEnd    Boolean            @default(false)
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([stripeCustomerId])
  @@index([stripeSubscriptionId])
}

model UsageRecord {
  id          String   @id @default(uuid()) @db.Uuid
  userId      String   @db.Uuid
  month       String   @db.VarChar(7) // "2026-11"
  conversions Int      @default(0)
  storageMB   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([userId, month], map: "usage_user_month_idx")
}

model AuditLog {
  id        String     @id @default(uuid()) @db.Uuid
  userId    String?    @db.Uuid
  action    AuditAction
  target    String?    @db.VarChar(255)
  targetId  String?    @db.Uuid
  metadata  Json?
  ipAddress String?    @db.VarChar(64)
  userAgent String?    @db.VarChar(512)
  createdAt DateTime   @default(now())

  user      User?      @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([userId])
  @@index([action])
  @@index([createdAt])
}

model DocumentShare {
  id          String   @id @default(uuid()) @db.Uuid
  documentId  String   @db.Uuid
  sharedWithId String  @db.Uuid
  permission  String   @default("view") @db.VarChar(20) // view, edit
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  sharedWith  User     @relation(fields: [sharedWithId], references: [id], onDelete: Cascade)

  @@index([documentId])
  @@index([sharedWithId])
  @@unique([documentId, sharedWithId], map: "share_unique")
}
```

### 4.2 Frontend Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/` | Landing page | Public |
| `/login` | Sign in | Public |
| `/register` | Sign up | Public |
| `/forgot-password` | Password reset request | Public |
| `/reset-password` | Password reset confirm | Public |
| `/verify-email` | Email verification | Public |
| `/dashboard` | File/folder list, recent activity | Protected |
| `/convert` | Universal document converter | Protected |
| `/convert/[jobId]` | Conversion progress | Protected |
| `/pdf-tools` | PDF toolkit | Protected |
| `/generate` | Document generator/editor | Protected |
| `/templates` | Template library | Protected |
| `/settings` | Profile, subscription, security | Protected |
| `/pricing` | Pricing tiers, checkout | Public/Protected |
| `/admin` | Admin dashboard (user/tier/jobs) | Admin only |
| `/admin/users` | User management | Admin only |
| `/admin/jobs` | Job queue monitoring | Admin only |
| `/admin/health` | System health | Admin only |

### 4.3 Backend REST API Endpoints

#### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | Public |
| POST | `/api/auth/login` | Login, returns access + refresh token | Public |
| POST | `/api/auth/refresh` | Refresh access token using refresh cookie | Public (cookie) |
| POST | `/api/auth/logout` | Revoke session | Protected |
| POST | `/api/auth/logout-all` | Revoke all sessions | Protected |
| GET | `/api/auth/me` | Current user profile | Protected |
| POST | `/api/auth/verify-email` | Verify email token | Public |
| POST | `/api/auth/resend-verification` | Resend verification email | Protected |
| POST | `/api/auth/request-password-reset` | Request password reset | Public |
| POST | `/api/auth/reset-password` | Reset password with token | Public |
| POST | `/api/auth/change-password` | Change password (authenticated) | Protected |
| PUT | `/api/auth/me` | Update profile (email) | Protected |
| DELETE | `/api/auth/me` | Delete account + data (GDPR) | Protected |

#### Files & Storage
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/files/upload` | Upload file (malware scan, validation) | Protected |
| GET | `/api/files/{fileId}` | Get file metadata | Protected (owner) |
| GET | `/api/files/{fileId}/download` | Download via signed URL | Protected (owner) |
| PUT | `/api/files/{fileId}` | Rename/move file | Protected (owner) |
| DELETE | `/api/files/{fileId}` | Delete file | Protected (owner) |
| POST | `/api/files/{fileId}/share` | Share document with user | Protected (owner) |
| GET | `/api/files/{fileId}/versions` | List document versions | Protected (owner) |
| POST | `/api/files/{fileId}/versions/{versionId}/restore` | Restore version | Protected (owner) |

#### Folders
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/folders` | Create folder | Protected |
| GET | `/api/folders` | List folders (tree) | Protected |
| GET | `/api/folders/{folderId}` | Get folder contents | Protected |
| PUT | `/api/folders/{folderId}` | Rename folder | Protected |
| DELETE | `/api/folders/{folderId}` | Delete folder | Protected |

#### Conversion
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/convert` | Enqueue conversion job | Protected |
| GET | `/api/convert/jobs/{jobId}` | Job status | Protected (owner) |
| GET | `/api/formats` | List supported formats | Public |
| GET | `/api/formats/conversions` | Full compatibility matrix | Public |
| GET | `/api/formats/convert-options/{source}/{target}` | Conversion fidelity info | Public |
| GET | `/api/formats/conversions/{source}` | Targets for source | Public |
| POST | `/api/convert/batch` | Batch conversion | Protected |

#### PDF Toolkit
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/pdf/merge` | Merge PDFs | Protected |
| POST | `/api/pdf/split` | Split PDF | Protected |
| POST | `/api/pdf/rotate` | Rotate pages | Protected |
| POST | `/api/pdf/rearrange` | Rearrange pages | Protected |
| POST | `/api/pdf/extract-pages` | Extract pages | Protected |
| POST | `/api/pdf/delete-pages` | Delete pages | Protected |
| POST | `/api/pdf/watermark` | Add watermark | Protected |
| POST | `/api/pdf/page-numbers` | Add page numbers | Protected |
| POST | `/api/pdf/header-footer` | Add header/footer | Protected |
| POST | `/api/pdf/compress` | Compress PDF | Protected |
| POST | `/api/pdf/protect` | Password protect | Protected |
| POST | `/api/pdf/unlock` | Unlock PDF | Protected |
| POST | `/api/pdf/repair` | Repair PDF | Protected |
| POST | `/api/pdf/extract-text` | Extract text | Protected |
| POST | `/api/pdf/extract-images` | Extract images | Protected |
| POST | `/api/pdf/images-to-pdf` | Images to PDF | Protected |
| POST | `/api/pdf/ocr` | OCR scanned PDF | Protected |
| GET | `/api/pdf/metadata/{fileId}` | Get metadata | Protected |
| POST | `/api/pdf/metadata/{fileId}` | Edit metadata | Protected |
| GET | `/api/pdf/encrypted/{fileId}` | Check encryption | Protected |

#### Document Generation
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/generate` | Generate document from blocks | Protected |
| POST | `/api/generate/template` | Generate from template | Protected |
| GET | `/api/generate/templates` | List templates | Public |
| GET | `/api/generate/templates/{name}` | Get template definition | Public |

#### Jobs
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/jobs/{jobId}` | Job status | Protected (owner) |
| GET | `/api/jobs` | List user jobs | Protected |
| GET | `/api/ws/jobs/{jobId}` | WebSocket progress | Protected (owner) |

#### Payments
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/payments/checkout` | Create Stripe checkout session | Protected |
| POST | `/api/payments/portal` | Stripe customer portal | Protected |
| POST | `/api/payments/webhook` | Stripe webhook (idempotent) | Public (signature) |
| GET | `/api/payments/subscription` | Current subscription | Protected |
| GET | `/api/payments/invoices` | Invoice history | Protected |
| GET | `/api/payments/pricing` | Tier pricing | Public |

#### Usage & Quota
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/usage` | Current usage vs limits | Protected |
| GET | `/api/usage/history` | Usage history | Protected |

#### Admin
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/admin/users` | List users | Admin |
| GET | `/api/admin/users/{userId}` | Get user | Admin |
| PATCH | `/api/admin/users/{userId}` | Update tier/role | Admin |
| GET | `/api/admin/stats` | System statistics | Admin |
| GET | `/api/admin/jobs` | All jobs | Admin |
| GET | `/api/admin/health` | System health | Admin |
| POST | `/api/admin/retention/run` | Run retention cleanup | Admin |
| GET | `/api/admin/audit-logs` | Audit log | Admin |

#### System
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/health` | Health check | Public |
| GET | `/api/ready` | Readiness probe | Public |
| GET | `/api/live` | Liveness probe | Public |

---

## 5. Integration Roadmap

| Service | Purpose | Env Vars | Notes |
|---------|---------|----------|-------|
| PostgreSQL 15 | Primary database | `DATABASE_URL` | Managed on Railway |
| Redis 7 | Job broker + cache | `REDIS_URL` | Managed on Railway |
| Stripe | Payments, subscriptions | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Test mode first |
| SendGrid | Transactional email | `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL` | Verify emails, resets |
| S3 / MinIO | Object storage | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET`, `AWS_S3_REGION`, `AWS_S3_ENDPOINT_URL` | Private buckets, signed URLs |
| ClamAV | Malware scanning | `CLAMAV_HOST`, `CLAMAV_PORT` | Sidecar, graceful degradation |
| OpenAI/Anthropic/Google | AI assistant | `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_API_KEY` | Server-side only |
| LibreOffice | DOCX/PPTX→PDF fidelity | (system dep) | Container |
| Tesseract | OCR | (system dep) | Language packs |
| ImageMagick | Image transforms | (system dep) | Container |
| Pandoc | EPUB/advanced doc | (system dep, optional) | Container |

---

## 6. Implementation Plan

### Phase 1 — Foundation (Weeks 1-2)
**Goal:** Harden foundation; DB-backed storage, Alembic, S3 abstraction, refresh tokens, clean dashboard.

**Deliverables:**
1. Alembic migrations from SQLAlchemy models → migrate to Prisma schema
2. `StorageBackend` interface: local + S3 (boto3), selectable via env
3. Move history/metadata from `history.json` to PostgreSQL `Document`/`Output` tables
4. Auth hardening: refresh tokens (httpOnly cookie) + session revocation table
5. RBAC: `user`/`admin` roles; resource-scoped document access
6. Malware scan on upload: ClamAV via clamd (graceful degradation)
7. Dashboard frontend: file/folder list, recent conversions, download/delete
8. Type-safe API client (`lib/api.ts`) with React Query
9. Tests: storage backends, auth flows, RBAC; target 60+ backend tests

**Exit criteria:**
- Local PostgreSQL + Redis running via docker-compose; backend serves on 8000
- Upload → store → download round-trip via DB-backed storage
- Refresh token rotation + revocation tested

**Risks:** JSON→Postgres migration without data loss; ClamAV unavailable on Windows (graceful fallback).

---

### Phase 2 — Document Generation & Templates (Weeks 3-4)
**Goal:** Production-grade template-driven generation with batch support.

**Deliverables:**
1. Generation service wrapping existing converters (PDF, DOCX, HTML, MD, TXT)
2. Template library: Invoice, Resume, Report, Certificate, Cover Letter, Meeting Minutes
3. Placeholder fill-in: `{{placeholder}}` extraction + form-driven fill
4. Batch generation: multiple documents from one template + CSV/JSON data (Celery job)
5. Export formats: PDF, DOCX, ODT, HTML, MD, TXT; EPUB via Pandoc
6. Fidelity notes per conversion

**Exit criteria:** Generate real DOCX/PDF from template with filled placeholders; downloadable output.

**Risk:** DOCX↔PDF formatting (LibreOffice; mark partial if absent).

---

### Phase 3 — Universal Conversion Engine (Weeks 5-6)
**Goal:** Complete conversion matrix with external engines.

**Deliverables:**
1. External engine adapters: LibreOffice headless, Pandoc, ImageMagick, Tesseract
2. Registry completion: full source→target matrix; `can_convert` + `status()` per entry
3. Format validation: magic-byte + MIME + extension cross-check (all 30 formats)
4. Batch conversion: multi-file upload → one job → per-file results; zip download
5. Conversion API: `POST /api/convert`, `GET /api/formats`, `GET /api/jobs/{id}` with WS progress
6. Tests: conversion matrix for every done/partial entry; 55 → 80+ backend tests

**Exit criteria:** Any supported source converts to every listed target (real files).

**Risk:** LibreOffice reliability in containers; format fidelity loss surfaced in `notes`.

---

### Phase 4 — PDF Toolkit & Image Processing (Weeks 7-8)
**Goal:** Full PDF toolkit + image pipeline.

**Deliverables:**
1. PDF tools: merge, split, rotate, rearrange, extract/delete pages, page numbers, watermark, header/footer, extract text/images/metadata, protect/unlock, compress, repair, images→PDF, comparison
2. OCR: Tesseract multi-language; scanned PDF → searchable PDF
3. Image processing: PNG/JPG/WEBP/GIF/BMP/TIFF/SVG/ICO conversion; resize/compress; images→PDF
4. Security: password-protected PDF unlock (password never logged)
5. Tests: every tool returns real processed bytes

**Exit criteria:** Merge/split/protect/OCR produce valid, openable output files.

**Risk:** OCR accuracy on low-quality scans; pypdf encryption edge cases.

---

### Phase 5 — Integrated Document Editor (Weeks 9-10)
**Goal:** Rich-text editor with autosave, version history, export.

**Deliverables:**
1. Rich-text editor: Tiptap or Lexical
2. Autosave: drafts to DB (`Document` + `DocumentVersion`) on debounce; localStorage fallback
3. Version history: list, diff view, restore
4. Export: PDF/DOCX/HTML/MD via generation service; real download
5. Collaboration skeleton: document sharing (owner + invited), permission model

**Exit criteria:** Create/edit document; autosave persists; restore version; export PDF/DOCX.

**Risk:** Rich-text ↔ DOCX/PDF round-trip fidelity; conflict resolution (last-write-wins MVP).

---

### Phase 6 — AI Assistant Integration (Weeks 11-12)
**Goal:** Modular AI assistant; keys never exposed to frontend.

**Deliverables:**
1. AI service: provider abstraction (OpenAI, Anthropic, Google); server-side keys
2. Endpoints: `POST /api/ai/generate`, `/ai/rewrite`, `/ai/summarize`, `/ai/translate`, `/ai/template-fill` (SSE streaming)
3. Frontend: AI panel in editor + generator; provider selection (admin-configurable)
4. Safety: content-length limits, PII scrub option, per-user rate limits
5. Tests: mock providers; verify no keys in frontend bundles

**Exit criteria:** Real AI-generated text inserted; streamed; no key in client code.

**Risk:** Provider cost/rate limits; streaming disconnect; prompt injection/PII.

---

### Phase 7 — SaaS Subscription, Billing & Usage Limits (Weeks 13-14)
**Goal:** Tier-based usage quotas enforced end-to-end with real Stripe.

**Deliverables:**
1. Usage-limit engine: `UsageRecord` per user/month; enforce conversions/day, file-size MB, concurrent jobs by tier
2. Stripe: Checkout + customer portal; webhook idempotency; subscription updated/deleted → tier change
3. Pricing page: tier comparison; upgrade/downgrade flow; invoice history
4. Quota middleware: reject when limit reached (402/403 with clear message)
5. Tests: webhook with stripe-mock; quota enforcement unit tests

**Exit criteria:** Real Stripe checkout creates subscription; webhook updates tier; quota blocks over-limit.

**Risk:** Stripe webhook signature in local dev (stripe-cli/stripe-mock); idempotent webhooks.

---

### Phase 8 — Admin Dashboard, Testing, Optimization, Deployment (Weeks 15-16)
**Goal:** Admin panel, full test suite, production deployment.

**Deliverables:**
1. Admin frontend: user management, tier override, system health, revenue analytics, job queue
2. Retention & deletion: configurable retention per tier; automated cleanup; GDPR "delete my data"
3. Performance: output caching, S3 presigned uploads/downloads, worker autoscaling hints
4. Observability: structured logging, request IDs, health endpoints (`/api/health`, `/api/ready`, `/api/live`)
5. Testing: 100+ backend tests; Playwright e2e for critical paths; frontend `tsc` clean; `ruff` clean
6. Deployment: docker-compose (backend, frontend, worker, redis, postgres, minio); Railway config

**Exit criteria:** Admin panel manages users/tiers/views stats; full test suite passes; production build succeeds.

**Risk:** Admin panel security (admin role + audit log); S3/Stripe keys never committed.

---

## 7. Risk Assessment & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Format fidelity loss (DOCX↔PDF, rich text) | High | LibreOffice adapter; `status()`/`notes` per conversion; mark complex cases "partial" |
| OCR accuracy / language packs | High | tesseract-ocr-all; language selection; warn on low-confidence |
| Batch job reliability at scale | High | Celery + Redis retries; idempotency keys; dead-letter queue; DB-backed job state |
| S3 migration from local FS | High | Dual-write during transition; migration script with verification; local fallback |
| Stripe webhook security/duplicates | High | Idempotency keys; stripe-mock in tests; signature verification |
| AI key leakage to frontend | Critical | Server-side proxy only; grep CI for keys in frontend bundles; never log keys |
| GDPR deletion / retention | High | Centralized deletion service; audit log; retention scheduler |
| Windows dev: no Docker/clamav | Medium | In-process job fallback; graceful ClamAV degradation; CI runs Linux |
| XSS via localStorage tokens | High | httpOnly refresh cookies; short-lived access tokens; CSRF protection |

---

## 8. Module A: Universal Document Converter — Supported Formats

**Input formats (source):** PDF, DOCX, DOC, ODT, RTF, TXT, MD, HTML, XML, JSON, CSV, TSV, XLSX, XLS, XLSM, ODS, PPTX, PPT, ODP, PNG, JPG/JPEG, WEBP, GIF, BMP, TIFF, SVG, ICO, HEIC, AVIF, EPUB

**Output formats (target):** PDF, DOCX, TXT, MD, HTML, CSV, XLSX, JSON, PNG, JPG, WEBP, GIF, BMP, TIFF, SVG, ICO, EPUB, ODT (partial)

**Conversion logic:**
- Native engines for same-family conversions (python-docx for DOCX, openpyxl for XLSX, python-pptx for PPTX, pypdf/reportlab for PDF, Pillow for images)
- LibreOffice headless for high-fidelity DOCX/PPTX→PDF
- Pandoc for MD/HTML↔Docx/EPUB
- Tesseract for OCR (scanned PDF→searchable PDF)
- ImageMagick for image format transforms and optimization
- Each conversion returns `ConversionResult` with `status` (done/partial/experimental) and `notes` describing fidelity loss

**Batch:** multi-file upload → single job → per-file results → optional ZIP download

---

**End of Blueprint.**
