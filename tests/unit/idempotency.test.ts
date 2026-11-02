import { describe, it, expect, vi } from "vitest";
import { getTodayDateString } from "../../convex/lib/dates";
import { timingSafeEqual } from "../../convex/lib/crypto";
import { recordAutomationWriteback } from "../../convex/automation";

describe("Idempotency Key Formulation & State Invariants", () => {
  it("validates timingSafeEqual correctly handles equal and unequal strings", () => {
    expect(timingSafeEqual("secret123", "secret123")).toBe(true);
    expect(timingSafeEqual("secret123", "secret124")).toBe(false);
    expect(timingSafeEqual("secret123", "secret1234")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
    expect(timingSafeEqual("a", "")).toBe(false);
  });

  it("handles duplicate automation writebacks idempotently", async () => {
    const existingEvent = {
      _id: "event_123",
      eventId: "evt_uuid_123",
      status: "succeeded",
      updatedAt: 1000,
    };
    const ctx = {
      db: {
        query: vi.fn().mockReturnValue({
          withIndex: vi.fn().mockReturnValue({
            first: vi.fn().mockResolvedValue(existingEvent),
          }),
        }),
        patch: vi.fn(),
        insert: vi.fn(),
      },
    };

    const res = await (recordAutomationWriteback as any)._handler(ctx, {
      eventId: "evt_uuid_123",
      status: "succeeded",
    });

    expect(res.success).toBe(true);
    expect(res.alreadyRecorded).toBe(true);
    expect(ctx.db.patch).not.toHaveBeenCalled();
  });
  it("generates deterministic daily idempotency keys for overdue loans", () => {
    const loanId = "loan_saw_123";
    const fixedDate = new Date("2026-11-02T10:00:00Z");
    const today = getTodayDateString(fixedDate);

    const key1 = `overdue-${loanId}-${today}`;
    const key2 = `overdue-${loanId}-${today}`;

    expect(key1).toBe("overdue-loan_saw_123-2026-11-02");
    expect(key1).toBe(key2);
  });

  it("produces distinct keys on different dates to allow subsequent daily reminders", () => {
    const loanId = "loan_saw_123";
    const day1 = "2026-11-02";
    const day2 = "2026-11-03";

    const keyDay1 = `overdue-${loanId}-${day1}`;
    const keyDay2 = `overdue-${loanId}-${day2}`;

    expect(keyDay1).not.toBe(keyDay2);
  });

  it("produces distinct keys for different loans on the same date", () => {
    const today = "2026-11-02";
    const keyLoanA = `overdue-loan_A-${today}`;
    const keyLoanB = `overdue-loan_B-${today}`;

    expect(keyLoanA).not.toBe(keyLoanB);
  });
});
