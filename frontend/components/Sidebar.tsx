// components/Sidebar.tsx

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
} from "lucide-react";

import { NAVIGATION } from "@/lib/navigation";
import { useSidebar } from "@/context/sidebar";
import { useAuth } from "@/context/auth";

export default function Sidebar() {
  const pathname = usePathname();

  const { user } = useAuth();
  const { open, toggle } = useSidebar();

  if (!user) return null;

  const navItems = NAVIGATION[user.role] || [];

  return (
    <aside
      className={`
        flex
        h-screen
        flex-col
        border-r
        bg-background
        transition-all
        duration-300
        ${open ? "w-64" : "w-16"}
      `}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b px-4">
        {open && (
          <div className="font-bold text-xl">
            HireIQ
          </div>
        )}

        <button
          onClick={toggle}
          className="rounded-md p-2 hover:bg-muted"
        >
          {open ? (
            <PanelLeftClose size={18} />
          ) : (
            <PanelLeftOpen size={18} />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;

          const active =
            pathname === item.href ||
            pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex
                items-center
                gap-3
                rounded-lg
                px-3
                py-2
                transition-colors
                ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted"
                }
              `}
            >
              <Icon size={18} />

              {open && (
                <span>{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t p-2">
        <Link
          href="/profile"
          className="
            flex
            items-center
            gap-3
            rounded-lg
            px-3
            py-2
            hover:bg-muted
          "
        >
          <UserCircle size={20} />

          {open && (
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {user.full_name ?? "Profile"}
              </span>

              <span className="text-xs text-muted-foreground">
                {user.role}
              </span>
            </div>
          )}
        </Link>
      </div>
    </aside>
  );
}