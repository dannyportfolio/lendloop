# LendLoop — Threat Model (STRIDE Methodology)

> **Methodology:** Microsoft STRIDE Threat Modeling Framework  
> **Evaluation Date:** November 2026  
> **Target Scope:** LendLoop Web Application, Convex Backend, n8n Automation Engine, Communication Channels  

---

## 1. System Boundary & Assets

### Critical Assets:
1. **User Identity & Auth Sessions:** Clerk authentication tokens, session cookies, user profiles.
2. **Platform Integrity & Access Control:** Administrative privileges, Trusted Lender flags.
3. **Inventory & Business Workflows:** Tool listings, active borrow requests, loan records.
4. **Integration Credentials & Webhooks:** Shared HMAC signing secret, n8n Bearer token, Convex deployment tokens.
5. **Operational Logs & Outbox:** Pending outbox events, delivery logs, audit history.

---

## 2. STRIDE Threat Analysis

| Threat Category | Threat Description | Attack Vector | Impact | Mitigation Strategy | Verification Status |
|---|---|---|---|---|---|
| **Spoofing** | Attacker impersonates legitimate user to borrow or modify listings | Forged JWT or stolen cookie | High | Clerk cryptographically signs JWTs; Convex verifies issuer, signature, and expiration on every call via JWKS. | Verified in Unit & Integration tests |
| **Spoofing** | Attacker impersonates Convex server to trigger fake notifications in n8n | Unauthenticated HTTP POST to n8n webhook | Medium | n8n validates HMAC SHA-256 signature using `CONVEX_N8N_HMAC_SECRET` over `${timestamp}.${eventId}.${rawBody}`. | Verified in Security test suite |
| **Tampering** | Attacker modifies listing ID or price/dates in transit | Intercepted client mutation request | High | All parameters validated against strict TypeScript & Zod schemas inside Convex mutations; business dates checked server-side. | Verified in Unit tests |
| **Tampering** | Attacker tampers with webhook payload between Convex and n8n | Man-in-the-middle on webhook payload | High | Webhook payload signed with HMAC-SHA256; n8n verifies hash of raw body prior to parsing or execution. | Verified in Security test suite |
| **Repudiation** | User denies approving a borrow request or returning a tool | Disputed loan status | Medium | Every state transition logs immutable event in `auditLogs` with actor ID, timestamp, and target entity. | Schema enforced |
| **Information Disclosure** | Unauthenticated user scrapes all user emails and phone numbers | Crawling public directory endpoint | High | Data minimization in `getPublicListings`: returns only title, category, condition, description, and first name. Emails strictly excluded. | Verified in Security test suite |
| **Denial of Service** | Attacker floods borrow requests to lock up tools or exhausts outbox queue | Automated request spam | Medium | Rate limiting on request creation; database checks prevent duplicate pending requests for the same tool. | Enforced in Convex mutation |
| **Elevation of Privilege** | Standard user modifies own record to `role: "admin"` | PATCH request with `{ role: "admin" }` | Critical | User mutation explicitly whitelist-only for profile fields; role and `isTrustedLender` cannot be modified by non-admin. | Verified in Security test suite |
| **Elevation of Privilege** | User attempts to delete another user's listing (IDOR) | DELETE request targeting victim's `listingId` | High | `requireListingOwner` helper checks `listing.ownerId === caller._id`; throws 403 on mismatch. | Verified in Integration test suite |

---

## 3. Deep-Dive Attack Scenarios & Mitigations

### 3.1 Attack Scenario A: Insecure Direct Object Reference (IDOR) on Listing Mutation
- **Objective:** Attacker (User B) attempts to edit or delete User A's tool listing.
- **Attack Flow:** User B opens developer tools, obtains User A's `listingId` from the public page, and invokes the Convex mutation `deleteListing({ listingId })`.
- **Defense Mechanism:**
  ```typescript
  // Inside convex/listings.ts
  export const deleteListing = mutation({
    args: { listingId: v.id("listings") },
    handler: async (ctx, args) => {
      const { user, listing } = await requireListingOwner(ctx, args.listingId);
      // Only executes if user._id === listing.ownerId OR user.role === "admin"
      await ctx.db.patch(listing._id, { isRemoved: true });
    }
  });
  ```
- **Outcome:** Mutation aborts immediately with an unauthorized error. No database mutation occurs.

---

### 3.2 Attack Scenario B: Webhook Replay & Forgery against n8n
- **Objective:** Attacker intercepts a legitimate notification webhook payload and replays it 1,000 times to spam a lender with emails or SMS messages.
- **Attack Flow:** Attacker captures `POST /webhook/borrow-request` with headers `X-LendLoop-Signature`, `X-LendLoop-Timestamp`, and `X-LendLoop-Event-Id`.
- **Defense Mechanism:**
  1. **Timestamp Check:** n8n verifies that `|Date.now() - timestamp| <= 300,000` ms (5 minutes). Replayed requests captured earlier are rejected immediately.
  2. **Event Idempotency Check:** n8n checks the unique `X-LendLoop-Event-Id`. If the event has already triggered notification dispatch, subsequent calls are dropped as duplicates.
- **Outcome:** The replayed request is rejected; zero additional notifications are sent.

---

### 3.3 Attack Scenario C: Race Condition in Concurrent Borrow Approvals
- **Objective:** Two conflicting borrow requests for the same tool are submitted for overlapping dates. The owner or an automated script triggers approval for both simultaneously.
- **Defense Mechanism:**
  Convex transactions are serializable ACID transactions. The first approval transaction commits:
  1. Marks listing `isAvailable = false`.
  2. Sets first request `status = "approved"`.
  3. Queries and marks conflicting pending requests `status = "declined"`.
  When the second approval transaction executes, it reads `isAvailable === false` and `status === "declined"`, throwing a validation exception.
- **Outcome:** Exactly one loan is created. Conflicting requests are automatically rejected.
