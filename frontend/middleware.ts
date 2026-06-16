// import { NextRequest, NextResponse } from "next/server";

// const ROLE_ROUTES: Record<string, string[]> = {
//   "/dashboard/admin":    ["admin"],
//   "/dashboard/employer": ["employer", "admin"],
//   "/dashboard/candidate":["candidate", "admin"],
// };

// function decodeRole(token: string): string | null {
//   try {
//     const payload = JSON.parse(atob(token.split(".")[1]));
//     if (payload.exp * 1000 < Date.now()) return null;
//     return payload.role;
//   } catch {
//     return null;
//   }
// }

// export function middleware(req: NextRequest) {
//   const { pathname } = req.nextUrl;

//   const matchedRoute = Object.keys(ROLE_ROUTES).find(r => pathname.startsWith(r));
//   if (!matchedRoute) return NextResponse.next();

//   const token = req.cookies.get("access_token")?.value;   // see note below
//   if (!token) return NextResponse.redirect(new URL("/auth/login", req.url));

//   const role = decodeRole(token);
//   if (!role || !ROLE_ROUTES[matchedRoute].includes(role)) {
//     return NextResponse.redirect(new URL("/auth/login", req.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   matcher: ["/dashboard/:path*"],
// };

// NEW CODE

import { NextRequest, NextResponse } from "next/server";

const ROLE_ROUTES: Record<string, string[]> = {
  "/dashboard/admin": ["admin"],
  "/dashboard/employer": ["employer", "admin"],
  "/dashboard/candidate": ["candidate", "admin"],
};

// Safe base64 decoding helper designed for Next.js Edge Runtime / Middleware
function safeDecodeJWT(token: string) {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    // Replace characters to match standard base64 format and add padding if missing
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    // Decode using standard global Buffer implementation safe for Edge
    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error("JWT payload decoding error:", error);
    return null;
  }
}

function decodeRole(token: string): string | null {
  const payload = safeDecodeJWT(token);
  console.log("Decoded JWT payload:", payload);
  if (!payload) return null;

  // Check expiration (exp is in seconds, Date.now() is in milliseconds)
  if (payload.exp && payload.exp * 1000 < Date.now()) {
    console.log("Token has expired");
    return null;
  }

  // Enforce explicit lowercase comparison as requested
  return payload.role ? payload.role.toLowerCase() : null;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Find if current route requires role-based access checking
  const matchedRoute = Object.keys(ROLE_ROUTES).find(
    (r) => pathname === r || pathname.startsWith(r + "/"),
  );
  if (!matchedRoute) return NextResponse.next();

  // Read the token cookie injected by your FastAPI backend response header
  const token = req.cookies.get("access_token")?.value;
  if (!token) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  const role = decodeRole(token);
  // DEBUG
  console.log(`Decoded role from token: ${role}, for route: ${matchedRoute}`);
  // Security validation boundary
  if (!role || !ROLE_ROUTES[matchedRoute].includes(role)) {
    console.log(
      `Access Denied. Role: ${role}, Route Requirement:`,
      ROLE_ROUTES[matchedRoute],
    );
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
