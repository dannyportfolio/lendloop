"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { X, Wrench, Loader2 } from "lucide-react";

const CATEGORIES = [
  "Power Tools",
  "Hand Tools",
  "Garden",
  "Kitchen",
  "Camping",
  "Woodworking",
  "Plumbing",
  "Electrical",
  "Automotive",
  "Other",
];

const CONDITIONS = [
  "Brand New",
  "Like New",
  "Good Condition",
  "Fair / Functional",
];

interface ListingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: {
    _id: Id<"listings">;
    name: string;
    category: string;
    condition: string;
    description: string;
    isAvailable: boolean;
  } | null;
}

export function ListingFormModal({
  isOpen,
  onClose,
  initialData,
}: ListingFormModalProps) {
  const createListing = useMutation(api.listings.createListing);
  const updateListing = useMutation(api.listings.updateListing);

  const [name, setName] = useState(initialData?.name || "");
  const [category, setCategory] = useState(initialData?.category || "Power Tools");
  const [condition, setCondition] = useState(initialData?.condition || "Good Condition");
  const [description, setDescription] = useState(initialData?.description || "");
  const [isAvailable, setIsAvailable] = useState(initialData?.isAvailable ?? true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (name.trim().length < 2) {
      setErrorMessage("Please enter a tool name (at least 2 characters).");
      return;
    }
    if (description.trim().length < 5) {
      setErrorMessage("Please provide a description (at least 5 characters).");
      return;
    }

    try {
      setIsSubmitting(true);
      if (initialData) {
        await updateListing({
          listingId: initialData._id,
          name: name.trim(),
          category,
          condition,
          description: description.trim(),
          isAvailable,
        });
      } else {
        await createListing({
          name: name.trim(),
          category,
          condition,
          description: description.trim(),
        });
      }
      onClose();
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to save tool listing."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="listing-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </div>
            <h2 id="listing-modal-title" className="text-lg font-bold text-slate-900">
              {initialData ? "Edit Tool Listing" : "List a Tool to Lend"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {errorMessage && (
            <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 border border-red-200">
              {errorMessage}
            </div>
          )}

          <div>
            <label htmlFor="tool-name" className="block text-xs font-semibold text-slate-700 mb-1">
              Tool Name <span className="text-red-500">*</span>
            </label>
            <input
              id="tool-name"
              type="text"
              required
              placeholder="e.g. DeWalt 20V Cordless Brushless Drill"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="tool-category" className="block text-xs font-semibold text-slate-700 mb-1">
                Category
              </label>
              <select
                id="tool-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="tool-condition" className="block text-xs font-semibold text-slate-700 mb-1">
                Condition
              </label>
              <select
                id="tool-condition"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {CONDITIONS.map((cond) => (
                  <option key={cond} value={cond}>
                    {cond}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label htmlFor="tool-description" className="block text-xs font-semibold text-slate-700 mb-1">
              Description & Accessories <span className="text-red-500">*</span>
            </label>
            <textarea
              id="tool-description"
              rows={3}
              required
              placeholder="Describe tool specifications, included batteries/bits, or safety instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {initialData && (
            <div className="flex items-center gap-2 pt-1">
              <input
                id="tool-available"
                type="checkbox"
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="tool-available" className="text-xs font-medium text-slate-700">
                Mark tool available for borrowing
              </label>
            </div>
          )}

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
              <span>{initialData ? "Save Changes" : "Publish Listing"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
