"use client";

import Link from "next/link";
import { useAuth, UserButton } from "@clerk/nextjs";
import { Wrench, ArrowRight } from "lucide-react";

export function Navbar() {
  const { isSignedIn } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-slate-900 transition-opacity hover:opacity-90"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white shadow-sm">
            <Wrench className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight leading-none">
              LendLoop
            </span>
            <span className="text-xs text-slate-500 font-medium leading-tight">
              Neighborhood Tool Lending
            </span>
          </div>
        </Link>

        <nav aria-label="Main Navigation" className="hidden md:flex items-center gap-6">
          <Link
            href="/#tools"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            Tool Directory
          </Link>
          <Link
            href="/#how-it-works"
            className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
          >
            How it Works
          </Link>
          {isSignedIn && (
            <Link
              href="/dashboard"
              className="text-sm font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              My Dashboard
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {isSignedIn ? (
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="hidden sm:inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                Go to Dashboard
              </Link>
              <UserButton />
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                Sign In
              </Link>
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <span>Get Started</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
