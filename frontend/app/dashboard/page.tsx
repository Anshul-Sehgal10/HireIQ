"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface CustomJWTPayload {
  sub: string;
  role: string;
  exp: number;
}

export default function DashboardPage() {
  const [userData, setUserData] = useState<CustomJWTPayload | null>(null);
  const [formattedExpiry, setFormattedExpiry] = useState<string>("N/A");
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");

    if (token) {
      try {
        // Simple base64 decoding on the client side
        const base64Url = token.split(".")[1];
        const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
        const jsonPayload = decodeURIComponent(
          window
            .atob(base64)
            .split("")
            .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
            .join("")
        );

        const decoded = JSON.parse(jsonPayload) as CustomJWTPayload;
        setUserData(decoded);

        if (decoded.exp) {
          setFormattedExpiry(new Date(decoded.exp * 1000).toLocaleString());
        }
      } catch (error) {
        console.error("Failed to decode client token:", error);
      }
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <p className="text-gray-500 animate-pulse">Loading session...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 sm:p-12">
      <div className="mx-auto max-w-2xl bg-white rounded-xl shadow-md overflow-hidden p-8">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Decoded session metadata from Client LocalStorage</p>
        </div>

        {userData ? (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">User ID (sub)</span>
              <code className="mt-1 block text-sm font-mono text-blue-600 break-all bg-blue-50 p-2 rounded border border-blue-100">
                {userData.sub}
              </code>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Assigned Role</span>
              <p className="mt-1 text-base font-medium text-gray-900 capitalize">{userData.role || "No role assigned"}</p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
              <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Token Expiration (exp)</span>
              <p className="mt-1 text-base font-medium text-gray-900">{formattedExpiry}</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-red-500 font-medium">No active session found (LocalStorage missing).</p>
            <Link href="/login" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}