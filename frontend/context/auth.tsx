"use client";
/*
    Using auth state in components:
import { apiUrl } from "@/lib/api";
import { apiUrl } from "@/lib/api";
      const { user, logout } = useAuth();

      return (
        <nav>
          {user && <span>Signed in as {user.role}</span>}
          {user && <button onClick={logout}>Sign out</button>}
        </nav>
      );
    }
*/

import { createContext, useContext, useEffect, useState, useCallback } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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

    return { id: payload.sub, role: payload.role, exp: payload.exp };
  } catch {
    return null;
  }
}

interface AuthUser {
  id: string;
  role: "admin" | "employer" | "candidate";
  exp: number;
}

interface AuthCtx {
  user: AuthUser | null;
  loading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthCtx>({ user: null, loading: true, logout: () => {} });

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
        setUser(null);
        return;
      }

      if (payload.exp * 1000 < Date.now()) {
        void refreshTokens().then(() => loadUser());
        return;
      }

      setUser(payload);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const logout = () => {
    void fetch(apiUrl("/auth/logout"), { method: "POST", credentials: "include" }).finally(() => {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setUser(null);
      window.location.href = "/auth/login";
    });
  };

  return <AuthContext.Provider value={{ user, loading, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

async function refreshTokens(): Promise<void> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return;
  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ refresh_token: refresh }),
  });
  if (!res.ok) {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    return;
  }
  const { access_token, refresh_token } = await res.json();
  localStorage.setItem("access_token", access_token);
  localStorage.setItem("refresh_token", refresh_token);
}