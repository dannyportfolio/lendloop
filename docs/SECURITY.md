# LendLoop — Security Architecture & Threat Defense

> **Classification:** Security Engineering Specification  
> **Standard:** OWASP Top 10 (2021/2025), Zero Trust Architecture  
> **Enforcement Scope:** Convex Server Functions, Next.js Client Boundaries, n8n Automation Engine  

---

## 1. Zero Trust Principles

LendLoop operates under strict Zero Trust tenets:
1. **Never trust the client:** Every identity assertion, role, or ownership identifier received in HTTP request bodies or query parameters is treated as potentially adversarial.
2. **Authenticate every request:** No internal database mutation or non-public query executes without cryptographic verification of the caller's session token or Bearer secret.
3. **Authorize at the data boundary:** Role and permission validation occurs inside Convex backend functions, never solely within frontend UI component guards.
4. **Enforce data minimization:** Public queries project only necessary attributes. Personally Identifiable Information (PII) such as emails and phone numbers are never returned in public search endpoints.
5. **Protect webhooks against tampering & replay:** All outbound webhook dispatches to n8n are signed with HMAC SHA-256 and time-bounded. Inbound write-backs require segregated Bearer tokens and strict payload schema validation.

---

## 2. Server-Side RBAC & Authorization Architecture

### 2.1 Identity & Role Model
LendLoop defines two discrete roles:
- `user`: Standard community member capable of listing tools, requesting borrows, approving/declining requests on their listings, and managing their active loans.
- `admin`: Elevated platform administrator capable of removing any listing across the system, viewing all active and historic loans, and conferring or revoking "Trusted Lender" status.

### 2.2 Reusable Server-Side Authorization Guards

All guards reside in `convex/lib/auth.ts`:

```typescript
/**
 * Resolves verified caller identity from Convex Auth context.
 * Throws standard error if session token is missing or invalid.
 */
export async function requireAuthenticatedUser(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">>

/**
 * Ensures caller possesses verified administrator role in Convex database.
 * Throws FORBIDDEN if caller role is not 'admin'.
 */
export async function requireAdmin(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">>

/**
 * Validates that the caller is the legitimate owner of the specified listing.
 * Prevents Insecure Direct Object Reference (IDOR) attacks.
 */
export async function requireListingOwner(
  ctx: QueryCtx | MutationCtx,
  listingId: Id<"listings">
): Promise<{ user: Doc<"users">; listing: Doc<"listings"> }>

/**
 * Validates caller is either the lender or borrower associated with a loan.
 */
export async function requireBorrowerOrLender(
  ctx: QueryCtx | MutationCtx,
  loanId: Id<"loans">
): Promise<{ user: Doc<"users">; loan: Doc<"loans"> }>
```

### 2.3 Defense Against IDOR (Insecure Direct Object Reference)
- Traditional vulnerable code:
  `const { listingId, ownerId } = args; db.patch(listingId, { ... });`
- LendLoop implementation:
  The `ownerId` argument is **never** accepted from the client. The system resolves the authenticated caller from `ctx.auth.getUserIdentity()`, queries the database for `listing = await ctx.db.get(args.listingId)`, and asserts:
  `if (listing.ownerId !== user._id && user.role !== 'admin') throw new Error("UNAUTHORIZED");`

### 2.4 Prevention of Privilege Escalation & Admin Provisioning
- **Self-Role Escalation Prevention:** The `updateUser` mutation specifically restricts editable fields to `displayName` and `avatarUrl`. Any attempt to pass `role: 'admin'` or `isTrustedLender: true` is ignored or rejected by schema validation.
- **Initial Admin Bootstrapping:**
  1. No public registration route can ever grant `admin` privileges.
  2. The initial admin is provisioned via an internal Convex script or one-time CLI seed command:
     `npx convex run users:seedInitialAdmin '{"secret": "SERVER_ADMIN_SEED_KEY", "clerkId": "user_xxx"}'`
  3. Once an initial admin exists, they can promote or manage other administrators through authenticated mutations guarded by `requireAdmin(ctx)`.

---

## 3. Webhook Security Architecture

### 3.1 HMAC SHA-256 Webhook Signing (Convex to n8n)
All outbound webhook calls dispatched from the Convex Outbox dispatcher to n8n are cryptographically signed to guarantee authenticity and integrity:

1. **Secret Management:** A high-entropy shared secret (`CONVEX_N8N_HMAC_SECRET`, minimum 256 bits) is provisioned across Convex and n8n environment variables.
2. **Canonical Payload Formulation:**
   ```
   canonicalString = `${timestamp}.${eventId}.${rawBodyJSON}`
   signature = HMAC_SHA256(canonicalString, secret).toHex()
   ```
3. **HTTP Header Delivery:**
   - `X-LendLoop-Signature`: Hex-encoded HMAC digest.
   - `X-LendLoop-Timestamp`: Unix millisecond timestamp when the signature was minted.
   - `X-LendLoop-Event-Id`: Unique event identifier (UUID v4).
4. **Replay Attack Mitigation:**
   - The n8n Code node extracts `X-LendLoop-Timestamp` and validates:
     `Math.abs(Date.now() - timestamp) <= 300000` (5-minute maximum tolerance).
   - If the timestamp is older than 5 minutes or in the future by more than 5 minutes, the request is immediately dropped with HTTP 401/403.
   - Constant-time string comparison (`crypto.timingSafeEqual`) is utilized to prevent timing attacks.

### 3.2 Inbound Write-Back Authentication (n8n to Convex)
When n8n completes notification delivery or periodic reminder processing, it writes back status updates to Convex:
- **Dedicated Credential:** Write-back requests do **not** reuse the HMAC webhook secret. A distinct Bearer secret (`N8N_CONVEX_WRITEBACK_SECRET`) is required in the `Authorization` header.
- **Segregated HTTP Endpoint:** Convex hosts HTTP Actions under `convex/http.ts` that authenticate the Bearer token before dispatching internal mutations.
- **Internal Mutation Scoping:** Write-back mutations only accept strictly defined schema payloads (`eventId`, `status`, `deliveryMetadata`). They cannot mutate arbitrary records or escalate permissions.

---

## 4. Data Minimization & Privacy Controls

| Data Category | Public Access | Authenticated User | Admin Access | Internal System |
|---|---|---|---|---|
| Tool Name, Category, Condition, Description | YES | YES | YES | YES |
| Tool Availability Status | YES | YES | YES | YES |
| Owner Display Name | YES (Anonymized/First Name) | YES | YES | YES |
| Owner Email Address | NEVER | Request counterpart only | YES | YES |
| User Role & Trusted Lender Status | Public badge only | Self only | YES | YES |
| Borrow Request Notes & History | NEVER | Borrower & Lender only | YES | YES |
| Automation Outbox & Event Logs | NEVER | Loan parties (status only) | YES | YES |

---

## 5. Security Testing Matrix

| Threat Scenario | Vector | Mitigation Layer | Test File |
|---|---|---|---|
| IDOR on Listing Edit | PUT /listings/:id with forged ownerId | `requireListingOwner` in Convex mutation | `tests/integration/listings.test.ts` |
| Self-Promotion to Admin | PATCH /users/me { role: "admin" } | Hardcoded exclusion in user mutation | `tests/integration/auth.test.ts` |
| Webhook Tampering | Altered payload in transit to n8n | HMAC SHA-256 signature verification | `tests/unit/crypto.test.ts` |
| Webhook Replay Attack | Resending captured valid webhook | Timestamp window (300s) + eventId lock | `tests/unit/crypto.test.ts` |
| Duplicate Reminder Storm | n8n cron run retrying multiple times | Unique index on `reminderLogs.idempotencyKey` | `tests/unit/idempotency.test.ts` |
| Non-Admin Accessing Global Loans | Querying `getAllLoans` as standard user | `requireAdmin` check throws 403 | `tests/integration/auth.test.ts` |
| Cross-User Borrow Request Spoofing | Creating borrow request with spoofed borrowerId | Caller identity resolved exclusively from JWT | `tests/integration/requests.test.ts` |
