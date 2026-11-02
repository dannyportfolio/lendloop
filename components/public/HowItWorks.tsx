import { Search, CalendarCheck, CheckCircle2 } from "lucide-react";

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-16 sm:py-24 bg-white border-t border-slate-200 scroll-mt-12">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            How Neighborhood Tool Lending Works
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            A simple three-step cycle that connects homeowners and makers across the community.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm mb-5">
              <Search className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              Step 1
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Browse and Request
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Find the exact power tool or hand gear you need. Pick your scheduled start and return dates.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm mb-5">
              <CalendarCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              Step 2
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Approve and Borrow
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              The tool owner reviews and approves your request. The loan activates with automated tracking.
            </p>
          </div>

          <div className="flex flex-col items-center text-center p-6 rounded-xl border border-slate-100 bg-slate-50/50">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm mb-5">
              <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-wider mb-1">
              Step 3
            </span>
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Return and Confirm
            </h3>
            <p className="text-sm text-slate-600 leading-relaxed">
              Return the tool on or before the due date, mark it returned, and free it for the next neighbor.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
