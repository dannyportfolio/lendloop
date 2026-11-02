/**
 * Date validation and utility functions for LendLoop.
 * Uses ISO 8601 YYYY-MM-DD strings for predictable timezone-independent date comparisons.
 */

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validates whether a given string is a valid ISO YYYY-MM-DD date.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || !DATE_REGEX.test(dateStr)) {
    return false;
  }
  const [year, month, day] = dateStr.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

/**
 * Returns today's date formatted as YYYY-MM-DD in UTC.
 */
export function getTodayDateString(referenceDate: Date = new Date()): string {
  const year = referenceDate.getUTCFullYear();
  const month = String(referenceDate.getUTCMonth() + 1).padStart(2, "0");
  const day = String(referenceDate.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Validates a requested borrow date range.
 * Rules:
 * 1. Both start and end dates must be valid ISO YYYY-MM-DD strings.
 * 2. Start date must be today or in the future.
 * 3. End date must be equal to or after start date.
 * 4. Maximum borrowing duration cannot exceed 60 days.
 */
export function validateBorrowDateRange(
  startDateStr: string,
  endDateStr: string,
  todayStr: string = getTodayDateString()
): { valid: boolean; error?: string } {
  if (!isValidDateString(startDateStr)) {
    return { valid: false, error: "Invalid start date format. Expected YYYY-MM-DD." };
  }
  if (!isValidDateString(endDateStr)) {
    return { valid: false, error: "Invalid end date format. Expected YYYY-MM-DD." };
  }
  if (startDateStr < todayStr) {
    return { valid: false, error: "Start date cannot be in the past." };
  }
  if (endDateStr < startDateStr) {
    return { valid: false, error: "End date must be on or after start date." };
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 60) {
    return { valid: false, error: "Borrow duration cannot exceed 60 days." };
  }

  return { valid: true };
}

/**
 * Determines whether a loan is overdue based on due date and reference date.
 */
export function isLoanOverdue(dueDateStr: string, todayStr: string = getTodayDateString()): boolean {
  if (!isValidDateString(dueDateStr)) return false;
  return dueDateStr < todayStr;
}
