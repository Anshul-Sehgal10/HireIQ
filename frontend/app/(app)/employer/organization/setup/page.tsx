"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Users } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { Card, CardContent, Button, Field, Input } from "@/components/ui";

export default function OrgSetupPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"create" | "join">("create");

  // Create org state
  const [orgName, setOrgName] = useState("");
  const [domain, setDomain] = useState("");

  // Join org state
  const [orgId, setOrgId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!orgName.trim()) { setError("Organisation name is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch("/orgs/", {
        method: "POST",
        body: JSON.stringify({ name: orgName.trim(), domain: domain.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to create organisation");
      router.push("/employer/organization");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async () => {
    if (!orgId.trim()) { setError("Organisation ID is required"); return; }
    setLoading(true); setError(null);
    try {
      const res = await apiFetch(`/orgs/${orgId.trim()}/requests/`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to send join request");
      router.push("/employer/organization/requested");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="mb-8">
          <span className="text-xs font-semibold uppercase tracking-widest text-primary">
            HireIQ
          </span>
          <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight text-foreground">
            Set up your workspace
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Every job posting belongs to an organisation. Create yours or join an existing one.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-8 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(null); }}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === t
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t === "create" ? "Create organisation" : "Join existing"}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-sm text-danger-foreground">
            {error}
          </div>
        )}

        <Card className="p-6">
          <CardContent className="p-0">
            {tab === "create" ? (
              <div className="space-y-5">
                <Field label="Organisation name" htmlFor="org_name" required>
                  <Input
                    id="org_name"
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    placeholder="Acme Corp"
                  />
                </Field>
                <Field
                  label="Company domain"
                  htmlFor="domain"
                  hint="Used to auto-match colleagues by email domain later."
                >
                  <Input
                    id="domain"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    placeholder="acme.com"
                  />
                </Field>
                <Button className="w-full" loading={loading} onClick={handleCreate}>
                  Create organisation
                </Button>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-lg border border-border bg-muted/40 px-4 py-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Users size={14} className="text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">
                      Already have an invite?
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Check your email — your org admin may have sent you an invite link. Click it
                    to join automatically without needing the org ID.
                  </p>
                </div>

                <Field
                  label="Organisation ID"
                  htmlFor="org_id"
                  hint="Ask your organisation's owner for their org ID."
                >
                  <Input
                    id="org_id"
                    value={orgId}
                    onChange={(e) => setOrgId(e.target.value)}
                    placeholder="Paste the org UUID here"
                    className="font-mono"
                  />
                </Field>
                <Button className="w-full" loading={loading} onClick={handleRequestJoin}>
                  Send join request
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}