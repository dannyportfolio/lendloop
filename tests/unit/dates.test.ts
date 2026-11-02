import { describe, it, expect } from "vitest";
import {
  isValidDateString,
  getTodayDateString,
  validateBorrowDateRange,
  isLoanOverdue,
} from "../../convex/lib/dates";

describe("Date Validation Utilities", () => {
  it("validates correct ISO YYYY-MM-DD date strings", () => {
    expect(isValidDateString("2026-11-02")).toBe(true);
    expect(isValidDateString("2026-02-28")).toBe(true);
    expect(isValidDateString("invalid")).toBe(false);
    expect(isValidDateString("2026-13-01")).toBe(false);
    expect(isValidDateString("2026-02-31")).toBe(false);
    expect(isValidDateString("")).toBe(false);
  });

  it("produces standard UTC today date string", () => {
    const fixedDate = new Date("2026-11-02T12:00:00Z");
    expect(getTodayDateString(fixedDate)).toBe("2026-11-02");
  });

  it("validates borrow date ranges correctly", () => {
    const today = "2026-11-02";

    // Valid range starting today
    const validResult = validateBorrowDateRange("2026-11-02", "2026-11-05", today);
    expect(validResult.valid).toBe(true);

    // Past start date rejected
    const pastResult = validateBorrowDateRange("2026-11-01", "2026-11-05", today);
    expect(pastResult.valid).toBe(false);
    expect(pastResult.error).toContain("past");

    // End date before start date rejected
    const invertedResult = validateBorrowDateRange("2026-11-05", "2026-11-03", today);
    expect(invertedResult.valid).toBe(false);
    expect(invertedResult.error).toContain("on or after");

    // Range exceeding 60 days rejected
    const longResult = validateBorrowDateRange("2026-11-02", "2027-02-01", today);
    expect(longResult.valid).toBe(false);
    expect(longResult.error).toContain("60 days");
  });

  it("identifies overdue loans accurately", () => {
    const today = "2026-11-05";
    expect(isLoanOverdue("2026-11-04", today)).toBe(true);
    expect(isLoanOverdue("2026-11-05", today)).toBe(false);
    expect(isLoanOverdue("2026-11-06", today)).toBe(false);
  });
});
