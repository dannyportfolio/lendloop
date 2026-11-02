import { Suspense } from "react";
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create your account
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Join your neighborhood tool-lending community
          </p>
        </div>
        <Suspense
          fallback={
            <div className="p-8 text-center text-sm text-slate-500 bg-white rounded-xl border border-slate-200">
              Loading sign up...
            </div>
          }
        >
          <SignUp
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-sm border border-slate-200 rounded-xl",
              },
            }}
          />
        </Suspense>
      </div>
    </main>
  );
}
