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
  const [joinCode, setJoinCode] = useState("");
  const [orgId, setOrgId] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!orgName.trim()) {
      setError("Organisation name is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/orgs/", {
        method: "POST",
        body: JSON.stringify({
          name: orgName.trim(),
          domain: domain.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? "Failed to create organisation");
      router.push("/employer/organization");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleJoinByCode = async () => {
    if (!joinCode.trim()) {
      setError("Enter the organisation code");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/orgs/join-by-code", {
        method: "POST",
        body: JSON.stringify({ code: joinCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? "Failed to join organisation");
      router.push("/employer/organization/requested");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestJoin = async () => {
    if (!orgId.trim()) {
      setError("Organisation ID is required");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch(`/orgs/${orgId.trim()}/requests/`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? "Failed to send join request");
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
            Every job posting belongs to an organisation. Create yours or join
            an existing one.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="mb-8 flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
          {(["create", "join"] as const).map((t) => (
            <button
              key={t}
              onClick={() => {
                setTab(t);
                setError(null);
              }}
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
                <Button
                  className="w-full"
                  loading={loading}
                  onClick={handleCreate}
                >
                  Create organisation
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <Field
                  label="Organisation code"
                  htmlFor="join_code"
                  hint="Ask your organisation's owner for their 8-character join code."
                >
                  <Input
                    id="join_code"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="e.g. 7K4RXQ2M"
                    className="font-mono uppercase"
                    maxLength={12}
                  />
                </Field>
                <Button
                  className="w-full"
                  loading={loading}
                  onClick={handleJoinByCode}
                >
                  Join with code
                </Button>

                <div className="relative py-1">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs">
                    <span className="bg-background px-2 text-muted-foreground">
                      Or use an org ID
                    </span>
                  </div>
                </div>

                <div className="space-y-5">
                  <Field
                    label="Organisation ID"
                    htmlFor="org_id"
                    hint="Fallback if you don't have a join code — ask the owner for their org ID."
                  >
                    <Input
                      id="org_id"
                      value={orgId}
                      onChange={(e) => setOrgId(e.target.value)}
                      placeholder="Paste the org UUID here"
                      className="font-mono"
                    />
                  </Field>
                  <Button
                    className="w-full"
                    variant="outline"
                    loading={loading}
                    onClick={handleRequestJoin}
                  >
                    Send join request by ID
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
