import type { QueryCtx, MutationCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";

/**
 * Resolves the authenticated caller from the verified Clerk JWT identity context.
 * In a Mutation context, seamlessly provisions or syncs the user profile document (JIT).
 */
export async function requireAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("UNAUTHENTICATED: Authentication required");
  }

  const clerkId = identity.subject;

  // Query user by clerkId index
  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q) => q.eq("clerkId", clerkId))
    .first();

  if (existingUser) {
    return existingUser;
  }

  // If in mutation context, auto-provision user on first authenticated interaction
  if ("insert" in ctx.db) {
    const now = Date.now();
    const name =
      identity.name ||
      `${identity.givenName ?? ""} ${identity.familyName ?? ""}`.trim() ||
      "Neighbor";
    const email = identity.email ?? "";

    const newUserId = await (ctx as MutationCtx).db.insert("users", {
      clerkId,
      name,
      email,
      role: "user",
      isTrustedLender: false,
      avatarUrl: identity.pictureUrl,
      createdAt: now,
      updatedAt: now,
    });

    const created = (await ctx.db.get(newUserId)) as Doc<"users"> | null;
    if (!created) {
      throw new Error("INTERNAL_ERROR: Failed to initialize user profile");
    }
    return created;
  }

  throw new Error("UNAUTHENTICATED: User profile not provisioned");
}

/**
 * Enforces that the caller has an active, verified 'admin' role in the database.
 */
export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users">> {
  const user = await requireAuthenticatedUser(ctx);
  if (user.role !== "admin") {
    throw new Error("FORBIDDEN: Administrative privileges required");
  }
  return user;
}

/**
 * Validates that the caller is either the owner of the listing or a platform admin.
 * Protects against IDOR (Insecure Direct Object Reference) vulnerabilities.
 */
export async function requireListingOwner(
  ctx: QueryCtx | MutationCtx,
  listingId: Id<"listings">
): Promise<{ user: Doc<"users">; listing: Doc<"listings"> }> {
  const user = await requireAuthenticatedUser(ctx);
  const listing = (await ctx.db.get(listingId)) as Doc<"listings"> | null;

  if (!listing || listing.isRemoved) {
    throw new Error("NOT_FOUND: Listing does not exist or has been removed");
  }

  if (listing.ownerId !== user._id && user.role !== "admin") {
    throw new Error("FORBIDDEN: You do not have permission to manage this listing");
  }

  return { user, listing };
}

/**
 * Validates caller is the borrower of a borrow request (or platform admin).
 */
export async function requireBorrower(
  ctx: QueryCtx | MutationCtx,
  requestId: Id<"borrowRequests">
): Promise<{ user: Doc<"users">; request: Doc<"borrowRequests"> }> {
  const user = await requireAuthenticatedUser(ctx);
  const request = (await ctx.db.get(requestId)) as Doc<"borrowRequests"> | null;

  if (!request) {
    throw new Error("NOT_FOUND: Borrow request not found");
  }

  if (request.borrowerId !== user._id && user.role !== "admin") {
    throw new Error("FORBIDDEN: You are not the borrower for this request");
  }

  return { user, request };
}

/**
 * Validates caller is the lender (tool owner) of a borrow request (or platform admin).
 */
export async function requireLender(
  ctx: QueryCtx | MutationCtx,
  requestId: Id<"borrowRequests">
): Promise<{ user: Doc<"users">; request: Doc<"borrowRequests"> }> {
  const user = await requireAuthenticatedUser(ctx);
  const request = (await ctx.db.get(requestId)) as Doc<"borrowRequests"> | null;

  if (!request) {
    throw new Error("NOT_FOUND: Borrow request not found");
  }

  if (request.lenderId !== user._id && user.role !== "admin") {
    throw new Error("FORBIDDEN: You are not the lender for this tool");
  }

  return { user, request };
}

/**
 * Validates caller is either the borrower or lender of a loan (or platform admin).
 */
export async function requireBorrowerOrLender(
  ctx: QueryCtx | MutationCtx,
  loanId: Id<"loans">
): Promise<{ user: Doc<"users">; loan: Doc<"loans"> }> {
  const user = await requireAuthenticatedUser(ctx);
  const loan = (await ctx.db.get(loanId)) as Doc<"loans"> | null;

  if (!loan) {
    throw new Error("NOT_FOUND: Loan agreement not found");
  }

  const isParty = loan.borrowerId === user._id || loan.lenderId === user._id;
  if (!isParty && user.role !== "admin") {
    throw new Error("FORBIDDEN: You are not authorized to access this loan");
  }

  return { user, loan };
}
