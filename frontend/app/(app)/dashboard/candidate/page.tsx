import { cookies } from "next/headers";
import Link from "next/link";

interface CustomJWTPayload {
  sub: string;
  email: string;
  full_name: string;
  role: string;
  exp: number;
}

function decodeJWT(token: string): CustomJWTPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;

    let base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }

    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload) as CustomJWTPayload;
  } catch (error) {
    console.error("Failed to decode token on server:", error);
    return null;
  }
}

export default async function CandidateDashboardPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  let userData: CustomJWTPayload | null = null;
  let formattedExpiry = "N/A";

  if (token) {
    userData = decodeJWT(token);
    if (userData?.exp) {
      formattedExpiry = new Date(userData.exp * 1000).toLocaleString();
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-6 sm:p-12">
      <div className="mx-auto max-w-2xl bg-white rounded-xl shadow-md overflow-hidden p-8">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Candidate Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">Decoded session metadata securely from Server Cookies</p>
        </div>

        {userData ? (
          /* Wrapped multiple sibling items cleanly inside a single Fragment fragment wrapper */
          <>
            <div className="space-y-4">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Welcome Back</span>
                <p className="mt-1 text-lg font-bold text-gray-900">{userData.full_name}</p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <span className="block text-xs font-semibold uppercase tracking-wider text-gray-400">Email Address</span>
                <p className="mt-1 text-base text-gray-700">{userData.email}</p>
              </div>

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
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-red-500 font-medium">No active session found (Cookie missing or invalid).</p>
            <Link href="/auth/login" className="mt-4 inline-block rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-700">
              Go to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}