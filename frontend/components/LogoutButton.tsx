"use client";

import { useRouter } from 'next/navigation';
import { apiUrl } from "@/lib/api";
import { clearAuthCookie } from "@/context/auth";

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/auth/logout'), {
        method: 'POST',
        credentials: 'include', // Important to pass along cookies to your FastAPI backend
      });
    } catch (error) {
      console.error("Failed to call backend logout api:", error);
    } finally {
      // Clear out any old local storage items just in case, then refresh and redirect
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      clearAuthCookie(); // Clear the auth cookie
      router.refresh(); // Tells Next.js to drop the page cache and read empty cookies
      router.push('/auth/login');
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="mt-6 w-full sm:w-auto bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
    >
      Logout Session
    </button>
  );
}