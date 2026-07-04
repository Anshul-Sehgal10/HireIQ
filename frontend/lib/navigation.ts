// lib/navigation.ts

import {
  LayoutDashboard,
  Briefcase,
  Building2,
  Users,
  FileText,
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
      href: "/admin/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Users",
      href: "/admin/users",
      icon: Users,
    },
  ],

  employer: [
    {
      label: "Dashboard",
      href: "/employer/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Jobs",
      href: "/employer/jobs",
      icon: Briefcase,
    },
    {
      label: "Organization",
      href: "/employer/organization",
      icon: Building2,
    },
  ],

  candidate: [
    {
      label: "Dashboard",
      href: "/candidate/dashboard",
      icon: LayoutDashboard,
    },
    {
      label: "Jobs",
      href: "/candidate/jobs",
      icon: Briefcase,
    },
    { 
      label: "Resumes",
      href: "/candidate/resumes", 
      icon: FileText
    },
  ],
};
