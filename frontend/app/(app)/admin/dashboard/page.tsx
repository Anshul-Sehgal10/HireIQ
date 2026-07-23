"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, Users2, Building2 } from "lucide-react";
import { RoleGuard } from "@/components/RoleGuard";
import { apiFetch } from "@/lib/api";
import {
  Card,
  CardContent,
  Button,
  Badge,
  Input,
  Select,
  PageHeader,
  SkeletonText,
  useToast,
} from "@/components/ui";

interface AdminOrg {
  id: string;
  name: string;
  domain: string | null;
  verification_status: "pending" | "verified" | "rejected" | "blocked";
  subscription_tier: string;
  owner_email: string | null;
  member_count: number;
  published_job_count: number;
}
interface AdminUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  is_verified: boolean;
}

const ORG_STATUS_VARIANT: Record<
  string,
  "default" | "success" | "warning" | "danger"
> = {
  pending: "warning",
  verified: "success",
  rejected: "danger",
  blocked: "danger",
};

export default function AdminDashboard() {
  return (
    <RoleGuard allowed={["admin"]}>
      <DashboardContent />
    </RoleGuard>
  );
}

function DashboardContent() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"orgs" | "users">("orgs");

  const [orgs, setOrgs] = useState<AdminOrg[]>([]);
  const [orgStatusFilter, setOrgStatusFilter] = useState("");
  const [orgQuery, setOrgQuery] = useState("");
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [busyOrgId, setBusyOrgId] = useState<string | null>(null);

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roleFilter, setRoleFilter] = useState("");
  const [userQuery, setUserQuery] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);

  const loadOrgs = async () => {
    setLoadingOrgs(true);
    try {
      const params = new URLSearchParams();
      if (orgStatusFilter) params.set("verification_status", orgStatusFilter);
      if (orgQuery.trim()) params.set("q", orgQuery.trim());
      const res = await apiFetch(`/admin/orgs?${params.toString()}`);
      if (res.ok) setOrgs((await res.json()).items ?? []);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const params = new URLSearchParams();
      if (roleFilter) params.set("role", roleFilter);
      if (userQuery.trim()) params.set("q", userQuery.trim());
      const res = await apiFetch(`/admin/users?${params.toString()}`);
      if (res.ok) setUsers((await res.json()).items ?? []);
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    loadOrgs(); /* eslint-disable-next-line */
  }, [orgStatusFilter]);
  useEffect(() => {
    loadUsers(); /* eslint-disable-next-line */
  }, [roleFilter]);

  const orgAction = async (
    org: AdminOrg,
    action: "verify" | "reject" | "block" | "unblock",
  ) => {
    setBusyOrgId(org.id);
    try {
      const res = await apiFetch(`/admin/orgs/${org.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.detail ?? `Failed to ${action} organisation`);
      setOrgs((prev) =>
        prev.map((o) => (o.id === org.id ? { ...o, ...data } : o)),
      );
      toast({ title: `Organisation ${action}ed`, variant: "success" });
    } catch (e: any) {
      toast({
        title: `Failed to ${action}`,
        description: e.message,
        variant: "error",
      });
    } finally {
      setBusyOrgId(null);
    }
  };

  const userAction = async (user: AdminUser, action: "block" | "unblock") => {
    setBusyUserId(user.id);
    try {
      const res = await apiFetch(`/admin/users/${user.id}/${action}`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail ?? `Failed to ${action} user`);
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...data } : u)),
      );
      toast({ title: `User ${action}ed`, variant: "success" });
    } catch (e: any) {
      toast({
        title: `Failed to ${action}`,
        description: e.message,
        variant: "error",
      });
    } finally {
      setBusyUserId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader
        title="Admin Control Center"
        description="Organisation and user moderation"
      />

      <div className="space-y-6 p-6">
        <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1 w-fit">
          <button
            onClick={() => setTab("orgs")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "orgs" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Building2 size={14} /> Organisations
          </button>
          <button
            onClick={() => setTab("users")}
            className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium transition-colors ${tab === "users" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
          >
            <Users2 size={14} /> Users
          </button>
        </div>

        {tab === "orgs" && (
          <Card className="p-5">
            <CardContent className="p-0">
              <div className="mb-4 flex flex-wrap gap-2">
                <Input
                  placeholder="Search org name…"
                  value={orgQuery}
                  onChange={(e) => setOrgQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadOrgs()}
                  className="max-w-xs"
                />
                <Select
                  value={orgStatusFilter}
                  onChange={(e) => setOrgStatusFilter(e.target.value)}
                  className="w-44"
                >
                  <option value="">All statuses</option>
                  <option value="pending">Pending</option>
                  <option value="verified">Verified</option>
                  <option value="rejected">Rejected</option>
                  <option value="blocked">Blocked</option>
                </Select>
                <Button size="sm" variant="outline" onClick={loadOrgs}>
                  Search
                </Button>
              </div>

              {loadingOrgs ? (
                <SkeletonText lines={4} />
              ) : orgs.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No organisations found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">Organisation</th>
                        <th className="py-2 pr-4 font-medium">Owner</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Members</th>
                        <th className="py-2 pr-4 font-medium">
                          Published jobs
                        </th>
                        <th className="py-2 pr-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orgs.map((org) => (
                        <tr
                          key={org.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <p className="font-medium text-foreground">
                              {org.name}
                            </p>
                            {org.domain && (
                              <p className="text-xs text-muted-foreground">
                                {org.domain}
                              </p>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-muted-foreground">
                            {org.owner_email ?? "—"}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={
                                ORG_STATUS_VARIANT[org.verification_status]
                              }
                              dot
                              className="capitalize"
                            >
                              {org.verification_status}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">{org.member_count}</td>
                          <td className="py-3 pr-4">
                            {org.published_job_count}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex flex-wrap gap-1.5">
                              {org.verification_status !== "verified" &&
                                org.verification_status !== "blocked" && (
                                  <Button
                                    size="sm"
                                    loading={busyOrgId === org.id}
                                    onClick={() => orgAction(org, "verify")}
                                  >
                                    Verify
                                  </Button>
                                )}
                              {org.verification_status === "pending" && (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  loading={busyOrgId === org.id}
                                  onClick={() => orgAction(org, "reject")}
                                >
                                  Reject
                                </Button>
                              )}
                              {org.verification_status !== "blocked" ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busyOrgId === org.id}
                                  onClick={() => orgAction(org, "block")}
                                >
                                  Block
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busyOrgId === org.id}
                                  onClick={() => orgAction(org, "unblock")}
                                >
                                  Unblock
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {tab === "users" && (
          <Card className="p-5">
            <CardContent className="p-0">
              <div className="mb-4 flex flex-wrap gap-2">
                <Input
                  placeholder="Search name or email…"
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && loadUsers()}
                  className="max-w-xs"
                />
                <Select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-44"
                >
                  <option value="">All roles</option>
                  <option value="admin">Admin</option>
                  <option value="employer">Employer</option>
                  <option value="candidate">Candidate</option>
                </Select>
                <Button size="sm" variant="outline" onClick={loadUsers}>
                  Search
                </Button>
              </div>

              {loadingUsers ? (
                <SkeletonText lines={4} />
              ) : users.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  No users found.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-4 font-medium">User</th>
                        <th className="py-2 pr-4 font-medium">Role</th>
                        <th className="py-2 pr-4 font-medium">Status</th>
                        <th className="py-2 pr-4 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr
                          key={u.id}
                          className="border-b border-border last:border-0"
                        >
                          <td className="py-3 pr-4">
                            <p className="font-medium text-foreground">
                              {u.full_name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {u.email}
                            </p>
                          </td>
                          <td className="py-3 pr-4 capitalize text-muted-foreground">
                            {u.role}
                          </td>
                          <td className="py-3 pr-4">
                            <Badge
                              variant={u.is_active ? "success" : "danger"}
                              dot
                            >
                              {u.is_active ? "Active" : "Blocked"}
                            </Badge>
                          </td>
                          <td className="py-3 pr-4">
                            {u.role !== "admin" &&
                              (u.is_active ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  loading={busyUserId === u.id}
                                  onClick={() => userAction(u, "block")}
                                >
                                  Block
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  loading={busyUserId === u.id}
                                  onClick={() => userAction(u, "unblock")}
                                >
                                  Unblock
                                </Button>
                              ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
