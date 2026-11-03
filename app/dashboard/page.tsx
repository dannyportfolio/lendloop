"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ListingFormModal } from "@/components/listings/ListingFormModal";
import { BorrowModal } from "@/components/requests/BorrowModal";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  Wrench,
  Plus,
  Shield,
  Clock,
  RotateCcw,
  Search,
  Check,
  X,
  ShieldAlert,
} from "lucide-react";

interface PublicListingItem {
  _id: Id<"listings">;
  name: string;
  category: string;
  condition: string;
  description: string;
  isAvailable: boolean;
  createdAt: number;
  owner: {
    _id?: Id<"users">;
    name: string;
    isTrustedLender: boolean;
  };
}

interface ListingItem {
  _id: Id<"listings">;
  ownerId: Id<"users">;
  name: string;
  category: string;
  condition: string;
  description: string;
  isAvailable: boolean;
  createdAt: number;
}

interface SentRequestItem {
  _id: Id<"borrowRequests">;
  listingId: Id<"listings">;
  borrowerId: Id<"users">;
  lenderId: Id<"users">;
  startDate: string;
  endDate: string;
  status: string;
  note?: string;
  toolName: string;
  category: string;
  lenderName: string;
  isTrustedLender: boolean;
}

interface IncomingRequestItem {
  _id: Id<"borrowRequests">;
  listingId: Id<"listings">;
  borrowerId: Id<"users">;
  lenderId: Id<"users">;
  startDate: string;
  endDate: string;
  status: string;
  note?: string;
  toolName: string;
  category: string;
  borrowerName: string;
}

interface MyLoanItem {
  _id: Id<"loans">;
  listingId: Id<"listings">;
  toolName: string;
  category: string;
  borrowerId: Id<"users">;
  borrowerName: string;
  lenderId: Id<"users">;
  lenderName: string;
  isMyBorrow: boolean;
  isMyLend: boolean;
  startDate: string;
  dueDate: string;
  returnedAt?: number;
  status: string;
  createdAt: number;
  latestReminder?: {
    timestamp: number;
    deliveryStatus: "sent" | "failed";
    reminderType: string;
    dueDate: string;
  } | null;
}

type DashboardTab =
  | "catalog"
  | "my-listings"
  | "incoming-requests"
  | "my-requests"
  | "loans";

function formatReminderNotice(reminder?: {
  timestamp: number;
  deliveryStatus: "sent" | "failed";
  reminderType: string;
  dueDate: string;
} | null): string {
  if (!reminder) return "";
  const diffHours = Math.round((Date.now() - reminder.timestamp) / (1000 * 60 * 60));
  if (diffHours < 1) return "Overdue reminder sent just now";
  if (diffHours === 1) return "Overdue reminder sent 1 hour ago";
  if (diffHours < 24) return `Overdue reminder sent ${diffHours} hours ago`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Overdue reminder sent 1 day ago";
  return `Overdue reminder sent ${diffDays} days ago`;
}

export default function DashboardPage() {
  const viewer = useQuery(api.users.getViewer);
  const myListings = useQuery(api.listings.getMyListings);
  const catalogListings = useQuery(api.listings.getAuthenticatedCatalog, {});
  const incomingRequests = useQuery(api.requests.getIncomingRequests);
  const sentRequests = useQuery(api.requests.getMySentRequests);
  const myLoans = useQuery(api.loans.getMyLoans);

  const approveRequest = useMutation(api.requests.approveBorrowRequest);
  const declineRequest = useMutation(api.requests.declineBorrowRequest);
  const markReturned = useMutation(api.loans.markLoanReturned);
  const deleteListing = useMutation(api.listings.deleteListing);

  const [activeTab, setActiveTab] = useState<DashboardTab>("catalog");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  // Modals state
  const [isListingModalOpen, setIsListingModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<ListingItem | null>(null);

  const [borrowModalTool, setBorrowModalTool] = useState<{
    _id: Id<"listings">;
    name: string;
    ownerName: string;
  } | null>(null);

  // Destructive confirmation state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  const pendingIncomingCount =
    incomingRequests?.filter((r: IncomingRequestItem) => r.status === "pending").length || 0;

  const handleApproveRequest = async (requestId: Id<"borrowRequests">) => {
    setDashboardError(null);
    try {
      await approveRequest({ requestId });
    } catch (err: unknown) {
      setDashboardError(err instanceof Error ? err.message : "Failed to approve request");
    }
  };

  const handleDeclineRequest = (requestId: Id<"borrowRequests">, toolName: string) => {
    setDashboardError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Decline Borrow Request?",
      message: `Are you sure you want to decline the request for "${toolName}"? The borrower will be notified.`,
      onConfirm: async () => {
        try {
          await declineRequest({ requestId });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setDashboardError(err instanceof Error ? err.message : "Failed to decline request");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleDeleteListing = (listingId: Id<"listings">, toolName: string) => {
    setDashboardError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Remove Listing?",
      message: `Are you sure you want to remove "${toolName}"? Existing loans will remain in your history.`,
      onConfirm: async () => {
        try {
          await deleteListing({ listingId });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setDashboardError(err instanceof Error ? err.message : "Failed to remove listing");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleMarkReturned = (loanId: Id<"loans">, toolName: string) => {
    setDashboardError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Confirm Tool Return",
      message: `Confirm that "${toolName}" has been safely returned in functional condition?`,
      onConfirm: async () => {
        try {
          await markReturned({ loanId });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setDashboardError(err instanceof Error ? err.message : "Failed to mark tool as returned");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Navbar />

      <main className="flex-1 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          {/* Dashboard Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {viewer ? `Welcome, ${viewer.name}` : "Neighborhood Dashboard"}
                </h1>
                {viewer?.isTrustedLender && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700 border border-blue-200">
                    <Shield className="h-3 w-3 text-blue-600" />
                    Trusted Lender
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-500">
                Manage your shared tools, incoming borrow requests, and active loans.
              </p>
            </div>

            <div className="flex items-center gap-3">
              {viewer?.role === "admin" && (
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-purple-200 bg-purple-50 px-3.5 py-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100"
                >
                  <ShieldAlert className="h-4 w-4" />
                  <span>Admin Portal</span>
                </Link>
              )}
              <button
                onClick={() => {
                  setEditingListing(null);
                  setIsListingModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <Plus className="h-4 w-4" />
                <span>List a Tool</span>
              </button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-6 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === "catalog"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>All Tools</span>
            </button>

            <button
              onClick={() => setActiveTab("my-listings")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === "my-listings"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>My Listings</span>
              {myListings && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {myListings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("incoming-requests")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === "incoming-requests"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>Incoming Requests</span>
              {pendingIncomingCount > 0 && (
                <span className="rounded-full bg-blue-600 px-2 py-0.5 text-xs text-white font-bold">
                  {pendingIncomingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("my-requests")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === "my-requests"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>My Requests</span>
              {sentRequests && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {sentRequests.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("loans")}
              className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition whitespace-nowrap ${
                activeTab === "loans"
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              }`}
            >
              <span>My Loans</span>
              {myLoans && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {myLoans.filter((l: MyLoanItem) => l.status === "active" || l.status === "overdue").length}
                </span>
              )}
            </button>
          </div>

          {dashboardError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
              <span>{dashboardError}</span>
              <button
                onClick={() => setDashboardError(null)}
                className="text-xs font-semibold text-red-800 underline hover:no-underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: BROWSE CATALOG */}
          {activeTab === "catalog" && (
            <div className="py-6">
              <div className="flex items-center justify-between mb-6">
                <p className="text-sm text-slate-600">
                  Select any tool listed by your neighbors to submit a borrow request.
                </p>
                <div className="relative w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search tools..."
                    value={catalogSearch}
                    onChange={(e) => setCatalogSearch(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-1.5 text-xs text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>

              {!catalogListings ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-44 rounded-xl bg-slate-200 p-4" />
                  ))}
                </div>
              ) : catalogListings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Wrench className="mx-auto h-8 w-8 text-slate-400 mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No tools found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {catalogListings
                    .filter(
                      (tool: PublicListingItem) =>
                        catalogSearch.length === 0 ||
                        tool.name.toLowerCase().includes(catalogSearch.toLowerCase()) ||
                        tool.description.toLowerCase().includes(catalogSearch.toLowerCase())
                    )
                    .map((tool: PublicListingItem) => {
                      const isMyOwnTool = viewer && tool.owner._id === viewer._id;

                      return (
                        <div
                          key={tool._id}
                          className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                        >
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                                {tool.category}
                              </span>
                              <span className="text-xs text-slate-500">
                                {tool.condition}
                              </span>
                            </div>
                            <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                              {tool.name}
                            </h3>
                            <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                              {tool.description}
                            </p>
                          </div>

                          <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-600">
                                Lender: {tool.owner.name}
                              </span>
                              {tool.owner.isTrustedLender && (
                                <Shield className="h-3 w-3 text-blue-600" />
                              )}
                            </div>

                            {isMyOwnTool ? (
                              <span className="text-xs font-semibold text-slate-400">
                                (Your Listing)
                              </span>
                            ) : (
                              <button
                                onClick={() =>
                                  setBorrowModalTool({
                                    _id: tool._id,
                                    name: tool.name,
                                    ownerName: tool.owner.name,
                                  })
                                }
                                className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700"
                              >
                                Borrow Tool
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: MY LISTINGS */}
          {activeTab === "my-listings" && (
            <div className="py-6">
              {!myListings ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-44 rounded-xl bg-slate-200" />
                  ))}
                </div>
              ) : myListings.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Wrench className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <h3 className="text-base font-semibold text-slate-900">
                    No tools listed yet
                  </h3>
                  <p className="mt-1 text-xs text-slate-500 max-w-sm mx-auto">
                    Share equipment sitting idle in your shed or basement with verified neighbors.
                  </p>
                  <button
                    onClick={() => {
                      setEditingListing(null);
                      setIsListingModalOpen(true);
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>List your first tool</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {myListings.map((listing: ListingItem) => (
                    <div
                      key={listing._id}
                      className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                            {listing.category}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              listing.isAvailable
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-amber-50 text-amber-700 border border-amber-200"
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${
                                listing.isAvailable ? "bg-emerald-600" : "bg-amber-600"
                              }`}
                            />
                            {listing.isAvailable ? "Available" : "On Loan / Busy"}
                          </span>
                        </div>

                        <h3 className="text-base font-bold text-slate-900 line-clamp-1">
                          {listing.name}
                        </h3>
                        <p className="mt-1 text-xs text-slate-500 font-medium">
                          Condition: {listing.condition}
                        </p>
                        <p className="mt-2 text-xs text-slate-600 line-clamp-2">
                          {listing.description}
                        </p>
                      </div>

                      <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                        <button
                          onClick={() => {
                            setEditingListing(listing);
                            setIsListingModalOpen(true);
                          }}
                          className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteListing(listing._id, listing.name)}
                          className="rounded-md border border-red-200 bg-red-50/50 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: INCOMING BORROW REQUESTS */}
          {activeTab === "incoming-requests" && (
            <div className="py-6">
              <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Incoming Requests (Requests to borrow your tools)
                </h2>
                {pendingIncomingCount > 0 && (
                  <span className="rounded-full bg-blue-600 text-white text-xs font-bold px-2 py-0.5">
                    {pendingIncomingCount} pending
                  </span>
                )}
              </div>

              {!incomingRequests ? (
                <div className="h-28 rounded-xl bg-slate-200 animate-pulse" />
              ) : incomingRequests.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  No incoming borrow requests at the moment.
                </div>
              ) : (
                <div className="space-y-3">
                  {incomingRequests.map((req: IncomingRequestItem) => (
                    <div
                      key={req._id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">
                            {req.toolName}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              req.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : req.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Requested by <strong className="text-slate-800">{req.borrowerName}</strong> for dates{" "}
                          <span className="font-semibold text-slate-900">
                            {req.startDate} to {req.endDate}
                          </span>
                        </p>
                        {req.note && (
                          <p className="mt-1 text-xs text-slate-500 italic">
                            &ldquo;{req.note}&rdquo;
                          </p>
                        )}
                      </div>

                      {req.status === "pending" && (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => handleApproveRequest(req._id)}
                            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                          >
                            <Check className="h-3.5 w-3.5" />
                            <span>Approve</span>
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(req._id, req.toolName)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-red-600"
                          >
                            <X className="h-3.5 w-3.5" />
                            <span>Decline</span>
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: MY SENT REQUESTS */}
          {activeTab === "my-requests" && (
            <div className="py-6">
              <h2 className="text-lg font-bold text-slate-900 mb-4">
                My Requests (Tools you requested from neighbors)
              </h2>

              {!sentRequests ? (
                <div className="h-28 rounded-xl bg-slate-200 animate-pulse" />
              ) : sentRequests.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-xs text-slate-500">
                  You haven&apos;t sent any borrow requests yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {sentRequests.map((req: SentRequestItem) => (
                    <div
                      key={req._id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-bold text-slate-900">
                            {req.toolName}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                              req.status === "pending"
                                ? "bg-amber-100 text-amber-800"
                                : req.status === "approved"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {req.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600">
                          Lender: <strong className="text-slate-800">{req.lenderName}</strong> | Dates:{" "}
                          {req.startDate} to {req.endDate}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MY LOANS */}
          {activeTab === "loans" && (
            <div className="py-6">
              {!myLoans ? (
                <div className="h-44 rounded-xl bg-slate-200 animate-pulse" />
              ) : myLoans.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
                  <Clock className="mx-auto h-10 w-10 text-slate-400 mb-3" />
                  <h3 className="text-base font-semibold text-slate-900">
                    No active or past loans
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    When you borrow a tool or lend one out, your active loan tracking and due dates will show up here.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {myLoans.map((loan: MyLoanItem) => (
                    <div
                      key={loan._id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-base font-bold text-slate-900">
                            {loan.toolName}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              loan.status === "active"
                                ? "bg-blue-100 text-blue-800"
                                : loan.status === "overdue"
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {loan.status.toUpperCase()}
                          </span>
                          <span className="text-xs text-slate-500 font-medium">
                            {loan.isMyBorrow ? "(You Borrowed)" : "(You Lent)"}
                          </span>
                        </div>

                        <p className="text-xs text-slate-600">
                          {loan.isMyBorrow
                            ? `Lender: ${loan.lenderName}`
                            : `Borrower: ${loan.borrowerName}`}
                          {" | "}
                          Scheduled Due:{" "}
                          <strong
                            className={
                              loan.status === "overdue" ? "text-red-600 font-bold" : "text-slate-900"
                            }
                          >
                            {loan.dueDate}
                          </strong>
                        </p>

                        {/* Recent Automation Activity (Bonus Requirement) */}
                        {loan.latestReminder ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 w-fit">
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>
                              🤖 Automation: {formatReminderNotice(loan.latestReminder)}
                            </span>
                          </div>
                        ) : loan.status === "active" ? (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                            <span>Automated overdue tracking active</span>
                          </div>
                        ) : null}
                      </div>

                      {loan.status !== "returned" && (
                        <button
                          onClick={() => handleMarkReturned(loan._id, loan.toolName)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          <span>Mark as Returned</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <Footer />

      {/* Modals & Dialogs */}
      <ListingFormModal
        isOpen={isListingModalOpen}
        onClose={() => {
          setIsListingModalOpen(false);
          setEditingListing(null);
        }}
        initialData={editingListing}
      />

      {borrowModalTool && (
        <BorrowModal
          isOpen={true}
          onClose={() => setBorrowModalTool(null)}
          tool={borrowModalTool}
        />
      )}

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        isDestructive={true}
      />
    </div>
  );
}
