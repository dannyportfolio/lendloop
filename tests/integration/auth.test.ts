import { describe, it, expect, vi } from "vitest";
import {
  requireAuthenticatedUser,
  requireAdmin,
  requireListingOwner,
  requireBorrower,
  requireLender,
  requireBorrowerOrLender,
} from "../../convex/lib/auth";
import { seedInitialAdmin } from "../../convex/users";

describe("Server-Side RBAC & Authorization Guards", () => {
  const userA = {
    _id: "user_a" as any,
    clerkId: "clerk_user_a",
    name: "Alice",
    email: "alice@example.com",
    role: "user" as const,
    isTrustedLender: false,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const userB = {
    _id: "user_b" as any,
    clerkId: "clerk_user_b",
    name: "Bob",
    email: "bob@example.com",
    role: "user" as const,
    isTrustedLender: false,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const adminUser = {
    _id: "user_admin" as any,
    clerkId: "clerk_admin",
    name: "Admin Alice",
    email: "admin@example.com",
    role: "admin" as const,
    isTrustedLender: true,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const listingA = {
    _id: "listing_a" as any,
    ownerId: "user_a" as any,
    name: "Circular Saw",
    category: "Power Tools",
    condition: "Good Condition",
    description: "7-1/4 inch cordless circular saw",
    isAvailable: true,
    isRemoved: false,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const requestBtoA = {
    _id: "req_1" as any,
    listingId: "listing_a" as any,
    borrowerId: "user_b" as any,
    lenderId: "user_a" as any,
    startDate: "2026-11-10",
    endDate: "2026-11-12",
    status: "pending" as const,
    createdAt: 1000,
    updatedAt: 1000,
  };

  const loanBtoA = {
    _id: "loan_1" as any,
    listingId: "listing_a" as any,
    requestId: "req_1" as any,
    borrowerId: "user_b" as any,
    lenderId: "user_a" as any,
    startDate: "2026-11-10",
    dueDate: "2026-11-12",
    status: "active" as const,
    createdAt: 1000,
    updatedAt: 1000,
  };

  function createMockCtx(identity: any, dbRecords: Record<string, any>) {
    return {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(identity),
      },
      db: {
        get: vi.fn().mockImplementation(async (id) => dbRecords[id] || null),
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockImplementation(async () => {
              if (identity?.subject === userA.clerkId) return userA;
              if (identity?.subject === userB.clerkId) return userB;
              if (identity?.subject === adminUser.clerkId) return adminUser;
              return null;
            }),
          }),
        }),
      },
    } as any;
  }

  it("throws UNAUTHENTICATED when caller identity is missing", async () => {
    const ctx = createMockCtx(null, {});
    await expect(requireAuthenticatedUser(ctx)).rejects.toThrow("UNAUTHENTICATED");
  });

  it("resolves authenticated user successfully from verified identity", async () => {
    const ctx = createMockCtx({ subject: userA.clerkId }, { user_a: userA });
    const user = await requireAuthenticatedUser(ctx);
    expect(user._id).toBe("user_a");
    expect(user.role).toBe("user");
  });

  it("enforces admin privileges and rejects non-admin users", async () => {
    const normalCtx = createMockCtx({ subject: userA.clerkId }, { user_a: userA });
    await expect(requireAdmin(normalCtx)).rejects.toThrow("FORBIDDEN: Administrative privileges required");

    const adminCtx = createMockCtx({ subject: adminUser.clerkId }, { user_admin: adminUser });
    const admin = await requireAdmin(adminCtx);
    expect(admin.role).toBe("admin");
  });

  it("protects listing ownership and stops IDOR tampering", async () => {
    const db = { listing_a: listingA, user_a: userA, user_b: userB, user_admin: adminUser };

    // Owner Alice can manage listing
    const ownerCtx = createMockCtx({ subject: userA.clerkId }, db);
    const ownerRes = await requireListingOwner(ownerCtx, "listing_a" as any);
    expect(ownerRes.listing._id).toBe("listing_a");

    // Bob attempting to manage Alice's listing is rejected (IDOR)
    const attackerCtx = createMockCtx({ subject: userB.clerkId }, db);
    await expect(requireListingOwner(attackerCtx, "listing_a" as any)).rejects.toThrow(
      "FORBIDDEN: You do not have permission to manage this listing"
    );

    // Platform Admin can manage any listing
    const adminCtx = createMockCtx({ subject: adminUser.clerkId }, db);
    const adminRes = await requireListingOwner(adminCtx, "listing_a" as any);
    expect(adminRes.listing._id).toBe("listing_a");
  });

  it("verifies borrower and lender roles on requests and loans", async () => {
    const db = {
      user_a: userA,
      user_b: userB,
      user_admin: adminUser,
      req_1: requestBtoA,
      loan_1: loanBtoA,
    };

    const aliceCtx = createMockCtx({ subject: userA.clerkId }, db);
    const bobCtx = createMockCtx({ subject: userB.clerkId }, db);

    // Alice is lender, not borrower
    await expect(requireBorrower(aliceCtx, "req_1" as any)).rejects.toThrow("FORBIDDEN");
    const lenderCheck = await requireLender(aliceCtx, "req_1" as any);
    expect(lenderCheck.request._id).toBe("req_1");

    // Bob is borrower, not lender
    await expect(requireLender(bobCtx, "req_1" as any)).rejects.toThrow("FORBIDDEN");
    const borrowerCheck = await requireBorrower(bobCtx, "req_1" as any);
    expect(borrowerCheck.request._id).toBe("req_1");

    // Both Bob and Alice are authorized parties on the loan
    const loanPartyBob = await requireBorrowerOrLender(bobCtx, "loan_1" as any);
    expect(loanPartyBob.loan._id).toBe("loan_1");
    const loanPartyAlice = await requireBorrowerOrLender(aliceCtx, "loan_1" as any);
    expect(loanPartyAlice.loan._id).toBe("loan_1");
  });

  it("rejects seedInitialAdmin when CONVEX_ADMIN_SEED_SECRET is unconfigured or mismatched", async () => {
    const originalSecret = process.env.CONVEX_ADMIN_SEED_SECRET;
    delete process.env.CONVEX_ADMIN_SEED_SECRET;

    const ctx = {
      db: {
        query: vi.fn(),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    await expect(
      (seedInitialAdmin as any)._handler(ctx, {
        seedSecret: "some_secret",
        clerkId: "clerk_user_a",
      })
    ).rejects.toThrow("CONFIG_ERROR");

    process.env.CONVEX_ADMIN_SEED_SECRET = "super_test_secret_12345";

    await expect(
      (seedInitialAdmin as any)._handler(ctx, {
        seedSecret: "wrong_secret",
        clerkId: "clerk_user_a",
      })
    ).rejects.toThrow("FORBIDDEN");

    if (originalSecret) {
      process.env.CONVEX_ADMIN_SEED_SECRET = originalSecret;
    } else {
      delete process.env.CONVEX_ADMIN_SEED_SECRET;
    }
  });
});
