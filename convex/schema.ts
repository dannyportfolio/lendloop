import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ---------------------------------------------------------------------------
  // Users: synchronized from Clerk identity tokens
  // ---------------------------------------------------------------------------
  users: defineTable({
    clerkId: v.string(), // Clerk subject id (user_2...)
    name: v.string(),
    email: v.string(),
    role: v.union(v.literal("user"), v.literal("admin")),
    isTrustedLender: v.boolean(),
    avatarUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_role", ["role"]),

  // ---------------------------------------------------------------------------
  // Listings: tools available for neighborhood lending
  // ---------------------------------------------------------------------------
  listings: defineTable({
    ownerId: v.id("users"),
    name: v.string(),
    category: v.string(), // "Power Tools", "Hand Tools", "Lawn & Garden", etc.
    condition: v.string(), // "Brand New", "Like New", "Good Condition", "Fair / Functional"
    description: v.string(),
    isAvailable: v.boolean(),
    isRemoved: v.boolean(), // Soft deletion flag for administrative or owner removal
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_ownerId", ["ownerId"])
    .index("by_category_available", ["category", "isAvailable", "isRemoved"])
    .index("by_isAvailable", ["isAvailable", "isRemoved"]),

  // ---------------------------------------------------------------------------
  // Borrow Requests: requests submitted by borrowers to tool owners
  // ---------------------------------------------------------------------------
  borrowRequests: defineTable({
    listingId: v.id("listings"),
    borrowerId: v.id("users"),
    lenderId: v.id("users"),
    startDate: v.string(), // ISO date: YYYY-MM-DD
    endDate: v.string(), // ISO date: YYYY-MM-DD
    status: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("declined"),
      v.literal("cancelled")
    ),
    note: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_listingId", ["listingId", "status"])
    .index("by_borrowerId", ["borrowerId", "status"])
    .index("by_lenderId", ["lenderId", "status"]),

  // ---------------------------------------------------------------------------
  // Loans: materialized agreements following borrow request approval
  // ---------------------------------------------------------------------------
  loans: defineTable({
    listingId: v.id("listings"),
    requestId: v.id("borrowRequests"),
    borrowerId: v.id("users"),
    lenderId: v.id("users"),
    startDate: v.string(), // ISO date: YYYY-MM-DD
    dueDate: v.string(), // ISO date: YYYY-MM-DD
    returnedAt: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("returned"),
      v.literal("overdue")
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_borrowerId", ["borrowerId", "status"])
    .index("by_lenderId", ["lenderId", "status"])
    .index("by_listingId", ["listingId", "status"])
    .index("by_status_dueDate", ["status", "dueDate"]),

  // ---------------------------------------------------------------------------
  // Automation Events: Transactional Outbox for resilient n8n dispatch
  // ---------------------------------------------------------------------------
  automationEvents: defineTable({
    eventId: v.string(), // UUID v4
    eventType: v.string(), // "request.created", "request.status_changed", "loan.created", "loan.returned"
    targetEntityId: v.string(),
    payload: v.any(),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("succeeded"),
      v.literal("failed"),
      v.literal("retry_scheduled")
    ),
    attemptCount: v.number(),
    nextRetryAt: v.number(),
    lastError: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_eventId", ["eventId"])
    .index("by_status_nextRetry", ["status", "nextRetryAt"]),

  // ---------------------------------------------------------------------------
  // Reminder Logs: Database-level idempotency record for automated reminders
  // ---------------------------------------------------------------------------
  reminderLogs: defineTable({
    loanId: v.id("loans"),
    reminderType: v.string(), // e.g. "overdue"
    dueDate: v.string(),
    idempotencyKey: v.string(), // Deterministic: overdue-{loanId}-{YYYY-MM-DD}
    deliveryStatus: v.union(v.literal("sent"), v.literal("failed")),
    timestamp: v.number(),
  })
    .index("by_idempotencyKey", ["idempotencyKey"])
    .index("by_loanId", ["loanId"]),

  // ---------------------------------------------------------------------------
  // Audit Logs: Immutable log of administrative and critical operations
  // ---------------------------------------------------------------------------
  auditLogs: defineTable({
    actorId: v.string(), // Clerk ID or "system"
    action: v.string(),
    targetEntity: v.string(),
    metadata: v.any(),
    timestamp: v.number(),
  })
    .index("by_actorId", ["actorId"])
    .index("by_targetEntity", ["targetEntity"]),
});
