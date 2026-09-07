"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ChevronLeft,
  ChevronRight,
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

/* ── Helpers ──────────────────────────────────────────────────────── */

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase() || "?";
}

function HireIQLogo({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M5 4v16M19 4v16M5 12h14"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M18 3l.6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6L18 3z"
        fill="currentColor"
        opacity="0.85"
      />
    </svg>
  );
}

/* ── Sidebar ──────────────────────────────────────────────────────── */

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
    <div
      className={cn(
        "relative h-screen shrink-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        open ? "w-62" : "w-15",
      )}
    >
      <aside
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card text-foreground",
          "transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          open ? "w-62" : "w-15",
        )}
      >
        {/* Brand header — pinned open: logo + brand text on the left, a
            collapse button on the right, both always visible. Collapsed:
            just the logo, which swaps to an expand button on hover (pure
            CSS via group-hover, no separate hover state needed) — this
            replaces the old whole-sidebar hover-to-peek behavior, which
            fought with intentional clicks near the edge. */}
        <div className="flex h-14 shrink-0 items-center justify-between px-3">
          {open ? (
            <Link
              href={`/${user.role}/dashboard`}
              className="flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-muted"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]">
                <HireIQLogo size={16} />
              </span>
              <span className="text-[15px] font-bold tracking-tight text-foreground">HireIQ</span>
            </Link>
          ) : (
            <div className="group relative mx-auto flex h-8 w-8 shrink-0 items-center justify-center">
              <Link
                href={`/${user.role}/dashboard`}
                aria-label="Go to dashboard"
                className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)] transition-opacity duration-150 group-hover:pointer-events-none group-hover:opacity-0"
              >
                <HireIQLogo size={18} />
              </Link>
              <button
                type="button"
                onClick={toggle}
                aria-label="Expand sidebar"
                className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-lg border border-border bg-card text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-foreground group-hover:pointer-events-auto group-hover:opacity-100"
              >
                <ChevronRight size={15} />
              </button>
            </div>
          )}

          {open && (
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ChevronLeft size={15} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5 scrollbar-none">
          <p
            className={cn(
              "mb-1 px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
              "text-muted-foreground/50 select-none",
              "transition-[opacity,max-height] duration-200 ease-out",
              open
                ? "max-h-8 opacity-100"
                : "max-h-0 overflow-hidden opacity-0",
            )}
          >
            Menu
          </p>

          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!open ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg py-2.25 text-[13px] transition-colors duration-150",
                    open ? "gap-3 px-2.5" : "justify-center px-0",
                    active
                      ? "bg-primary/10 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium",
                  )}
                >
                  {active && (
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-0.75 h-5 rounded-r-full bg-primary",
                        "origin-center animate-sidebar-indicator",
                      )}
                    />
                  )}

                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center",
                      "transition-colors duration-150",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon size={17} />
                  </span>

                  <span
                    className={cn(
                      "truncate whitespace-nowrap",
                      "transition-[opacity,transform] duration-200 ease-out",
                      open
                        ? "translate-x-0 opacity-100"
                        : "pointer-events-none absolute -translate-x-2 opacity-0",
                    )}
                  >
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Footer: profile + theme toggle */}
        <div
          className="relative shrink-0 border-t border-border px-2 py-2"
          ref={menuRef}
        >
          {menuOpen && (
            <div
              className={cn(
                "absolute bottom-full left-2 z-50 mb-2 w-60 overflow-hidden rounded-xl",
                "glass-popup animate-sidebar-menu",
              )}
            >
              <div className="flex items-center gap-2.5 border-b border-border/50 px-3.5 py-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                  {initialsFor(user.full_name ?? "?")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold text-popover-foreground">
                    {user.full_name}
                  </p>
                  <p className="truncate text-[11px] font-normal capitalize text-muted-foreground">
                    {user.role}
                  </p>
                </div>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/profile");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                    "text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <User size={15} /> Profile
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    router.push("/settings");
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                    "text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground",
                  )}
                >
                  <Settings size={15} /> Settings
                </button>

                <div className="mx-2 my-1 border-t border-border/40" />

                <button
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium",
                    "text-danger transition-colors hover:bg-danger-bg",
                  )}
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            </div>
          )}

          <div
            className={cn(
              "flex items-center",
              open ? "flex-row gap-1" : "flex-col gap-2",
            )}
          >
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-lg transition-colors hover:bg-muted",
                open
                  ? "flex-1 px-2 py-1.5 text-left"
                  : "justify-center p-1.5",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initialsFor(user.full_name ?? "?")}
              </span>

              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-start",
                  "transition-[opacity,transform] duration-200 ease-out",
                  open
                    ? "translate-x-0 opacity-100"
                    : "pointer-events-none absolute -translate-x-2 opacity-0",
                )}
              >
                <span className="w-full truncate text-[13px] font-semibold text-foreground">
                  {user.full_name ?? "Profile"}
                </span>
                <span className="text-[11px] font-normal capitalize text-muted-foreground">
                  {user.role}
                </span>
              </div>

              <ChevronsUpDown
                size={14}
                className={cn(
                  "shrink-0 text-muted-foreground",
                  "transition-opacity duration-200",
                  open
                    ? "opacity-100"
                    : "pointer-events-none absolute opacity-0",
                )}
              />
            </button>

            {open && (
              <div className="shrink-0">
                <ThemeToggle />
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}