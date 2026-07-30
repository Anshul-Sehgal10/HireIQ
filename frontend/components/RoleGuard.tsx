"use client";

/*

    Layer 2 — RoleGuard component: Use this for pages where the route is shared but content is role-specific, or as a fallback when you want a client-side double-check.

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
import { PageLoader } from "./ui";

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
      router.replace("/auth/login");
    }
  }, [user, loading, allowed, router]);

  if (loading || !user || !allowed.includes(user.role)) {
    return <PageLoader label="Checking access…" />;
  }

  return <>{children}</>;
}