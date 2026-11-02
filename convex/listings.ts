import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import {
  requireAdmin,
  requireAuthenticatedUser,
  requireListingOwner,
} from "./lib/auth";

/**
 * Public catalog query.
 * Data minimization: Excludes user emails, phone numbers, and private metadata.
 * Projects only necessary tool fields, owner display name, and trusted lender badge.
 */
export const getPublicListings = query({
  args: {
    category: v.optional(v.string()),
    searchQuery: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let listings = await ctx.db
      .query("listings")
      .withIndex("by_isAvailable", (q) =>
        q.eq("isAvailable", true).eq("isRemoved", false)
      )
      .collect();

    // Category filter
    if (args.category && args.category !== "All") {
      listings = listings.filter((l) => l.category === args.category);
    }

    // Text search filter
    if (args.searchQuery && args.searchQuery.trim().length > 0) {
      const term = args.searchQuery.toLowerCase().trim();
      listings = listings.filter(
        (l) =>
          l.name.toLowerCase().includes(term) ||
          l.description.toLowerCase().includes(term) ||
          l.category.toLowerCase().includes(term)
      );
    }

    // Join with owner display name and trusted status without exposing private PII
    const enrichedListings = await Promise.all(
      listings.map(async (listing) => {
        const owner = (await ctx.db.get(listing.ownerId)) as Doc<"users"> | null;
        return {
          _id: listing._id,
          name: listing.name,
          category: listing.category,
          condition: listing.condition,
          description: listing.description,
          isAvailable: listing.isAvailable,
          createdAt: listing.createdAt,
          owner: {
            _id: owner?._id,
            name: owner?.name || "Community Member",
            isTrustedLender: owner?.isTrustedLender || false,
          },
        };
      })
    );

    return enrichedListings;
  },
});

/**
 * Retrieves single listing details.
 */
export const getListingById = query({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const listing = (await ctx.db.get(args.listingId)) as Doc<"listings"> | null;
    if (!listing || listing.isRemoved) {
      return null;
    }

    const owner = (await ctx.db.get(listing.ownerId)) as Doc<"users"> | null;
    return {
      _id: listing._id,
      ownerId: listing.ownerId,
      name: listing.name,
      category: listing.category,
      condition: listing.condition,
      description: listing.description,
      isAvailable: listing.isAvailable,
      createdAt: listing.createdAt,
      owner: {
        _id: owner?._id,
        name: owner?.name || "Community Member",
        isTrustedLender: owner?.isTrustedLender || false,
      },
    };
  },
});

/**
 * Returns listings owned by current authenticated user.
 */
export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuthenticatedUser(ctx);
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", user._id))
      .collect();

    return listings.filter((l) => !l.isRemoved);
  },
});

/**
 * Creates a new tool listing.
 * Ownership is resolved exclusively server-side from verified auth context.
 */
export const createListing = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuthenticatedUser(ctx);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("VALIDATION_ERROR: Tool name must be between 2 and 100 characters");
    }

    const description = args.description.trim();
    if (description.length < 5 || description.length > 1000) {
      throw new Error("VALIDATION_ERROR: Description must be between 5 and 1000 characters");
    }

    const now = Date.now();
    const listingId = await ctx.db.insert("listings", {
      ownerId: user._id,
      name,
      category: args.category,
      condition: args.condition,
      description,
      isAvailable: true,
      isRemoved: false,
      createdAt: now,
      updatedAt: now,
    });

    return listingId;
  },
});

/**
 * Updates an existing tool listing.
 * Guarded by `requireListingOwner` to prevent IDOR attacks.
 */
export const updateListing = mutation({
  args: {
    listingId: v.id("listings"),
    name: v.string(),
    category: v.string(),
    condition: v.string(),
    description: v.string(),
    isAvailable: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { listing } = await requireListingOwner(ctx, args.listingId);

    const name = args.name.trim();
    if (name.length < 2 || name.length > 100) {
      throw new Error("VALIDATION_ERROR: Tool name must be between 2 and 100 characters");
    }

    const description = args.description.trim();
    if (description.length < 5 || description.length > 1000) {
      throw new Error("VALIDATION_ERROR: Description must be between 5 and 1000 characters");
    }

    await ctx.db.patch(listing._id, {
      name,
      category: args.category,
      condition: args.condition,
      description,
      isAvailable: args.isAvailable,
      updatedAt: Date.now(),
    });

    return { success: true, listingId: listing._id };
  },
});

/**
 * Soft deletes a listing (owner action).
 * Guarded by `requireListingOwner`.
 */
export const deleteListing = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const { listing } = await requireListingOwner(ctx, args.listingId);

    await ctx.db.patch(listing._id, {
      isRemoved: true,
      isAvailable: false,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

/**
 * Administrative removal of any tool listing.
 * Guarded by `requireAdmin` with audit logging.
 */
export const adminRemoveListing = mutation({
  args: {
    listingId: v.id("listings"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = (await ctx.db.get(args.listingId)) as Doc<"listings"> | null;

    if (!listing) {
      throw new Error("NOT_FOUND: Listing not found");
    }

    await ctx.db.patch(listing._id, {
      isRemoved: true,
      isAvailable: false,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.clerkId,
      action: "admin.remove_listing",
      targetEntity: `listings:${listing._id}`,
      metadata: {
        listingName: listing.name,
        ownerId: listing.ownerId,
        reason: args.reason || "Policy moderation",
      },
      timestamp: Date.now(),
    });

    return { success: true, removedListingId: listing._id };
  },
});

/**
 * Admin query: retrieves all listings across all users, including on-loan and removed tools.
 * Guarded by `requireAdmin`.
 */
export const getAllListingsAdmin = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const listings = await ctx.db.query("listings").collect();

    return await Promise.all(
      listings.map(async (listing) => {
        const owner = (await ctx.db.get(listing.ownerId)) as Doc<"users"> | null;
        return {
          _id: listing._id,
          ownerId: listing.ownerId,
          name: listing.name,
          category: listing.category,
          condition: listing.condition,
          description: listing.description,
          isAvailable: listing.isAvailable,
          isRemoved: listing.isRemoved,
          createdAt: listing.createdAt,
          updatedAt: listing.updatedAt,
          owner: {
            _id: owner?._id,
            name: owner?.name || "Community Member",
            email: owner?.email,
            isTrustedLender: owner?.isTrustedLender || false,
          },
        };
      })
    );
  },
});

/**
 * Administrative restoration of a soft-deleted listing.
 * Guarded by `requireAdmin` with audit logging.
 */
export const adminRestoreListing = mutation({
  args: { listingId: v.id("listings") },
  handler: async (ctx, args) => {
    const admin = await requireAdmin(ctx);
    const listing = (await ctx.db.get(args.listingId)) as Doc<"listings"> | null;

    if (!listing) {
      throw new Error("NOT_FOUND: Listing not found");
    }

    await ctx.db.patch(listing._id, {
      isRemoved: false,
      isAvailable: true,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditLogs", {
      actorId: admin.clerkId,
      action: "admin.restore_listing",
      targetEntity: `listings:${listing._id}`,
      metadata: {
        listingName: listing.name,
        ownerId: listing.ownerId,
      },
      timestamp: Date.now(),
    });

    return { success: true, restoredListingId: listing._id };
  },
});
