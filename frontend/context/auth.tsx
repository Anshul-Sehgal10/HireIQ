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

export function clearAuthCookie() {
  document.cookie = "access_token=; path=/; max-age=0; SameSite=Lax";
}

export function getAccessTokenFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("access_token="));
  return match ? match.split("=").slice(1).join("=") : null;
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

    return {
      id: payload.sub,
      full_name: payload.full_name,
      role: payload.role,
      exp: payload.exp,
    };
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
  reloadUser: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  reloadUser: () => {},
  logout: () => {},
});

// ---------------------------------------------------------------------------
// Refresh helper
// ---------------------------------------------------------------------------

async function callRefreshEndpoint(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl("/auth/refresh"), {
      method: "POST",
      credentials: "include", // sends the HttpOnly refresh_token cookie
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async (didRefresh: boolean = false): Promise<void> => {
    const token = getAccessTokenFromCookie();
    if (!token) {
      setLoading(false);
      return;
    }

    const payload = decodeJwt(token);
    if (!payload) {
      localStorage.removeItem("access_token");
      clearAuthCookie();
      setUser(null);
      setLoading(false);
      return;
    }

    if (payload.exp * 1000 < Date.now()) {
      if (didRefresh) {
        // Already tried refreshing once this pass — give up and force re-login
        localStorage.removeItem("access_token");
        clearAuthCookie();
        setUser(null);
        setLoading(false);
        return;
      }
      const refreshed = await callRefreshEndpoint();
      if (refreshed) {
        await loadUser(true); // cookie is now fresh — retry once
      } else {
        clearAuthCookie();
        setUser(null);
        setLoading(false);
      }
      return;
    }

    setUser(payload);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  // Proactively refresh ~1 minute before the access token expires, so the
  // frontend-domain cookie proxy.ts reads never goes stale mid-session.
  useEffect(() => {
    if (!user) return;
    const msUntilExpiry = user.exp * 1000 - Date.now();
    const delay = Math.max(0, msUntilExpiry - 60_000);

    const timer = setTimeout(async () => {
      const ok = await callRefreshEndpoint();
      if (ok) {
        await loadUser(true);
      } else {
        clearAuthCookie();
        setUser(null);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [user, loadUser]);

  const reloadUser = useCallback(() => { loadUser(); }, [loadUser]);

  const logout = useCallback(() => {
    clearAuthCookie();
    setUser(null);

    void fetch(apiUrl("/auth/logout"), {
      method: "POST",
      credentials: "include",
    }).finally(() => {
      window.location.href = "/auth/login";
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, reloadUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);