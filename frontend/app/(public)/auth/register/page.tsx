"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import OAuthButtons from "@/components/OAuthButtons";
import AuthHeader from "@/components/AuthHeader";
import Button from "@/components/ui/Button";
import { Field, Input, Select } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api";
import { getAccessTokenFromCookie, useAuth } from "@/context/auth";

type RegisterRole = "candidate" | "employer";

interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
  role: RegisterRole;
}

function decodeJwtPayload(token: string): { role?: string } | null {
  try {
    let b64 = token.split(".")[1];
    if (!b64) return null;
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64)) as { role?: string };
  } catch {
    return null;
  }
}

const HIGHLIGHTS = [
  "A personalized job feed — not a generic firehose",
  "Ranked candidates with match score + AI summary",
  "Live token-cost visibility, AWS-style transparency",
];

export default function SignupPage() {
  const router = useRouter();
  const { reloadUser } = useAuth();

  const [formData, setFormData] = useState<RegisterRequest>({
    email: "",
    full_name: "",
    password: "",
    role: "candidate",
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || "Registration failed.");

      const token = getAccessTokenFromCookie();
      if (!token) throw new Error("No session cookie set after registration.");

      const payload = decodeJwtPayload(token);
      const role = payload?.role?.toLowerCase();
      if (!role) throw new Error("Could not resolve role from token.");

      setSuccess(true);
      reloadUser();
      router.replace(`/${role}/dashboard`);
    } catch (err: any) {
      setError(err.message || "Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AuthHeader mode="register" />

      <div className="grid flex-1 overflow-hidden lg:grid-cols-2">
        {/* Form column — LEFT on register (opposite of login), only scrollable element */}
        <div className="order-2 flex flex-col overflow-y-auto scrollbar-none lg:order-1">
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            <div className="w-full max-w-sm animate-auth-content space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
                <p className="mt-2 text-sm text-muted-foreground">Set up in under a minute.</p>
              </div>

              <OAuthButtons mode="register" />

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              {error && (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-foreground">
                  {error}
                </div>
              )}

              {success && (
                <div className="rounded-lg border border-success-border bg-success-bg px-4 py-2.5 text-sm text-success-foreground">
                  Account created! Redirecting…
                </div>
              )}

              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field label="Full name" htmlFor="full_name" required>
                  <Input
                    id="full_name" name="full_name" type="text" required
                    value={formData.full_name} onChange={handleChange}
                    disabled={loading || success} placeholder="John Doe"
                  />
                </Field>

                <Field label="Email address" htmlFor="email" required>
                  <Input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={formData.email} onChange={handleChange}
                    disabled={loading || success} placeholder="you@example.com"
                  />
                </Field>

                <Field label="Password" htmlFor="password" required>
                  <Input
                    id="password" name="password" type="password" autoComplete="new-password" required
                    value={formData.password} onChange={handleChange}
                    disabled={loading || success} placeholder="••••••••"
                  />
                </Field>

                <Field label="I want to join as a" htmlFor="role" required>
                  <Select id="role" name="role" value={formData.role} onChange={handleChange} disabled={loading || success}>
                    <option value="candidate">Candidate (Looking for jobs)</option>
                    <option value="employer">Employer (Hiring talent)</option>
                  </Select>
                </Field>

                <Button type="submit" loading={loading} disabled={success} className="w-full">
                  Register account
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Brand column — RIGHT on register, theme-aware */}
        <div className="relative order-1 hidden overflow-hidden bg-background lg:order-2 lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-bl from-primary/10 via-transparent to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
          />
          <span />
          <div className="relative z-10 max-w-md animate-auth-panel-right self-end text-right">
            <h2 className="text-3xl font-bold leading-tight text-foreground">
              Screen for thinking,
              <br />
              <span className="text-primary">not prompting.</span>
            </h2>
            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start justify-end gap-2.5 text-sm text-muted-foreground">
                  {h}
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 text-right text-xs text-muted-foreground">
            Verified employers. Real screening signal. No spreadsheets.
          </p>
        </div>
      </div>
    </div>
  );
}