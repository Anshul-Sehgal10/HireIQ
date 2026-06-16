'use client';

// temporary page 

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '@/lib/api';


type UserRole = 'admin' | 'candidate' | 'employer';

interface JWTPayload {
  sub: string;         // Internal database User ID
  role: UserRole;
  email: string;
  full_name: string;   // Updated from 'name' to match backend key
  type: 'access';
  exp: number;
}

function decodeJwtPayload(token: string): JWTPayload | null {
  try {
    let b64 = token.split(".")[1];
    if (!b64) return null;
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    return JSON.parse(atob(b64)) as JWTPayload;
  } catch {
    return null;
  }
}

export default function AdminDashboard() {
  const router = useRouter();
  const [tokenData, setTokenData] = useState<JWTPayload | null>(null);
  const [rawToken, setRawToken] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Helper to extract a cookie value by name
    const getCookie = (name: string): string | null => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
      return null;
    };

    // 1. Try to fetch token from Cookie, fallback to LocalStorage
    const token = getCookie('access_token') || localStorage.getItem('access_token');

    if (!token) {
      // No token found anywhere, boot to login
      console.log("No token found");
      router.push('/auth/login');
      return;
    }

    const payload = decodeJwtPayload(token);
    if (!payload || payload.role !== 'admin') {
      console.log("Not an admin or invalid token");
      router.push('/auth/login');
      return;
    }

    setRawToken(token);
    setTokenData(payload);
    setLoading(false);
  }, [router]);

  const handleLogout = () => {
    void fetch(apiUrl('/auth/logout'), {
      method: 'POST',
      credentials: 'include',
    }).finally(() => {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      router.push('/auth/login');
    });
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-white">
        <p className="text-lg animate-pulse">Decoding secure token...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      {/* Top Navigation Bar */}
      <header className="flex justify-between items-center border-b border-slate-800 pb-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Control Center</h1>
          <p className="text-slate-400 mt-1">Welcome back, {tokenData?.full_name || 'Administrator'}</p>
        </div>
        
        <button
          onClick={handleLogout}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          Logout Session
        </button>
      </header>

      {/* Main Grid Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Panel 1: User Profile Metadata */}
        <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-emerald-400 flex items-center gap-2">
            <span>👤</span> Identity Claims
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Admin Name</label>
              <p className="text-lg font-medium">{tokenData?.full_name || 'N/A'}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Email Address</label>
              <p className="text-lg font-medium break-all">{tokenData?.email}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Assigned Security Role</label>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                {tokenData?.role}
              </span>
            </div>
          </div>
        </section>

        {/* Panel 2: Token Lifecycle and Specs */}
        <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl lg:col-span-1">
          <h2 className="text-xl font-semibold mb-4 text-blue-400 flex items-center gap-2">
            <span>🔑</span> Token Lifecycle
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Unique User ID (sub)</label>
              <code className="text-sm font-mono block bg-slate-900/50 p-2 rounded mt-1 border border-slate-700/50 break-all">
                {tokenData?.sub}
              </code>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Token Expiration (Unix Epoch)</label>
              <p className="text-lg font-medium font-mono">{tokenData?.exp}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Readable Expiry Date</label>
              <p className="text-sm font-medium text-slate-300">
                {tokenData?.exp ? new Date(tokenData.exp * 1000).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>
        </section>

        {/* Panel 3: Complete Decoded JSON Object Payload */}
        <section className="bg-slate-800 rounded-xl p-6 border border-slate-700 shadow-xl lg:col-span-3">
          <h2 className="text-xl font-semibold mb-4 text-purple-400 flex items-center gap-2">
            <span>📦</span> Complete Raw JWT Payload Debugger
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Decoded JSON Object</label>
              <pre className="text-xs font-mono bg-slate-950 p-4 rounded-lg overflow-x-auto text-purple-300 border border-slate-800 max-h-64 leading-relaxed">
                {JSON.stringify(tokenData, null, 2)}
              </pre>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block mb-2">Stringified Bearer Hash Reference</label>
              <p className="text-xs font-mono bg-slate-950 p-3 rounded-lg text-slate-500 truncate select-all">
                {rawToken}
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}