import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  requireAdmin,
  requireAuthenticatedUser,
  requireBorrowerOrLender,
} from "./lib/auth";
import { isLoanOverdue } from "./lib/dates";

/**
 * Returns all active and historical loans where the caller is either borrower or lender.
 */
export const getMyLoans = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);

    const borrowerLoans = await ctx.db
      .query("loans")
      .withIndex("by_borrowerId", (q) => q.eq("borrowerId", user._id))
      .collect();

    const lenderLoans = await ctx.db
      .query("loans")
      .withIndex("by_lenderId", (q) => q.eq("lenderId", user._id))
      .collect();

    // Deduplicate in case a user is both (edge case)
    const loanMap = new Map<string, Doc<"loans">>();
    for (const l of [...borrowerLoans, ...lenderLoans]) {
      loanMap.set(l._id, l);
    }

    const allLoans = Array.from(loanMap.values());

    return await Promise.all(
      allLoans.map(async (loan) => {
        const listing = (await ctx.db.get(loan.listingId)) as Doc<"listings"> | null;
        const borrower = (await ctx.db.get(loan.borrowerId)) as Doc<"users"> | null;
        const lender = (await ctx.db.get(loan.lenderId)) as Doc<"users"> | null;

        // Dynamic status check: if active and past due date, tag as overdue
        let effectiveStatus = loan.status;
        if (loan.status === "active" && isLoanOverdue(loan.dueDate)) {
          effectiveStatus = "overdue";
        }

        return {
          _id: loan._id,
          listingId: loan.listingId,
          toolName: listing?.name || "Tool",
          category: listing?.category || "General",
          borrowerId: loan.borrowerId,
          borrowerName: borrower?.name || "Neighbor",
          lenderId: loan.lenderId,
          lenderName: lender?.name || "Neighbor",
          isMyBorrow: loan.borrowerId === user._id,
          isMyLend: loan.lenderId === user._id,
          startDate: loan.startDate,
          dueDate: loan.dueDate,
          returnedAt: loan.returnedAt,
          status: effectiveStatus,
          createdAt: loan.createdAt,
        };
      })
    );
  },
});

/**
 * Retrieves specific loan details, including recent automation reminder logs.
 * Guarded by `requireBorrowerOrLender` or platform admin.
 */
export const getLoanById = query({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const { user, loan } = await requireBorrowerOrLender(ctx, args.loanId);
    const listing = (await ctx.db.get(loan.listingId)) as Doc<"listings"> | null;
    const borrower = (await ctx.db.get(loan.borrowerId)) as Doc<"users"> | null;
    const lender = (await ctx.db.get(loan.lenderId)) as Doc<"users"> | null;

    // Fetch reminder history for this loan
    const reminderLogs = await ctx.db
      .query("reminderLogs")
      .withIndex("by_loanId", (q) => q.eq("loanId", loan._id))
      .collect();

    let effectiveStatus = loan.status;
    if (loan.status === "active" && isLoanOverdue(loan.dueDate)) {
      effectiveStatus = "overdue";
    }

    return {
      _id: loan._id,
      listingId: loan.listingId,
      toolName: listing?.name || "Tool",
      category: listing?.category || "General",
      borrower: {
        _id: borrower?._id,
        name: borrower?.name || "Neighbor",
        email: user.role === "admin" || user._id === loan.lenderId ? borrower?.email : undefined,
      },
      lender: {
        _id: lender?._id,
        name: lender?.name || "Neighbor",
        email: user.role === "admin" || user._id === loan.borrowerId ? lender?.email : undefined,
      },
      isMyBorrow: loan.borrowerId === user._id,
      isMyLend: loan.lenderId === user._id,
      startDate: loan.startDate,
      dueDate: loan.dueDate,
      returnedAt: loan.returnedAt,
      status: effectiveStatus,
      createdAt: loan.createdAt,
      reminderLogs: reminderLogs.map((r) => ({
        _id: r._id,
        reminderType: r.reminderType,
        deliveryStatus: r.deliveryStatus,
        timestamp: r.timestamp,
      })),
    };
  },
});

/**
 * Admin query: retrieves all active and historical loans across all users.
 * Guarded by `requireAdmin`.
 */
export const getAllLoansAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const allLoans = await ctx.db.query("loans").collect();

    return await Promise.all(
      allLoans.map(async (loan) => {
        const listing = (await ctx.db.get(loan.listingId)) as Doc<"listings"> | null;
        const borrower = (await ctx.db.get(loan.borrowerId)) as Doc<"users"> | null;
        const lender = (await ctx.db.get(loan.lenderId)) as Doc<"users"> | null;

        let effectiveStatus = loan.status;
        if (loan.status === "active" && isLoanOverdue(loan.dueDate)) {
          effectiveStatus = "overdue";
        }

        return {
          _id: loan._id,
          listingId: loan.listingId,
          toolName: listing?.name || "Tool",
          category: listing?.category || "General",
          borrowerName: borrower?.name || "Borrower",
          borrowerEmail: borrower?.email,
          lenderName: lender?.name || "Lender",
          lenderEmail: lender?.email,
          startDate: loan.startDate,
          dueDate: loan.dueDate,
          returnedAt: loan.returnedAt,
          status: effectiveStatus,
          createdAt: loan.createdAt,
        };
      })
    );
  },
});

/**
 * Marks an active loan as returned.
 * Can be triggered by the borrower, lender, or admin.
 * Updates loan status, marks tool listing available, and persists outbox event.
 */
export const markLoanReturned = mutation({
  args: { loanId: v.id("loans") },
  handler: async (ctx, args) => {
    const { loan } = await requireBorrowerOrLender(ctx, args.loanId);

    if (loan.status === "returned") {
      throw new Error("INVALID_STATE: Loan has already been marked as returned");
    }

    const now = Date.now();

    // 1. Update loan record
    await ctx.db.patch(loan._id, {
      status: "returned",
      returnedAt: now,
      updatedAt: now,
    });

    // 2. Make tool available for neighborhood lending again
    const listing = (await ctx.db.get(loan.listingId)) as Doc<"listings"> | null;
    if (listing) {
      await ctx.db.patch(listing._id, {
        isAvailable: true,
        updatedAt: now,
      });
    }

    // 3. Persist transactional outbox event
    const eventId = crypto.randomUUID();
    const lender = (await ctx.db.get(loan.lenderId)) as Doc<"users"> | null;
    const borrower = (await ctx.db.get(loan.borrowerId)) as Doc<"users"> | null;

    await ctx.db.insert("automationEvents", {
      eventId,
      eventType: "loan.returned",
      targetEntityId: loan._id,
      payload: {
        loanId: loan._id,
        listingId: loan.listingId,
        toolName: listing?.name || "Tool",
        borrowerName: borrower?.name,
        lenderEmail: lender?.email,
        returnedAt: now,
      },
      status: "pending",
      attemptCount: 0,
      nextRetryAt: now,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, loanId: loan._id };
  },
});
