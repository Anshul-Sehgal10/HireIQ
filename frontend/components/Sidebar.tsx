"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  UserCircle,
  LogOut,
  User,
  Settings,
} from "lucide-react";

import { NAVIGATION } from "@/lib/navigation";
import { useSidebar } from "@/context/sidebar";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { open, toggle } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close popup when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (!user) return null;

  const navItems = NAVIGATION[user.role] || [];

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-card text-foreground transition-all duration-300",
        open ? "w-64" : "w-16",
      )}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {open && (
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-primary" />
            <span className="text-lg font-bold tracking-tight text-foreground">HireIQ</span>
          </div>
        )}
        <button
          onClick={toggle}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {open ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon size={18} />
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer — theme toggle + profile popup trigger */}
      <div className="relative border-t border-border p-2" ref={menuRef}>
        {/* Popup menu — renders above the footer */}
        {menuOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-2 w-56 overflow-hidden rounded-xl border border-border bg-popover shadow-xl">
            {/* User info header */}
            <div className="border-b border-border px-3 py-2.5">
              <p className="truncate text-sm font-medium text-popover-foreground">
                {user.full_name}
              </p>
              <p className="truncate text-xs capitalize text-muted-foreground">
                {user.role}
              </p>
            </div>

            {/* Menu items */}
            <div className="p-1">
              <button
                onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <User size={15} />
                Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings size={15} />
                Settings
              </button>

              <div className="my-1 border-t border-border" />

              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-bg"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-1", open ? "justify-between" : "flex-col")}>
          {/* Trigger button */}
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              !open && "flex-none justify-center px-2",
            )}
          >
            <UserCircle size={20} className="shrink-0" />
            {open && (
              <div className="flex min-w-0 flex-col items-start">
                <span className="w-full truncate text-sm font-medium text-foreground">
                  {user.full_name ?? "Profile"}
                </span>
                <span className="text-xs capitalize text-muted-foreground">
                  {user.role}
                </span>
              </div>
            )}
          </button>

          <ThemeToggle />
        </div>
      </div>
    </aside>
  );
}