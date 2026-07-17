"use client";

import Link from "next/link";
import { ShieldCheck, Mail, Fingerprint, Clock } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { useAuth } from "@/context/auth";
import { Card, CardContent } from "@/components/ui/Card";
import PageHeader from "@/components/ui/PageHeader";

export default function AdminDashboard() {
  return (
    <RoleGuard allowed={["admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        title="Admin Control Center"
        description={`Signed in as ${user.full_name}`}
      />

      <div className="p-6 space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <InfoCard icon={ShieldCheck} label="Role" value={user.role} capitalize />
          <InfoCard icon={Mail} label="Signed in as" value={user.full_name} />
          <InfoCard
            icon={Clock}
            label="Session expires"
            value={new Date(user.exp * 1000).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          />
        </div>

        <Card className="p-6">
          <CardContent className="p-0 flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Fingerprint size={18} />
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">Platform analytics</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Org verification queue, token-usage-by-org, and platform-wide pipeline stats need
                a dedicated backend aggregate endpoint before they can be shown here — flagged in{" "}
                <code className="text-xs bg-muted px-1 py-0.5 rounded">TODO.md</code> for the
                backend agent. This page will grow real stat cards once that's available.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/admin/users">
            <Card interactive className="p-6 h-full">
              <CardContent className="p-0">
                <h3 className="font-semibold text-foreground">Users</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Manage employers, candidates, and flagged accounts
                </p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  label,
  value,
  capitalize,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <Card className="p-5">
      <CardContent className="p-0">
        <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon size={15} />
        </div>
        <p className={`text-sm font-semibold text-foreground ${capitalize ? "capitalize" : ""}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}