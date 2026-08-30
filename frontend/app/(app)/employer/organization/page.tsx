"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Building2,
  Users2,
  Mail,
  Copy,
  RefreshCw,
  Trash2,
  Check,
  X,
  Pencil,
  Globe,
} from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import { getAccessTokenFromCookie } from "@/context/auth";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Field,
  Input,
  Textarea,
  Select,
  PageHeader,
  SkeletonText,
  useToast,
} from "@/components/ui";

interface Org {
  id: string;
  name: string;
  domain: string | null;
  verification_status: string;
  owner_id: string;
  join_code: string | null;
  description: string | null;
  website: string | null;
  industry: string | null;
  company_size: string | null;
  logo_url: string | null;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  email: string | null;
  full_name: string | null;
}

interface Invite {
  id: string;
  invited_email: string;
  role: string;
  status: string;
  token?: string;
}

interface ProfileForm {
  name: string;
  domain: string;
  industry: string;
  company_size: string;
  website: string;
  logo_url: string;
  description: string;
}

const ROLE_BADGE_VARIANT: Record<string, "success" | "primary" | "default"> = {
  owner: "success",
  recruiter: "primary",
  viewer: "default",
};

const COMPANY_SIZES = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1000+"];

function initialsFor(name: string) {
  return (name?.[0] ?? "?").toUpperCase();
}

export default function OrgPage() {
  return (
    <RoleGuard allowed={["employer", "admin"]}>
      <OrgContent />
    </RoleGuard>
  );
}

function OrgContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [org, setOrg] = useState<Org | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [requests, setRequests] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  // Profile edit
  const [editingProfile, setEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>({
    name: "",
    domain: "",
    industry: "",
    company_size: "",
    website: "",
    logo_url: "",
    description: "",
  });
  const [savingProfile, setSavingProfile] = useState(false);

  // Invite form
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"recruiter" | "viewer">("recruiter");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Join Code
  const [regenerating, setRegenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const currentUserId = (() => {
    try {
      const token = getAccessTokenFromCookie();
      if (!token) return null;
      let b64 = token.split(".")[1];
      if (!b64) return null;
      b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      return (JSON.parse(atob(b64)) as { sub: string }).sub;
    } catch {
      return null;
    }
  })();

  const isOwner = org ? org.owner_id === currentUserId : false;

  const syncProfileForm = (data: Org) => {
    setProfileForm({
      name: data.name ?? "",
      domain: data.domain ?? "",
      industry: data.industry ?? "",
      company_size: data.company_size ?? "",
      website: data.website ?? "",
      logo_url: data.logo_url ?? "",
      description: data.description ?? "",
    });
  };

  useEffect(() => {
    (async () => {
      const res = await apiFetch("/orgs/mine");
      if (res.status === 404) {
        router.replace("/employer/organization/setup");
        return;
      }
      const data: Org = await res.json();
      setOrg(data);
      syncProfileForm(data);

      const [membersRes, invitesRes, requestsRes] = await Promise.all([
        apiFetch("/orgs/mine/members"),
        apiFetch("/orgs/invites/"),
        apiFetch("/orgs/mine/requests"),
      ]);

      if (membersRes.ok) setMembers(await membersRes.json());
      if (invitesRes.ok) setInvites(await invitesRes.json());
      if (requestsRes.ok) setRequests(await requestsRes.json());
      setLoading(false);
    })();
  }, [router]);

  const cancelProfileEdit = () => {
    if (org) syncProfileForm(org);
    setEditingProfile(false);
  };

  const saveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast({ title: "Organisation name is required", variant: "error" });
      return;
    }
    setSavingProfile(true);
    try {
      const res = await apiFetch("/orgs/mine", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileForm.name.trim(),
          domain: profileForm.domain.trim() || null,
          industry: profileForm.industry.trim() || null,
          company_size: profileForm.company_size || null,
          website: profileForm.website.trim() || null,
          logo_url: profileForm.logo_url.trim() || null,
          description: profileForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to update organisation");
      setOrg(data);
      syncProfileForm(data);
      setEditingProfile(false);
      toast({ title: "Organisation profile updated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "error" });
    } finally {
      setSavingProfile(false);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviteLoading(true);
    setInviteError(null);
    try {
      const res = await apiFetch("/orgs/invites/", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Failed to send invite");
      setInvites((prev) => [data, ...prev]);
      setInviteEmail("");
    } catch (e: unknown) {
      const error = e instanceof Error ? e : new Error(String(e));
      setInviteError(error.message);
    } finally {
      setInviteLoading(false);
    }
  };

  const cancelInvite = async (id: string) => {
    await apiFetch(`/orgs/invites/${id}`, { method: "DELETE" });
    setInvites((prev) => prev.filter((i) => i.id !== id));
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/onboarding/accept-invite?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const approveRequest = async (id: string) => {
    const res = await apiFetch(`/orgs/mine/requests/${id}/approve`, { method: "POST" });
    if (res.ok) {
      const member: Member = await res.json();
      setMembers((prev) => [...prev, member]);
      setRequests((prev) => prev.filter((r) => r.id !== id));
    }
  };

  const rejectRequest = async (id: string) => {
    await apiFetch(`/orgs/mine/requests/${id}/reject`, { method: "POST" });
    setRequests((prev) => prev.filter((r) => r.id !== id));
  };

  const removeMember = async (m: Member) => {
    if (!confirm(`Remove ${m.full_name ?? m.email} from the organisation?`)) return;
    const res = await apiFetch(`/orgs/mine/members/${m.user_id}`, { method: "DELETE" });
    if (res.ok) setMembers((prev) => prev.filter((x) => x.id !== m.id));
  };

  const regenerateCode = async () => {
    if (!confirm("Regenerate the join code? The old code will stop working immediately.")) return;
    setRegenerating(true);
    try {
      const res = await apiFetch("/orgs/mine/regenerate-code", { method: "POST" });
      const data: Org = await res.json();
      if (!res.ok) throw new Error((data as any).detail ?? "Failed to regenerate code");
      setOrg(data);
    } finally {
      setRegenerating(false);
    }
  };

  const copyCode = () => {
    if (!org?.join_code) return;
    navigator.clipboard.writeText(org.join_code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <SkeletonText lines={8} />
      </div>
    );
  }

  if (!org) return null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={org.name}
        description={
          org.verification_status === "verified" ? "Verified organisation" : `Verification ${org.verification_status}`
        }
        actions={
          <Link
            href="/employer/jobs"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Job postings
          </Link>
        }
      />

      {org.verification_status !== "verified" && (
        <div className="px-6 pt-6">
          <div
            className={`rounded-xl border px-5 py-4 text-sm ${
              org.verification_status === "pending"
                ? "border-warning-border bg-warning-bg text-warning-foreground"
                : "border-danger-border bg-danger-bg text-danger-foreground"
            }`}
          >
            {org.verification_status === "pending" && (
              <p>
                <strong>Verification pending.</strong> You can set up your organisation and draft postings, but you
                won't be able to publish jobs until an admin verifies your organisation.
              </p>
            )}
            {org.verification_status === "rejected" && (
              <p>
                <strong>Verification rejected.</strong> This organisation can't publish jobs. You can{" "}
                <Link href="/employer/organization/setup" className="font-medium underline">
                  create a new organisation
                </Link>{" "}
                to start over.
              </p>
            )}
            {org.verification_status === "blocked" && (
              <p>
                <strong>Organisation blocked.</strong> All published jobs have been closed and new publishing is
                disabled. Contact support if you believe this is a mistake.
              </p>
            )}
          </div>
        </div>
      )}

      <div className="space-y-8 p-6">
        {/* ------------------------------------------------------------ */}
        {/* Profile — editable by owner                                   */}
        {/* ------------------------------------------------------------ */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <Building2 size={13} /> About the organisation
            </h2>
            {isOwner && !editingProfile && (
              <Button size="sm" variant="outline" leftIcon={<Pencil size={13} />} onClick={() => setEditingProfile(true)}>
                Edit
              </Button>
            )}
          </div>

          <Card className="p-6">
            <CardContent className="p-0">
              {editingProfile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label="Organisation name" htmlFor="org_name" required>
                      <Input
                        id="org_name"
                        value={profileForm.name}
                        onChange={(e) => setProfileForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </Field>
                    <Field label="Domain" htmlFor="org_domain" hint="Used to auto-match colleagues by email.">
                      <Input
                        id="org_domain"
                        value={profileForm.domain}
                        onChange={(e) => setProfileForm((p) => ({ ...p, domain: e.target.value }))}
                        placeholder="acme.com"
                      />
                    </Field>
                    <Field label="Industry" htmlFor="org_industry">
                      <Input
                        id="org_industry"
                        value={profileForm.industry}
                        onChange={(e) => setProfileForm((p) => ({ ...p, industry: e.target.value }))}
                        placeholder="e.g. Fintech, Healthcare"
                      />
                    </Field>
                    <Field label="Company size" htmlFor="org_size">
                      <Select
                        id="org_size"
                        value={profileForm.company_size}
                        onChange={(e) => setProfileForm((p) => ({ ...p, company_size: e.target.value }))}
                      >
                        <option value="">Select</option>
                        {COMPANY_SIZES.map((s) => (
                          <option key={s} value={s}>
                            {s} employees
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Website" htmlFor="org_website">
                      <Input
                        id="org_website"
                        value={profileForm.website}
                        onChange={(e) => setProfileForm((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://acme.com"
                      />
                    </Field>
                    <Field label="Logo URL" htmlFor="org_logo" hint="Direct link to a square image.">
                      <Input
                        id="org_logo"
                        value={profileForm.logo_url}
                        onChange={(e) => setProfileForm((p) => ({ ...p, logo_url: e.target.value }))}
                        placeholder="https://…"
                      />
                    </Field>
                  </div>
                  <Field label="Description" htmlFor="org_description" hint="Shown to candidates on your public organisation page.">
                    <Textarea
                      id="org_description"
                      rows={4}
                      value={profileForm.description}
                      onChange={(e) => setProfileForm((p) => ({ ...p, description: e.target.value }))}
                      placeholder="What does your company do? What's it like to work there?"
                    />
                  </Field>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button variant="ghost" leftIcon={<X size={14} />} onClick={cancelProfileEdit} disabled={savingProfile}>
                      Cancel
                    </Button>
                    <Button leftIcon={<Check size={14} />} loading={savingProfile} onClick={saveProfile}>
                      Save changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-5 sm:flex-row">
                  <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/20">
                    {org.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={org.logo_url} alt={org.name} className="h-full w-full object-cover" />
                    ) : (
                      initialsFor(org.name)
                    )}
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      {org.industry && <span>{org.industry}</span>}
                      {org.company_size && <span>{org.company_size} employees</span>}
                      {org.domain && <span>{org.domain}</span>}
                    </div>
                    {org.website && (
                      <a
                        href={org.website.startsWith("http") ? org.website : `https://${org.website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary-hover"
                      >
                        <Globe size={13} /> {org.website}
                      </a>
                    )}
                    {org.description ? (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{org.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {isOwner
                          ? "No description yet — add one so candidates know who you are."
                          : "No description added yet."}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Members                                                       */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Users2 size={13} /> Members · {members.length}
          </h2>
          <div className="space-y-2">
            {members.map((m) => (
              <Card key={m.id} className="p-4">
                <CardContent className="flex items-center justify-between p-0">
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
                      {initialsFor(m.full_name ?? m.email ?? "?")}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{m.full_name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{m.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={ROLE_BADGE_VARIANT[m.role] ?? "default"} className="capitalize">
                      {m.role}
                    </Badge>
                    {isOwner && m.user_id !== currentUserId && (
                      <Button size="sm" variant="ghost" leftIcon={<Trash2 size={13} />} onClick={() => removeMember(m)}>
                        Remove
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Invite by email — owner/recruiter                             */}
        {/* ------------------------------------------------------------ */}
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Mail size={13} /> Invite by email
          </h2>
          <Card className="p-5">
            <CardContent className="space-y-4 p-0">
              {inviteError && (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-3 py-2 text-xs text-danger-foreground">
                  {inviteError}
                </div>
              )}
              <div className="flex flex-col gap-2.5 sm:flex-row">
                <Input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="flex-1"
                />
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as "recruiter" | "viewer")}
                  className="sm:w-40"
                >
                  <option value="recruiter">Recruiter</option>
                  <option value="viewer">Viewer</option>
                </Select>
                <Button loading={inviteLoading} onClick={sendInvite}>
                  Send invite
                </Button>
              </div>

              {invites.length > 0 && (
                <div className="space-y-2 border-t border-border pt-3">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <div>
                        <p className="text-foreground">{inv.invited_email}</p>
                        <p className="text-xs capitalize text-muted-foreground">{inv.role} · {inv.status}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.token && (
                          <Button size="sm" variant="ghost" onClick={() => copyInviteLink(inv.token!)}>
                            {copiedToken === inv.token ? "Copied!" : "Copy link"}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => cancelInvite(inv.id)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        {/* ------------------------------------------------------------ */}
        {/* Join requests — owner only                                    */}
        {/* ------------------------------------------------------------ */}
        {isOwner && requests.length > 0 && (
          <section>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Join requests · {requests.length}
            </h2>
            <div className="space-y-2">
              {requests.map((req) => (
                <Card key={req.id} className="p-4">
                  <CardContent className="flex items-center justify-between p-0">
                    <div>
                      <p className="text-sm text-foreground">{req.invited_email}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">Wants to join as {req.role}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => approveRequest(req.id)}>
                        Approve
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => rejectRequest(req.id)}>
                        Reject
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* ------------------------------------------------------------ */}
        {/* Join code — owner only                                        */}
        {/* ------------------------------------------------------------ */}
        {isOwner && org.join_code && (
          <section className="border-t border-border pt-6">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Join code</h2>
            <div className="flex items-center gap-3">
              <span className="select-all font-mono text-lg font-bold tracking-widest text-foreground">
                {org.join_code}
              </span>
              <Button size="sm" variant="ghost" leftIcon={<Copy size={13} />} onClick={copyCode}>
                {copiedCode ? "Copied!" : "Copy"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                leftIcon={<RefreshCw size={13} />}
                loading={regenerating}
                onClick={regenerateCode}
              >
                Regenerate
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Share this with colleagues so they can request to join instantly. Regenerating immediately invalidates
              the old code.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}