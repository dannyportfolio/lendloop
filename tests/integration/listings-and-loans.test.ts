import { describe, it, expect, vi } from "vitest";
import {
  createListing,
  updateListing,
  deleteListing,
  adminRemoveListing,
} from "../../convex/listings";
import {
  createBorrowRequest,
  approveBorrowRequest,
  declineBorrowRequest,
} from "../../convex/requests";
import { markLoanReturned } from "../../convex/loans";

describe("Listings and Loan Lifecycle Integration", () => {
  const alice = {
    _id: "users_alice" as any,
    clerkId: "clerk_alice",
    name: "Alice Owner",
    email: "alice@example.com",
    role: "user" as const,
    isTrustedLender: true,
  };

  const bob = {
    _id: "users_bob" as any,
    clerkId: "clerk_bob",
    name: "Bob Borrower",
    email: "bob@example.com",
    role: "user" as const,
    isTrustedLender: false,
  };

  const admin = {
    _id: "users_admin" as any,
    clerkId: "clerk_admin",
    name: "Admin",
    email: "admin@example.com",
    role: "admin" as const,
    isTrustedLender: true,
  };

  function createMockConvexContext(currentUser: any, initialStore: Record<string, any> = {}) {
    const store = new Map<string, any>(Object.entries(initialStore));

    return {
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue(
          currentUser ? { subject: currentUser.clerkId } : null
        ),
      },
      db: {
        get: vi.fn().mockImplementation(async (id) => store.get(String(id)) || null),
        insert: vi.fn().mockImplementation(async (table, doc) => {
          const id = `${table}_${Math.random().toString(36).substring(2, 9)}`;
          const fullDoc = { _id: id, ...doc };
          store.set(id, fullDoc);
          return id;
        }),
        patch: vi.fn().mockImplementation(async (id, updates) => {
          const existing = store.get(String(id));
          if (existing) {
            store.set(String(id), { ...existing, ...updates });
          }
        }),
        query: vi.fn().mockImplementation((table) => {
          return {
            withIndex: vi.fn().mockImplementation((indexName, queryFn) => {
              const eqConditions: Array<{ field: string; value: any }> = [];
              const q = {
                eq: (field: string, value: any) => {
                  eqConditions.push({ field, value });
                  return q;
                },
              };
              if (queryFn) queryFn(q);
              const matched = Array.from(store.values()).filter((d) => {
                if (!d._id.startsWith(table)) return false;
                for (const cond of eqConditions) {
                  if (d[cond.field] !== cond.value) return false;
                }
                return true;
              });
              return {
                collect: vi.fn().mockResolvedValue(matched),
                first: vi.fn().mockResolvedValue(matched[0] || null),
              };
            }),
            collect: vi.fn().mockImplementation(async () =>
              Array.from(store.values()).filter((d) => d._id.startsWith(table))
            ),
          };
        }),
      },
      _store: store,
    };
  }

  it("allows user to create listing with server-enforced ownerId", async () => {
    const ctx = createMockConvexContext(alice, { users_alice: alice });

    const listingId = await (createListing as any)._handler(ctx, {
      name: "Table Saw",
      category: "Woodworking",
      condition: "Like New",
      description: "10-inch portable jobsite table saw with folding stand.",
    });

    expect(listingId).toBeDefined();
    const stored = ctx._store.get(listingId);
    expect(stored.name).toBe("Table Saw");
    expect(stored.ownerId).toBe("users_alice"); // Resolved server-side
    expect(stored.isAvailable).toBe(true);
  });

  it("prevents borrowing one's own tool", async () => {
    const listing = {
      _id: "listings_1",
      ownerId: "users_alice",
      name: "Drill",
      isAvailable: true,
      isRemoved: false,
    };
    const ctx = createMockConvexContext(alice, {
      users_alice: alice,
      listings_1: listing,
    });

    await expect(
      (createBorrowRequest as any)._handler(ctx, {
        listingId: "listings_1",
        startDate: "2026-11-10",
        endDate: "2026-11-15",
      })
    ).rejects.toThrow("INVALID_ACTION: You cannot borrow your own tool");
  });

  it("handles the complete borrow request approval and loan creation cycle", async () => {
    const listing = {
      _id: "listings_saw",
      ownerId: "users_alice",
      name: "Chop Saw",
      isAvailable: true,
      isRemoved: false,
    };

    // Step 1: Bob requests the tool
    const bobCtx = createMockConvexContext(bob, {
      users_bob: bob,
      users_alice: alice,
      listings_saw: listing,
    });

    const requestId = await (createBorrowRequest as any)._handler(bobCtx, {
      listingId: "listings_saw",
      startDate: "2026-11-10",
      endDate: "2026-11-15",
      note: "Need it for weekend deck repair.",
    });

    expect(requestId).toBeDefined();
    const createdReq = bobCtx._store.get(requestId);
    expect(createdReq.status).toBe("pending");
    expect(createdReq.borrowerId).toBe("users_bob");

    // Check that outbox event was recorded atomically
    const outboxEvents = Array.from(bobCtx._store.values()).filter((d) =>
      d._id.startsWith("automationEvents")
    );
    expect(outboxEvents.length).toBe(1);
    expect(outboxEvents[0].eventType).toBe("request.created");

    // Step 2: Alice approves the request
    const aliceCtx = {
      ...bobCtx,
      auth: {
        getUserIdentity: vi.fn().mockResolvedValue({ subject: alice.clerkId }),
      },
    };

    const approvalResult = await (approveBorrowRequest as any)._handler(aliceCtx, {
      requestId,
    });

    expect(approvalResult.success).toBe(true);
    expect(approvalResult.loanId).toBeDefined();

    // Verify listing is now unavailable
    const updatedListing = bobCtx._store.get("listings_saw");
    expect(updatedListing.isAvailable).toBe(false);

    // Verify loan was created
    const createdLoan = bobCtx._store.get(approvalResult.loanId);
    expect(createdLoan.status).toBe("active");
    expect(createdLoan.borrowerId).toBe("users_bob");
    expect(createdLoan.lenderId).toBe("users_alice");

    // Step 3: Bob marks loan returned
    const returnResult = await (markLoanReturned as any)._handler(bobCtx, {
      loanId: approvalResult.loanId,
    });

    expect(returnResult.success).toBe(true);
    const returnedLoan = bobCtx._store.get(approvalResult.loanId);
    expect(returnedLoan.status).toBe("returned");
    expect(returnedLoan.returnedAt).toBeDefined();

    // Verify listing is available again
    const finalListing = bobCtx._store.get("listings_saw");
    expect(finalListing.isAvailable).toBe(true);
  });

  it("allows admin to remove any listing and writes audit log", async () => {
    const listing = {
      _id: "listings_unsafe",
      ownerId: "users_bob",
      name: "Faulty Chainsaw",
      isAvailable: true,
      isRemoved: false,
    };
    const adminCtx = createMockConvexContext(admin, {
      users_admin: admin,
      listings_unsafe: listing,
    });

    const result = await (adminRemoveListing as any)._handler(adminCtx, {
      listingId: "listings_unsafe",
      reason: "Damaged blade safety hazard",
    });

    expect(result.success).toBe(true);
    const updated = adminCtx._store.get("listings_unsafe");
    expect(updated.isRemoved).toBe(true);
    expect(updated.isAvailable).toBe(false);

    const auditLogs = Array.from(adminCtx._store.values()).filter((d) =>
      d._id.startsWith("auditLogs")
    );
    expect(auditLogs.length).toBe(1);
    expect(auditLogs[0].action).toBe("admin.remove_listing");
  });

  it("allows owner to update and soft-delete their listing", async () => {
    const listing = {
      _id: "listings_ladder",
      ownerId: "users_alice",
      name: "Telescoping Ladder",
      category: "Hand Tools",
      condition: "Good Condition",
      description: "12.5ft aluminum telescoping ladder.",
      isAvailable: true,
      isRemoved: false,
    };
    const aliceCtx = createMockConvexContext(alice, {
      users_alice: alice,
      listings_ladder: listing,
    });

    const updateRes = await (updateListing as any)._handler(aliceCtx, {
      listingId: "listings_ladder",
      name: "Heavy Duty Telescoping Ladder",
      category: "Hand Tools",
      condition: "Like New",
      description: "Updated description for 12.5ft ladder with stabilizer bar.",
      isAvailable: true,
    });
    expect(updateRes.success).toBe(true);
    expect(aliceCtx._store.get("listings_ladder").name).toBe("Heavy Duty Telescoping Ladder");

    const deleteRes = await (deleteListing as any)._handler(aliceCtx, {
      listingId: "listings_ladder",
    });
    expect(deleteRes.success).toBe(true);
    expect(aliceCtx._store.get("listings_ladder").isRemoved).toBe(true);
    expect(aliceCtx._store.get("listings_ladder").isAvailable).toBe(false);
  });

  it("handles declining a borrow request and logs outbox event", async () => {
    const listing = {
      _id: "listings_mower",
      ownerId: "users_alice",
      name: "Lawn Mower",
      isAvailable: true,
      isRemoved: false,
    };
    const req = {
      _id: "borrowRequests_mower",
      listingId: "listings_mower",
      borrowerId: "users_bob",
      lenderId: "users_alice",
      startDate: "2026-11-20",
      endDate: "2026-11-22",
      status: "pending",
    };
    const aliceCtx = createMockConvexContext(alice, {
      users_alice: alice,
      users_bob: bob,
      listings_mower: listing,
      borrowRequests_mower: req,
    });

    const declineRes = await (declineBorrowRequest as any)._handler(aliceCtx, {
      requestId: "borrowRequests_mower",
    });
    expect(declineRes.success).toBe(true);
    expect(aliceCtx._store.get("borrowRequests_mower").status).toBe("declined");

    const events = Array.from(aliceCtx._store.values()).filter((d) =>
      d._id.startsWith("automationEvents")
    );
    expect(events.some((e) => e.eventType === "request.status_changed")).toBe(true);
  });
});
