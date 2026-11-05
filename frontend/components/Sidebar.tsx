"use client";

import Link from "next/link";
import {
  LayoutDashboard,
  FileText,
  RefreshCw,
  Layers,
  LogOut,
  ChevronRight,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/convert", label: "Convert", icon: RefreshCw },
  { href: "/documents", label: "Documents", icon: FileText },
  { href: "/templates", label: "Templates", icon: Layers },
];

export default function Sidebar({
  user,
  onLogout,
  collapsed,
  setCollapsed,
}: {
  user: { id: string; email: string; name: string | null } | null;
  onLogout: () => void;
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}) {
  return (
    <aside
      className={`fixed left-0 top-16 h-[calc(100vh-64px)] border-r border-input bg-background transition-all duration-300 z-20 ${
        collapsed ? "w-16" : "w-64"
      }`}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between h-12 px-4">
          {!collapsed && (
            <span className="font-bold text-lg tracking-tight text-brand-600 dark:text-brand-400">
              EveryDoc
            </span>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="rounded-md p-1.5 hover:bg-accent dark:hover:bg-slate-800 transition"
            aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          >
            {collapsed ? (
              <ChevronRight size={20} strokeWidth={2.5} />
            ) : (
              <X size={20} strokeWidth={2.5} />
            )}
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-4" aria-label="Workspace navigation">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isCollapsedIcon = collapsed ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                <Icon size={18} strokeWidth={2} />
              </div>
            ) : null;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg p-2 text-sm font-medium transition",
                  "text-slate-600 dark:text-slate-400 hover:bg-accent dark:hover:bg-slate-800 hover:text-brand-600 dark:hover:text-brand-400",
                )}
              >
                {isCollapsedIcon || <Icon size={18} strokeWidth={2} />}
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-input">
          {!collapsed && (
            <div className="space-y-3">
              <div className="px-3">
                <p className="text-xs font-medium text-slate-900 dark:text-white">
                  {user?.name || user?.email || "User"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                  {user?.email}
                </p>
              </div>
              <Separator orientation="vertical" className="my-2" />
              <Button
                variant="outline"
                size="sm"
                onClick={onLogout}
                className="w-full text-left justify-start gap-2"
              >
                <LogOut size={16} strokeWidth={2} />
                Sign out
              </Button>
            </div>
          )}
          {collapsed && (
            <button
              onClick={onLogout}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition"
              aria-label="Sign out"
            >
              <LogOut size={18} strokeWidth={2} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
