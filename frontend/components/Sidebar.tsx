"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useState, useEffect } from "react";
import {
  ChevronLeft,
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
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M5 4v16M19 4v16M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M18 3l.6 1.4L20 5l-1.4.6L18 7l-.6-1.4L16 5l1.4-.6L18 3z" fill="currentColor" opacity="0.85" />
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
  const [hovering, setHovering] = useState(false);
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

  // `expanded` drives everything visual (labels, widths inside the aside).
  // `open` alone drives the layout track below — hovering while collapsed
  // never shifts the main content, it only lets the sidebar itself pop out
  // and overlap it.
  const expanded = open || hovering;

  return (
    <div
      className={cn(
        "relative h-screen shrink-0",
        "transition-[width] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
        open ? "w-[248px]" : "w-[60px]",
      )}
    >
      <aside
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => !menuOpen && setHovering(false)}
        className={cn(
          "absolute inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-card text-foreground",
          "transition-[width,box-shadow] duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          expanded ? "w-[248px]" : "w-[60px]",
          hovering && !open && "shadow-2xl shadow-black/10",
        )}
      >
        {/* Floating collapse/expand handle — fixed position always, only the
            chevron rotates, so toggling never shifts anything vertically. */}
        <button
          onClick={toggle}
          aria-label={open ? "Collapse sidebar" : "Expand sidebar"}
          className="absolute -right-3 top-16 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          <ChevronLeft size={13} className={cn("transition-transform duration-300", !open && "rotate-180")} />
        </button>

        {/* Brand header */}
        <div className="flex h-14 shrink-0 items-center px-3">
          <Link
            href={`/${user.role}/dashboard`}
            className={cn(
              "flex items-center gap-2.5 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-muted",
              !expanded && "mx-auto",
            )}
          >
            <span
              className={cn(
                "flex shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground",
                "shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_1px_rgba(0,0,0,0.04)]",
                expanded ? "h-7 w-7" : "h-8 w-8",
              )}
            >
              <HireIQLogo size={expanded ? 16 : 18} />
            </span>
            <span
              className={cn(
                "text-[15px] font-bold tracking-tight text-foreground",
                "transition-[opacity,transform] duration-200 ease-out",
                expanded ? "translate-x-0 opacity-100" : "pointer-events-none absolute -translate-x-2 opacity-0",
              )}
            >
              HireIQ
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1.5 scrollbar-none">
          <p
            className={cn(
              "mb-1 px-2.5 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.12em]",
              "text-muted-foreground/50 select-none",
              "transition-[opacity,max-height] duration-200 ease-out",
              expanded ? "max-h-8 opacity-100" : "max-h-0 overflow-hidden opacity-0",
            )}
          >
            Menu
          </p>

          <div className="space-y-0.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href || pathname.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={!expanded ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg py-[9px] text-[13px] transition-colors duration-150",
                    expanded ? "gap-3 px-2.5" : "justify-center px-0",
                    active
                      ? "text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground font-medium",
                  )}
                >
                  {active && (
                    <span
                      className={cn(
                        "absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-primary",
                        "origin-center animate-sidebar-indicator",
                      )}
                    />
                  )}

                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center",
                      "transition-colors duration-150",
                      active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                    )}
                  >
                    <Icon size={17} />
                  </span>

                  <span
                    className={cn(
                      "truncate whitespace-nowrap",
                      "transition-[opacity,transform] duration-200 ease-out",
                      expanded ? "translate-x-0 opacity-100" : "pointer-events-none absolute -translate-x-2 opacity-0",
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
        <div className="relative shrink-0 border-t border-border px-2 py-2" ref={menuRef}>
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
                  <p className="truncate text-[13px] font-semibold text-popover-foreground">{user.full_name}</p>
                  <p className="truncate text-[11px] font-normal capitalize text-muted-foreground">{user.role}</p>
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

          <div className={cn("flex items-center", expanded ? "gap-1" : "flex-col gap-2")}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-lg transition-colors hover:bg-muted",
                expanded ? "flex-1 px-2 py-1.5 text-left" : "justify-center p-1.5",
              )}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                {initialsFor(user.full_name ?? "?")}
              </span>

              <div
                className={cn(
                  "flex min-w-0 flex-1 flex-col items-start",
                  "transition-[opacity,transform] duration-200 ease-out",
                  expanded ? "translate-x-0 opacity-100" : "pointer-events-none absolute -translate-x-2 opacity-0",
                )}
              >
                <span className="w-full truncate text-[13px] font-semibold text-foreground">
                  {user.full_name ?? "Profile"}
                </span>
                <span className="text-[11px] font-normal capitalize text-muted-foreground">{user.role}</span>
              </div>

              <ChevronsUpDown
                size={14}
                className={cn(
                  "shrink-0 text-muted-foreground",
                  "transition-opacity duration-200",
                  expanded ? "opacity-100" : "pointer-events-none absolute opacity-0",
                )}
              />
            </button>

            <ThemeToggle />
          </div>
        </div>
      </aside>
    </div>
  );
}