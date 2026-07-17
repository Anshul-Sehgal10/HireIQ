"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  LogOut,
  User,
  Settings,
  ChevronsUpDown,
} from "lucide-react";

import { NAVIGATION } from "@/lib/navigation";
import { useSidebar } from "@/context/sidebar";
import { useAuth } from "@/context/auth";
import { cn } from "@/lib/utils";
import ThemeToggle from "@/components/ui/ThemeToggle";

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { open, toggle } = useSidebar();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

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
        open ? "w-64" : "w-[68px]",
      )}
    >
      {/* Brand header */}
      <div className="flex h-16 shrink-0 items-center justify-between px-3">
        {open ? (
          <Link href={`/${user.role}/dashboard`} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-muted">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
              <Sparkles size={14} />
            </span>
            <span className="text-base font-bold tracking-tight text-foreground">HireIQ</span>
          </Link>
        ) : (
          <Link href={`/${user.role}/dashboard`} className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
            <Sparkles size={14} />
          </Link>
        )}
        {open && (
          <button
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PanelLeftClose size={17} />
          </button>
        )}
      </div>

      {!open && (
        <button
          onClick={toggle}
          aria-label="Expand sidebar"
          className="mx-auto mb-1 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <PanelLeftOpen size={17} />
        </button>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 py-2">
        {open && (
          <p className="px-2.5 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">
            Menu
          </p>
        )}
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              title={!open ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-150",
                active
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
                !open && "justify-center",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon size={17} className={cn("shrink-0 transition-colors", active ? "text-primary" : "text-muted-foreground group-hover:text-foreground")} />
              {open && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer — theme toggle + profile popup trigger */}
      <div className="relative shrink-0 border-t border-border p-2.5" ref={menuRef}>
        {menuOpen && (
          <div className="absolute bottom-full left-2.5 right-2.5 z-50 mb-2 overflow-hidden rounded-xl border border-border bg-popover shadow-xl animate-fade-in">
            <div className="flex items-center gap-2.5 border-b border-border px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initialsFor(user.full_name ?? "?")}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-popover-foreground">{user.full_name}</p>
                <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
              </div>
            </div>

            <div className="p-1">
              <button
                onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <User size={15} /> Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Settings size={15} /> Settings
              </button>
              <div className="my-1 border-t border-border" />
              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-danger transition-colors hover:bg-danger-bg"
              >
                <LogOut size={15} /> Log out
              </button>
            </div>
          </div>
        )}

        <div className={cn("flex items-center gap-1.5", open ? "justify-between" : "flex-col")}>
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-muted",
              !open && "flex-none justify-center px-1.5",
            )}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
              {initialsFor(user.full_name ?? "?")}
            </span>
            {open && (
              <>
                <div className="flex min-w-0 flex-1 flex-col items-start">
                  <span className="w-full truncate text-sm font-medium text-foreground">{user.full_name ?? "Profile"}</span>
                  <span className="text-xs capitalize text-muted-foreground">{user.role}</span>
                </div>
                <ChevronsUpDown size={14} className="shrink-0 text-muted-foreground" />
              </>
            )}
          </button>

          {open && <ThemeToggle />}
        </div>
        {!open && (
          <div className="mt-1.5 flex justify-center">
            <ThemeToggle />
          </div>
        )}
      </div>
    </aside>
  );
}