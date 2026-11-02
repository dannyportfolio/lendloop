import { Wrench } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <Wrench className="h-4 w-4" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900 leading-none">
                LendLoop
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Borrow what you need. Lend what you don&apos;t.
              </p>
            </div>
          </div>

          <p className="text-xs text-slate-500 text-center md:text-right">
            Built for Fluence International, Inc. Engineering Assessment.
            <br />
            Next.js App Router, Clerk, Convex, and n8n Outbox Automation.
          </p>
        </div>
      </div>
    </footer>
  );
}
