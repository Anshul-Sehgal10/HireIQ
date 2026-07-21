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
import { Mail, CheckCircle2, AlertTriangle } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, Button } from "@/components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            HireIQ
          </span>
        </div>

        {state === "loading" && (
          <p className="animate-pulse text-sm text-muted-foreground">Checking invite…</p>
        )}

        {state === "confirm" && (
          <Card className="p-8">
            <CardContent className="p-0">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                <Mail size={20} />
              </div>
              <h1 className="mb-2 text-xl font-bold text-foreground">You've been invited</h1>
              <p className="mb-8 text-sm text-muted-foreground">
                You've been invited to join an organisation on HireIQ. Accept to get access to
                their job postings and hiring pipeline.
              </p>
              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleAccept}>
                  Accept invite
                </Button>
                <Button className="flex-1" variant="secondary" onClick={handleDecline}>
                  Decline
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {state === "accepting" && (
          <p className="animate-pulse text-sm text-muted-foreground">Joining organisation…</p>
        )}

        {state === "success" && (
          <Card className="border-success-border bg-success-bg p-8 text-center">
            <CardContent className="p-0">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-success/15 text-success">
                <CheckCircle2 size={20} />
              </div>
              <h2 className="mb-1 text-lg font-bold text-success-foreground">You're in!</h2>
              <p className="text-sm text-success-foreground/80">Redirecting to your workspace…</p>
            </CardContent>
          </Card>
        )}

        {state === "error" && (
          <Card className="border-danger-border bg-danger-bg p-8">
            <CardContent className="p-0">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-danger/15 text-danger">
                <AlertTriangle size={20} />
              </div>
              <h2 className="mb-2 text-lg font-bold text-danger-foreground">
                Something went wrong
              </h2>
              <p className="mb-6 text-sm text-danger-foreground/90">{errorMsg}</p>
              <Link
                href="/employer/dashboard"
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                ← Back to dashboard
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}