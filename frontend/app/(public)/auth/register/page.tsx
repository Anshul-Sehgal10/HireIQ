"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";
import ThemeToggle from "@/components/ui/ThemeToggle";
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

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
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
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <Link href="/" className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-lg font-bold tracking-tight">HireIQ</span>
        </Link>
        <ThemeToggle />
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-16">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Create your account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Already have one?{" "}
              <Link href="/auth/login" className="font-medium text-primary hover:text-primary-hover transition-colors">
                Sign in
              </Link>
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-sm space-y-6">
            <OAuthButtons mode="register" />

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
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
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  disabled={loading || success}
                  placeholder="John Doe"
                />
              </Field>

              <Field label="Email address" htmlFor="email" required>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading || success}
                  placeholder="you@example.com"
                />
              </Field>

              <Field label="Password" htmlFor="password" required>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading || success}
                  placeholder="••••••••"
                />
              </Field>

              <Field label="I want to join as a" htmlFor="role" required>
                <Select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading || success}
                >
                  <option value="candidate">Candidate (Looking for Jobs)</option>
                  <option value="employer">Employer (Hiring Talent)</option>
                </Select>
              </Field>

              <Button type="submit" loading={loading} disabled={success} className="w-full">
                Register Account
              </Button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}