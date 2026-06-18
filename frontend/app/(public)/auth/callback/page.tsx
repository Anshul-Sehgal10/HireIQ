"use client";

/**
 * /app/auth/callback/page.tsx
 *
 * http://localhost:3000/auth/callback?access_token=xxx
 * (refresh_token is set as an HttpOnly cookie by the backend directly)
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
import { getAccessTokenFromCookie } from "@/context/auth";

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
    const error = params.get("error");

    if (error) {
      router.replace("/auth/login?error=" + error);
      return;
    }

    // Token is already in the cookie — just decode it to get the role
    const token = getAccessTokenFromCookie();
    if (!token) {
      router.replace("/auth/login?error=missing_token");
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload) {
      router.replace("/auth/login?error=invalid_token");
      return;
    }

    const role =
      typeof payload.role === "string" ? payload.role.toLowerCase() : null;
    window.history.replaceState({}, "", "/auth/callback");
    router.replace(`/dashboard/${role ?? "candidate"}`);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground text-sm animate-pulse">
        Completing sign in…
      </p>
    </div>
  );
}
