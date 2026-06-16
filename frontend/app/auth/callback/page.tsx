"use client";

/**
 * /app/auth/callback/page.tsx
 *
 * The backend redirects here after OAuth completes:
 *   http://localhost:3000/auth/callback?access_token=xxx&refresh_token=yyy
 *
 * This page:
 * 1. Reads the tokens from the URL
 * 2. Stores them (in memory via Zustand / context, or localStorage for dev)
 * 3. Clears the tokens from the URL bar (security hygiene)
 * 4. Redirects to the appropriate dashboard based on role
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function persistSession(accessToken: string, refreshToken: string) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
  document.cookie = `access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
}

export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error = params.get("error");

    if (error) {
      console.error("OAuth error:", error);
      router.replace("/auth/login?error=" + error);
      return;
    }

    if (!accessToken || !refreshToken) {
      router.replace("/auth/login?error=missing_tokens");
      return;
    }

    persistSession(accessToken, refreshToken);

    // Decode role from the JWT payload (no library needed — just base64)
    try {
      const payload = JSON.parse(atob(accessToken.split(".")[1]));
      const role: string = payload.role;
      console.log(role)

      // Clear tokens from URL immediately (they're in storage now)
      window.history.replaceState({}, "", "/auth/callback");

      // Redirect based on role
      if (role === "admin") router.replace("/dashboard/admin");
      else if (role === "employer") router.replace("/dashboard/employer");
      else router.replace("/dashboard/candidate");

    } catch {
      router.replace("/auth/login?error=invalid_token");
    }
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm animate-pulse">
        Completing sign in…
      </p>
    </div>
  );
}