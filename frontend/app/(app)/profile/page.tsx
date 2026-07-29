"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/auth";
import { useTheme } from "@/context/theme";
import { apiFetch, apiUrl } from "@/lib/api";
import {
  Sun,
  Moon,
  Monitor,
  Shield,
  CreditCard,
  User as UserIcon,
  KeyRound,
  LogOut,
  Link2,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  Button,
  Field,
  Input,
  Badge,
  SkeletonText,
  useToast,
} from "@/components/ui";

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string | null; // now nullable
  has_password: boolean; // oauth_provider field removed
}

interface LinkedAccount {
  id: string;
  provider: "google" | "linkedin";
  provider_email: string;
  created_at: string;
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

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

const ROLE_ICON: Record<string, React.ElementType> = {
  admin: ShieldCheck,
  employer: Briefcase,
  candidate: UserIcon,
};

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

  const [accounts, setAccounts] = useState<LinkedAccount[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [unlinkingId, setUnlinkingId] = useState<string | null>(null);

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

  useEffect(() => {
    apiFetch("/auth/me/oauth-accounts")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAccounts(Array.isArray(data) ? data : []))
      .finally(() => setAccountsLoading(false));
  }, []);

  const saveInfo = async () => {
    setInfoSaving(true);
    try {
      if(email.trim() === "" || fullName.trim() === "") {
        throw new Error("Please fill in all required fields");
      }
      const res = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Update failed");
      console.log("Updated profile:", data);
      setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      reloadUser();
      toast({ title: "Profile updated", variant: "success" });
    } catch (e: any) {
      toast({
        title: "Failed to update profile",
        description: e.message,
        variant: "error",
      });
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
      const res = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Password update failed");
      setProfile((prev) => (prev ? { ...prev, has_password: true } : prev));
      setCurrentPassword("");
      setNewPassword("");
      toast({
        title: profile?.has_password ? "Password changed" : "Password set",
        variant: "success",
      });
    } catch (e: any) {
      toast({
        title: "Failed to update password",
        description: e.message,
        variant: "error",
      });
    } finally {
      setPwSaving(false);
    }
  };

  const connect = (provider: "google" | "linkedin") => {
    window.location.href = apiUrl(`/auth/${provider}/connect`);
  };

  const unlink = async (accountId: string) => {
    if (
      !confirm(
        "Unlink this account? You'll no longer be able to sign in with it.",
      )
    )
      return;
    setUnlinkingId(accountId);
    try {
      const res = await apiFetch(`/auth/oauth-accounts/${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? "Failed to unlink account");
      }
      setAccounts((prev) => prev.filter((a) => a.id !== accountId));
      toast({ title: "Account unlinked", variant: "success" });
    } catch (e: any) {
      toast({
        title: "Failed to unlink",
        description: e.message,
        variant: "error",
      });
    } finally {
      setUnlinkingId(null);
    }
  };

  if (loading || !profile) {
    return (
      <div className="mx-auto max-w-5xl p-8">
        <SkeletonText lines={6} />
      </div>
    );
  }

  const RoleIcon = ROLE_ICON[profile.role ?? ""] ?? UserIcon;
  const signInMethods = [
    profile.has_password ? "Password" : null,
    ...accounts.map((a) => a.provider),
  ].filter(Boolean);

  return (
    <div className="mx-auto max-w-5xl">
      {/* ------------------------------------------------------------ */}
      {/* Profile banner — identity + quick account meta, replaces the  */}
      {/* old bare PageHeader + separate "Account" card.                */}
      {/* ------------------------------------------------------------ */}
      <div className="relative overflow-hidden border-b border-border px-6 py-8 sm:py-10">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/10 blur-3xl"
        />

        <div className="relative z-10 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-xl font-bold text-primary ring-1 ring-primary/20">
              {initialsFor(profile.full_name || "?")}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-foreground">
                  {profile.full_name}
                </h1>
                {profile.role && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-semibold capitalize text-primary">
                    <RoleIcon size={11} />
                    {profile.role}
                  </span>
                )}
              </div>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {profile.email}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {signInMethods.map((m) => (
                  <span
                    key={m}
                    className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium capitalize text-muted-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
            <span className="font-mono text-[11px] text-muted-foreground/70">
              ID: {profile.id.slice(0, 8)}…
            </span>
            <Button
              size="sm"
              variant="outline"
              leftIcon={<LogOut size={13} />}

              onClick={logout}
              className="shrink-0"
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------------ */}
      {/* Settings grid                                                 */}
      {/* ------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-5 p-6 lg:grid-cols-2">
        <SectionCard icon={UserIcon} title="Basic info">
          <Field label="Full name" htmlFor="full_name" required>
            <Input
              id="full_name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </Field>
          <Field
            label="Email"
            htmlFor="email"
            required
            hint={
              !profile.has_password
                ? "Set a password to edit your email directly — it's otherwise tied to your connected sign-in provider(s)."
                : signInMethods.includes("Google") || signInMethods.includes("LinkedIn")
                  ? "Your email is tied to your connected sign-in provider(s)."
                  : undefined
            }
          >
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={
                signInMethods.includes("Google") ||
                signInMethods.includes("LinkedIn")
              }
            />
          </Field>
          <Button size="sm" loading={infoSaving} onClick={saveInfo}>
            Save changes
          </Button>
        </SectionCard>

        <SectionCard
          icon={KeyRound}
          title={profile.has_password ? "Change password" : "Set a password"}
        >
          {!profile.has_password && (
            <p className="text-xs text-muted-foreground">
              Setting a password lets you also log in with email.
            </p>
          )}
          {profile.has_password && (
            <Field label="Current password" htmlFor="current_password">
              <Input
                id="current_password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </Field>
          )}
          <Field
            label={profile.has_password ? "New password" : "Password"}
            htmlFor="new_password"
          >
            <Input
              id="new_password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </Field>
          <Button
            size="sm"
            loading={pwSaving}
            disabled={!newPassword}
            onClick={savePassword}
          >
            {profile.has_password ? "Change password" : "Set password"}
          </Button>
        </SectionCard>

        <SectionCard icon={Link2} title="Connected accounts">
          {accountsLoading ? (
            <SkeletonText lines={2} />
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5"
                >
                  <div>
                    <p className="text-sm font-medium capitalize text-foreground">
                      {a.provider}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {a.provider_email}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    loading={unlinkingId === a.id}
                    onClick={() => unlink(a.id)}
                  >
                    Unlink
                  </Button>
                </div>
              ))}
              {(["google", "linkedin"] as const)
                .filter((p) => !accounts.some((a) => a.provider === p))
                .map((p) => (
                  <Button
                    key={p}
                    size="sm"
                    variant="secondary"
                    className="w-full capitalize"
                    onClick={() => connect(p)}
                  >
                    Connect {p}
                  </Button>
                ))}
            </div>
          )}
        </SectionCard>

        <SectionCard icon={Sun} title="Appearance">
          <p className="mb-1 text-xs text-muted-foreground">
            Choose how HireIQ looks on this device.
          </p>
          <div className="flex gap-2">
            <ThemeOption
              active={preference === "light"}
              icon={Sun}
              label="Light"
              onClick={() => setTheme("light")}
            />
            <ThemeOption
              active={preference === "dark"}
              icon={Moon}
              label="Dark"
              onClick={() => setTheme("dark")}
            />
            <ThemeOption
              active={preference === "system"}
              icon={Monitor}
              label="System"
              onClick={() => setTheme("system")}
            />
          </div>
        </SectionCard>

        {(user?.role === "candidate" || user?.role === "employer") && (
          <SectionCard icon={CreditCard} title="Plan & usage">
            {planLoading ? (
              <SkeletonText lines={2} />
            ) : user?.role === "candidate" && overview ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Current plan
                  </span>
                  <Badge variant="primary" className="capitalize">
                    {overview.subscription_tier}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Override applications
                  </span>
                  <span className="text-sm font-medium text-foreground">
                    {overview.overrides_unlimited
                      ? "Unlimited"
                      : `${overview.overrides_remaining} / ${overview.override_apps_limit} left`}
                  </span>
                </div>
              </div>
            ) : user?.role === "employer" && org ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Organisation plan
                  </span>
                  <Badge variant="primary" className="capitalize">
                    {org.subscription_tier}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">
                    Verification status
                  </span>
                  <Badge
                    variant={
                      org.verification_status === "verified"
                        ? "success"
                        : "warning"
                    }
                    className="capitalize"
                  >
                    {org.verification_status}
                  </Badge>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No organisation set up yet.
              </p>
            )}
          </SectionCard>
        )}

        <SectionCard icon={Shield} title="Account">
          <InfoRow
            label="Sign-in methods"
            value={signInMethods.join(", ") || "—"}
            capitalize
          />
          <InfoRow label="User ID" value={profile.id} mono />
        </SectionCard>
      </div>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 transition-colors hover:border-primary/25">
      <CardContent className="space-y-4 p-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={15} />
          </div>
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ThemeOption({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1.5 rounded-lg border px-3 py-3 text-xs font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:border-primary/40"
      }`}
    >
      <Icon size={16} />
      {label}
    </button>
  );
}

function InfoRow({
  label,
  value,
  capitalize,
  mono,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={`text-foreground ${capitalize ? "capitalize" : ""} ${mono ? "font-mono text-xs text-muted-foreground" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}
