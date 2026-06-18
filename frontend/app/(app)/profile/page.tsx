"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/auth";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";

interface ProfileData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  has_password: boolean;
  oauth_provider: string;
}

export default function ProfilePage() {
  const { reloadUser } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  // Info form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoMsg, setInfoMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

  // Password form state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{
    type: "ok" | "err";
    text: string;
  } | null>(null);

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

  const saveInfo = async () => {
    setInfoSaving(true);
    setInfoMsg(null);
    try {
      const res = await apiFetch("/auth/me", {
        method: "PATCH",
        body: JSON.stringify({ full_name: fullName, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? "Update failed");
      setProfile((prev) => (prev ? { ...prev, ...data } : prev));
      reloadUser(); // re-read cookie since tokens were re-issued
      setInfoMsg({ type: "ok", text: "Profile updated." });
    } catch (e: any) {
      setInfoMsg({ type: "err", text: e.message });
    } finally {
      setInfoSaving(false);
    }
  };

  const savePassword = async () => {
    if (!newPassword) return;
    setPwSaving(true);
    setPwMsg(null);
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
      setPwMsg({
        type: "ok",
        text: profile?.has_password
          ? "Password changed."
          : "Password set. You can now log in with email too.",
      });
    } catch (e: any) {
      setPwMsg({ type: "err", text: e.message });
    } finally {
      setPwSaving(false);
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <p className="text-slate-400 text-sm animate-pulse">Loading profile…</p>
      </div>
    );

  if (!profile) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8">
        <h1 className="text-2xl font-bold text-white">Profile</h1>

        {/* Basic info */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Basic info
          </h2>
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              Full name
            </label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={profile.oauth_provider !== "local"}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            {profile.oauth_provider !== "local" && (
              <p className="text-xs text-slate-500 mt-1">
                Email is managed by{" "}
                {profile.oauth_provider.charAt(0).toUpperCase() +
                  profile.oauth_provider.slice(1)}{" "}
                and cannot be changed here.
              </p>
            )}
          </div>
          {infoMsg && (
            <p
              className={`text-sm ${infoMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {infoMsg.text}
            </p>
          )}
          <button
            onClick={saveInfo}
            disabled={infoSaving}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {infoSaving ? "Saving…" : "Save changes"}
          </button>
        </section>

        {/* Password */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            {profile.has_password ? "Change password" : "Set a password"}
          </h2>
          {!profile.has_password && (
            <p className="text-xs text-slate-400">
              You signed up with {profile.oauth_provider}. Setting a password
              lets you also log in with email.
            </p>
          )}
          {profile.has_password && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Current password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {profile.has_password ? "New password" : "Password"}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            />
          </div>
          {pwMsg && (
            <p
              className={`text-sm ${pwMsg.type === "ok" ? "text-emerald-400" : "text-red-400"}`}
            >
              {pwMsg.text}
            </p>
          )}
          <button
            onClick={savePassword}
            disabled={pwSaving || !newPassword}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
          >
            {pwSaving
              ? "Saving…"
              : profile.has_password
                ? "Change password"
                : "Set password"}
          </button>
        </section>

        {/* Account info — read only */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-slate-500">
            Account
          </h2>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Role</span>
            <span className="text-white capitalize">{profile.role}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Account created via</span>
            <span className="text-white capitalize">
              {profile.oauth_provider}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">User ID</span>
            <code className="text-xs text-slate-500 font-mono">
              {profile.id}
            </code>
          </div>
        </section>
      </div>
    </div>
  );
}
