"use client";

/*
    For cases where middleware isn't enough (or as a fallback), a <RoleGuard> component.
    Usage:
    import { RoleGuard } from "@/components/RoleGuard";

    export default function EmployerDashboard() {
      return (
        <RoleGuard allowed={["employer", "admin"]}>
          <div>Employer content here</div>
        </RoleGuard>
      );
    }
*/
import { useAuth } from "@/context/auth";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

interface Props {
  allowed: string[];
  children: React.ReactNode;
}

export function RoleGuard({ allowed, children }: Props) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user || !allowed.includes(user.role)) {
      router.replace("/auth/candidate");
    }
  }, [user, loading, allowed, router]);

  if (loading || !user || !allowed.includes(user.role)) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500 animate-pulse">Checking access…</p>
    </div>;
  }

  return <>{children}</>;
}