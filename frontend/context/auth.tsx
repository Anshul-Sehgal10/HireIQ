"use client";
/*
    Layer 3 — useAuth hook: Use this inside components when you need the user's identity to conditionally render UI, not for blocking access
    
    Using auth state in components:
    function NavBar() {
      const { user, logout } = useAuth();
      return (
        <nav>
          {user?.role === "employer" && <Link href="/dashboard/employer/jobs">Jobs</Link>}
          {user?.role === "candidate" && <Link href="/dashboard/candidate">Feed</Link>}
          <button onClick={logout}>Sign out</button>
        </nav>
      );
    }
*/

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { apiUrl } from "@/lib/api";

// ---------------------------------------------------------------------------
// Cookie helpers (frontend-domain cookies that Next.js middleware can read)
// ---------------------------------------------------------------------------

/**
 * Sets an access_token cookie on the FRONTEND domain so the Next.js middleware
 * can read it for server-side route protection. This is separate from the
 * httpOnly cookie the backend sets (which lives on the backend domain and is
 * only sent back to the backend on credentialed requests).
 *
 * Expiry is derived from the token's own `exp` claim so the cookie and the
 * token expire together. Falls back to 15 minutes if decoding fails.
 */

export function setAuthCookie(token: string) {
  try {
    let b64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) {
      b64 += "=";
    }
    const { exp } = JSON.parse(atob(b64));
    const maxAge = exp ? exp - Math.floor(Date.now() / 1000) : 900;

    const isSecure = window.location.protocol === "https:";
    const secureFlag = isSecure ? "; Secure" : "";
    document.cookie = `access_token=${token}; path=/; max-age=${Math.max(maxAge, 0)}; SameSite=Lax${secureFlag}`;
  } catch {
    document.cookie = `access_token=${token}; path=/; max-age=900; SameSite=Lax`;
  }
}

export function clearAuthCookie() {
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
}

// ---------------------------------------------------------------------------
// JWT decode helper
// ---------------------------------------------------------------------------

interface AuthUser {
  id: string;
  full_name: string;
  role: "admin" | "employer" | "candidate";
  exp: number;
}

function decodeJwt(token: string): AuthUser | null {
  try {
    const payloadBase64Url = token.split(".")[1];
    if (!payloadBase64Url) return null;

    let payloadBase64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (payloadBase64.length % 4) {
      payloadBase64 += "=";
    }

    const payload = JSON.parse(atob(payloadBase64));
    if (!payload.sub || !payload.role || !payload.exp) return null;

    return { id: payload.sub, full_name: payload.full_name, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Context types
// ---------------------------------------------------------------------------

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  logout: () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const payload = decodeJwt(token);
      if (!payload) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        clearAuthCookie();
        setUser(null);
        return;
      }

      if (payload.exp * 1000 < Date.now()) {
        // Token expired — try to silently refresh
        void refreshTokens().then(() => loadUser());
        return;
      }

      // Token is valid — keep the middleware cookie in sync with the same TTL
      setAuthCookie(token);
      setUser(payload);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      clearAuthCookie();
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const logout = useCallback(() => {
    // 1. Clear client-side storage immediately — don't wait for the API call
    localStorage.removeItem("access_token");
    clearAuthCookie();
    setUser(null);

    // 2. Tell the backend to clear the HttpOnly refresh_token cookie
    void fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include", // sends the HttpOnly cookie so backend can clear it
    }).finally(() => {
      window.location.href = "/auth/login";
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

// ---------------------------------------------------------------------------
// Token refresh (called internally when the access token has expired)
// ---------------------------------------------------------------------------

async function refreshTokens(): Promise<void> {
  const res = await fetch(apiUrl("/auth/refresh"), {
    method: "POST",
    credentials: "include",
  });

  if (!res.ok) {
    localStorage.removeItem("access_token");
    clearAuthCookie();
    return;
  }

  const { access_token } = await res.json();
  localStorage.setItem("access_token", access_token);
  setAuthCookie(access_token);
}
