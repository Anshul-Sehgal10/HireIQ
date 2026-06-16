"use client";

/**
 * /app/auth/callback/page.tsx
 *
 * The backend redirects here after OAuth completes:
 *   http://localhost:3000/auth/callback?access_token=xxx&refresh_token=yyy
 *
 * This page:
 * 1. Reads the tokens from the URL search params
 * 2. Saves them to localStorage (consistent with the email/password login flow)
 * 3. Sets the frontend-domain cookie the Next.js middleware reads for route guarding
 * 4. Clears the tokens from the URL bar (security hygiene)
 * 5. Redirects to the appropriate dashboard based on the JWT role claim
 *
 * NOTE: Tokens in query params appear in browser history. For production,
 * consider a Next.js API route that accepts a short-lived code and exchanges
 * it for tokens server-side (PKCE-style handoff).
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { setAuthCookie } from "@/context/auth";

function persistSession(accessToken: string, refreshToken: string) {
  localStorage.setItem("access_token", accessToken);
  localStorage.setItem("refresh_token", refreshToken);
}

/** Safely decodes a base64url-encoded JWT segment (handles padding and char substitution). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    let b64 = token.split(".")[1];
    if (!b64) return null;
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const error = params.get("error");

    console.log("[OAuth Callback Page] Mounted. params:", { 
      hasAccess: !!accessToken, 
      hasRefresh: !!refreshToken, 
      error 
    });

    if (error) {
      console.error("[OAuth Callback Page] Error in params:", error);
      router.replace("/auth/login?error=" + error);
      return;
    }

    if (!accessToken || !refreshToken) {
      console.error("[OAuth Callback Page] Missing tokens in params");
      router.replace("/auth/login?error=missing_tokens");
      return;
    }

    // Persist tokens — same storage strategy as email/password login
    console.log("[OAuth Callback Page] Persisting tokens to localStorage...");
    persistSession(accessToken, refreshToken);

    // Set the frontend-domain cookie so the Next.js middleware can enforce
    // role-based route protection on /dashboard/* routes.
    console.log("[OAuth Callback Page] Setting frontend-domain auth cookie...");
    setAuthCookie(accessToken);

    const payload = decodeJwtPayload(accessToken);
    console.log("[OAuth Callback Page] Decoded payload:", payload);
    if (!payload) {
      console.error("[OAuth Callback Page] Failed to decode JWT payload");
      router.replace("/auth/login?error=invalid_token");
      return;
    }

    const role = typeof payload.role === "string" ? payload.role.toLowerCase() : null;
    console.log("[OAuth Callback Page] Resolved role:", role);

    // Clear tokens from URL immediately — they're persisted in storage now
    window.history.replaceState({}, "", "/auth/callback");

    let destination = "/dashboard/candidate";
    if (role === "admin") destination = "/dashboard/admin";
    else if (role === "employer") destination = "/dashboard/employer";

    console.log("[OAuth Callback Page] Replacing router history with destination:", destination);
    router.replace(destination);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm animate-pulse">
        Completing sign in…
      </p>
    </div>
  );
}