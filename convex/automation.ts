import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { signWebhookPayload } from "./lib/crypto";

/**
 * Internal query: retrieves events ready for webhook dispatch.
 */
export const getPendingEventsToDispatch = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const pendingEvents = await ctx.db
      .query("automationEvents")
      .withIndex("by_status_nextRetry", (q) =>
        q.eq("status", "pending").lte("nextRetryAt", now)
      )
      .take(args.limit);

    const retryEvents = await ctx.db
      .query("automationEvents")
      .withIndex("by_status_nextRetry", (q) =>
        q.eq("status", "retry_scheduled").lte("nextRetryAt", now)
      )
      .take(args.limit);

    return [...pendingEvents, ...retryEvents].slice(0, args.limit);
  },
});

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

    if (event.status === args.status) {
      return { success: true, alreadyRecorded: true };
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
    const webhookUrl = process.env.CONVEX_N8N_WEBHOOK_URL;
    const hmacSecret = process.env.CONVEX_N8N_HMAC_SECRET;
    const batchLimit = args.maxBatchSize || 10;
    const now = Date.now();

    if (!webhookUrl || !hmacSecret) {
      console.warn(
        "[Outbox Dispatcher] Missing CONVEX_N8N_WEBHOOK_URL or CONVEX_N8N_HMAC_SECRET configuration. Skipping dispatch."
      );
      return {
        dispatchedCount: 0,
        skipped: true,
        reason: "Unconfigured webhook endpoint or HMAC secret",
      };
    }

    const candidates = await ctx.runQuery(
      internal.automation.getPendingEventsToDispatch,
      { limit: batchLimit }
    );

    let dispatchedCount = 0;
    let failedCount = 0;

    for (const event of candidates) {
      // 1. Lock event atomically
      const locked = await ctx.runMutation(
        internal.automation.lockEventForProcessing,
        { eventId: event.eventId }
      );
      if (!locked) {
        continue;
      }

      // 2. Cryptographically sign outbound payload with HMAC SHA-256
      const timestamp = Date.now();
      const outboundBody = {
        eventId: event.eventId,
        eventType: event.eventType,
        payload: event.payload,
      };
      const rawBody = JSON.stringify(outboundBody);
      const signed = await signWebhookPayload(
        hmacSecret,
        timestamp,
        event.eventId,
        rawBody
      );

      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-lendloop-signature": signed.signature,
            "x-lendloop-timestamp": String(timestamp),
            "x-lendloop-event-id": event.eventId,
          },
          body: rawBody,
        });

        if (response.ok) {
          await ctx.runMutation(internal.automation.markEventSucceeded, {
            eventId: event.eventId,
          });
          dispatchedCount++;
        } else {
          failedCount++;
          const attempt = locked.attemptCount;
          const isTerminal = attempt >= 5;
          const backoffMs = Math.min(1000 * Math.pow(2, attempt), 300_000);
          await ctx.runMutation(internal.automation.markEventFailed, {
            eventId: event.eventId,
            error: `HTTP ${response.status}: ${response.statusText}`,
            nextRetryAt: Date.now() + backoffMs,
            isTerminal,
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const attempt = locked.attemptCount;
        const isTerminal = attempt >= 5;
        const backoffMs = Math.min(1000 * Math.pow(2, attempt), 300_000);
        const errorMsg =
          err instanceof Error ? err.message : "Network dispatch failure";
        await ctx.runMutation(internal.automation.markEventFailed, {
          eventId: event.eventId,
          error: errorMsg,
          nextRetryAt: Date.now() + backoffMs,
          isTerminal,
        });
      }
    }

    return {
      dispatchedCount,
      failedCount,
      candidateCount: candidates.length,
      timestamp: now,
    };
  },
});
