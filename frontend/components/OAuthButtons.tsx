"use client";

import { apiUrl } from "@/lib/api";

/**
 * OAuthButtons component
 *
 * Drop this into your login / register page.
 * Clicking a button just redirects to the backend login initiator —
 * the backend handles everything from there.
 *
 * Usage:
 *   import OAuthButtons from "@/components/auth/OAuthButtons";
 *   <OAuthButtons mode="login" />
 */

interface Props {
  mode?: "login" | "register"; // cosmetic only — same URL either way
}

export default function OAuthButtons({ mode = "login" }: Props) {
  const label = mode === "login" ? "Continue" : "Sign up";

  const handleOAuth = (provider: "google" | "linkedin") => {
    // Simple redirect — the backend sets the state cookie and redirects to provider
    window.location.href = apiUrl(`/auth/${provider}/login`);
  };

  return (
    <div className="flex flex-col gap-3 w-full">
      {/* Google */}
      <button
        onClick={() => handleOAuth("google")}
        className="flex items-center justify-center gap-3 w-full px-4 py-2.5
                   border border-border rounded-lg bg-background hover:bg-muted
                   transition-colors text-sm font-medium"
      >
        <GoogleIcon />
        {label} with Google
      </button>

      {/* LinkedIn */}
      <button
        onClick={() => handleOAuth("linkedin")}
        className="flex items-center justify-center gap-3 w-full px-4 py-2.5
                   border border-border rounded-lg bg-[#0077B5] hover:bg-[#006399]
                   transition-colors text-sm font-medium text-white"
      >
        <LinkedInIcon />
        {label} with LinkedIn
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline SVG icons (no extra dependencies)
// ---------------------------------------------------------------------------

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.961L3.964 6.293C4.672 4.166 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="white">
      <path d="M16.2 0H1.8C.81 0 0 .81 0 1.8v14.4C0 17.19.81 18 1.8 18h14.4c.99 0 1.8-.81 1.8-1.8V1.8C18 .81 17.19 0 16.2 0zM5.4 15.3H2.7V6.75h2.7V15.3zM4.05 5.58a1.575 1.575 0 1 1 0-3.15 1.575 1.575 0 0 1 0 3.15zM15.3 15.3h-2.7v-4.41c0-1.05-.018-2.4-1.462-2.4-1.463 0-1.688 1.143-1.688 2.325V15.3H6.75V6.75h2.59v1.237h.036c.36-.682 1.24-1.4 2.553-1.4 2.73 0 3.232 1.796 3.232 4.133V15.3H15.3z"/>
    </svg>
  );
}