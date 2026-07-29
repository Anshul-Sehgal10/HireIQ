"use client";

import { useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import OAuthButtons from "@/components/OAuthButtons";
import AuthHeader from "@/components/AuthHeader";
import NeuralNetworkBackground from "@/components/NeuralNetworkBackground";
import RoleToggle from "@/components/RoleToggle";
import Button from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Input";
import { apiUrl } from "@/lib/api";
import { getAccessTokenFromCookie, useAuth } from "@/context/auth";

type Mode = "login" | "register";
type RegisterRole = "candidate" | "employer";

// Durations must match the inline/utility transition durations below —
// they drive the setTimeout choreography, not just CSS.
const FADE_OUT_MS = 300;
const SLIDE_MS = 550;
const FADE_IN_MS = 400;

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

const LOGIN_HIGHLIGHTS = [
  "Semantic resume matching before you ever apply",
  "Timed scenario tests that AI polish can't fake",
  "One real-time pipeline channel — no more email black holes",
];

const REGISTER_HIGHLIGHTS = [
  "A personalized job feed — not a generic firehose",
  "Ranked candidates with match score + AI summary",
  "Live token-cost visibility, AWS-style transparency",
];

function BrandPanel({ mode }: { mode: Mode }) {
  const isLogin = mode === "login";
  return (
    <div className="relative z-10 flex h-full flex-col justify-between">
      <span className="text-xs font-semibold uppercase tracking-widest text-primary">HireIQ</span>
      <div>
        <h2 className="text-2xl font-bold leading-tight tracking-tight text-foreground xl:text-3xl">
          {isLogin ? (
            <>
              A resume can be written by ChatGPT.
              <br />
              <span className="text-primary">A timed, live scenario can't.</span>
            </>
          ) : (
            <>
              Screen for thinking,
              <br />
              <span className="text-primary">not prompting.</span>
            </>
          )}
        </h2>
        <ul className="mt-7 space-y-3">
          {(isLogin ? LOGIN_HIGHLIGHTS : REGISTER_HIGHLIGHTS).map((h) => (
            <li key={h} className="flex items-start gap-2.5 text-sm text-muted-foreground">
              <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" />
              {h}
            </li>
          ))}
        </ul>
      </div>
      <p className="text-xs text-muted-foreground">
        {isLogin
          ? "AI-native hiring — built for people who ship products, not just features."
          : "Verified employers. Real screening signal. No spreadsheets."}
      </p>
    </div>
  );
}

export default function AuthExperience({ initialMode }: { initialMode: Mode }) {
  const { reloadUser } = useAuth();

  // `mode` drives the slide direction (target); `displayMode` drives what
  // text/form is actually rendered. They're deliberately decoupled: mode
  // flips (and the slide starts) at the same moment displayMode flips,
  // but both happen while the content is invisible (textVisible=false),
  // so the swap itself is never seen — only a fade-out, then a fade-in
  // once everything has settled in its new position.
  const [mode, setMode] = useState<Mode>(initialMode);
  const [displayMode, setDisplayMode] = useState<Mode>(initialMode);
  const [textVisible, setTextVisible] = useState(true);
  const transitioningRef = useRef(false);

  const isLogin = mode === "login";

  const switchTo = (next: Mode) => {
    if (next === mode || transitioningRef.current) return;
    transitioningRef.current = true;

    setTextVisible(false); // phase 1 — fade current content out

    setTimeout(() => {
      setMode(next); // phase 2 — slide starts, content still invisible
      setDisplayMode(next);
      window.history.replaceState(null, "", `/auth/${next}`);

      setTimeout(() => {
        setTextVisible(true); // phase 3 — fade new content in, slide has settled
        transitioningRef.current = false;
      }, SLIDE_MS);
    }, FADE_OUT_MS);
  };

  // ---- login ----
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);
    try {
      const res = await fetch(apiUrl("/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Login failed" }));
        setLoginError(err.detail || "Login failed");
        return;
      }
      const token = getAccessTokenFromCookie();
      if (!token) {
        setLoginError("Login succeeded but no session cookie was set. Check CORS + credentials config.");
        return;
      }
      const role = decodeJwtPayload(token)?.role?.toLowerCase();
      if (!role) {
        setLoginError("Could not resolve user role from token.");
        return;
      }
      reloadUser();
      window.location.href = `/${role}/dashboard`;
    } catch {
      setLoginError("An error occurred. Please try again.");
    } finally {
      setLoginLoading(false);
    }
  };

  // ---- register ----
  const [regForm, setRegForm] = useState({
    email: "",
    full_name: "",
    password: "",
    role: "candidate" as RegisterRole,
  });
  const [regError, setRegError] = useState<string | null>(null);
  const [regLoading, setRegLoading] = useState(false);
  const [regSuccess, setRegSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegLoading(true);
    try {
      const res = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(regForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Registration failed.");

      const token = getAccessTokenFromCookie();
      if (!token) throw new Error("No session cookie set after registration.");
      const role = decodeJwtPayload(token)?.role?.toLowerCase();
      if (!role) throw new Error("Could not resolve role from token.");

      setRegSuccess(true);
      reloadUser();
      window.location.href = `/${role}/dashboard`;
    } catch (err: any) {
      setRegError(err.message || "Failed to connect to the server.");
    } finally {
      setRegLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-foreground">
      {/* Solid base first, canvas painted on top of it (not after it) —
          this ordering is what makes the network actually visible. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 bg-background" />
      <NeuralNetworkBackground
        className="pointer-events-none absolute inset-0 z-[1] h-full w-full opacity-70 [mask-image:radial-gradient(ellipse_75%_75%_at_50%_38%,black_40%,transparent_100%)]"
      />

      <AuthHeader
        mode={mode}
        onSwitch={() => switchTo(isLogin ? "register" : "login")}
      />

      <div className="relative z-10 flex flex-1 items-center justify-center px-4 py-6 sm:px-6">
        <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-border bg-card/95 shadow-2xl shadow-black/[0.06] backdrop-blur-sm lg:h-[600px]">
          <div className="grid h-full min-h-0 lg:grid-cols-2">
            {/* Brand panel slot */}
            <div
              className="relative hidden overflow-hidden bg-muted/40 transition-transform duration-[550ms] ease-[cubic-bezier(0.65,0,0.35,1)] lg:flex lg:p-10"
              style={{ transform: isLogin ? "translateX(0%)" : "translateX(100%)" }}
            >
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-primary/15 blur-3xl"
              />
              <div
                className="transition-all ease-out"
                style={{
                  opacity: textVisible ? 1 : 0,
                  transform: textVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
                  transitionDuration: `${textVisible ? FADE_IN_MS : FADE_OUT_MS}ms`,
                }}
              >
                <BrandPanel mode={displayMode} />
              </div>
            </div>

            {/* Form panel slot */}
            <div
              className="flex min-h-0 flex-col overflow-y-auto scrollbar-none p-6 transition-transform duration-[550ms] ease-[cubic-bezier(0.65,0,0.35,1)] sm:p-8 lg:p-10"
              style={{ transform: isLogin ? "translateX(0%)" : "translateX(-100%)" }}
            >
              <div
                className="m-auto w-full max-w-sm py-2 transition-all ease-out"
                style={{
                  opacity: textVisible ? 1 : 0,
                  transform: textVisible ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)',
                  transitionDuration: `${textVisible ? FADE_IN_MS : FADE_OUT_MS}ms`,
                }}
              >
                {displayMode === "login" ? (
                  <>
                    <div className="mb-5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome back</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">
                        Sign in to pick up right where you left off.
                      </p>
                    </div>

                    {loginError && (
                      <div className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-foreground">
                        {loginError}
                      </div>
                    )}

                    <OAuthButtons mode="login" />

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                      </div>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-3.5">
                      <Field label="Email address" htmlFor="login_email" required>
                        <Input
                          id="login_email"
                          type="email"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          required
                          placeholder="you@example.com"
                        />
                      </Field>
                      <Field label="Password" htmlFor="login_password" required>
                        <Input
                          id="login_password"
                          type="password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          required
                          placeholder="••••••••"
                        />
                      </Field>
                      <Button type="submit" loading={loginLoading} className="w-full">
                        Sign in
                      </Button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="mb-5">
                      <h1 className="text-2xl font-bold tracking-tight text-foreground">Create your account</h1>
                      <p className="mt-1.5 text-sm text-muted-foreground">Set up in under a minute.</p>
                    </div>

                    {regError && (
                      <div className="mb-4 rounded-lg border border-danger-border bg-danger-bg px-4 py-2.5 text-sm text-danger-foreground">
                        {regError}
                      </div>
                    )}
                    {regSuccess && (
                      <div className="mb-4 rounded-lg border border-success-border bg-success-bg px-4 py-2.5 text-sm text-success-foreground">
                        Account created! Redirecting…
                      </div>
                    )}

                    <OAuthButtons mode="register" />

                    <div className="relative my-5">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-border" />
                      </div>
                      <div className="relative flex justify-center text-xs">
                        <span className="bg-card px-2 text-muted-foreground">Or continue with email</span>
                      </div>
                    </div>

                    <form onSubmit={handleRegister} className="space-y-3.5">
                      <Field label="Full name" htmlFor="reg_full_name" required>
                        <Input
                          id="reg_full_name"
                          type="text"
                          required
                          value={regForm.full_name}
                          onChange={(e) => setRegForm((p) => ({ ...p, full_name: e.target.value }))}
                          disabled={regLoading || regSuccess}
                          placeholder="John Doe"
                        />
                      </Field>
                      <Field label="Email address" htmlFor="reg_email" required>
                        <Input
                          id="reg_email"
                          type="email"
                          autoComplete="email"
                          required
                          value={regForm.email}
                          onChange={(e) => setRegForm((p) => ({ ...p, email: e.target.value }))}
                          disabled={regLoading || regSuccess}
                          placeholder="you@example.com"
                        />
                      </Field>
                      <Field label="Password" htmlFor="reg_password" required>
                        <Input
                          id="reg_password"
                          type="password"
                          autoComplete="new-password"
                          required
                          value={regForm.password}
                          onChange={(e) => setRegForm((p) => ({ ...p, password: e.target.value }))}
                          disabled={regLoading || regSuccess}
                          placeholder="••••••••"
                        />
                      </Field>
                      <Field label="I want to join as a">
                        <RoleToggle
                          value={regForm.role}
                          onChange={(role) => setRegForm((p) => ({ ...p, role }))}
                          disabled={regLoading || regSuccess}
                        />
                      </Field>
                      <Button type="submit" loading={regLoading} disabled={regSuccess} className="w-full">
                        Register account
                      </Button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}