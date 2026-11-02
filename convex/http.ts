import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

/**
 * Validates the inbound Bearer credential against the configured secret.
 */
function isBearerAuthorized(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return false;
  }
  const token = authHeader.substring(7).trim();
  const expectedSecret =
    process.env.N8N_CONVEX_WRITEBACK_SECRET ||
    "secret_bearer_token_for_n8n_writeback_verification";
  return token === expectedSecret;
}

/**
 * Endpoint A: Inbound Automation Write-Back (from n8n Workflow A)
 * Receives delivery outcomes and updates automationEvents state.
 */
http.route({
  path: "/api/automation/writeback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isBearerAuthorized(request)) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED: Invalid Bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { eventId, status, metadata } = body;

      if (!eventId || (status !== "succeeded" && status !== "failed")) {
        return new Response(
          JSON.stringify({ error: "VALIDATION_ERROR: Missing eventId or invalid status" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      await ctx.runMutation(internal.automation.recordAutomationWriteback, {
        eventId,
        status,
        metadata,
      });

      return new Response(JSON.stringify({ success: true, eventId, status }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Internal writeback error";
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Endpoint B: Authenticated Overdue Loans Query (for n8n Workflow B daily poll)
 * Projects minimal data required for borrower overdue reminders.
 */
http.route({
  path: "/api/loans/overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!isBearerAuthorized(request)) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED: Invalid Bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const overdueLoans = await ctx.runQuery(internal.loans.getOverdueLoansInternal, {});
      return new Response(JSON.stringify(overdueLoans), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Internal query error";
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

/**
 * Endpoint C: Database-Level Idempotent Reminder Write-Back (from n8n Workflow B)
 * Records reminder delivery and guarantees zero duplicate reminders per day.
 */
http.route({
  path: "/api/loans/reminders/record",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!isBearerAuthorized(request)) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED: Invalid Bearer token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    try {
      const body = await request.json();
      const { loanId, idempotencyKey, dueDate, deliveryStatus } = body;

      if (!loanId || !idempotencyKey || !dueDate) {
        return new Response(
          JSON.stringify({ error: "VALIDATION_ERROR: Missing required fields" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const result = await ctx.runMutation(internal.loans.recordReminderLogInternal, {
        loanId,
        idempotencyKey,
        dueDate,
        deliveryStatus: deliveryStatus || "sent",
      });

      return new Response(JSON.stringify({ success: true, ...result }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Internal reminder log error";
      return new Response(JSON.stringify({ error: msg }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
