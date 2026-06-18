"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import OAuthButtons from "@/components/OAuthButtons";
import { apiUrl } from "@/lib/api";

type RegisterRole = "candidate" | "employer";

interface RegisterRequest {
  email: string;
  full_name: string;
  password: string;
  role: RegisterRole;
}

export default function SignupPage() {
  const router = useRouter();

  // 1. Form States
  const [formData, setFormData] = useState<RegisterRequest>({
    email: "",
    full_name: "",
    password: "",
    role: "candidate", // Default selection
  });

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);

  // 2. Input Change Handler
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // 3. Form Submission Handler (Updated for Role-Based Redirects)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(apiUrl("/auth/register"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Something went wrong during registration.",
        );
      }

      // The register endpoint returns { message: "Account created." } — no token is issued. The current code sends the user straight to /dashboard/employer which the middleware immediately bounces back to login since there's no cookie.
      // setSuccess(true);
      // // Calculate the specific route based on the selected role state
      // // Converts 'CANDIDATE' -> 'candidate' or 'EMPLOYER' -> 'employer'
      // const targetRoleRoute = formData.role.toLowerCase();

      // // Dynamic redirection delay to give the user success feedback
      // setTimeout(() => {
      //   router.push(`/dashboard/${targetRoleRoute}`);
      // }, 1500);

      // AFTER
      setSuccess(true);

      setTimeout(() => {
        router.push("/auth/login");
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to connect to the server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 text-slate-100">
      <div className="sm:mx-auto w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-bold tracking-tight text-white">
          Create your account
        </h2>
        <p className="mt-2 text-center text-sm text-slate-400">
          Or{" "}
          <Link
            href="/auth/login"
            className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            sign in to your existing account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto w-full sm:max-w-md">
        <div className="bg-slate-800 py-8 px-4 shadow-xl rounded-xl sm:px-10 border border-slate-700">
          {/* OAuth Providers Integration */}
          <div className="mb-6">
            <OAuthButtons />
          </div>

          {/* Visual Divider */}
          <div className="relative my-6">
            <div
              className="absolute inset-0 flex items-center"
              aria-hidden="true"
            >
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-slate-800 px-2 text-slate-400">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Status Message Blocks */}
          {error && (
            <div className="mb-4 bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm font-medium">
              ⚠️ {error}
            </div>
          )}

          {success && (
            // <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-sm font-medium">
            //   🎉 Account created successfully! Redirecting to your dashboard...
            // </div>
            // New logic: After registration, redirect to login page instead of dashboard since no token is issued yet.
            <div className="mb-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 p-3 rounded-lg text-sm font-medium">
              🎉 Account created! Redirecting to sign in…
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Full Name Input */}
            <div>
              <label
                htmlFor="full_name"
                className="block text-sm font-medium text-slate-300"
              >
                Full Name
              </label>
              <div className="mt-1">
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  required
                  value={formData.full_name}
                  onChange={handleChange}
                  disabled={loading || success}
                  className="block w-full rounded-lg border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm disabled:opacity-50 transition-all"
                  placeholder="John Doe"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-slate-300"
              >
                Email address
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  disabled={loading || success}
                  className="block w-full rounded-lg border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm disabled:opacity-50 transition-all"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-slate-300"
              >
                Password
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  disabled={loading || success}
                  className="block w-full rounded-lg border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm disabled:opacity-50 transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {/* Account Type Selection */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-slate-300"
              >
                I want to join as a
              </label>
              <div className="mt-1">
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  disabled={loading || success}
                  className="block w-full rounded-lg border-0 bg-slate-900 py-2 px-3 text-white shadow-sm ring-1 ring-inset ring-slate-700 focus:ring-2 focus:ring-inset focus:ring-emerald-500 sm:text-sm disabled:opacity-50 transition-all cursor-pointer"
                >
                  <option value="candidate">
                    Candidate (Looking for Jobs)
                  </option>
                  <option value="employer">Employer (Hiring Talent)</option>
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading || success}
                className="flex w-full justify-center rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 transition-colors disabled:opacity-50"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Creating account...
                  </span>
                ) : (
                  "Register Account"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
