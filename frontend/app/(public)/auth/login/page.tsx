"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import OAuthButtons from "@/components/OAuthButtons";
import AuthHeader from "@/components/AuthHeader";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api";
import { useAuth } from "@/context/auth";

function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.split("; ").find((row) => row.startsWith("access_token="));
  return match ? match.split("=").slice(1).join("=") : null;
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
  "Semantic resume matching before you ever apply",
  "Timed scenario tests that AI polish can't fake",
  "One real-time pipeline channel — no more email black holes",
];

export default function LoginPage() {
  const { reloadUser } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        setError(err.detail || "Login failed");
        return;
      }

      const token = getAccessTokenFromCookie();
      if (!token) {
        setError("Login succeeded but no session cookie was set. Check CORS + credentials config.");
        return;
      }

      const payload = decodeJwtPayload(token);
      const role = payload?.role?.toLowerCase();
      if (!role) {
        setError("Could not resolve user role from token.");
        return;
      }

      reloadUser();
      router.replace(`/${role}/dashboard`);
    } catch (error) {
      console.error("Login error:", error);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <AuthHeader mode="login" />

      <div className="grid flex-1 overflow-hidden lg:grid-cols-2">
        {/* Brand column — LEFT on login. Theme-aware: uses card/foreground
            tokens instead of hardcoded slate, so it responds to the toggle. */}
        <div className="relative order-1 hidden overflow-hidden bg-background lg:flex lg:flex-col lg:justify-between lg:p-10">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/10 via-transparent to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-primary/20 blur-3xl"
          />
          <span />
          <div className="relative z-10 max-w-md animate-auth-panel-left">
            <h2 className="text-3xl font-bold leading-tight text-foreground">
              A resume can be written by ChatGPT.
              <br />
              <span className="text-primary">A timed, live scenario can't.</span>
            </h2>
            <ul className="mt-8 space-y-3">
              {HIGHLIGHTS.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                  <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
                  {h}
                </li>
              ))}
            </ul>
          </div>
          <p className="relative z-10 text-xs text-muted-foreground">
            AI-native hiring — built for people who ship products, not just features.
          </p>
        </div>

        {/* Form column — RIGHT on login, the only scrollable element */}
        <div className="order-2 flex flex-col overflow-y-auto scrollbar-none">
          <div className="flex flex-1 items-center justify-center px-4 py-8">
            <div className="w-full max-w-sm animate-auth-content space-y-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Sign in to your account</h1>
                <p className="mt-2 text-sm text-muted-foreground">Welcome back — pick up right where you left off.</p>
              </div>

              {error && (
                <div className="rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-foreground">
                  {error}
                </div>
              )}

              <OAuthButtons mode="login" />

              <div className="relative py-1">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <Field label="Email address" htmlFor="email" required>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" />
                </Field>

                <Field label="Password" htmlFor="password" required>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
                </Field>

                <Button type="submit" loading={loading} className="w-full">
                  Sign in
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}