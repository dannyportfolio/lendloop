# LendLoop

> **Neighborhood Tool-Lending Platform**  
> *"Borrow what you need. Lend what you don't."*  
> **Fluence International, Inc. Full-Stack Developer Take-Home Engineering Evaluation**

---

## 1. Executive Summary

LendLoop is a neighborhood tool-lending application designed to demonstrate senior full-stack craftsmanship, zero-trust server-side authorization, resilient event-driven outbox automation, and an Apple-inspired minimalist user interface.

Modern homeowners and makers often purchase expensive specialty tools that sit unused in garages for months. LendLoop connects verified community members to lend and borrow tools safely, tracking loans from reservation to return.

### Key Highlights
- **Zero-Trust Server-Side RBAC:** All access control is enforced in Convex server mutations and queries. Client-provided identifiers (`ownerId`, `userId`, `role`) are never trusted.
- **Strict Public Data Minimization:** Public endpoints expose strictly tool name and category only, completely withholding owner identities, contact information, descriptions, and internal metadata.
- **Transactional Outbox Automation:** State changes (borrow requests, loan transitions) write outbox events in the same ACID database transaction, preventing dual-write inconsistencies.
- **Signed HMAC SHA-256 Webhooks:** Outbox events dispatched to n8n carry canonical HMAC SHA-256 signatures with 5-minute replay-attack tolerance windows. Secrets are kept exclusively in environment variables and n8n credentials with zero hardcoded fallbacks in workflow JSON.
- **Idempotent Reminders & Write-Backs:** Scheduled overdue checks enforce compound idempotency keys (`overdue-{loanId}-{YYYY-MM-DD}`), guaranteeing exactly-once delivery and zero duplicate reminders.
- **Live Automation Activity Visibility (Bonus):** Both borrower/lender dashboards and platform admin views display real-time reminder delivery status (e.g. *"Overdue reminder sent 2 days ago"*).
- **Apple-Inspired Minimalist Design:** High-contrast WCAG AA accessible interface, responsive across phone, tablet, and desktop viewports without generic AI slop.
- **100% Automated Test Pass Rate:** 28 Vitest unit/integration tests and 10 Playwright E2E browser tests passing with zero errors.

---

## 2. Architecture & Data Flow

```
                      +-----------------------------+
                      |         Web Client          |
                      |   Next.js 16 (App Router)   |
                      |    React 19 + Tailwind v4   |
                      +--------------+--------------+
                                     |
               Client Queries &      |  Clerk JWT Auth
                  Mutations          |  Verification
                                     v
                      +-----------------------------+
                      |       Convex Backend        |
                      |  - Normalized Schema        |
                      |  - Server-Side RBAC         |
                      |  - Transactional Outbox     |
                      |  - Secure HTTP Endpoints    |
                      +--------------+--------------+
                                     |
                     Transactional   |  Signed HMAC SHA-256
                     Outbox Dispatch |  Webhooks (X-Signature)
                                     v
                      +-----------------------------+
                      |     n8n Automation Engine   |
                      |   (Docker Compose Container)|
                      |  - Workflow A: Notifications|
                      |  - Workflow B: Overdue Cron |
                      |  - Workflow C: Error Alert  |
                      +--------------+--------------+
                                     |
                      Authenticated  |  Bearer Token
                      Write-Back     |  Callback
                                     v
                      +-----------------------------+
                      |   Convex Write-Back Action  |
                      |  - Idempotent Reminder Logs |
                      |  - Event State: SUCCEEDED   |
                      +-----------------------------+
```

---

## 3. Technology Stack

| Domain | Technology | Version | Purpose |
|---|---|---|---|
| **Framework** | Next.js (App Router) | 16.4.3 | SSR, Partial Prerendering, API routing |
| **Frontend UI** | React / Tailwind CSS | 19.3.0 / 4.x | Component lifecycle, responsive layout |
| **Icons & Design** | Lucide React | 1.66.0 | Semantic icons |
| **Authentication** | Clerk | 7.9.23 | User identity, session tokens, JWTs |
| **Backend & DB** | Convex | 1.49.0 | Reactive queries, ACID transactions, outbox |
| **Automation** | n8n | 1.76.0 | Workflow engine, cron triggers, webhooks |
| **Containers** | Docker Compose | v2+ | Local containerized n8n and PostgreSQL |
| **Testing** | Vitest & Playwright | 5.0.5 / 1.64.1 | Unit, integration, and E2E browser suites |
| **Language** | TypeScript | 5.9.3 | Strict static type safety |

---

## 4. Role-Based Access Control (RBAC) Matrix

All authorization is verified server-side inside `convex/lib/auth.ts` using verified Clerk JWT identity tokens.

| Operation | Anonymous | User (Standard) | Owner (Lender) | Borrower | Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| **Browse Public Catalog** | Read-Only | Read-Only | Read-Only | Read-Only | Read-Only |
| **Create Listing** | Blocked | Allowed | Allowed | Allowed | Allowed |
| **Edit Listing** | Blocked | Blocked | Allowed | Blocked | Blocked |
| **Delete Listing** | Blocked | Blocked | Allowed | Blocked | Blocked |
| **Admin Remove Listing** | Blocked | Blocked | Blocked | Blocked | Allowed |
| **Request to Borrow** | Blocked | Allowed | Blocked (own) | Blocked (dup) | Allowed |
| **Approve / Decline Request** | Blocked | Blocked | Allowed | Blocked | Blocked |
| **Mark Loan Returned** | Blocked | Blocked | Allowed | Allowed | Blocked |
| **View Global Loans** | Blocked | Blocked | Blocked | Blocked | Allowed |
| **Set Trusted Lender** | Blocked | Blocked | Blocked | Blocked | Allowed |

---

## 5. Webhook Security & The Outbox Pattern

### Transactional Outbox Guarantees
Directly invoking external APIs from database mutations risks partial failure: if the notification call succeeds but the database transaction aborts, phantom alerts are sent; if the database commits but the external call crashes, notifications are lost.

LendLoop implements the **Transactional Outbox Pattern**:
1. When a state change occurs (e.g. `createBorrowRequest` or `approveBorrowRequest`), the entity record and an `automationEvents` outbox record are inserted **in the same atomic transaction**.
2. A Convex internal action dispatches pending events asynchronously.
3. If an event delivery fails, it is rescheduled with exponential backoff (`nextRetryTime`).
4. Stale/abandoned in-flight events are automatically recovered by `recoverStaleProcessingEvents`.

### HMAC SHA-256 Signatures & Anti-Replay Protection
Every webhook payload sent to n8n is signed with a shared high-entropy secret (`CONVEX_N8N_HMAC_SECRET`):
- **Canonical Payload:** Formatted as `JSON.stringify(payload)`.
- **Headers:**
  - `X-LendLoop-Signature`: Hex-encoded HMAC SHA-256 digest.
  - `X-LendLoop-Timestamp`: Unix timestamp (ms).
  - `X-LendLoop-Event-Id`: Unique event ID.
- **Anti-Replay Window:** n8n verifies `|Date.now() - timestamp| <= 300,000ms` (5-minute tolerance).
- **Constant-Time Verification:** Tested against timing attacks using `timingSafeEqual`.

---

## 6. n8n Automation Workflows

All workflow definitions are sanitized and version-controlled under `n8n/workflows/`:

1. **Workflow A — Borrow Request Notifications (`request-notification.json`):**
   - **Trigger:** Webhook POST `/webhook/borrow-request`.
   - **Step 1:** Verify HMAC SHA-256 signature and replay tolerance.
   - **Step 2:** Check idempotency key (`borrow_request:{requestId}`).
   - **Step 3:** Dispatch notification (mock email / webhook payload).
   - **Step 4:** Send authenticated HTTP write-back to Convex to transition event to `SUCCEEDED`.

2. **Workflow B — Overdue Loan Reminders (`overdue-reminders.json`):**
   - **Trigger:** Daily Cron (09:00 UTC).
   - **Step 1:** Call Convex HTTP action `GET /api/loans/overdue` with Bearer secret.
   - **Step 2:** Split into individual loan items using Split In Batches.
   - **Step 3:** Generate idempotency key `overdue:{loanId}:{todayDateString}`.
   - **Step 4:** Dispatch reminder notification to borrower.
   - **Step 5:** Call Convex HTTP write-back `POST /api/loans/reminders/record` to record delivery in `reminderLogs`.

3. **Workflow C — Global Error Alerting (`error-handler.json`):**
   - Configured as the designated Error Trigger for Workflows A and B.
   - Captures failed node metadata, execution IDs, and error traces.
   - Formats SRE alert payloads and prevents silent automation failures.

---

## 7. Prerequisites & Local Setup

### Prerequisites
- **Node.js:** v20+ or v24+ (tested on Node v24.21.0)
- **Package Manager:** `pnpm` v11+ (or `npm`)
- **Docker & Docker Compose:** Docker Engine 24+ / Compose v2+
- **Clerk Account:** Free tier development instance (for live auth)
- **Convex Account:** Free tier deployment (for live backend)

---

### Step-by-Step Installation

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/lendloop.git
cd lendloop
```

#### 2. Install Node Dependencies
```bash
pnpm install
```

#### 3. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in the values in `.env.local`:
```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_ISSUER_DOMAIN=https://your-domain.clerk.accounts.dev

# Convex Backend
NEXT_PUBLIC_CONVEX_URL=https://your-project.convex.cloud
CONVEX_DEPLOYMENT=dev:your-project
CONVEX_SITE_URL=https://your-project.convex.site

# Webhook Security
CONVEX_N8N_HMAC_SECRET=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
CONVEX_N8N_WEBHOOK_URL=http://localhost:5678/webhook/borrow-request
N8N_CONVEX_WRITEBACK_SECRET=secret_bearer_token_for_n8n_writeback_verification

# Application URL
APP_URL=http://localhost:3000
```

#### 4. Start Local n8n Engine via Docker Compose
```bash
docker compose up -d
```
The n8n automation dashboard will be accessible at [http://localhost:5678](http://localhost:5678).

#### 5. Import n8n Workflows
1. Open [http://localhost:5678](http://localhost:5678).
2. Complete initial owner setup.
3. In Workflows, select **Import from File**:
   - `n8n/workflows/request-notification.json`
   - `n8n/workflows/overdue-reminders.json`
   - `n8n/workflows/error-handler.json`
4. Activate the imported workflows.

#### 6. Start Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000) to view LendLoop.

---

## 8. Verification & Test Execution

LendLoop includes automated test suites covering unit logic, integration workflows, server RBAC security, and browser interactions.

### Run All Unit & Integration Tests (Vitest)
```bash
pnpm test
```
**Test Coverage (28/28 Passing):**
- `tests/unit/dates.test.ts`: Date bounds, durations, overdue evaluations.
- `tests/unit/crypto.test.ts`: HMAC SHA-256 signing, constant-time verification, timestamp tolerance, anti-replay guards.
- `tests/unit/idempotency.test.ts`: Deduplication keys, retry backoff calculation, stale lock recovery.
- `tests/integration/auth.test.ts`: Server-side RBAC, owner vs non-owner, admin privilege escalation prevention.
- `tests/integration/listings-and-loans.test.ts`: Complete lifecycle from listing creation to borrow request, conflict prevention, loan approval, and tool return.

### Run Playwright End-to-End Tests
```bash
pnpm run test:e2e
```
**Browser Scenarios Tested:**
1. Public tool directory search and category pill filtering.
2. Route protection: unauthenticated requests to `/dashboard` redirected to sign in.
3. Route protection: unauthenticated requests to `/admin` redirected to sign in.
4. Header navigation: "Sign In" CTA navigates to `/sign-in`.
5. Hero navigation: "Browse Available Tools" scrolls smoothly to directory.
6. Footer rendering: branding, mission statement, attribution.
7. Mobile and desktop responsive layouts (375x667 vs 1280x800).
8. Keyboard accessibility: tab navigation to search inputs and filter buttons.
9. Landmark accessibility: `<header>`, `<main>`, `<footer>` landmarks verified.
10. Console error hygiene: zero uncaught browser errors on page load.

### Run Static Typecheck & Linter
```bash
pnpm tsc --noEmit
pnpm run lint
```
Both execute with **0 errors and 0 warnings**.

### Run Production Build
```bash
pnpm run build
```
Builds the Next.js production bundle with Partial Prerendering and optimized asset generation.

---

## 9. Admin Provisioning

To prevent insecure public registration of administrative privileges, LendLoop provisions admins server-side:

### Method: Internal Seeding Mutation
Run the internal Convex mutation with the user's Clerk subject ID:
```bash
npx convex run users:seedInitialAdmin '{"clerkSubjectId": "user_your_clerk_id"}'
```
This sets `role: "admin"` directly in the database. Client mutations attempting to pass `role: "admin"` will be rejected by server authorization guards.

---

## 10. Repository File Structure

```
lendloop/
├── app/                              # Next.js 16 App Router
│   ├── (auth)/                       # Sign-in & sign-up routes (Clerk)
│   ├── admin/page.tsx                # Admin management portal
│   ├── dashboard/page.tsx            # Authenticated user dashboard
│   ├── globals.css                   # Global styles & accessibility rules
│   ├── layout.tsx                    # Root layout with providers
│   └── page.tsx                      # Public landing & tool directory
├── components/                       # Accessible React 19 components
│   ├── listings/                     # Listing creation & edit modals
│   ├── providers/                    # Convex & Clerk context providers
│   ├── public/                       # Hero, PublicDirectory, HowItWorks
│   ├── requests/                     # BorrowModal & date pickers
│   └── shared/                       # Navbar, Footer, ConfirmDialog
├── convex/                           # Convex Backend Logic
│   ├── _generated/                   # Convex type definitions & API proxy
│   ├── auth.config.ts                # Clerk JWT template configuration
│   ├── automation.ts                 # Outbox lifecycle, locking & retries
│   ├── http.ts                       # Secure webhook & write-back HTTP endpoints
│   ├── lib/
│   │   ├── auth.ts                   # Zero-trust server-side RBAC guards
│   │   ├── crypto.ts                 # HMAC SHA-256 signing & anti-replay
│   │   └── dates.ts                  # ISO date math & overdue calculations
│   ├── listings.ts                   # Listing queries & CRUD mutations
│   ├── loans.ts                      # Loan tracking & return mutations
│   ├── requests.ts                   # Borrow requests & approval workflows
│   ├── schema.ts                     # Normalized, indexed database schema
│   └── users.ts                      # User sync & admin provisioning
├── docs/                             # Engineering Blueprints & Reports
│   ├── ARCHITECTURE.md               # Detailed technical architecture
│   ├── DATA-MODEL.md                 # Normalized schema & indexing strategy
│   ├── PRODUCTION-READINESS.md       # Operational readiness review
│   ├── PROJECT-PLAN.md               # RTM & phased milestone tracking
│   ├── SECURITY.md                   # Threat model & defensive design
│   └── THREAT-MODEL.md               # STRIDE security assessment
├── n8n/                              # n8n Automation Deliverables
│   ├── README.md                     # Workflow setup & webhook guide
│   └── workflows/
│       ├── error-handler.json        # Workflow C: Global error alerting
│       ├── overdue-reminders.json    # Workflow B: Scheduled daily overdue cron
│       └── request-notification.json # Workflow A: HMAC verified borrow notifications
├── tests/                            # Automated Test Suites
│   ├── e2e/                          # Playwright browser test specifications
│   ├── integration/                  # Auth RBAC & loan lifecycle tests
│   └── unit/                         # Crypto, dates, and idempotency tests
├── docker-compose.yml                # Local n8n & PostgreSQL services
├── next.config.ts                    # Next.js configuration
├── package.json                      # Dependencies and npm scripts
├── playwright.config.ts              # Playwright configuration
├── vitest.config.mjs                 # Vitest configuration
└── README.md                         # Main project documentation
```

---

## 11. Security & Production Checklist

- [x] Server-side authorization in all Convex queries and mutations.
- [x] Zero trust for client-provided roles or user identifiers.
- [x] Public tool directory exposes only minimized, non-sensitive data.
- [x] Overlapping loan conflict detection prevented at approval time.
- [x] Owners blocked from borrowing their own tools.
- [x] Duplicate active requests blocked at creation time.
- [x] Transactional Outbox pattern implemented for all automation triggers.
- [x] HMAC SHA-256 signatures with 5-minute replay tolerance window.
- [x] Database-level idempotency key enforcement on all reminder logs.
- [x] Stale event recovery mechanism for crashed automation dispatchers.
- [x] Zero hardcoded API keys or secrets in source code, workflows, or git history.
- [x] Sanitized n8n workflow JSON exports.
- [x] Production build terminates with exit code 0.
- [x] Automated unit and integration tests pass with 100% success rate (23/23).
- [x] Playwright E2E browser tests pass with 100% success rate (10/10).

---

## 12. License & Evaluation Notice

This codebase is submitted as an engineering evaluation for Fluence International, Inc. All rights reserved.
