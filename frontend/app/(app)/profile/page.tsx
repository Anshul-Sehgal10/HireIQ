"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { apiFetch } from "@/lib/api";
import { Sun, Moon, Monitor, Shield, CreditCard, User as UserIcon, KeyRound, LogOut } from "lucide-react";
import { PageHeader, Card, CardContent, Button, Field, Input, Badge, SkeletonText, useToast } from "@/components/ui";

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  has_password: boolean;
  oauth_provider: string;
}

interface CandidateOverview {
  subscription_tier: string;
  override_apps_used: number;
  override_apps_limit: number;
  overrides_remaining: number;
  overrides_unlimited: boolean;
}

interface OrgSummary {
  name: string;
  verification_status: string;
  subscription_tier: string;
}

export default function ProfilePage() {
  const { reloadUser, logout, user } = useAuth();
  const { toast } = useToast();
  const { preference, setTheme } = useTheme();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<CandidateOverview | null>(null);
  const [org, setOrg] = useState<OrgSummary | null>(null);
  const [planLoading, setPlanLoading] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((r) => r.json())
      .then((data: ProfileData) => {
        setProfile(data);
        setFullName(data.full_name);
        setEmail(data.email);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setPlanLoading(true);
      try {
        if (user.role === "candidate") {
          const res = await apiFetch("/candidates/me/overview");
          if (res.ok) setOverview(await res.json());
        } else if (user.role === "employer") {
          const res = await apiFetch("/orgs/mine");
          if (res.ok) setOrg(await res.json());
        }
      } finally {
        setPlanLoading(false);
      }
    })();
  }, [user]);

  const saveInfo = async () => {
    setInfoSaving(true);
    try {
      const res = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify({ full_name: fullName, email }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Update failed");
      setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      reloadUser();
      toast({ title: "Profile updated", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to update profile", description: e.message, variant: "error" });
    } finally {
      setInfoSaving(false);
    }
  };

  const savePassword = async () => {
    if (!newPassword) return;
    setPwSaving(true);
    try {
      const body: Record<string, string> = { new_password: newPassword };
      if (profile?.has_password) body.current_password = currentPassword;
      const res = await apiFetch("/auth/me", { method: "PATCH", body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Password update failed");
      setProfile((prev) => (prev ? { ...prev, has_password: true } : prev));
      setCurrentPassword("");
      setNewPassword("");
      toast({ title: profile?.has_password ? "Password changed" : "Password set", variant: "success" });
    } catch (e: any) {
      toast({ title: "Failed to update password", description: e.message, variant: "error" });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-2xl p-8">
        <SkeletonText lines={6} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" description="Manage your account, appearance, and plan" />

      <div className="space-y-6 p-6">
        <SectionCard icon={UserIcon} title="Basic info">
          <Field label="Full name" htmlFor="full_name">
            <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            hint={profile.oauth_provider !== "local" ? `Managed by ${profile.oauth_provider} — cannot be changed here.` : undefined}
          >
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={profile.oauth_provider !== "local"} />
          </Field>
          <Button size="sm" loading={infoSaving} onClick={saveInfo}>Save changes</Button>
        </SectionCard>

        <SectionCard icon={KeyRound} title={profile.has_password ? "Change password" : "Set a password"}>
          {!profile.has_password && (
            <p className="text-xs text-muted-foreground">
              You signed up with {profile.oauth_provider}. Setting a password lets you also log in with email.
            </p>
          )}
          {profile.has_password && (
            <Field label="Current password" htmlFor="current_password">
              <Input id="current_password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </Field>
          )}
          <Field label={profile.has_password ? "New password" : "Password"} htmlFor="new_password">
            <Input id="new_password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          </Field>
          <Button size="sm" loading={pwSaving} disabled={!newPassword} onClick={savePassword}>
            {profile.has_password ? "Change password" : "Set password"}
          </Button>
        </SectionCard>

        <SectionCard icon={Sun} title="Appearance">
          <p className="mb-1 text-xs text-muted-foreground">Choose how HireIQ looks on this device.</p>
          <div className="flex gap-2">
            <ThemeOption active={preference === "light"} icon={Sun} label="Light" onClick={() => setTheme("light")} />
            <ThemeOption active={preference === "dark"} icon={Moon} label="Dark" onClick={() => setTheme("dark")} />
            <ThemeOption active={preference === "system"} icon={Monitor} label="System" onClick={() => setTheme("system")} />
          </div>
        </SectionCard>

        {(user?.role === "candidate" || user?.role === "employer") && (
          <SectionCard icon={CreditCard} title="Plan & usage">
            {planLoading ? (
              <SkeletonText lines={2} />
            ) : user?.role === "candidate" && overview ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Current plan</span>
                  <Badge variant="primary" className="capitalize">{overview.subscription_tier}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Override applications</span>
                  <span className="text-sm font-medium text-foreground">
                    {overview.overrides_unlimited ? "Unlimited" : `${overview.overrides_remaining} / ${overview.override_apps_limit} left`}
                  </span>
                </div>
              </div>
            ) : user?.role === "employer" && org ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Organisation plan</span>
                  <Badge variant="primary" className="capitalize">{org.subscription_tier}</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Verification status</span>
                  <Badge variant={org.verification_status === "verified" ? "success" : "warning"} className="capitalize">
                    {org.verification_status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No organisation set up yet.</p>
            )}
          </SectionCard>
        )}

        <SectionCard icon={Shield} title="Account">
          <InfoRow label="Role" value={profile.role} capitalize />
          <InfoRow label="Signed in with" value={profile.oauth_provider} capitalize />
          <InfoRow label="User ID" value={profile.id} mono />
        </SectionCard>

        <Button variant="outline" leftIcon={<LogOut size={14} />} onClick={logout} className="w-full sm:w-auto">
          Sign out
        </Button>
      </div>
    </div>
  );
}

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-6">
      <CardContent className="space-y-4 p-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={14} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ThemeOption({ active, icon: Icon, label, onClick }: { active: boolean; icon: React.ElementType; label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function InfoRow({ label, value, capitalize, mono }: { label: string; value: string; capitalize?: boolean; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-foreground ${capitalize ? "capitalize" : ""} ${mono ? "font-mono text-xs text-muted-foreground" : ""}`}>{value}</span>
    </div>
  );
}