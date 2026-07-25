"use client";

import { useState } from "react";
import { Briefcase, User as UserIcon } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent } from "@/components/ui";

export default function SelectRolePage() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const choose = async (role: "candidate" | "employer") => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch("/auth/select-role", {
        method: "POST",
        body: JSON.stringify({ role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to set role");
      // Cookies were re-issued server-side with the new role — full reload
      // so proxy.ts / useAuth pick up the fresh token.
      window.location.href = `/${role}/dashboard`;
    } catch (e: any) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-md">
        <h1 className="mb-2 text-2xl font-bold">One more step</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Tell us how you&apos;ll be using HireIQ.
        </p>

        {error && (
          <div className="mb-6 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        <div className="space-y-3">
          <Card interactive onClick={() => !submitting && choose("candidate")} className="p-5">
            <CardContent className="flex items-center gap-3 p-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <UserIcon size={18} />
              </div>
              <div>
                <p className="font-semibold">I&apos;m looking for a job</p>
                <p className="text-xs text-muted-foreground">Browse roles and apply as a candidate</p>
              </div>
            </CardContent>
          </Card>

          <Card interactive onClick={() => !submitting && choose("employer")} className="p-5">
            <CardContent className="flex items-center gap-3 p-0">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Briefcase size={18} />
              </div>
              <div>
                <p className="font-semibold">I&apos;m hiring</p>
                <p className="text-xs text-muted-foreground">Post jobs and manage candidates as an employer</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}