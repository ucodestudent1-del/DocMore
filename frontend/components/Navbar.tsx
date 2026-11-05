"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon, Monitor, LayoutDashboard, LogOut, User } from "lucide-react";
import { api } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import { Button } from "@/components/ui/button";

const icons: Record<string, React.ElementType> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/convert", label: "Convert" },
  { href: "/templates", label: "Templates" },
  { href: "/pricing", label: "Pricing" },
];

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const Icon = icons[theme as keyof typeof icons];

  const cycleTheme = () => {
    const next: string[] = ["light", "dark", "system"];
    const i = next.indexOf(theme);
    setTheme(next[(i + 1) % next.length] as any);
  };

  useEffect(() => {
    api("/api/v1/auth/me")
      .then((data: any) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleLogout = async () => {
    try {
      await api("/api/v1/auth/logout", { method: "POST" });
    } catch {}
    setUser(null);
    setMobileOpen(false);
  };

  const authLinks = (
    <div className="flex items-center gap-3">
      <Link
        href="/login"
        className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
      >
        Sign in
      </Link>
      <Button asChild size="sm">
        <a href="/register">Get Started</a>
      </Button>
      <button
        onClick={cycleTheme}
        className="p-2 rounded-md hover:bg-accent dark:hover:bg-slate-800 transition"
        aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
      >
        <Icon size={18} strokeWidth={2} />
      </button>
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden p-2 rounded-md hover:bg-accent dark:hover:bg-slate-800 transition"
        aria-label={mobileOpen ? "Close menu" : "Open menu"}
      >
        {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
      </button>
    </div>
  );

  const userLinks = (
    <div className="flex items-center gap-3">
      <div className="hidden md:flex items-center gap-3">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
        >
          <LayoutDashboard size={16} strokeWidth={2} className="mr-1.5" />
          Dashboard
        </Link>
        <Link
          href="/convert"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
        >
          Convert
        </Link>
        <Link
          href="/templates"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
        >
          Templates
        </Link>
        <Link
          href="/pricing"
          className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
        >
          Pricing
        </Link>
      </div>
      <div className="flex items-center gap-3">
        <span className="hidden md:block text-sm font-medium text-slate-900 dark:text-white">
          {user?.name || user?.email || "User"}
        </span>
        <button
          onClick={cycleTheme}
          className="p-2 rounded-md hover:bg-accent dark:hover:bg-slate-800 transition"
          aria-label={theme === "light" ? "Switch to dark theme" : "Switch to light theme"}
        >
          <Icon size={18} strokeWidth={2} />
        </button>
        <button
          onClick={handleLogout}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
        >
          Sign out <LogOut size={16} strokeWidth={2} className="ml-1" />
        </button>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-md hover:bg-accent dark:hover:bg-slate-800 transition"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
        </button>
      </div>
    </div>
  );

  const mobileMenu = (
    <div className="md:hidden bg-background border-b border-input">
      <div className="px-4 py-3 space-y-2">
        {!user ? (
          <>
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800"
            >
              Sign in
            </Link>
            <Button asChild onClick={() => setMobileOpen(false)} className="w-full">
              <a href="/register">Get Started</a>
            </Button>
          </>
        ) : (
          <>
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800"
            >
              Dashboard
            </Link>
            <Link
              href="/convert"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800"
            >
              Convert
            </Link>
            <Link
              href="/templates"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800"
            >
              Templates
            </Link>
            <Link
              href="/pricing"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-accent dark:hover:bg-slate-800"
            >
              Pricing
            </Link>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-accent dark:hover:bg-slate-800"
            >
              Sign out
            </button>
            <button
              onClick={cycleTheme}
              className="block w-full text-left px-3 py-2 rounded-lg text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-accent dark:hover:bg-slate-800"
            >
              Theme: {theme}
            </button>
          </>
        )}
      </div>
    </div>
  );

  return (
    <nav className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-input" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href={user ? "/dashboard" : "/"}
              className="flex items-center gap-2"
            >
              <span className="font-bold text-xl tracking-tight text-brand-600 dark:text-brand-400">
                EveryDoc
              </span>
            </Link>
          </div>

          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-brand-600 dark:hover:text-brand-400"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {checkingAuth ? (
              <div className="flex h-8 w-32 flex-shrink-0 space-x-2">
                <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"></div>
                <div className="h-4 w-16 animate-pulse rounded-full bg-slate-200 dark:bg-slate-700"></div>
              </div>
            ) : user ? (
              userLinks
            ) : (
              authLinks
            )}
          </div>
        </div>
      </div>
      {mobileOpen && mobileMenu}
    </nav>
  );
}
