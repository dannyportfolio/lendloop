"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Calendar, Loader2, CheckCircle2 } from "lucide-react";
import { getTodayDateString, validateBorrowDateRange } from "@/convex/lib/dates";

interface BorrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  tool: {
    _id: Id<"listings">;
    name: string;
    ownerName: string;
  };
  onSuccess?: () => void;
}

export function BorrowModal({
  isOpen,
  onClose,
  tool,
  onSuccess,
}: BorrowModalProps) {
  const createRequest = useMutation(api.requests.createBorrowRequest);

  const todayStr = getTodayDateString();
  // Default to 3-day loan period
  const defaultEndDate = new Date();
  defaultEndDate.setDate(defaultEndDate.getDate() + 3);
  const defaultEndStr = getTodayDateString(defaultEndDate);

  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(defaultEndStr);
  const [note, setNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const validation = validateBorrowDateRange(startDate, endDate, todayStr);
    if (!validation.valid) {
      setErrorMessage(validation.error || "Invalid borrow dates.");
      return;
    }

    try {
      setIsSubmitting(true);
      await createRequest({
        listingId: tool._id,
        startDate,
        endDate,
        note: note.trim() || undefined,
      });

      setIsSuccess(true);
      if (onSuccess) onSuccess();
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
      }, 1200);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to submit borrow request."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="borrow-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Calendar className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <h2 id="borrow-modal-title" className="text-base font-bold text-slate-900 leading-tight">
                Request to Borrow
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {tool.name} from {tool.ownerName}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isSuccess ? (
          <div className="py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mx-auto mb-3">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              Request Sent!
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              We notified {tool.ownerName}. You will see it under your active requests.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-5 space-y-4">
            {errorMessage && (
              <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="borrow-start" className="block text-xs font-semibold text-slate-700 mb-1">
                  Start Date
                </label>
                <input
                  id="borrow-start"
                  type="date"
                  required
                  min={todayStr}
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div>
                <label htmlFor="borrow-end" className="block text-xs font-semibold text-slate-700 mb-1">
                  Return Due Date
                </label>
                <input
                  id="borrow-end"
                  type="date"
                  required
                  min={startDate || todayStr}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="borrow-note" className="block text-xs font-semibold text-slate-700 mb-1">
                Note for Lender (Optional)
              </label>
              <textarea
                id="borrow-note"
                rows={2}
                placeholder="What project are you tackling? When can you pick it up?"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                <span>Send Request</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
