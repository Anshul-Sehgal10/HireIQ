// lib/navigation.ts

import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  UserCircle,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  icon: React.ElementType;
};

export const NAVIGATION: Record<string, NavItem[]> = {
  admin: [
    {
      label: "Dashboard",
      href: "/dashboard/admin",
      icon: LayoutDashboard,
    },
    {
      label: "Users",
      href: "/dashboard/admin/users",
      icon: Users,
    },
  ],

  employer: [
    {
      label: "Dashboard",
      href: "/dashboard/employer",
      icon: LayoutDashboard,
    },
    {
      label: "Jobs",
      href: "/dashboard/employer/jobs",
      icon: Briefcase,
    },
    {
      label: "Organization",
      href: "/dashboard/employer/org",
      icon: Building2,
    },
  ],

  candidate: [
    {
      label: "Dashboard",
      href: "/dashboard/candidate",
      icon: LayoutDashboard,
    },
    {
      label: "Jobs",
      href: "/jobs",
      icon: Briefcase,
    },
  ],
};