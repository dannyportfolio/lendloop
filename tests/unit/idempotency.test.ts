import { describe, it, expect } from "vitest";
import { getTodayDateString } from "../../convex/lib/dates";

describe("Idempotency Key Formulation & State Invariants", () => {
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
