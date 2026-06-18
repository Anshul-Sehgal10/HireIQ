import { cookies } from "next/headers";
import Link from "next/link";

type UserRole = 'admin' | 'candidate' | 'employer';

interface JWTPayload {
  sub: string;         // Internal database User ID
  role: UserRole;
  email: string;
  full_name: string;   
  type: 'access';
  exp: number;
}

function decodeJwtPayload(token: string): JWTPayload | null {
  try {
    let b64 = token.split(".")[1];
    if (!b64) return null;
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    while (b64.length % 4) b64 += "=";
    
    // Server-safe native Node decoding
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8")) as JWTPayload;
  } catch {
    return null;
  }
}

// Converted to async Server Component
export default async function AdminDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value || "";

  const tokenData = decodeJwtPayload(token);

  // Fallback protection check if a user sneaks past middleware without admin claims
  if (!tokenData || tokenData.role !== 'admin') {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-100 p-8 flex flex-col items-center justify-center">
        <p className="text-red-400 font-medium mb-4">Access Denied. Insufficient administrative privileges.</p>
        <Link href="/auth/login" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 transition-colors">
          Return to Login
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-8">
      {/* Top Navigation Bar */}
      <header className="flex flex-col sm:flex-row justify-between sm:items-center border-b border-slate-800 pb-6 mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Control Center</h1>
          <p className="text-slate-400 mt-1">Welcome back, {tokenData.full_name}</p>
        </div>
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
              <p className="text-lg font-medium">{tokenData.full_name}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Email Address</label>
              <p className="text-lg font-medium break-all">{tokenData.email}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Assigned Security Role</label>
              <span className="inline-block mt-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                {tokenData.role}
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
                {tokenData.sub}
              </code>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Token Expiration (Unix Epoch)</label>
              <p className="text-lg font-medium font-mono">{tokenData.exp}</p>
            </div>
            <div>
              <label className="text-xs text-slate-400 uppercase tracking-wider block">Readable Expiry Date</label>
              <p className="text-sm font-medium text-slate-300">
                {new Date(tokenData.exp * 1000).toLocaleString()}
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
                {token}
              </p>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}