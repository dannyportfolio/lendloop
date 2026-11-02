# LendLoop — Project Implementation Plan & Traceability Matrix

> **Project Identity:** LendLoop — Neighborhood Tool-Lending Platform  
> **Tagline:** "Borrow what you need. Lend what you don't."  
> **Target Audience:** Fluence International, Inc. Take-Home Engineering Evaluation  
> **Engineering Standards:** Zero Trust Security, Outbox Automation Pattern, HMAC SHA-256 Webhooks, WCAG AA Accessibility, Senior Engineering Quality Gates  

---

## 1. Executive Summary & Architecture Overview

LendLoop is a neighborhood tool-lending application engineered to showcase production-grade architecture, rigorous server-side authorization, resilient event-driven automation with n8n, and Apple-inspired minimalist UI/UX.

### Tech Stack
- **Frontend:** Next.js 15+ (App Router), React 19, TypeScript, Tailwind CSS, Lucide React (content-specific icons), Accessible Components
- **Authentication:** Clerk (Server-Side JWT verification integrated with Convex)
- **Backend & Database:** Convex (Reactive queries, ACID mutations, background actions, secure HTTP endpoints, scheduled crons)
- **Automation & Integration:** n8n (Dockerized local engine, HMAC SHA-256 webhook receiver, daily overdue scheduler, idempotent write-back)
- **Infrastructure & DevOps:** Docker Compose (n8n containerized, PostgreSQL backend for n8n), GitHub Actions CI/CD ready
- **Testing:** Vitest / Jest (Unit & Integration tests), Playwright (E2E browser tests), Security Test Suite (Privilege escalation, IDOR, replay attacks)

---

## 2. 10-Day Phased Execution Schedule

| Phase | Timeline | Core Focus | Deliverables & Milestones |
|---|---|---|---|
| **Phase 0** | Day 1 | Workspace Inspection, Architecture, Planning, Threat Modeling | `docs/*` specifications, RTM, Git repo initialization |
| **Phase 1** | Day 2 | Project Scaffolding, Clerk Auth & Convex Backend Foundations | Next.js App Router, Tailwind, Convex schema, Clerk-Convex JWT auth |
| **Phase 2** | Day 3 | Core Business Logic: Listings & Borrowing Workflows | Listings CRUD, date validation, borrow requests, conflict resolution, loan creation |
| **Phase 3** | Day 4 | User & Admin Dashboards, Responsive UI & Access Control | My Listings, My Requests, Incoming Requests, Loan History, Admin Portal |
| **Phase 4** | Day 5 | Transactional Outbox & n8n Request Notifications | Outbox pattern in Convex, HMAC SHA-256 signed webhooks, n8n Workflow A, write-back |
| **Phase 5** | Day 6 | Overdue Loans Automation, Idempotency & Retries | n8n Workflow B (Scheduled Overdue Reminders), idempotent logs, error handling |
| **Phase 6** | Day 7 | Security Audit, Robustness & Comprehensive Testing | Unit tests, Integration tests, RBAC security tests, anti-replay verification |
| **Phase 7** | Day 8 | Playwright End-to-End Testing & Documentation | 11 E2E test flows, docker-compose.yml, sanitized workflow exports, README |
| **Phase 8** | Day 9–10 | Verification, Production Hardening & Final Submission Audit | Production build, zero-lint audit, test execution evidence, final engineering report |

---

## 3. Requirements Traceability Matrix (RTM)

The matrix maps every requirement from the master prompt to its implementation path, testing strategy, and verification status.

| Req ID | Requirement Description | Implementation Location | Test Strategy & Coverage | Verification Status |
|---|---|---|---|---|
| **REQ-PUB-01** | Public tool directory with LendLoop branding & tagline | `app/(public)/page.tsx`, `components/public/Hero.tsx` | Playwright E2E: anonymous browse test | NOT TESTED |
| **REQ-PUB-02** | Public query data minimization (no owner email, phone, or private data) | `convex/listings.ts:getPublicListings` | Unit & Security test: inspect query projection | NOT TESTED |
| **REQ-PUB-03** | Call-to-action to sign in to lend or borrow | `components/public/Navbar.tsx`, `Hero.tsx` | E2E test: CTA redirects to Clerk sign-in | NOT TESTED |
| **REQ-AUTH-01** | Clerk authentication with Convex server-side JWT verification | `convex/auth.config.ts`, `app/layout.tsx` | Integration test: authenticated vs unauthenticated context | NOT TESTED |
| **REQ-AUTH-02** | Reusable authorization helpers (`requireAuthenticatedUser`, `requireAdmin`, etc.) | `convex/lib/auth.ts` | Unit tests: mock identity contexts for all roles | NOT TESTED |
| **REQ-AUTH-03** | Server-side actor resolution (never trust client-supplied ownerId or role) | `convex/listings.ts`, `convex/requests.ts` | Security test: spoofed userId parameter injection | NOT TESTED |
| **REQ-AUTH-04** | Prevent self-role escalation & secure initial admin provisioning | `convex/users.ts:promoteToAdminInternal` | Security test: user mutation cannot alter role | NOT TESTED |
| **REQ-LIST-01** | Authenticated user can create tool listing | `convex/listings.ts:createListing` | Integration test: create listing, check database | NOT TESTED |
| **REQ-LIST-02** | Authenticated user can edit only their own listings | `convex/listings.ts:updateListing` | Security test: User B attempting to edit User A listing | NOT TESTED |
| **REQ-LIST-03** | Authenticated user can soft-delete or remove only their own listings | `convex/listings.ts:deleteListing` | Security test: User B attempting to delete User A listing | NOT TESTED |
| **REQ-LIST-04** | Listing categories, condition levels, short descriptions, availability | `convex/schema.ts`, `components/listings/ListingForm.tsx` | Form validation & UI test | NOT TESTED |
| **REQ-BORR-01** | Borrow request creation with date range validation | `convex/requests.ts:createBorrowRequest` | Unit test: start date >= today, end date >= start date | NOT TESTED |
| **REQ-BORR-02** | Prevent borrowing one's own tool | `convex/requests.ts:createBorrowRequest` | Unit & integration test: owner cannot request own tool | NOT TESTED |
| **REQ-BORR-03** | Prevent duplicate active borrow requests for same tool & user | `convex/requests.ts:createBorrowRequest` | Unit & integration test: duplicate pending request rejected | NOT TESTED |
| **REQ-BORR-04** | Prevent conflicting active loans for overlapping date windows | `convex/requests.ts:approveBorrowRequest` | Concurrency & logic test: overlapping approved loans blocked | NOT TESTED |
| **REQ-BORR-05** | Listing owner can approve incoming borrow request | `convex/requests.ts:approveBorrowRequest` | Integration test: approval generates active loan record | NOT TESTED |
| **REQ-BORR-06** | Listing owner can decline incoming borrow request | `convex/requests.ts:declineBorrowRequest` | Integration test: status changes to declined | NOT TESTED |
| **REQ-BORR-07** | Borrower or lender can mark borrowed tool as returned | `convex/loans.ts:markLoanReturned` | Integration test: loan status becomes returned, tool is available | NOT TESTED |
| **REQ-DASH-01** | User dashboard: My Listings, My Requests, Incoming Requests, Loan History | `app/(dashboard)/dashboard/page.tsx` | E2E & component tests: view all tabs and actions | NOT TESTED |
| **REQ-DASH-02** | Category and availability filtering for tool directory | `components/dashboard/ToolDirectory.tsx` | E2E test: filter by category, check filtered results | NOT TESTED |
| **REQ-ADM-01** | Administrator can view all loans across all users | `convex/loans.ts:getAllLoansAdmin` | Security test: non-admin gets 403, admin gets all loans | NOT TESTED |
| **REQ-ADM-02** | Administrator can remove any listing | `convex/listings.ts:adminRemoveListing` | Security & integration test: admin removes any listing | NOT TESTED |
| **REQ-ADM-03** | Administrator can assign/revoke Trusted Lender status | `convex/users.ts:setTrustedLender` | Security test: non-admin blocked; admin sets flag | NOT TESTED |
| **REQ-AUTO-01** | Transactional Outbox pattern: mutation atomically saves data + event | `convex/requests.ts`, `convex/loans.ts`, `schema.ts` | Integration test: verify outbox event row created in same tx | NOT TESTED |
| **REQ-AUTO-02** | Asynchronous outbox event dispatcher with retry and exponential backoff | `convex/automation.ts:dispatchPendingEvents` | Unit test: backoff calculation, retry limit enforcement | NOT TESTED |
| **REQ-AUTO-03** | Abandoned event recovery mechanism | `convex/automation.ts:recoverStaleProcessingEvents` | Integration test: stale processing events reset to retry | NOT TESTED |
| **REQ-N8N-01** | n8n Workflow A: Borrow Request Notifications triggered by webhook | `n8n/workflows/request-notification.json` | End-to-end webhook dispatch and mock notification test | NOT TESTED |
| **REQ-N8N-02** | HMAC SHA-256 signing with timestamp tolerance and replay protection | `convex/lib/crypto.ts`, `convex/http.ts` | Security test: forged signature rejected, expired ts rejected | NOT TESTED |
| **REQ-N8N-03** | n8n Workflow B: Scheduled daily overdue reminder check | `n8n/workflows/overdue-reminders.json` | Mock cron trigger, verify overdue query and delivery | NOT TESTED |
| **REQ-N8N-04** | Authenticated Convex HTTP endpoint for overdue loans | `convex/http.ts:getOverdueLoansEndpoint` | Security test: unauthenticated request rejected | NOT TESTED |
| **REQ-N8N-05** | Write-back delivery result with idempotency key enforcement | `convex/http.ts:recordReminderWritebackEndpoint` | Integration test: duplicate write-back records 0 extra logs | NOT TESTED |
| **REQ-N8N-06** | Dedicated Error Handling Workflow in n8n | `n8n/workflows/error-handler.json` | Failure injection test: workflow error triggers handler | NOT TESTED |
| **REQ-SEC-01** | Zero secrets in client bundles, git history, or exported workflow JSON | Scan scripts, `.env.example`, sanitization audit | Automated secret scanning with git hygiene check | NOT TESTED |
| **REQ-SEC-02** | Rate limiting / abuse prevention on public and webhook endpoints | `convex/http.ts`, Next.js middleware / headers | Security audit & load simulation | NOT TESTED |
| **REQ-E2E-01** | 11 comprehensive Playwright E2E browser test scenarios | `tests/e2e/*.spec.ts` | Full Playwright suite execution with headless browser | NOT TESTED |
| **REQ-OPS-01** | Docker Compose setup for local n8n with healthchecks | `docker-compose.yml`, `n8n/README.md` | Docker compose up and container health verification | NOT TESTED |
| **REQ-DOC-01** | Comprehensive README, setup guides, architectural & security docs | `README.md`, `docs/*` | Full documentation review against assignment rubric | NOT TESTED |

---

## 4. Phase-by-Phase Task Checklist

### Phase 0: Workspace Audit, Architecture & Planning
- [x] Inspect workspace directory, tools, Node.js (`v24.21.0`), pnpm (`11.2.2`), Docker (`29.8.2`), Docker Compose (`v5.5.1`)
- [x] Initialize Git repository (`main` branch)
- [x] Create comprehensive architectural blueprints in `docs/`
- [ ] Review threat model and security specifications

### Phase 1: Project Scaffolding & Core Foundations
- [ ] Initialize Next.js 15+ App Router with TypeScript and Tailwind CSS
- [ ] Install dependencies: `@clerk/nextjs`, `convex`, `lucide-react`, `zod`, `clsx`, `tailwind-merge`
- [ ] Setup Convex project directory and configure `convex/auth.config.ts`
- [ ] Setup `.env.example` with exact variable placeholders
- [ ] Setup base UI component system complying with antislop guidelines (clean, purposeful, no decorative slop)
- [ ] Establish initial Git commit: `chore: initialize LendLoop project scaffolding`

### Phase 2: Convex Data Model & Server-Side RBAC
- [ ] Define normalized schema in `convex/schema.ts` with indexes
- [ ] Implement server-side authorization helpers in `convex/lib/auth.ts`:
  - `requireAuthenticatedUser(ctx)`
  - `requireAdmin(ctx)`
  - `requireListingOwner(ctx, listingId)`
  - `requireBorrowerOrLender(ctx, loanId)`
- [ ] Implement user lifecycle sync and internal admin provisioning (`convex/users.ts`)
- [ ] Implement security tests for RBAC helpers
- [ ] Milestone Git commit: `feat: implement Convex schema and RBAC`

### Phase 3: Listings & Borrowing State Machine
- [ ] Implement `convex/listings.ts` (public query, user CRUD, admin removal)
- [ ] Implement `convex/requests.ts` (create request, date validation, approve, decline)
- [ ] Implement `convex/loans.ts` (loan tracking, return confirmation, overdue query)
- [ ] Implement atomic outbox insertion inside state-changing mutations
- [ ] Write unit & integration tests for date validation, conflict prevention, and state transitions
- [ ] Milestone Git commit: `feat: implement listings and borrowing workflows`

### Phase 4: User & Admin Frontend Dashboards
- [ ] Build Public Landing Page (`app/(public)/page.tsx`): Hero, Read-only tool directory, Auth CTAs
- [ ] Build Authenticated Dashboard (`app/(dashboard)/dashboard/page.tsx`):
  - My Listings (create, edit, delete, condition/category tags)
  - Borrow Requests (incoming approvals/declines, outgoing statuses)
  - Active & Past Loans (due dates, return triggers)
- [ ] Build Admin Portal (`app/(dashboard)/admin/page.tsx`):
  - Global loan monitor
  - Listing moderation (admin removal)
  - Trusted Lender badge management
- [ ] Verify accessibility (WCAG AA contrast, keyboard navigation, focus indicators)
- [ ] Milestone Git commit: `feat: build user and admin dashboards`

### Phase 5: Transactional Outbox & n8n Request Notification
- [ ] Implement Convex action dispatcher (`convex/automation.ts:dispatchPendingEvents`)
- [ ] Implement HMAC SHA-256 signature generation with timestamp and eventId
- [ ] Build Docker Compose for local n8n execution (`docker-compose.yml`)
- [ ] Design n8n Workflow A: Webhook trigger -> HMAC verification -> Idempotency check -> Notification dispatch -> Convex write-back
- [ ] Implement Convex HTTP write-back endpoint (`convex/http.ts`) with Bearer token authentication
- [ ] Export sanitized workflow JSON to `n8n/workflows/request-notification.json`
- [ ] Milestone Git commit: `feat: integrate n8n notifications with HMAC webhooks`

### Phase 6: Scheduled Overdue Reminders & Resiliency
- [ ] Implement authenticated overdue loans HTTP endpoint in `convex/http.ts`
- [ ] Design n8n Workflow B: Daily schedule -> fetch overdue loans -> process independently -> check idempotency -> send reminder -> write-back
- [ ] Implement Convex reminder write-back mutation with database-level idempotency (`reminderLogs`)
- [ ] Build dedicated n8n Error Workflow (`n8n/workflows/error-handler.json`)
- [ ] Export sanitized workflow JSON to `n8n/workflows/overdue-reminders.json`
- [ ] Milestone Git commit: `feat: implement overdue reminder automation and error workflows`

### Phase 7: Automated Testing & Security Verification
- [ ] Write unit tests for date math, status transitions, signature hashing
- [ ] Write integration tests for listing and loan lifecycle
- [ ] Write security tests for IDOR, unauthenticated mutations, role forging, HMAC tampering, and replay attacks
- [ ] Implement Playwright E2E test suite covering all 11 required scenarios
- [ ] Milestone Git commit: `test: add security, integration, and Playwright E2E coverage`

### Phase 8: Production Readiness & Final Documentation
- [ ] Audit zero hardcoded secrets and secret scanning
- [ ] Complete `README.md` with full setup instructions, screenshots/flows, and architecture notes
- [ ] Complete `docs/PRODUCTION-READINESS.md`, `docs/SECURITY.md`, `docs/ARCHITECTURE.md`
- [ ] Verify clean `npm run build`, `npm run lint`, and 100% test pass rate
- [ ] Generate Final Engineering Report with evidence-based verification metrics
- [ ] Milestone Git commit: `docs: complete architecture, security, and setup documentation`

---

## 5. Quality Gate Criteria

Before advancing between phases and before declaring any milestone complete, all of the following conditions must be satisfied:

1. **Type Safety:** `pnpm tsc --noEmit` returns zero errors.
2. **Linting:** ESLint passes with zero warnings or errors.
3. **Automated Tests:** Relevant test suites execute with 100% pass rate. Real command outputs captured.
4. **Security Bounds:** No secrets committed; authorization checks present on all Convex mutations/actions.
5. **UI Craftsmanship:** Meets antislop criteria (no em dashes in UI, no generic gradient slop, contrast >= 4.5:1, keyboard operable, responsive).
6. **Git Cleanliness:** Clean working tree, conventional commit messages, zero untracked debug artifacts.
