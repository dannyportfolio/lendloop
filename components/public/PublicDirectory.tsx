"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Search, Shield, Wrench } from "lucide-react";

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

const CATEGORIES = [
  "All",
  "Power Tools",
  "Hand Tools",
  "Lawn & Garden",
  "Woodworking",
  "Plumbing",
  "Electrical",
  "Automotive",
];

export function PublicDirectory() {
  const { isSignedIn } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const listings = useQuery(api.listings.getPublicListings, {
    category: selectedCategory === "All" ? undefined : selectedCategory,
    searchQuery: searchQuery.trim().length > 0 ? searchQuery : undefined,
  });

  return (
    <section id="tools" className="py-16 sm:py-20 bg-slate-50 scroll-mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Available Neighborhood Tools
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Browse equipment currently offered by neighbors in your area.
            </p>
          </div>

          {/* Search bar */}
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search tools or brands..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6 scrollbar-none">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-semibold transition ${
                selectedCategory === cat
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100 hover:text-slate-900"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Listings Grid */}
        {listings === undefined ? (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-56 rounded-xl border border-slate-200 bg-white p-6 animate-pulse"
              >
                <div className="h-4 bg-slate-200 rounded w-1/3 mb-4" />
                <div className="h-6 bg-slate-200 rounded w-2/3 mb-3" />
                <div className="h-4 bg-slate-100 rounded w-full mb-2" />
                <div className="h-4 bg-slate-100 rounded w-4/5 mb-6" />
                <div className="h-8 bg-slate-200 rounded w-full" />
              </div>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <Wrench className="mx-auto h-10 w-10 text-slate-400 mb-3" />
            <h3 className="text-base font-semibold text-slate-900">
              No tools found
            </h3>
            <p className="mt-1 text-sm text-slate-500 max-w-sm mx-auto">
              No tools match your current filter. Try selecting a different category or clearing your search term.
            </p>
            {(selectedCategory !== "All" || searchQuery.length > 0) && (
              <button
                onClick={() => {
                  setSelectedCategory("All");
                  setSearchQuery("");
                }}
                className="mt-4 inline-flex items-center text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((tool: PublicListingItem) => (
              <div
                key={tool._id}
                className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:border-slate-300 hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      {tool.category}
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                      Available
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 line-clamp-1">
                    {tool.name}
                  </h3>

                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Condition: <span className="text-slate-700">{tool.condition}</span>
                  </p>

                  <p className="mt-3 text-sm text-slate-600 line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-700">
                      Lender: {tool.owner.name}
                    </span>
                    {tool.owner.isTrustedLender && (
                      <span
                        title="Verified Trusted Lender"
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200"
                      >
                        <Shield className="h-3 w-3 text-blue-600" />
                        Trusted
                      </span>
                    )}
                  </div>

                  <Link
                    href={isSignedIn ? "/dashboard" : "/sign-in"}
                    className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    {isSignedIn ? "Request Tool" : "Sign In to Borrow"}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
