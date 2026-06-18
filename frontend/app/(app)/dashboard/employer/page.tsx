import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";

interface JWTPayload {
  sub: string;
  email: string;
  full_name: string;
  role: string;
  exp: number;
}

function decodeJWT(token: string): JWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) base64 += "=";
    return JSON.parse(Buffer.from(base64, "base64").toString("utf8")) as JWTPayload;
  } catch {
    return null;
  }
}

async function fetchOrg(accessToken: string) {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000/api/v1"}/orgs/mine`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      }
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function EmployerDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (!token) redirect("/auth/login");

  const userData = decodeJWT(token);
  if (!userData) redirect("/auth/login");

  const org = await fetchOrg(token);

  // No org → send to setup flow
  if (!org) redirect("/dashboard/employer/org/setup");

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold">Employer Dashboard</h1>
              <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded-full border border-slate-600">
                {org.name}
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 className="text-2xl font-bold mb-2">
          Welcome back, {userData.full_name}!
        </h2>
        <p className="text-slate-400 mb-8">
          {userData.email} · <span className="text-emerald-400">{org.name}</span>
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Link
            href="/dashboard/employer/jobs"
            className="bg-slate-800 border border-slate-700 hover:border-emerald-500/50 rounded-xl p-6 group transition-colors"
          >
            <div className="text-2xl mb-2">📋</div>
            <h3 className="font-semibold text-white group-hover:text-emerald-400 transition-colors">
              Job postings
            </h3>
            <p className="text-sm text-slate-400 mt-1">Create and manage open roles</p>
          </Link>

          <Link
            href="/dashboard/employer/org"
            className="bg-slate-800 border border-slate-700 hover:border-blue-500/50 rounded-xl p-6 group transition-colors"
          >
            <div className="text-2xl mb-2">🏢</div>
            <h3 className="font-semibold text-white group-hover:text-blue-400 transition-colors">
              Organisation
            </h3>
            <p className="text-sm text-slate-400 mt-1">Members, invites, and settings</p>
          </Link>

          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 opacity-50 cursor-not-allowed">
            <div className="text-2xl mb-2">📊</div>
            <h3 className="font-semibold text-white">Analytics</h3>
            <p className="text-sm text-slate-400 mt-1">Coming soon</p>
          </div>
        </div>
      </main>
    </div>
  );
}