import { NextRequest, NextResponse } from "next/server";

/**
 * Layer 1 — Middleware, Now proxy (proxy.ts): Already handles all /dashboard/* routes. As you add new
 * protected route groups, just extend ROLE_ROUTES
 *
 * Role-based route guard.
 *
 * Reads the `access_token` cookie (set on the *frontend* domain by the
 * client after login / OAuth callback) and verifies:
 *   1. The token is present and structurally valid.
 *   2. The token has not expired.
 *   3. The user's role is allowed on the requested route.
 *
 * This is a UX-layer defence that prevents a flash of wrong content and
 * provides fast server-side redirects. It is NOT the security boundary —
 * the FastAPI backend (get_current_user + require_role) enforces that.
 *
 * The proxy handles entire subtrees — /dashboard/employer covers /dashboard/employer/jobs, /dashboard/* employer/applications, everything under it. You never need to touch proxy again for new pages under * existing route groups.
 */

const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard/admin":     ["admin"],
  "/dashboard/employer":  ["employer", "admin"],
  "/dashboard/candidate": ["candidate", "admin"],
  "/onboarding":          ["employer", "candidate", "admin"],
  "/profile":             ["admin", "employer", "candidate"],

  // Add more role-based routes here as needed. Eg -
  // "/onboarding":          ["employer", "candidate"],
  // "/apply":               ["candidate"],
};

/** Safely decodes a JWT payload. Returns null on any error. */
function safeDecodeJWT(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function decodeRole(token: string): string | null {
  const payload = safeDecodeJWT(token);
  if (!payload) return null;
  if (typeof payload.exp === "number" && payload.exp * 1000 < Date.now()) {
    return null;
  }
  return typeof payload.role === "string" ? payload.role.toLowerCase() : null;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const matchedRoute = Object.keys(ROLE_ROUTES).find(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  if (!matchedRoute) return NextResponse.next();

  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const role = decodeRole(token);
  if (!role || !ROLE_ROUTES[matchedRoute].includes(role)) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/onboarding/:path*", "/profile"],
};
