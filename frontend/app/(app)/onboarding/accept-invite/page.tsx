"use client";

/**
 * /onboarding/accept-invite?token=xxx
 *
 * Shown when a user clicks an invite link from their email/clipboard.
 * Calls POST /orgs/invites/{token}/accept, then redirects to the org page.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api"

type State = "loading" | "confirm" | "accepting" | "success" | "error";

export default function AcceptInvitePage() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");

  const [state, setState] = useState<State>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  // Check the user is logged in before anything else
  useEffect(() => {
    if (!token) {
      setErrorMsg("No invite token found in the URL.");
      setState("error");
      return;
    }

    const accessToken = localStorage.getItem("access_token");
    if (!accessToken) {
      // Not logged in — redirect to login, come back after
      router.replace(`/auth/login?next=/onboarding/accept-invite?token=${token}`);
      return;
    }

    setState("confirm");
  }, [token, router]);

  const handleAccept = async () => {
    setState("accepting");
    try {
      const res = await apiFetch(`/orgs/invites/${token}/accept`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to accept invite");
      setState("success");
      setTimeout(() => router.push("/employer/organization"), 1500);
    } catch (e: any) {
      setErrorMsg(e.message);
      setState("error");
    }
  };

  const handleDecline = async () => {
    try {
      await apiFetch(`/orgs/invites/${token}/decline`, { method: "POST" });
    } finally {
      router.push("/employer/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="text-xs font-semibold tracking-widest text-emerald-400 uppercase">
            HireIQ
          </span>
        </div>

        {state === "loading" && (
          <p className="text-slate-400 text-sm animate-pulse">Checking invite…</p>
        )}

        {state === "confirm" && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-center mb-6">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">You've been invited</h1>
            <p className="text-slate-400 text-sm mb-8">
              You've been invited to join an organisation on HireIQ. Accept to get access to their
              job postings and hiring pipeline.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleAccept}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-3 rounded-lg text-sm transition-colors"
              >
                Accept invite
              </button>
              <button
                onClick={handleDecline}
                className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium py-3 rounded-lg text-sm transition-colors"
              >
                Decline
              </button>
            </div>
          </div>
        )}

        {state === "accepting" && (
          <div className="text-center">
            <p className="text-slate-400 text-sm animate-pulse">Joining organisation…</p>
          </div>
        )}

        {state === "success" && (
          <div className="bg-emerald-500/10 border border-emerald-500/25 rounded-2xl p-8 text-center">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-white font-bold text-lg mb-1">You're in!</h2>
            <p className="text-slate-400 text-sm">Redirecting to your workspace…</p>
          </div>
        )}

        {state === "error" && (
          <div className="bg-red-500/10 border border-red-500/25 rounded-2xl p-8">
            <h2 className="text-white font-bold text-lg mb-2">Something went wrong</h2>
            <p className="text-red-400 text-sm mb-6">{errorMsg}</p>
            <Link
              href="/employer/dashboard"
              className="inline-block text-sm text-slate-400 hover:text-white transition-colors"
            >
              ← Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}