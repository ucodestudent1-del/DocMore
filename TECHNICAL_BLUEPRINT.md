# EveryDoc — Technical Blueprint & Strategic Product Roadmap

**Document Owner:** Engineering  
**Product:** EveryDoc — High-Scale SaaS Platform for Automated Document Generation & Multi-Format File Conversion  
**Status:** Draft  
**Last Updated:** 2026-11-05  
**Scope:** Architecture through Day-2 operations; aligns with PRD MVP v1.0 and extends to production-scale GA

---

## Executive Summary

EveryDoc is a cloud-native, multi-tenant SaaS platform that enables programmatic and interactive document generation (HTML/CSS-to-PDF, JSON-to-DOCX) and multi-format file conversion (PDF, DOCX, XLSX, HTML, images). The platform must sustain high-throughput, asynchronous processing with sub-second API response times, multi-tenant data isolation, and compliance with GDPR and SOC2.

This blueprint defines the target architecture, feature specifications, technology stack, API design, security framework, and scalability strategy, plus a phased roadmap from MVP (Q2 2027) to high-scale GA.

---

## 1. System Architecture

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| Cloud-native / microservices | Independently deployable, horizontally scalable services communicating over gRPC/HTTP. |
| API-first | All core capabilities exposed via versioned REST + GraphQL APIs; UI is one of many clients. |
| Async-first | All conversion/generation jobs are offloaded to a distributed task queue; synchronous endpoints return a `jobId` and status. |
| Multi-tenant isolation | Tenant-scoped data, quotas, rate limits, and resource isolation at every layer. |
| Ephemeral file handling | Source/output files live in object storage with TTL-based cleanup; never persisted on worker local disk beyond job lifetime. |
| Observability by design | Distributed tracing, structured logging, metrics, and SLO-driven alerting. |

### 1.2 Service Boundaries (Microservices)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
│  Web SPA (Next.js)  │  Mobile Web  │  Partner Integrations  │  Public API   │
└──────────┬──────────┴──────────────┴────────────────────────┴──────────────┘
           │                      HTTPS / WSS / gRPC-web
┌──────────▼────────────────────────────────────────────────────────────────┐
│                         EDGE / API GATEWAY (Kong / Envoy)                   │
│  • TLS termination, WAF, rate limiting, authN/authZ, routing, request    │
│    transformation, circuit breaking                                       │
└──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬────────┘
           │          │          │          │          │          │
┌──────────▼──┐┌──────▼────┐┌────▼────────▼──┐┌──────▼──────┐┌───▼───────┐
│  API Service││Template Svc││ Conversion Svc ││  Job Svc    ││  Usage Svc││   Auth  │
│  (BFF/REST) ││  (gRPC)   ││  (gRPC)        ││  orchestration││  (billing)││  Svc    │
└──────┬──────┘└─────┬─────┘└───────┬────────┘└──────┬───────┘└─────┬────┘└────┬────┘
       │             │              │                │              │          │
       └─────────────┴──────────────┴───────────────┴──────────────┴──────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   Redis (BullMQ / Streams)   │
                    │   Job queues + rate-limit     │
                    │   counters + pub/sub          │
                    └──────────────┬──────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
┌─────────▼────────┐  ┌───────────▼────────┐ ┌───────────▼────────┐
│ Conversion       │  │ Generation Worker  │ │ OCR / AI Worker    │
│ Workers (CPU)    │  │ Workers (CPU/RAM)  │ │ Workers (GPU opt.) │
│ LibreOffice/     │  │ docx / pdf-lib     │ │ Tesseract / LLM    │
│ Puppeteer /      │  │ handlebars / mustache││ provider           │
│ Pandoc / pdf-lib │  │ JSON-to-DOCX       │ └───────────┬────────┘
└─────────┬────────┘  └───────────┬────────┘         │
          │                        │                  │
          └────────────────────────┴─────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Object Storage (S3/R2)  │
                    │  source files + outputs +   │
                    │  presigned URLs (TTL)       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      PostgreSQL (Primary)   │
                    │  tenants, users, templates, │
                    │  documents, jobs, audit     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      Redis (Cache/Sessions)  │
                    │  hot docs, rate limits,     │
                    │  websocket presence         │
                    └─────────────────────────────┘
```

### 1.3 Service Responsibilities

| Service | Responsibility | Sync/Async | Scaling Unit |
|---------|---------------|------------|--------------|
| **API Gateway** | Edge routing, WAF, authN, rate limiting, request shaping | Sync | HTTP replicas behind LB |
| **API Service** | REST/GraphQL facade, document CRUD, template CRUD, job submission, presigned URL issuance | Sync | Stateless HTTP replicas |
| **Template Service** | Template storage, variable schema validation, versioning, preview rendering | Sync | Stateless HTTP/gRPC |
| **Conversion Service** | Job intake, format negotiation, worker dispatch, result assembly | Async (gRPC to Job Svc) | Stateless HTTP/gRPC |
| **Job Service** | Queue management, retry/backoff, dead-letter handling, status machine | Async | Redis-driven |
| **Conversion Workers** | CPU-bound rendering (LibreOffice, Puppeteer, Pandoc, pdf-lib, Sharp) | Async | Worker pool, pod-per-format |
| **Generation Workers** | Template rendering (Handlebars/Mustache), JSON-to-DOCX (docx lib), HTML-to-PDF | Async | Worker pool |
| **OCR/AI Workers** | Tesseract OCR, LLM-driven text-to-document, section regeneration | Async | GPU-enabled optional pool |
| **Usage Service** | Metering, quota enforcement, billing event emission | Async | Stateless |
| **Auth Service** | JWT issuance, OAuth (Google/GitHub), session mgmt, MFA | Sync | Stateless |

### 1.4 Data Flow — Document Generation (Template + JSON → PDF/DOCX)

1. Client `POST /api/v1/generate` with `{ templateId, data: {...}, outputFormat: "pdf" }`, Bearer JWT.
2. API Service validates auth, tenant quota, and payload schema; persists a `Document` record (status `queued`) and a `Job` record.
3. API Service enqueues `generation:render` job in BullMQ (Redis), returns `202 Accepted` with `jobId`.
4. Generation Worker dequeues job, fetches template JSON + variables from PostgreSQL/Object Storage, renders HTML via Handlebars.
5. HTML→PDF via Puppeteer (print CSS) or HTML→DOCX via `docx`/`pandoc`; writes output to Object Storage (ephemeral prefix `jobs/{jobId}/`).
6. Worker updates `Job` status `completed`, stores output URL + metadata, publishes `job.completed` event on Redis Streams.
7. API Service/Webhook dispatcher notifies client via WebSocket (if connected) or HTTP webhook; client polls `GET /api/v1/jobs/{jobId}` or downloads presigned URL.

### 1.5 Data Flow — File Conversion (Upload → Multi-format)

1. Client `POST /api/v1/convert` multipart upload (or URL import). API Service streams directly to Object Storage (direct S3/R2 presigned POST to avoid proxying bytes through API).
2. API Service persists `ConversionJob` (status `queued`), enqueues `conversion:process` per file.
3. Conversion Worker downloads source to a memory-bounded temp stream (or ephemeral `/tmp` with size cap), selects engine by source→target matrix (Section 2.3).
4. Worker converts, uploads output to Object Storage, updates job status, emits event.
5. Client notified via webhook/WebSocket; downloads output via time-limited presigned URL.

### 1.6 Orchestration & Deployment

- **Container orchestration:** Kubernetes (EKS/GKE/AKS) or ECS Fargate; each service its own Deployment with HPA.
- **Service mesh (optional, post-scale):** Istio/Linkerd for mTLS, retries, circuit breaking, observability.
- **CI/CD:** GitHub Actions → container image registry → ArgoCD/Flux GitOps deployment to staging/production.
- **Environments:** local (docker-compose), preview (per-PR), staging, production.
- **Infrastructure as Code:** Terraform/OpenTofu for VPC, RDS/Aurora PostgreSQL, ElastiCache Redis, S3/R2, IAM, KMS.

### 1.7 Reliability Patterns

- Circuit breakers on downstream (LibreOffice timeouts, LLM API).
- Exponential backoff + jitter retries (max 3 attempts) with dead-letter queue for poison messages.
- Idempotency keys on generation/convert endpoints to prevent duplicate processing.
- Bulkheads: separate worker pools and Redis DBs per job class (generation vs conversion vs OCR) so a spike in one class cannot starve others.
- Multi-AZ deployment with read replicas for PostgreSQL; async replication for DR.

---

## 2. Core Feature Specifications

### 2.1 Template Engine

#### 2.1.1 Supported Transformations

| Transformation | Input | Output | Engine | Notes |
|----------------|-------|--------|--------|-------|
| HTML/CSS → PDF | HTML + inline/linked CSS | PDF | Puppeteer (headless Chromium) print CSS | `@media print`, page headers/footers, page breaks |
| HTML/CSS → DOCX | HTML + CSS | DOCX | `mammoth.js` (reverse) / Pandoc | Fidelity limited; complex CSS degraded gracefully |
| JSON → DOCX | JSON payload + DOCX template (.dotx) | DOCX | `docx` library + Handlebar-style merge | Rich text, tables, images, lists |
| JSON → PDF | JSON + HTML template | PDF | Handlebars render → Puppeteer | Single engine path for JSON→PDF via HTML |
| HTML → Markdown | HTML | MD | Turndown | Client/server |
| Markdown → PDF/DOCX/HTML | MD | PDF/DOCX/HTML | Marked + Puppeteer/Pandoc | GFM extensions |

#### 2.1.2 Template Model (Schema)

```json
{
  "templateId": "tpl_01H....",
  "tenantId": "ten_01H....",
  "name": "Invoice",
  "category": "invoice",
  "htmlTemplate": "<!doctype html>...{{invoiceNumber}}...",
  "css": "@page { size: A4; margin: 2cm; } ...",
  "variableSchema": [
    { "name": "invoiceNumber", "type": "string", "required": true },
    { "name": "lineItems", "type": "array", "itemType": "object" }
  ],
  "defaultData": { ... },
  "previewImageUrl": "s3://...",
  "isPublic": false,
  "version": 3,
  "createdAt": "2026-...",
  "updatedAt": "2026-..."
}
```

#### 2.1.3 Variable Injection Rules

- Syntax: `{{variableName}}` for scalar; `{{#each items}}{{name}} - {{price}}{{/each}}` for sections (Handlebars-compatible).
- Strict mode: unknown variables render as empty string in preview; fail job in strict production mode (configurable per template).
- Sanitization: HTML-escape by default; `{{{tripleMustache}}}` for trusted HTML only after allow-list validation (DOMPurify server-side).

#### 2.1.4 Preview Rendering

- On-demand preview endpoint `GET /api/v1/templates/{id}/preview` returns rendered HTML (no PDF/DOCX) for sub-second editor feedback.
- Preview cached per template version + variable hash (TTL 5 min) in Redis.

### 2.2 Automated Data-Mapping Layer

Purpose: map arbitrary source data (API response, database row, upload CSV/JSON) to template variables without manual field matching.

#### 2.2.1 Mapping Capabilities

- **Schema inference:** inspect sample JSON/CSV and propose field-to-variable mappings.
- **Field matching:** fuzzy + exact name matching with confidence scores; user confirmation UI.
- **Transforms:** date formatting, case conversion, currency formatting, null coalescing, default values, array flattening.
- **Conditional mapping:** `if source.field == "X" then target.var = "Y"`.
- **Persistence:** save mapping profiles per tenant/template for reuse (`MappingProfile` entity).

#### 2.2.2 Data-Mapping API

`POST /api/v1/mapping/infer` — body: `{ sampleData, templateId }` → returns proposed mapping + confidence.
`POST /api/v1/mapping/apply` — body: `{ mappingId, sourceData }` → returns resolved variable payload ready for generation engine.

### 2.3 High-Performance Conversion Engine

#### 2.3.1 Format Support Matrix

```
             ┌─────────┬─────────┬─────────┬─────────┬─────────┐
             │  PDF    │  DOCX   │  XLSX   │  HTML   │  Image  │
├────────────┼─────────┼─────────┼─────────┼─────────┼─────────┤
│ PDF        │  opt    │ LibreO  │  -      │ pdf.js  │ pdf2img │
│ DOCX       │ LibreO  │  copy   │  -      │ mammoth │ LibreO  │
│ XLSX       │ LibreO  │  copy   │  copy   │ SheetJS │ LibreO  │
│ HTML       │ Puppete │ docx    │  copy   │  -      │ Puppete │
│ Image      │ Img2PDF │ -       │  -      │ -       │ Sharp   │
└────────────┴─────────┴─────────┴─────────┴─────────┴─────────┘
```

Key: `LibreO` = headless LibreOffice; `Puppete` = Puppeteer; `opt` = pdf-lib/ghostscript optimization.

#### 2.3.2 Engine Selection Logic (per source→target)

| Source → Target | Primary Engine | Fallback | Fidelity |
|-----------------|----------------|----------|----------|
| DOCX → PDF | Headless LibreOffice (`soffice --headless --convert-to pdf`) | - | High (layout-preserving) |
| PDF → DOCX | `mammoth`-inverse not reliable; Pandoc `pdf→docx` | Apache Tika (Java sidecar) | Medium |
| HTML → PDF | Puppeteer (`page.pdf()`) with print CSS | wkhtmltopdf (legacy) | High |
| HTML → DOCX | Pandoc (`html→docx`) | mammoth reverse | Medium |
| HTML → Markdown | Turndown | Pandoc | High |
| Markdown → PDF | Marked → HTML → Puppeteer | Pandoc | High |
| Markdown → DOCX | Pandoc | docx lib | Medium |
| XLSX → PDF/HTML | LibreOffice headless | SheetJS (data only) | High |
| Image → PDF | img2pdf / pdf-lib | - | High |
| Image → Image | Sharp (resize/convert/format) | - | High |
| PDF → Image | pdf2image (poppler) | Puppeteer render | High |
| PDF → Text/MD | pdf-parse + Turndown | Tesseract OCR (scanned) | Medium |
| PDF optimization | pdf-lib + Ghostscript | - | Lossless/lossy |

#### 2.3.3 Conversion Job Model

```json
{
  "jobId": "cnv_01H....",
  "tenantId": "ten_01H....",
  "userId": "usr_01H....",
  "status": "queued|processing|completed|failed|dead_letter",
  "sourceFiles": [{"fileId", "originalName", "mimeType", "size", "storageKey"}],
  "targetFormat": "pdf|docx|xlsx|html|md|png|jpg",
  "options": {"dpi", "quality", "ocr": false, "preserveForms": false},
  "outputFiles": [{"storageKey", "mimeType", "size", "presignedUrl", "expiresAt"}],
  "error": {"code", "message", "retryable"},
  "attempts": 0,
  "maxAttempts": 3,
  "createdAt", "startedAt", "completedAt"
}
```

#### 2.3.4 Performance Guardrails

- Max file size enforced at gateway: Free 25 MB, Paid 100 MB, Enterprise 500 MB (configurable per tenant).
- Worker memory cap: 2 GB per conversion process; OOM kill → job marked failed, retry once with reduced quality.
- Per-job timeout: 300 s (configurable); LibreOffice/Puppeteer hard timeout 240 s.
- Concurrency limit per worker: 1 CPU-bound job at a time; I/O-bound (Sharp, pdf-parse) up to 4 concurrent.
- Batch jobs: fan-out per-file sub-jobs; parent job completes when all sub-jobs terminal; partial failures reported per file.

---

## 3. Technology Stack Recommendations

### 3.1 Production Stack Matrix

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Frontend | Next.js 15 (App Router), React 19, TypeScript | latest LTS | SSR/SSG, edge-ready, Vercel/self-host |
| UI Kit | shadcn/ui, Tailwind CSS, Lucide | latest | Accessible, consistent, no heavy component lib |
| State | TanStack Query (server), Zustand (client) | latest | Cache/sync for job polling |
| API Gateway | Kong or Envoy | latest | WAF, rate limiting, mTLS, routing |
| API Service | Node.js 20 LTS, TypeScript, Hono or Express | LTS | Existing codebase alignment, rich ecosystem |
| Conversion Workers | Node.js 20 + native sidecars | LTS | Puppeteer/Sharp native bindings |
| Task Queue | Redis 7 + BullMQ | 7.x | Reliable, delayed jobs, rate limiting, DLQ |
| Pub/Sub | Redis Streams | 7.x | Job completion fan-out to websockets/webhooks |
| Database | PostgreSQL 16 (Aurora / RDS / Neon) | 16 | Relational integrity, JSONB for templates, audit |
| Object Storage | AWS S3 or Cloudflare R2 | - | S3-compatible, lifecycle policies, presigned URLs |
| Cache | Redis (ElastiCache / Upstash) | - | Sessions, hot docs, rate-limit counters |
| Search (optional) | Meilisearch or Elasticsearch | - | Template gallery full-text search |
| CI/CD | GitHub Actions + ArgoCD | - | GitOps, preview environments |
| Observability | OpenTelemetry → Honeycomb/Datadog; Loki; Grafana | - | Traces, logs, metrics, SLO dashboards |
| Secrets | AWS Secrets Manager / Doppler / 1Password Secrets Automation | - | No secrets in repo/CI |
| Payments | Stripe | - | Subscription + usage-based metered billing |
| Auth | Clerk or Supabase Auth + custom JWT service | - | OAuth, MFA, session mgmt |

### 3.2 Conversion Libraries & Specialized APIs

| Category | Library / Tool | Use |
|----------|---------------|-----|
| PDF manipulation | `pdf-lib` | Merge, split, compress, form filling, metadata |
| PDF parsing | `pdf-parse` | Text extraction, page count |
| DOCX generation | `docx` (npm) | Programmatic DOCX from JSON |
| DOCX → HTML | `mammoth.js` | High-fidelity DOCX→HTML |
| Markdown parse | `marked` | MD→HTML pipeline |
| HTML → MD | `turndown` | HTML→Markdown |
| HTML → PDF | `puppeteer` | Print CSS PDF rendering |
| Image processing | `sharp` | Resize, format convert, metadata strip |
| Headless office | LibreOffice (headless) | DOCX↔PDF, XLSX↔PDF/HTML fidelity |
| PDF → image | `pdf2image` / poppler | PDF page rendering |
| OCR | Tesseract.js / Tesseract OCR sidecar | Scanned PDF text extraction |
| Universal conv | Pandoc (sidecar container) | HTML/MD/DOCX cross-conversion fallback |
| HTML sanitization | `dompurify` (server) | XSS prevention on triple-mustache HTML |

### 3.3 Async Workload Pattern (BullMQ)

- Queues: `conversion:process`, `generation:render`, `ocr:extract`, `ai:generate`, `cleanup:ephemeral`.
- Rate limiting: BullMQ `RateLimiter` per tenant (jobs/min) to enforce quota and prevent noisy neighbors.
- Delayed jobs: ephemeral file cleanup scheduled `job.createdAt + TTL`.
- Concurrency: per-worker `concurrency` tuned to CPU cores; I/O-heavy jobs higher concurrency than CPU-heavy.
- Retry: `backoff: { type: 'exponential', delay: 2000 }`, `attempts: 3`, dead-letter queue `*_failed`.
- Events: `completed`, `failed`, `progress` emitted to Redis Streams; API Service consumes for WebSocket/webhook dispatch.

### 3.4 Infrastructure Topology (AWS Example)

- VPC with public subnets (ALB, NAT) and private subnets (services, workers, RDS, ElastiCache).
- RDS Aurora PostgreSQL Serverless v2 (multi-AZ), read replicas for reporting.
- ElastiCache for Redis (cluster mode enabled, multi-AZ).
- S3 buckets: `everydoc-source-{env}`, `everydoc-output-{env}` with lifecycle rule (delete after 7 days), SSE-KMS encryption, Block Public Access.
- ECS Fargate or EKS for services/workers; spot instances for worker pools to reduce conversion cost.
- CloudFront for presigned asset delivery + edge caching of public templates.

---

## 4. API & Integration Ecosystem

### 4.1 API Strategy

- **Primary:** REST (OpenAPI 3.1) — resource-oriented, simple client generation, good tooling.
- **Secondary:** GraphQL (Apollo/GraphQL Yoga) — for dashboard clients needing nested, flexible queries (documents + templates + jobs in one round trip).
- Both expose the same underlying service layer; GraphQL resolvers call the same use cases as REST controllers.
- Versioning: `/api/v1/...`; breaking changes → `/api/v2/` with 12-month deprecation window and sunset headers.

### 4.2 Core REST Endpoints

```
Authentication
  POST   /api/v1/auth/register
  POST   /api/v1/auth/login
  POST   /api/v1/auth/logout
  POST   /api/v1/auth/refresh
  GET    /api/v1/auth/me

Tenants / Workspaces
  GET    /api/v1/workspaces
  POST   /api/v1/workspaces
  GET    /api/v1/workspaces/:id
  PATCH  /api/v1/workspaces/:id
  GET    /api/v1/workspaces/:id/members
  POST   /api/v1/workspaces/:id/members

Templates
  GET    /api/v1/templates                      (list, filter, search)
  POST   /api/v1/templates
  GET    /api/v1/templates/:id
  PATCH  /api/v1/templates/:id
  DELETE /api/v1/templates/:id
  POST   /api/v1/templates/:id/versions
  GET    /api/v1/templates/:id/preview
  GET    /api/v1/templates/:id/variables        (schema)

Documents (generation)
  POST   /api/v1/documents                      (create from template/AI)
  GET    /api/v1/documents/:id
  PATCH  /api/v1/documents/:id
  DELETE /api/v1/documents/:id
  POST   /api/v1/documents/:id/generate         (render → job)
  GET    /api/v1/documents/:id/export/:format   (presigned download)

Conversion
  POST   /api/v1/convert                        (multipart or URL, returns jobId)
  GET    /api/v1/convert/:jobId                 (status + output presigned URLs)
  DELETE /api/v1/convert/:jobId                 (cancel if queued/processing)
  POST   /api/v1/convert/batch                  (multiple files)

Data Mapping
  POST   /api/v1/mapping/infer
  POST   /api/v1/mapping/apply

Jobs (generic)
  GET    /api/v1/jobs/:id
  GET    /api/v1/jobs                           (list, filter by status/tenant)

Usage & Quota
  GET    /api/v1/usage                          (current period)
  GET    /api/v1/quota                          (limits + remaining)

Webhooks
  GET    /api/v1/webhooks                       (list registered endpoints)
  POST   /api/v1/webhooks
  PATCH  /api/v1/webhooks/:id
  DELETE /api/v1/webhooks/:id
  GET    /api/v1/webhooks/:id/deliveries        (delivery attempts)

API Keys
  GET    /api/v1/api-keys
  POST   /api/v1/api-keys                       (returns secret once)
  DELETE /api/v1/api-keys/:id

Health
  GET    /healthz                               (liveness)
  GET    /readyz                                (readiness: DB, Redis, storage)
```

### 4.3 Authentication & Authorization

- **AuthN:** JWT access tokens (short-lived, 15 min) + refresh tokens (7–30 days, rotating) in `httpOnly`, `Secure`, `SameSite=Strict` cookies; OAuth 2.0 (Google, GitHub) + email/password; MFA (TOTP) for paid tiers.
- **API Keys:** prefix `ed_live_...` / `ed_test_...`, scoped to tenant, HMAC-SHA256 signed, rate-limited separately from user sessions.
- **AuthZ:** RBAC (owner, admin, member, viewer) + resource-level tenant isolation enforced by middleware; every request resolves `tenantId` from JWT/subdomain and scopes DB queries.
- **Idempotency:** `Idempotency-Key` header on mutating endpoints; 24-hour dedup window.

### 4.4 Documentation Structure

Hosted docs site (Mintlify/Docusaurus) with:

1. **Quickstart** — 5-minute first API call (cURL + official SDKs).
2. **Authentication guide** — JWT, OAuth, API keys, MFA.
3. **API Reference** — OpenAPI 3.1 spec (interactive Try-It console), per-endpoint request/response schemas, error taxonomy.
4. **Conversion guide** — format matrix, size limits, options, async polling vs webhooks.
5. **Template guide** — Handlebars syntax, variable schema, JSON→DOCX mapping, CSS constraints for PDF.
6. **Webhooks guide** — event schema, retry policy, signature verification, delivery logs.
7. **SDKs** — TypeScript/JavaScript (official), Python, Go, PHP, cURL examples; OpenAPI client generation in CI.
8. **Error reference** — HTTP status + `error.code` + `error.retryable` + remediation steps.
9. **Rate limits & quotas** — per-tier tables, headers (`X-RateLimit-Limit/Remaining/Reset`), 429 handling.
10. **Changelog & deprecation policy** — versioning, sunset dates, migration guides.

### 4.5 Webhook System

- **Events:** `job.completed`, `job.failed`, `document.generated`, `conversion.completed`, `quota.threshold`, `invoice.paid`, `subscription.cancelled`.
- **Delivery:** HTTP POST with JSON body, `Idempotency-Key`, `EveryDoc-Signature` HMAC-SHA256 header (webhook secret), `EveryDoc-Event-Type`, `EveryDoc-Delivery-Id`.
- **Retry:** exponential backoff (1s, 5s, 25s, 120s, 600s), max 5 attempts over ~24h; dead-letter after exhaustion; customer-configurable failure threshold for auto-disable.
- **Idempotency:** delivery-id dedupe at receiver recommended; signature verification mandatory.
- **Management:** dashboard to register endpoints, select events, view delivery history (status, response, duration), re-deliver failed.
- **Test endpoint:** `POST /api/v1/webhooks/test` sends a sample payload.

### 4.6 SDKs & Client Generation

- Generate TypeScript, Python, Go, PHP, Java clients from OpenAPI spec via OpenAPI Generator in CI; publish to npm/PyPI/Go module registry.
- Official TS SDK included in repo (`sdk/`), with auto-retries, job polling helper, webhook verification util.

---

## 5. Security, Privacy, & Compliance

### 5.1 Security Framework (Defense in Depth)

| Layer | Controls |
|-------|----------|
| Edge / Transport | TLS 1.3 everywhere (ALB/CloudFront), HSTS, modern cipher suites, certificate pinning optional for SDKs, WAF (OWASP Top 10), DDoS protection |
| API Gateway | AuthN/AuthZ, rate limiting, request size limits, IP allow/block lists, geo-blocking (optional) |
| Service-to-service | mTLS (service mesh) or JWT service accounts; least-privilege IAM roles |
| Application | Helmet headers, CSRF (SameSite cookies), XSS protection, input validation (Zod), SQL injection prevention (parameterized queries / ORM), output encoding |
| Data at rest | AES-256 encryption (SSE-S3/SSE-KMS for object storage; TDE/pgcrypto for PostgreSQL), field-level encryption for sensitive document content |
| Data in transit | TLS 1.3 internal + external; no plaintext credentials in logs |
| Secrets | Secrets Manager / external secret store; rotation; never in repo or CI logs |
| Container | Non-root users, read-only root filesystem where possible, image scanning (Trivy), base image pinning, runtime security (Falco) |

### 5.2 Encryption Standards

- **At rest:** AES-256-GCM (S3 SSE-KMS), PostgreSQL Transparent Data Encryption; database backups encrypted.
- **In transit:** TLS 1.3, AES-256-GCM / ChaCha20-Poly1305 cipher suites, perfect forward secrecy via ECDHE.
- **Keys:** AWS KMS CMKs with automatic rotation (1 year); envelope encryption for document content; separate KMS keys per environment; break-glass access logged.
- **File handling:** source and output objects encrypted server-side; presigned URLs with short TTL (default 15 min, max 24h); client-side encryption optional for Enterprise (customer-managed keys via KMS external key store).

### 5.3 Ephemeral File Handling

- All conversion/generation inputs and outputs stored under `jobs/{jobId}/` prefix.
- TTL-based lifecycle: S3 lifecycle rule expires objects after 7 days (configurable per tier: Free 3d, Paid 7d, Enterprise 30d).
- Explicit deletion: `DELETE /api/v1/jobs/{jobId}` removes files immediately.
- Workers write to memory-bounded streams or `/tmp` with `ulimit` and size cap; temp files `unlinked` immediately after creation (POSIX) to guarantee cleanup on crash.
- No document content stored on worker local disk beyond job lifetime; no content in logs (metadata only, redacted PII).

### 5.4 Sandboxing for Conversion Processes

- Conversion workers run in isolated containers (Fargate/EKS pods) with:
  - Non-root user (`node` user, UID 1000).
  - Read-only root filesystem; writable `/tmp` tmpfs (size-limited, noexec).
  - Seccomp profile (Docker default + custom blocking `mount`, `ptrace`, `reboot`).
  - AppArmor profile restricting network egress to allowed conversion endpoints only (LibreOffice has no external network need).
  - CPU/memory limits (cgroups); no GPU unless OCR/AI pool.
  - Network isolation: egress denied except S3/Redis/internal service endpoints.
  - LibreOffice run with `--headless --norestore --no-first-startwizard` and user profile redirected to tmpfs.
- Headless Chromium (Puppeteer) with `--no-sandbox` avoided where possible; if required, runs in dedicated hardened pod with seccomp + no external network.
- File-type validation at upload (magic bytes via `file-type` library, not extension); ClamAV sidecar scan for paid/Enterprise uploads (post-MVP).

### 5.5 GDPR Compliance Roadmap

| Control | Implementation | Timeline |
|---------|---------------|----------|
| Lawful basis & consent | Cookie consent banner, DPA checkbox, processing register | MVP |
| Data subject access | `GET /api/v1/user/export` (all data + files) | MVP |
| Right to erasure | `DELETE /api/v1/account` cascades docs/templates/jobs/files; 30-day soft-delete then hard purge | MVP |
| Data minimization | Collect only required fields; IP anonymization in logs after 30d | MVP |
| Breach notification | Incident response plan; 72h supervisory authority notification process | MVP |
| Records of processing | Audit log (who, what, when, which tenant) stored immutable | MVP |
| DPO / contact | Published DPO contact, privacy policy, terms | Post-MVP |
| Cross-border transfers | EU region deployment option; SCCs for subprocessors (LLM provider) | Post-MVP |
| Data retention policy | Configurable per tenant; automated purge jobs | Post-MVP |

### 5.6 SOC2 Type II Roadmap

| Domain | Milestone | Target |
|--------|-----------|--------|
| CC6.1 Logical access | RBAC, MFA, least privilege IAM, access review quarterly | T+6 months |
| CC6.6 Network security | WAF, TLS 1.3, VPC isolation, penetration test | T+6 months |
| CC7.1 Change management | CI/CD gated on tests + review; change log | T+6 months |
| CC7.2 System operations | Monitoring, alerting, on-call runbooks, incident mgmt | T+9 months |
| A1.2 Availability | 99.9% SLO, auto-scaling, multi-AZ, DR test | T+9 months |
| Confidentiality | Encryption at rest/transit, key management, vendor assessments | T+12 months |
| SOC2 Type II audit | Engage CPA firm, Type I then Type II | T+12–18 months |

### 5.7 Third-Party Subprocessor Management

- LLM provider (OpenAI/Anthropic): data processing agreement, zero-retention/opt-out where available, no training on customer data (Enterprise).
- Stripe (payments): PCI DSS handled by Stripe; EveryDoc never stores full card numbers.
- Monitoring/logging vendors: BAAs where PHI could appear (none by design); DPAs in place.

---

## 6. Scalability & Performance Engineering

### 6.1 Target SLOs

| Metric | Target | Measurement |
|--------|--------|-------------|
| API p95 latency (CRUD) | < 100 ms | RUM + synthetic |
| Job acceptance (202) | < 500 ms | API Service |
| Single-file conversion < 5 MB | < 30 s p95 | Worker → job completed |
| Batch conversion (50 files) | < 180 s p95 | Fan-out + aggregation |
| Template preview | < 200 ms p95 (cached) | Redis cache hit |
| Platform availability | 99.9% monthly | SLO dashboard |
| Error rate | < 0.1% of jobs | Sentry + metrics |

### 6.2 Load Management & Auto-Scaling

- **API Service:** HPA on CPU > 65% or request latency p99 > 500 ms; min 2, max 50 replicas; warm-pool for flash traffic.
- **Conversion Workers:** KEDA or custom metrics scaler based on BullMQ queue depth (`jobs waiting > 10 per worker` → scale); min 0 (scale-to-zero for off-peak), max 100; spot instance fallback.
- **Generation Workers:** scale on queue depth + CPU; separate from conversion to avoid CPU starvation.
- **Database:** Aurora Serverless v2 auto-scales ACUs; read replicas scale for analytics/reporting; connection pooling (PgBouncer) in front of PostgreSQL.
- **Redis:** ElastiCache cluster mode with sharding; scale horizontally on memory/eviction metrics.
- **Object Storage:** S3 scales automatically; use S3 Intelligent-Tiering for infrequent access; CloudFront edge caching for public templates.

### 6.3 Load Balancing & Traffic

- **External:** Application Load Balancer (ALB) + CloudFront; TLS termination at ALB; sticky sessions not required (stateless services, Redis-backed sessions).
- **Internal:** Kubernetes Service (ClusterIP) + Envoy sidecar or AWS App Mesh for gRPC service-to-service with retries, timeouts, circuit breakers.
- **Traffic shaping:** rate limiting per tenant/API key/IP at gateway (token bucket); burst allowance + queueing; 429 with `Retry-After` header.
- **Backpressure:** BullMQ concurrency limits per worker type; API returns 429/503 when queues saturated; client advised to retry after `Retry-After`.

### 6.4 Resource Isolation

- **Tenant isolation:** row-level security (RLS) on PostgreSQL by `tenantId`; Redis rate-limit keys namespaced `tenant:{id}:{endpoint}`; per-tenant job queue priority (Enterprise > Paid > Free).
- **Workload isolation:** separate node pools / Kubernetes namespaces for API, workers, OCR/AI; taints/tolerations so CPU-heavy LibreOffice jobs don't share nodes with latency-sensitive API pods.
- **Noisy neighbor:** per-worker job concurrency cap; per-tenant job rate limits; CPU limits/cfs quota on containers.

### 6.5 Caching Strategy

| Cache | Content | TTL | Invalidation |
|-------|---------|-----|--------------|
| Redis | Job status, presigned URLs, rate-limit counters | 5 min–24h | Job terminal state; URL consumed |
| Redis | Template preview HTML | 5 min | Template version bump |
| CDN (CloudFront) | Public templates, static assets | 24h | Cache tags / versioned URLs |
| Application | Frequently used templates (compiled Handlebars) | 30 min | Template update |
| Browser | SDK, static assets | 30d | Service worker + versioned builds |
| CDN edge | Presigned output downloads | 15 min | Signed URL expiry (do not cache beyond TTL) |

Cache-aside pattern with write-through for template previews; cache-stampede protection via single-flight locks for template compilation.

### 6.6 Latency Reduction for Intensive Conversions

- **Streaming uploads:** direct-to-S3 presigned POST so API never proxies large bytes.
- **Engine warm pools:** keep a small pool of pre-warmed Puppeteer/LibreOffice processes (or containers with pre-loaded engines) to avoid cold-start (~5–15 s).
- **Format fast paths:** DOCX→DOCX copy; PDF optimization only when requested; skip OCR unless `ocr=true`.
- **Parallelization:** batch jobs fan out per file across worker pool; multi-page PDF→image renders pages in parallel (bounded concurrency).
- **Result caching:** hash source content + options; if identical conversion exists within 24h, return cached output URL (skip reprocessing). Applies to public/template-driven conversions.
- **Edge delivery:** CloudFront signed URLs for output files; regional edge caches reduce download latency.

### 6.7 Peak Load / Black Friday Playbook

1. Pre-scale workers 24h before anticipated peak based on queue depth forecast.
2. Enable Free-tier queue deprioritization; Paid/Enterprise guaranteed concurrency slots.
3. Circuit-breaker non-critical AI/OCR features under load.
4. Graceful degradation: return `202` with `retryAfter` instead of 503; continue processing as workers scale.
5. Post-peak: scale-to-zero worker pools, review SLO breaches, tune HPA thresholds.

---

## 7. Strategic Product Roadmap

Roadmap aligns to PRD MVP v1.0 (Q2 2027) and extends to high-scale GA. Timeframes are quarters from project kickoff.

### Phase 1 — Foundation & MVP (Q1–Q2 2027)

**Goal:** Validate core generation + conversion end-to-end; first paying users.

- Next.js frontend + Node.js/TypeScript backend (existing scaffold)
- Auth: email/password + OAuth (Google/GitHub), JWT in httpOnly cookies
- PostgreSQL (Supabase/Neon) + Redis + BullMQ
- Object storage (S3/R2) with presigned uploads/downloads
- Conversion engine: DOCX↔PDF↔HTML↔Markdown (LibreOffice, Puppeteer, Pandoc, pdf-lib, mammoth, turndown)
- Template engine: Handlebars HTML→PDF/DOCX, JSON→DOCX
- REST API v1, OpenAPI docs, API keys (paid tiers)
- Stripe billing: Free/Starter/Professional tiers; usage metering
- Webhooks for job completion
- Async job queue with status polling + webhook notification
- Security: TLS, JWT, rate limiting, input validation, ephemeral file TTL

**Exit criteria:** `<30s` conversion for `<5MB` files; ≥95% conversion success; first paying customers.

### Phase 2 — Scale & Reliability (Q3 2027)

**Goal:** Production-grade reliability, multi-tenant isolation, performance.

- Kubernetes/EKS deployment with HPA, multi-AZ
- Service mesh (Istio/Linkerd) mTLS + circuit breaking
- Per-tenant rate limits, resource isolation (separate worker pools)
- Warm pools for Puppeteer/LibreOffice; result caching by content hash
- SLO/SLI dashboards (OpenTelemetry, Grafana), alerting, on-call runbooks
- Penetration test; ClamAV virus scanning; field-level encryption for sensitive docs
- GraphQL endpoint for dashboard
- SDKs: TS, Python, Go

**Exit criteria:** 99.9% availability SLO; p95 API <100 ms; penetration test passed.

### Phase 3 — Compliance & Enterprise (Q4 2027 – Q1 2028)

**Goal:** GDPR/SOC2 readiness; enterprise features.

- GDPR: data export, erasure, DPA, retention policies, breach notification process
- SOC2 Type II preparation: RBAC, MFA, access reviews, change management, audit logs
- Customer-managed keys (KMS external key store) for Enterprise
- SSO (SAML/OIDC), SCIM provisioning, workspace admin dashboard
- SLA-backed commitments (99.95% Enterprise)
- Audit log export; immutable retention
- Vendor subprocessors: DPA/BAA register, LLM zero-retention opt-out

**Exit criteria:** SOC2 Type I completed; GDPR self-assessment signed; first Enterprise contract.

### Phase 4 — High-Scale & Platform (Q2 2028+)

**Goal:** High-throughput SaaS platform; ecosystem extensibility.

- OCR for scanned PDFs (Tesseract sidecar); AI text-to-document (LLM integration)
- Batch conversion 100+ files; large file support up to 500 MB
- Template marketplace; public template gallery; template versioning
- Real-time WebSocket job progress (optional polling fallback)
- Integrations: Google Drive, Dropbox, Notion, OneDrive (OAuth file pickers)
- Electronic signature workflow (post-MVP open question)
- Multi-region deployment (EU + US) for data residency
- Mobile-native consideration vs responsive web (decision gate)

**Exit criteria:** Multi-region live; OCR/AI generally available; platform handles 10k+ concurrent jobs.

---

## 8. Operational Readiness Checklist

- [ ] OpenAPI 3.1 spec published; SDK generation in CI
- [ ] HPA/KEDA policies defined and load-tested
- [ ] SLO dashboards with alerting (latency, error rate, availability)
- [ ] Encryption at rest (S3 SSE-KMS, RDS TDE) and in transit (TLS 1.3)
- [ ] Ephemeral file TTL lifecycle rules + explicit delete
- [ ] Sandboxed conversion containers (non-root, seccomp, tmpfs /tmp, network isolation)
- [ ] GDPR data export/erasure endpoints
- [ ] SOC2 control evidence collection (access reviews, change logs, pen test)
- [ ] Disaster recovery test (multi-AZ failover, backup restore)
- [ ] Incident response runbook + 72h breach notification process
- [ ] Cost attribution per tenant (tagging, usage metering)

---

## 9. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DOCX formatting fidelity loss | High | Medium | Headless LibreOffice as primary; set UI expectations; offer PDF as canonical |
| AI/LLM cost overruns | Medium | High | Per-user AI credits; prompt caching; rate limits; zero-retention opt-out |
| Large file timeouts | Medium | Medium | Size caps; async jobs; streaming to S3; worker timeouts with retry |
| Storage cost growth | Low | Medium | Lifecycle policies; tier-based quotas; Intelligent-Tiering |
| Noisy neighbor (CPU) | Medium | High | Separate worker pools; cgroup limits; per-tenant rate limits |
| Conversion engine vulnerabilities | Medium | High | Container sandboxing; image scanning; file-type validation; ClamAV |
| Compliance delays | Medium | High | Early GDPR design; SOC2 gap assessment at Phase 2 start |

---

**End of Blueprint.** This document is intended to guide implementation across the six technical domains and should be reviewed bi-weekly alongside the PRD during MVP development, then quarterly post-launch.
