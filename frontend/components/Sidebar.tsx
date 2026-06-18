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
      className={`
        flex h-screen flex-col border-r border-slate-700
        bg-slate-900 text-slate-100 transition-all duration-300
        ${open ? "w-64" : "w-16"}
      `}
    >
      {/* Header */}
      <div className="flex h-16 items-center justify-between border-b border-slate-700 px-4">
        {open && <div className="font-bold text-xl text-white">HireIQ</div>}
        <button
          onClick={toggle}
          className="rounded-md p-2 hover:bg-slate-700 text-slate-300"
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
              className={`
                flex items-center gap-3 rounded-lg px-3 py-2 transition-colors
                ${active
                  ? "bg-slate-600 text-white"
                  : "text-slate-300 hover:bg-slate-700 hover:text-white"
                }
              `}
            >
              <Icon size={18} />
              {open && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer — profile popup trigger */}
      <div className="border-t border-slate-700 p-2 relative" ref={menuRef}>

        {/* Popup menu — renders above the footer */}
        {menuOpen && (
          <div className="absolute bottom-full mb-2 left-0 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
            {/* User info header */}
            <div className="px-3 py-2.5 border-b border-slate-700">
              <p className="text-sm font-medium text-white truncate">
                {user.full_name}
              </p>
              <p className="text-xs text-slate-400 truncate capitalize">
                {user.role}
              </p>
            </div>

            {/* Menu items */}
            <div className="p-1">
              <button
                onClick={() => { setMenuOpen(false); router.push("/profile"); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
              >
                <User size={15} />
                Profile
              </button>
              <button
                onClick={() => { setMenuOpen(false); router.push("/settings"); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-lg transition-colors"
              >
                <Settings size={15} />
                Settings
              </button>

              <div className="border-t border-slate-700 my-1" />

              <button
                onClick={() => { setMenuOpen(false); logout(); }}
                className="flex items-center gap-3 w-full px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-lg transition-colors"
              >
                <LogOut size={15} />
                Log out
              </button>
            </div>
          </div>
        )}

        {/* Trigger button */}
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center gap-3 w-full rounded-lg px-3 py-2 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
        >
          <UserCircle size={20} />
          {open && (
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium text-white truncate w-full">
                {user.full_name ?? "Profile"}
              </span>
              <span className="text-xs text-slate-400 capitalize">
                {user.role}
              </span>
            </div>
          )}
        </button>
      </div>
    </aside>
  );
}