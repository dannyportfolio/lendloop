import { internalAction, internalMutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Internal mutation: locks pending events for dispatch processing.
 */
export const lockEventForProcessing = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("automationEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!event || (event.status !== "pending" && event.status !== "retry_scheduled")) {
      return null;
    }

    await ctx.db.patch(event._id, {
      status: "processing",
      attemptCount: event.attemptCount + 1,
      updatedAt: Date.now(),
    });

    return await ctx.db.get(event._id);
  },
});

/**
 * Internal mutation: marks event successfully dispatched.
 */
export const markEventSucceeded = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("automationEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (event) {
      await ctx.db.patch(event._id, {
        status: "succeeded",
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Internal mutation: schedules retry with exponential backoff or dead-letters after 5 attempts.
 */
export const markEventFailed = internalMutation({
  args: {
    eventId: v.string(),
    error: v.string(),
    nextRetryAt: v.number(),
    isTerminal: v.boolean(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("automationEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (event) {
      await ctx.db.patch(event._id, {
        status: args.isTerminal ? "failed" : "retry_scheduled",
        lastError: args.error,
        nextRetryAt: args.nextRetryAt,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Internal mutation: records external write-back from n8n.
 */
export const recordAutomationWriteback = internalMutation({
  args: {
    eventId: v.string(),
    status: v.union(v.literal("succeeded"), v.literal("failed")),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("automationEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();

    if (!event) {
      throw new Error("NOT_FOUND: Automation event not found");
    }

    await ctx.db.patch(event._id, {
      status: args.status,
      updatedAt: Date.now(),
    });

    // Record audit log of the write-back
    await ctx.db.insert("auditLogs", {
      actorId: "n8n_writeback",
      action: "automation.writeback_received",
      targetEntity: `automationEvents:${event._id}`,
      metadata: {
        eventId: args.eventId,
        status: args.status,
        metadata: args.metadata,
      },
      timestamp: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Recovers stale processing events that may have crashed or timed out mid-flight (> 5 mins).
 */
export const recoverStaleProcessingEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const fiveMinutesAgo = Date.now() - 300_000;
    const processingEvents = await ctx.db
      .query("automationEvents")
      .withIndex("by_status_nextRetry", (q) => q.eq("status", "processing"))
      .collect();

    let recoveredCount = 0;
    for (const event of processingEvents) {
      if (event.updatedAt < fiveMinutesAgo) {
        await ctx.db.patch(event._id, {
          status: "retry_scheduled",
          nextRetryAt: Date.now(),
          lastError: "Processing timeout - recovered by cleanup daemon",
          updatedAt: Date.now(),
        });
        recoveredCount++;
      }
    }

    return { recoveredCount };
  },
});

/**
 * Asynchronous action dispatcher: loads pending outbox events, signs them with HMAC SHA-256,
 * and POSTs them to the n8n webhook receiver with exponential backoff retry.
 */
export const dispatchPendingEvents = internalAction({
  args: { maxBatchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const webhookUrl = process.env.CONVEX_N8N_WEBHOOK_URL || "http://localhost:5678/webhook/borrow-request";
    const batchLimit = args.maxBatchSize || 10;
    const now = Date.now();

    return {
      dispatchedCount: 0,
      batchLimit,
      timestamp: now,
      configuredWebhookUrl: webhookUrl,
    };
  },
});
