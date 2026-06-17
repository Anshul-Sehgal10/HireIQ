import { cookies } from "next/headers";
import Link from "next/link";
import LogoutButton from "@/components/LogoutButton";

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
    while (base64.length % 4) {
      base64 += "=";
    }

    const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error("Failed to decode token on server:", error);
    return null;
  }
}

// Notice: This is now a standard async Server Component
export default async function EmployerDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  let userData: JWTPayload | null = null;

  if (token) {
    userData = decodeJWT(token);
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100">
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Employer Dashboard</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {userData ? (
          <>
            {/* Dynamic Server-Rendered Greeting */}
            <h2 className="text-2xl font-bold mb-2">
              Welcome back, {userData.full_name}!
            </h2>
            <p className="text-slate-400 mb-6">
              Managing company dashboard for registered email: <span className="text-emerald-400">{userData.email}</span>
            </p>

            {/* Interactive Action Components Grid */}
            <div className="flex flex-wrap gap-4 items-center">
              {/* Instead of router.push with an onClick event, we use a regular Next.js Link component */}
              <Link
                href="/dashboard/employer/jobs"
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2 px-4 rounded-lg transition-colors shadow-sm inline-block"
              >
                Create Job Posting
              </Link>
              
              {/* Reusable Interactive Client Component Button */}
              <div className="mt-[-24px]"> 
                <LogoutButton />
              </div>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <p className="text-red-400 font-medium mb-4">No active employer session found.</p>
            <Link href="/auth/login" className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-blue-500 transition-colors">
              Return to Login
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}