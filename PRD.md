# EveryDoc PRD — MVP

## 1. Overview

**Product Name:** EveryDoc  
**Version:** MVP v1.0  
**Status:** Draft  
**Target Launch:** Q2 2027

EveryDoc is an all-in-one SaaS platform for automated document generation and multi-format file conversion. The MVP enables users to generate documents from AI-powered templates and convert files seamlessly between PDF, DOCX, HTML, and Markdown formats.

---

## 2. Core Feature Set

### 2.1 Document Generation Engine

#### 2.1.1 Template Management (Functional Requirements)

| ID | Requirement | Priority |
|----|-------------|----------|
| TG-01 | Users can create, edit, duplicate, and delete document templates | P0 |
| TG-02 | Templates support static content and merge variables (e.g., `{{customer_name}}`) | P0 |
| TG-03 | Templates can be organized into folders and tagged for search | P1 |
| TG-04 | Template preview renders live before generation | P1 |
| TG-05 | Templates support rich text formatting (headings, lists, bold, italic, tables) | P0 |
| TG-06 | Version history retained for templates (last 5 versions) | P2 |
| TG-07 | Public template gallery with pre-built templates (invoice, resume, contract, report) | P1 |

#### 2.1.2 AI-Driven Text-to-Document (Functional Requirements)

| ID | Requirement | Priority |
|----|-------------|----------|
| AI-01 | Users input natural language prompts to generate document content | P0 |
| AI-02 | AI output maps into selected template structure (variable injection) | P0 |
| AI-03 | Users can refine/generate sections iteratively via chat-style interface | P1 |
| AI-04 | Supported content types: invoices, proposals, resumes, meeting notes, reports, contracts | P0 |
| AI-05 | Option to regenerate specific sections without regenerating whole document | P2 |
| AI-06 | AI usage quota tracked per user subscription tier | P1 |

#### 2.1.3 Document Editor (Functional Requirements)

| ID | Requirement | Priority |
|----|-------------|----------|
| ED-01 | WYSIWYG rich text editor for generated documents | P0 |
| ED-02 | Real-time preview of final output format | P0 |
| ED-03 | Undo/redo history | P1 |
| ED-04 | Export to PDF, DOCX, HTML, Markdown directly from editor | P0 |
| ED-05 | Auto-save drafts every 30 seconds | P1 |

### 2.2 Conversion Engine

| ID | Requirement | Priority |
|----|-------------|----------|
| CV-01 | Convert PDF ↔ DOCX, PDF ↔ HTML, PDF ↔ Markdown, DOCX ↔ HTML, DOCX ↔ Markdown, HTML ↔ Markdown | P0 |
| CV-02 | Batch conversion (up to 10 files per job on free tier, 50 on paid) | P1 |
| CV-03 | Preserve formatting, tables, images, and styling during conversion | P0 |
| CV-04 | File upload via drag-and-drop or URL import | P0 |
| CV-05 | Conversion status tracking (queued, processing, completed, failed) | P0 |
| CV-06 | Download converted files individually or as ZIP bundle | P1 |
| CV-07 | Maximum file size: 25MB per file (free), 100MB (paid) | P1 |
| CV-08 | OCR text extraction for scanned PDFs (MVP: English only) | P2 |

### 2.3 Shared / Platform Features

| ID | Requirement | Priority |
|----|-------------|----------|
| PF-01 | User registration, login, password reset (email + OAuth: Google, GitHub) | P0 |
| PF-02 | Workspace creation and management | P0 |
| PF-03 | File storage with per-user quotas | P0 |
| PF-04 | Document and conversion history dashboard | P0 |
| PF-05 | Responsive web UI (desktop + mobile) | P0 |
| PF-06 | API access (REST) for document generation and conversion (MVP: paid tiers only) | P1 |
| PF-07 | Audit log of user actions (export, convert, delete) | P2 |

---

## 3. User Workflow

### 3.1 End-to-End Journey Map

```
Onboarding → Workspace Setup → Template Selection/AI Prompt → Document Generation
   ↓                                                              ↓
File Upload/Conversion ← Editing & Refinement ← Export/Download ← Review
```

### 3.2 Detailed Touchpoints

#### Phase A: Onboarding & Account Setup
1. **Landing page** — value prop, feature demo, pricing, sign-up CTA.
2. **Sign-up** — email/password or OAuth (Google, GitHub). Email verification required.
3. **Welcome flow** — 3-step carousel: (a) choose primary use case, (b) set workspace name, (c) select subscription tier.
4. **Workspace created** — user lands on dashboard showing recent documents, conversions, and quick actions.

#### Phase B: Document Generation Path
1. **New Document** — user clicks "Create Document" on dashboard.
2. **Choose source** — (a) Blank, (b) Template gallery, (c) AI text-to-document.
3. **Template selection** — preview template, select, open editor.
4. **AI generation** (optional) — enter prompt, AI drafts content, user reviews/edits.
5. **Variable injection** — user fills merge fields (`{{client_name}}`, `{{date}}`, etc.).
6. **Edit** — WYSIWYG editor with real-time preview.
7. **Export** — select format (PDF/DOCX/HTML/MD), download or share link.

#### Phase C: File Conversion Path
1. **Convert** — user clicks "Convert Files" on dashboard.
2. **Upload** — drag-and-drop files or paste URL.
3. **Select target format** — choose from PDF, DOCX, HTML, Markdown.
4. **Process** — conversion job queued; user sees status progress.
5. **Review** — preview converted output inline.
6. **Download** — single file or ZIP bundle; option to save to workspace.

#### Phase D: Ongoing Management
- **Dashboard** — recent activity, storage usage, quick re-convert, template library.
- **Settings** — billing, API keys, integrations, team members (post-MVP).

### 3.3 Key User Flows (Acceptance Criteria)

| Flow | Success Criteria |
|------|------------------|
| Sign-up to first document | < 5 minutes, < 3 clicks to export |
| Template-based generation | Variable fields auto-detected, preview matches export |
| AI text-to-document | Output editable, format preserved on export |
| Single file conversion | Completed within 30s for <5MB files |
| Batch conversion | All files in job converted; failures reported per file |

---

## 4. Technical Architecture

### 4.1 High-Level Architecture

```
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│   Frontend      │      │     Backend     │      │   AI Service    │
│  (Next.js/React)│◄────►│  (Node.js/TS)   │◄────►│ (LLM Provider)  │
│  Vercel/Netlify │      │  (Render/Railway)│     │  (OpenAI/Anthropic)│
└─────────────────┘      └─────────────────┘      └─────────────────┘
        │                        │                        │
        │                  ┌─────▼─────┐                  │
        │                  │  Database │                  │
        │                  │  (PostgreSQL via Supabase)  │
        │                  └─────┬─────┘                  │
        │                        │                        │
        │                  ┌─────▼─────┐                  │
        │                  │ Object    │                  │
        │                  │ Storage   │                  │
        │                  │ (S3/R2)   │                  │
        │                  └───────────┘                  │
        │                        │                        │
        │                  ┌─────▼─────┐                  │
        └─────────────────►│  Job Queue│◄─────────────────┘
                           │ (BullMQ/   │
                           │  Redis)    │
                           └───────────┘
```

### 4.2 Recommended Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS | Rapid development, SSR/SSG, Vercel deployment |
| UI Components | shadcn/ui + Lucide icons | Accessible, customizable, consistent |
| State Management | React Query (server state), Zustand (client state) | Minimal boilerplate |
| Backend | Node.js, TypeScript, Express or Hono | Familiar ecosystem, fast iteration |
| Database | PostgreSQL (Supabase or Neon) | Relational data for users, docs, templates, billing |
| Auth | Supabase Auth or Clerk | OAuth, session mgmt, email magic links |
| Object Storage | AWS S3 or Cloudflare R2 | File uploads, converted file delivery |
| Job Queue | Redis + BullMQ (self-hosted or Upstash) | Async conversion and AI jobs |
| File Processing | `libreoffice` (headless), `pandoc`, `pdf-lib`, `mammoth.js`, `turndown`, `marked` | Multi-format conversion engine |
| AI Integration | OpenAI API (GPT-4o) or Anthropic Claude | Text-to-document generation |
| Payments | Stripe | Subscription + usage-based billing |
| Monitoring | Sentry + Logtail | Error tracking, logs |
| Deployment | Vercel (frontend) + Railway/Render (backend) | Fast MVP deployment |

### 4.3 Conversion Engine — Library Mapping

| Source → Target | Library / Engine | Notes |
|-----------------|------------------|-------|
| PDF → DOCX/HTML/MD | `pdf-lib` + `pdf-parse` + `turndown` | Text extraction; layout limits acknowledged |
| DOCX → PDF/HTML/MD | Headless LibreOffice (`unoconv` alternative) | Best fidelity for DOCX |
| DOCX → HTML/MD | `mammoth.js` | Fast, client-friendly |
| HTML → PDF/DOCX/MD | `puppeteer` (HTML→PDF), `pandoc` (HTML→MD/DOCX) | Print CSS for PDF fidelity |
| MD → PDF/DOCX/HTML | `marked` + `pandoc` / `puppeteer` | Markdown parsing + rendering |
| PDF → PDF (optimize) | `pdf-lib` / `ghostscript` | Compression, merge |

### 4.4 API Design (REST)

```
POST   /api/v1/documents           # Create document from template/AI
GET    /api/v1/documents/:id       # Get document metadata + content
PUT    /api/v1/documents/:id       # Update document content
DELETE /api/v1/documents/:id       # Delete document
POST   /api/v1/templates           # Create template
GET    /api/v1/templates           # List templates
POST   /api/v1/convert             # Submit conversion job
GET    /api/v1/convert/:jobId      # Job status + result download
GET    /api/v1/export/:docId/:fmt  # Export document in format
GET    /api/v1/user/quota          # Usage & quota status
```

### 4.5 Data Model (Key Entities)

- **User**: id, email, password_hash, provider, role, created_at, stripe_customer_id
- **Workspace**: id, name, owner_id, members[], created_at
- **Template**: id, workspace_id, name, content (JSON rich text), variables[], is_public, version, created_at
- **Document**: id, workspace_id, template_id, title, content, status, formats[], created_at, updated_at
- **ConversionJob**: id, user_id, status, source_files[], target_format, output_urls[], error, created_at, completed_at
- **Usage**: user_id, metric_type (doc_generated, conversion), count, period, reset_at

### 4.6 Security & Compliance (MVP)

- HTTPS everywhere, HSTS
- JWT access tokens + refresh tokens (httpOnly cookies)
- File type validation + virus scanning (ClamAV, post-MVP)
- Rate limiting per IP and per user
- GDPR: data deletion on account closure, export of user data
- SOC2 Type II: post-MVP

---

## 5. Monetization Strategy

### 5.1 Pricing Tiers (Subscription-Based)

| Tier | Price (Monthly) | Documents/Month | Conversions/Month | Storage | AI Credits | Features |
|------|-----------------|-----------------|-------------------|---------|------------|----------|
| Free | $0 | 5 | 10 | 500 MB | 10 credits | Public templates, watermark on export, community support |
| Starter | $9 | 50 | 100 | 5 GB | 100 credits | No watermark, priority queue, email support |
| Professional | $29 | 250 | 500 | 20 GB | 500 credits | API access, batch conversion, team workspace, chat support |
| Business | $79 | Unlimited | Unlimited | 100 GB | 2,000 credits | SSO, admin dashboard, SLA, dedicated support |

### 5.2 Usage-Based Add-Ons

| Metric | Price | Notes |
|--------|-------|-------|
| Extra document generation | $0.10/doc | Beyond tier limit |
| Extra file conversion | $0.05/conversion | Beyond tier limit |
| Extra storage | $5 / 10 GB | Prorated monthly |
| Extra AI credits | $10 / 100 credits | 1 credit ≈ 1 AI generation |
| Large file (>100MB) | $0.50/file | Enterprise only |

### 5.3 Strategy Rationale

- **Subscription tiers** drive predictable recurring revenue (MRR) and encourage habit formation.
- **Free tier** lowers barrier to entry for viral adoption; watermark encourages upgrade.
- **Usage-based overages** capture power users without forcing tier jumps.
- **API access on paid tiers** monetizes programmatic/document-whitelabel use cases.
- **Annual discount** (20% off) incentivizes annual commitment and improves cash flow.

### 5.4 Early Adoption Tactics

- 14-day free trial of Professional tier (no credit card required).
- Referral program: both parties get +50 AI credits.
- "Convert 3 files free" guest conversion (no account required, email capture for export).

---

## 6. Product Roadmap

### Phase 1 — Prototype (Weeks 1–4)
**Goal:** Validate core conversion and generation engine end-to-end.

Milestones:
- [ ] Project setup: Next.js frontend + Node.js backend + PostgreSQL
- [ ] Auth (email + Google OAuth)
- [ ] Basic file upload → storage → conversion (PDF↔DOCX↔HTML↔MD)
- [ ] Simple template editor with merge variables
- [ ] AI text-to-document integration (single prompt → document)
- [ ] Download converted/generated files
- [ ] Internal demo to stakeholders

**Exit criteria:** Team can generate a document from AI prompt and convert between all 4 formats successfully.

### Phase 2 — Internal Testing (Weeks 5–8)
**Goal:** Stability, UX polish, bug bash.

Milestones:
- [ ] WYSIWYG document editor with real-time preview
- [ ] Template gallery (5 pre-built templates)
- [ ] Batch conversion (up to 10 files)
- [ ] Dashboard: recent docs, conversions, storage usage
- [ ] Auto-save drafts
- [ ] Unit + integration tests (critical paths)
- [ ] Bug bash & performance tuning (conversion <30s for <5MB files)

**Exit criteria:** Zero P0 bugs; all critical flows pass QA.

### Phase 3 — Closed Beta (Weeks 9–12)
**Goal:** Validate with 20–50 design partners; collect feedback.

Milestones:
- [ ] Stripe integration (Free + Starter tiers)
- [ ] Usage tracking & quota enforcement
- [ ] Invite-only signup (waitlist → beta codes)
- [ ] Feedback widget + NPS survey in-app
- [ ] Support email + FAQ
- [ ] Performance monitoring (Sentry)

**Exit criteria:** 30+ active beta users; ≥70% task-completion rate on core flows; pricing feedback incorporated.

### Phase 4 — Public Launch (Weeks 13–16)
**Goal:** Market availability and recurring revenue.

Milestones:
- [ ] All four tiers live (Free, Starter, Professional, Business)
- [ ] API access (Professional+)
- [ ] Public landing page + pricing page
- [ ] Documentation + help center
- [ ] Launch announcement (Product Hunt, LinkedIn, Twitter)
- [ ] Post-launch review (Week 16+): churn, activation, revenue

**Exit criteria:** First paying customers; MRR tracking live; roadmap for v1.1 defined.

---

## 7. Success Metrics (MVP)

| Metric | Target |
|--------|--------|
| Activation (signup → first export) | ≥ 40% |
| Conversion success rate | ≥ 95% |
| Avg. conversion time (<5MB file) | < 30s |
| Monthly active users (end of beta) | 30–50 |
| MRR at public launch (Month 3 post-launch) | $2,000 |
| Churn (monthly) | < 10% |

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| DOCX formatting fidelity loss | High | Medium | Use headless LibreOffice for DOCX; set expectations in UI |
| AI cost overruns | Medium | High | Per-user AI credit limits; cache common prompts |
| Large file timeouts | Medium | Medium | File size caps; async job queue with status polling |
| Storage costs | Low | Medium | Object storage lifecycle policies; tier-based quotas |
| Competitor feature parity | Medium | Medium | Focus on UX + AI differentiation; narrow niche first |

---

## 9. Open Questions (Post-MVP)

1. Real-time collaborative editing (multi-user)?
2. Integrations with Google Drive, Dropbox, Notion?
3. Electronic signature workflow?
4. White-label / custom domain for Business tier?
5. Mobile native apps vs. responsive web?

---

**Document Owner:** Product  
**Last Updated:** 2026-11-04  
**Review Cadence:** Bi-weekly during MVP development