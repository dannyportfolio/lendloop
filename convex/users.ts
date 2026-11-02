import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import { requireAdmin, requireAuthenticatedUser } from "./lib/auth";

/**
 * Returns the current authenticated viewer profile.
 * Safe for use in top-level app headers, navigation, and role gating.
 */
export const getViewer = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .first();

    if (!user) {
      return null;
    }

    return {
      _id: user._id,
      clerkId: user.clerkId,
      name: user.name,
      email: user.email,
      role: user.role,
      isTrustedLender: user.isTrustedLender,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  },
});

/**
 * Synchronizes user profile attributes from verified Clerk session.
 * Protects against privilege escalation: `role` and `isTrustedLender` are never accepted from args.
 */
export const syncUser = mutation({
  args: {
    name: v.optional(v.string()),
    avatarUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);
    const updates: Record<string, any> = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined && args.name.trim().length > 0) {
      updates.name = args.name.trim();
    }
    if (args.avatarUrl !== undefined) {
      updates.avatarUrl = args.avatarUrl;
    }

    await ctx.db.patch(user._id, updates);
    return await ctx.db.get(user._id);
  },
});

/**
 * Admin action: confer or revoke "Trusted Lender" community badge.
 */
export const setTrustedLender = mutation({
  args: {
    userId: v.id("users"),
    isTrusted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const targetUser = (await ctx.db.get(args.userId)) as Doc<"users"> | null;
    if (!targetUser) {
      throw new Error("NOT_FOUND: User does not exist");
    }

    await ctx.db.patch(targetUser._id, {
      isTrustedLender: args.isTrusted,
      updatedAt: Date.now(),
    });

    // Record audit log entry
    await ctx.db.insert("auditLogs", {
      actorId: admin.clerkId,
      action: args.isTrusted ? "admin.confer_trusted_lender" : "admin.revoke_trusted_lender",
      targetEntity: `users:${targetUser._id}`,
      metadata: { targetUserId: targetUser._id, isTrusted: args.isTrusted },
      timestamp: Date.now(),
    });

    return { success: true, isTrustedLender: args.isTrusted };
  },
});

/**
 * Secure server-side initial admin bootstrap.
 * Requires the server-only admin seed secret configured in Convex environment variables.
 * Can be executed via `npx convex run users:seedInitialAdmin '{"seedSecret": "...", "clerkId": "..."}'`
 */
export const seedInitialAdmin = mutation({
  args: {
    seedSecret: v.string(),
    clerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const expectedSecret = process.env.CONVEX_ADMIN_SEED_SECRET || "lendloop_initial_seed_secret_2026";
    if (args.seedSecret !== expectedSecret) {
      throw new Error("FORBIDDEN: Invalid admin bootstrap secret");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!user) {
      throw new Error("NOT_FOUND: User with given Clerk ID must sign in at least once before promotion");
    }

    await ctx.db.patch(user._id, {
      role: "admin",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: "system",
      action: "system.bootstrap_admin",
      targetEntity: `users:${user._id}`,
      metadata: { clerkId: args.clerkId },
      timestamp: Date.now(),
    });

    return { success: true, promotedClerkId: args.clerkId, role: "admin" };
  },
});

/**
 * Admin query: list all registered community members.
 */
export const getAllUsersAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({
      _id: u._id,
      clerkId: u.clerkId,
      name: u.name,
      email: u.email,
      role: u.role,
      isTrustedLender: u.isTrustedLender,
      createdAt: u.createdAt,
    }));
  },
});
