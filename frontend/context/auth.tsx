"use client";
/*
    Using auth state in components:
    "use client";
    import { useAuth } from "@/context/auth";

    export function Navbar() {
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
    if (!token) { setLoading(false); return; }
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp * 1000 < Date.now()) {
        // Token expired — try refresh
        refreshTokens().then(loadUser);
        return;
      }
      setUser({ id: payload.sub, role: payload.role, exp: payload.exp });
    } catch {
      localStorage.removeItem("access_token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const logout = () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    setUser(null);
    window.location.href = "/auth/candidate";
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