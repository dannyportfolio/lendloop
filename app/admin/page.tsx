"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Navbar } from "@/components/shared/Navbar";
import { Footer } from "@/components/shared/Footer";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import {
  ShieldAlert,
  ShieldCheck,
  Wrench,
  Clock,
  Trash2,
  ArrowLeft,
  Users,
  RotateCcw,
} from "lucide-react";

interface AdminLoanItem {
  _id: Id<"loans">;
  listingId: Id<"listings">;
  toolName: string;
  category: string;
  borrowerName: string;
  borrowerEmail?: string;
  lenderName: string;
  lenderEmail?: string;
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

interface AdminListingItem {
  _id: Id<"listings">;
  ownerId: Id<"users">;
  name: string;
  category: string;
  condition: string;
  description: string;
  isAvailable: boolean;
  isRemoved: boolean;
  createdAt: number;
  owner: {
    _id?: Id<"users">;
    name: string;
    email?: string;
    isTrustedLender: boolean;
  };
}

interface AdminUserItem {
  _id: Id<"users">;
  clerkId: string;
  name: string;
  email: string;
  role: "user" | "admin";
  isTrustedLender: boolean;
  createdAt: number;
}

type AdminTab = "loans" | "listings" | "users";

export default function AdminPage() {
  const viewer = useQuery(api.users.getViewer);
  const allLoans = useQuery(api.loans.getAllLoansAdmin);
  const allListings = useQuery(api.listings.getAllListingsAdmin);
  const allUsers = useQuery(api.users.getAllUsersAdmin);

  const adminRemoveListing = useMutation(api.listings.adminRemoveListing);
  const adminRestoreListing = useMutation(api.listings.adminRestoreListing);
  const setTrustedLender = useMutation(api.users.setTrustedLender);

  const [activeTab, setActiveTab] = useState<AdminTab>("loans");
  const [actionError, setActionError] = useState<string | null>(null);

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

  // Guard: If viewer is loaded and not admin
  if (viewer && viewer.role !== "admin") {
    return (
      <div className="flex min-h-screen flex-col bg-slate-50">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-xl border border-red-200 bg-white p-8 text-center shadow-xs">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 mx-auto mb-4">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Access Denied</h1>
            <p className="mt-2 text-sm text-slate-600">
              Administrative privileges are strictly enforced server-side. Your account does not have permission to access this portal.
            </p>
            <div className="mt-6">
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Return to Dashboard</span>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const handleAdminRemoveListing = (listingId: Id<"listings">, toolName: string) => {
    setActionError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Administrative Removal",
      message: `Are you sure you want to administratively remove "${toolName}"? This action will be recorded in the security audit log.`,
      onConfirm: async () => {
        try {
          await adminRemoveListing({
            listingId,
            reason: "Administrative moderation policy",
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Failed to remove listing");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleAdminRestoreListing = (listingId: Id<"listings">, toolName: string) => {
    setActionError(null);
    setConfirmDialog({
      isOpen: true,
      title: "Restore Tool Listing",
      message: `Are you sure you want to restore "${toolName}"? The tool will become available in the directory again.`,
      onConfirm: async () => {
        try {
          await adminRestoreListing({ listingId });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Failed to restore listing");
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleToggleTrusted = async (userId: Id<"users">, currentStatus: boolean, userName: string) => {
    setActionError(null);
    const nextStatus = !currentStatus;
    setConfirmDialog({
      isOpen: true,
      title: nextStatus ? "Confer Trusted Lender Status?" : "Revoke Trusted Lender Status?",
      message: nextStatus
        ? `Mark ${userName} as a Trusted Lender? Their listings will display a verified trust badge.`
        : `Revoke Trusted Lender badge from ${userName}?`,
      onConfirm: async () => {
        try {
          await setTrustedLender({
            userId,
            isTrusted: nextStatus,
          });
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        } catch (err: unknown) {
          setActionError(err instanceof Error ? err.message : "Failed to update trusted lender status");
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
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
            <div>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-700">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  Platform Administration
                </h1>
              </div>
              <p className="mt-1 text-sm text-slate-500">
                Global loan monitoring, tool moderation, and community trust management.
              </p>
            </div>

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to User Dashboard</span>
            </Link>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 mt-6 gap-6">
            <button
              onClick={() => setActiveTab("loans")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "loans"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Clock className="h-4 w-4" />
              <span>All Loans Platform-Wide</span>
              {allLoans && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {allLoans.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("listings")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "listings"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Wrench className="h-4 w-4" />
              <span>Listing Moderation</span>
              {allListings && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {allListings.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("users")}
              className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition ${
                activeTab === "users"
                  ? "border-purple-600 text-purple-700"
                  : "border-transparent text-slate-600 hover:text-slate-900"
              }`}
            >
              <Users className="h-4 w-4" />
              <span>Community & Trusted Lenders</span>
              {allUsers && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700 font-medium">
                  {allUsers.length}
                </span>
              )}
            </button>
          </div>

          {actionError && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between">
              <span>{actionError}</span>
              <button
                onClick={() => setActionError(null)}
                className="text-xs font-semibold text-red-800 underline hover:no-underline ml-4"
              >
                Dismiss
              </button>
            </div>
          )}

          {/* TAB 1: ALL LOANS */}
          {activeTab === "loans" && (
            <div className="py-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                    <tr>
                      <th scope="col" className="px-5 py-3">Tool</th>
                      <th scope="col" className="px-5 py-3">Borrower</th>
                      <th scope="col" className="px-5 py-3">Lender</th>
                      <th scope="col" className="px-5 py-3">Due Date</th>
                      <th scope="col" className="px-5 py-3">Status</th>
                      <th scope="col" className="px-5 py-3">Automation / Reminders</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!allLoans ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                          Loading global loan registry...
                        </td>
                      </tr>
                    ) : allLoans.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                          No loans recorded in platform database yet.
                        </td>
                      </tr>
                    ) : (
                      allLoans.map((loan: AdminLoanItem) => (
                        <tr key={loan._id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {loan.toolName}
                          </td>
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-medium text-slate-800">{loan.borrowerName}</p>
                              <p className="text-xs text-slate-400">{loan.borrowerEmail}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-medium text-slate-800">{loan.lenderName}</p>
                              <p className="text-xs text-slate-400">{loan.lenderEmail}</p>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-medium text-slate-700">
                            {loan.dueDate}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                loan.status === "active"
                                  ? "bg-blue-100 text-blue-800"
                                  : loan.status === "overdue"
                                  ? "bg-red-100 text-red-800 font-bold"
                                  : "bg-emerald-100 text-emerald-800"
                              }`}
                            >
                              {loan.status.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {loan.latestReminder ? (
                              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
                                Reminder sent {new Date(loan.latestReminder.timestamp).toLocaleDateString()}
                              </span>
                            ) : loan.status === "active" ? (
                              <span className="text-xs text-slate-400">Scheduled Daily Check</span>
                            ) : (
                              <span className="text-xs text-slate-400">None</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: LISTING MODERATION */}
          {activeTab === "listings" && (
            <div className="py-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                    <tr>
                      <th scope="col" className="px-5 py-3">Tool Name</th>
                      <th scope="col" className="px-5 py-3">Category</th>
                      <th scope="col" className="px-5 py-3">Condition</th>
                      <th scope="col" className="px-5 py-3">Owner</th>
                      <th scope="col" className="px-5 py-3">Status</th>
                      <th scope="col" className="px-5 py-3 text-right">Moderation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!allListings ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                          Loading listings...
                        </td>
                      </tr>
                    ) : allListings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-xs text-slate-500">
                          No tool listings found in system.
                        </td>
                      </tr>
                    ) : (
                      allListings.map((listing: AdminListingItem) => (
                        <tr key={listing._id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {listing.name}
                          </td>
                          <td className="px-5 py-3.5">{listing.category}</td>
                          <td className="px-5 py-3.5">{listing.condition}</td>
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-medium text-slate-800">{listing.owner.name}</p>
                              {listing.owner.email && (
                                <p className="text-xs text-slate-400">{listing.owner.email}</p>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            {listing.isRemoved ? (
                              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                                Removed
                              </span>
                            ) : !listing.isAvailable ? (
                              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                                On Loan
                              </span>
                            ) : (
                              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                                Available
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {listing.isRemoved ? (
                              <button
                                onClick={() => handleAdminRestoreListing(listing._id, listing.name)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition"
                              >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Restore Listing</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleAdminRemoveListing(listing._id, listing.name)}
                                className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                <span>Remove Listing</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: COMMUNITY & TRUSTED LENDERS */}
          {activeTab === "users" && (
            <div className="py-6">
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-xs">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-700">
                    <tr>
                      <th scope="col" className="px-5 py-3">User Name</th>
                      <th scope="col" className="px-5 py-3">Email (Restricted)</th>
                      <th scope="col" className="px-5 py-3">Role</th>
                      <th scope="col" className="px-5 py-3">Trusted Status</th>
                      <th scope="col" className="px-5 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {!allUsers ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                          Loading user accounts...
                        </td>
                      </tr>
                    ) : allUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-xs text-slate-500">
                          No users provisioned.
                        </td>
                      </tr>
                    ) : (
                      allUsers.map((user: AdminUserItem) => (
                        <tr key={user._id} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3.5 font-bold text-slate-900">
                            {user.name}
                          </td>
                          <td className="px-5 py-3.5 text-xs text-slate-600">
                            {user.email}
                          </td>
                          <td className="px-5 py-3.5">
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                user.role === "admin"
                                  ? "bg-purple-100 text-purple-800"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {user.role.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {user.isTrustedLender ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700">
                                <ShieldCheck className="h-4 w-4 text-blue-600" />
                                Trusted Lender
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 font-medium">Standard</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() =>
                                handleToggleTrusted(user._id, user.isTrustedLender, user.name)
                              }
                              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                                user.isTrustedLender
                                  ? "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                  : "bg-blue-600 text-white shadow-xs hover:bg-blue-700"
                              }`}
                            >
                              <ShieldCheck className="h-3.5 w-3.5" />
                              <span>{user.isTrustedLender ? "Revoke Trust" : "Mark as Trusted"}</span>
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />

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
