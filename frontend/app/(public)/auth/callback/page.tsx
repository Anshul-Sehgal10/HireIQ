"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getAccessTokenFromCookie } from "@/context/auth";
import { PageLoader } from "@/components/ui";

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
    router.replace(`/${role ?? "candidate"}/dashboard`);
  }, [router]);

  return <PageLoader label="Completing sign in…" />;
}