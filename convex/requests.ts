import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  requireAuthenticatedUser,
  requireBorrower,
  requireLender,
} from "./lib/auth";
import { validateBorrowDateRange } from "./lib/dates";

/**
 * Creates a new borrow request.
 * Validates dates, prevents borrowing own tool, prevents duplicate requests,
 * and atomically persists an outbox automation event in the exact same transaction.
 */
export const createBorrowRequest = mutation({
  args: {
    listingId: v.id("listings"),
    startDate: v.string(),
    endDate: v.string(),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const borrower = await requireAuthenticatedUser(ctx);
    const listing = (await ctx.db.get(args.listingId)) as Doc<"listings"> | null;

    if (!listing || listing.isRemoved) {
      throw new Error("NOT_FOUND: Tool listing does not exist or has been removed");
    }

    if (!listing.isAvailable) {
      throw new Error("UNAVAILABLE: Tool is currently on loan or unavailable");
    }

    // Business Rule: Cannot borrow your own tool
    if (listing.ownerId === borrower._id) {
      throw new Error("INVALID_ACTION: You cannot borrow your own tool");
    }

    // Business Rule: Server-side date range validation
    const dateValidation = validateBorrowDateRange(args.startDate, args.endDate);
    if (!dateValidation.valid) {
      throw new Error(`INVALID_DATES: ${dateValidation.error}`);
    }

    // Business Rule: Prevent duplicate pending requests from same borrower for same tool
    const existingRequests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_borrowerId", (q) =>
        q.eq("borrowerId", borrower._id).eq("status", "pending")
      )
      .collect();

    const hasDuplicate = existingRequests.some((r) => r.listingId === listing._id);
    if (hasDuplicate) {
      throw new Error("DUPLICATE_REQUEST: You already have a pending request for this tool");
    }

    const now = Date.now();
    const requestId = await ctx.db.insert("borrowRequests", {
      listingId: listing._id,
      borrowerId: borrower._id,
      lenderId: listing.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      note: args.note?.trim(),
      createdAt: now,
      updatedAt: now,
    });

    const lender = (await ctx.db.get(listing.ownerId)) as Doc<"users"> | null;

    // Transactional Outbox Pattern: Save event atomically with business data
    const eventId = crypto.randomUUID();
    await ctx.db.insert("automationEvents", {
      eventId,
      eventType: "request.created",
      targetEntityId: requestId,
      payload: {
        requestId,
        listingId: listing._id,
        toolName: listing.name,
        borrowerName: borrower.name,
        lenderEmail: lender?.email,
        startDate: args.startDate,
        endDate: args.endDate,
        note: args.note?.trim(),
      },
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return requestId;
  },
});

/**
 * Returns borrow requests initiated by the authenticated user.
 */
export const getMySentRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const requests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", user._id))
      .collect();

    return await Promise.all(
      requests.map(async (req) => {
        const listing = (await ctx.db.get(req.listingId)) as Doc<"listings"> | null;
        const lender = (await ctx.db.get(req.lenderId)) as Doc<"users"> | null;
        return {
          ...req,
          toolName: listing?.name || "Deleted Tool",
          category: listing?.category || "General",
          lenderName: lender?.name || "Neighbor",
          isTrustedLender: lender?.isTrustedLender || false,
        };
      })
    );
  },
});

/**
 * Returns incoming borrow requests for tools owned by the authenticated user.
 */
export const getIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const requests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_lenderId", (q) => q.eq("lenderId", user._id))
      .collect();

    return await Promise.all(
      requests.map(async (req) => {
        const listing = (await ctx.db.get(req.listingId)) as Doc<"listings"> | null;
        const borrower = (await ctx.db.get(req.borrowerId)) as Doc<"users"> | null;
        return {
          ...req,
          toolName: listing?.name || "Deleted Tool",
          category: listing?.category || "General",
          borrowerName: borrower?.name || "Neighbor",
        };
      })
    );
  },
});

/**
 * Approves a borrow request.
 * Sets request status to "approved", creates an active loan record,
 * toggles listing availability to false, declines conflicting pending requests,
 * and records atomic outbox events.
 */
export const approveBorrowRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const { request } = await requireLender(ctx, args.requestId);

    if (request.status !== "pending") {
      throw new Error(`INVALID_STATE: Request is already ${request.status}`);
    }

    const listing = (await ctx.db.get(request.listingId)) as Doc<"listings"> | null;
    if (!listing || listing.isRemoved) {
      throw new Error("NOT_FOUND: Listing no longer exists");
    }

    if (!listing.isAvailable) {
      throw new Error("CONFLICT: Tool is already on loan for an approved borrower");
    }

    const now = Date.now();

    // 1. Mark request approved
    await ctx.db.patch(request._id, {
      status: "approved",
      updatedAt: now,
    });

    // 2. Mark listing unavailable
    await ctx.db.patch(listing._id, {
      isAvailable: false,
      updatedAt: now,
    });

    // 3. Create active loan record
    const loanId = await ctx.db.insert("loans", {
      listingId: listing._id,
      requestId: request._id,
      borrowerId: request.borrowerId,
      lenderId: request.lenderId,
      startDate: request.startDate,
      dueDate: request.endDate,
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    // 4. Concurrency Protection: Auto-decline conflicting pending requests for this tool
    const otherPending = await ctx.db
      .query("borrowRequests")
      .withIndex("by_listingId", (q) =>
        q.eq("listingId", listing._id).eq("status", "pending")
      )
      .collect();

    for (const pendingReq of otherPending) {
      if (pendingReq._id !== request._id) {
        await ctx.db.patch(pendingReq._id, {
          status: "declined",
          updatedAt: now,
        });
      }
    }

    // 5. Transactional Outbox: Write automation events
    const borrower = (await ctx.db.get(request.borrowerId)) as Doc<"users"> | null;
    const lender = (await ctx.db.get(request.lenderId)) as Doc<"users"> | null;

    const eventId = crypto.randomUUID();
    await ctx.db.insert("automationEvents", {
      eventId,
      eventType: "request.status_changed",
      targetEntityId: request._id,
      payload: {
        requestId: request._id,
        loanId,
        toolName: listing.name,
        newStatus: "approved",
        borrowerEmail: borrower?.email,
        lenderName: lender?.name,
        dueDate: request.endDate,
      },
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, loanId };
  },
});

/**
 * Declines a borrow request.
 * Sets request status to "declined" and writes outbox event.
 */
export const declineBorrowRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const { request } = await requireLender(ctx, args.requestId);

    if (request.status !== "pending") {
      throw new Error(`INVALID_STATE: Request is already ${request.status}`);
    }

    const now = Date.now();
    await ctx.db.patch(request._id, {
      status: "declined",
      updatedAt: now,
    });

    const listing = (await ctx.db.get(request.listingId)) as Doc<"listings"> | null;
    const borrower = (await ctx.db.get(request.borrowerId)) as Doc<"users"> | null;

    const eventId = crypto.randomUUID();
    await ctx.db.insert("automationEvents", {
      eventId,
      eventType: "request.status_changed",
      targetEntityId: request._id,
      payload: {
        requestId: request._id,
        toolName: listing?.name || "Tool",
        newStatus: "declined",
        borrowerEmail: borrower?.email,
      },
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true };
  },
});

/**
 * Cancels a borrow request (borrower action).
 */
export const cancelBorrowRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const { request } = await requireBorrower(ctx, args.requestId);

    if (request.status !== "pending") {
      throw new Error(`INVALID_STATE: Only pending requests can be cancelled`);
    }

    await ctx.db.patch(request._id, {
      status: "cancelled",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
