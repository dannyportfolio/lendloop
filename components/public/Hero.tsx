import Link from "next/link";
import { ArrowRight, ShieldCheck, RefreshCw, Users } from "lucide-react";

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50/80 px-3 py-1 text-xs font-semibold text-blue-700 mb-6">
            <span className="flex h-2 w-2 rounded-full bg-blue-600" />
            Neighborhood Community Exchange
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl lg:text-6xl">
            Borrow what you need. <br className="hidden sm:inline" />
            <span className="text-blue-600">Lend what you don&apos;t.</span>
          </h1>

          <p className="mt-6 text-lg leading-relaxed text-slate-600 max-w-2xl">
            Access drills, saws, lawnmowers, and specialty gear from neighbors down your street.
            Keep your garage uncluttered, save money, and build community trust.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/#tools"
              className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              Browse Available Tools
            </Link>

            <Link
              href="/sign-in"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
            >
              <span>Sign in to Lend or Borrow</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-3 pt-8 border-t border-slate-100">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <ShieldCheck className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Trusted Lenders
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Verified neighbors recognized for well-maintained tools.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Reliable Tracking
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Clear date ranges, automated loan tracking, and return confirmation.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
                <Users className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Community Focused
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Zero fees for community tool sharing among verified neighbors.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
