"use client";

import Link from "next/link";

export default function RequestedPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="w-14 h-14 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-7 h-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">Request sent</h1>
        <p className="text-slate-400 text-sm leading-relaxed mb-8">
          Your join request has been sent to the organisation's admin.
          You'll be able to post jobs as soon as they approve you.
        </p>
        <div className="flex flex-col gap-3">
          <Link
            href="/employer/dashboard"
            className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium py-3 rounded-lg text-sm transition-colors"
          >
            Back to dashboard
          </Link>
          <Link
            href="/employer/organization/setup"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors py-2"
          >
            Try a different organisation
          </Link>
        </div>
      </div>
    </div>
  );
}