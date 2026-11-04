"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, X, Sun, Moon, Monitor, LayoutDashboard, LogOut, User, Mail, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";

export default function Navbar() {
  const [user, setUser] = useState<{ id: string; email: string; name: string | null } | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [show, setShow] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, setTheme } = useTheme();

  const icons: Record<string, React.ElementType> = {
    light: Sun,
    dark: Moon,
    system: Monitor,
  };
  const Icon = icons[theme];

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
  };

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard"
              className="flex items-center gap-2"
            >
              <span className="font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">EveryDoc</span>
            </Link>
          </div>

          {checkingAuth ? (
            <div className="flex items-center gap-6">
              <div className="flex h-8 w-8 flex-shrink-0 rounded-full">
                <div className="h-4 w-4 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
              <div className="flex h-8 w-32 flex-shrink-0 space-x-4">
                <div className="h-4 w-16 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-24 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
                <div className="h-4 w-12 animate-pulse rounded-full bg-gray-200 dark:bg-gray-700"></div>
              </div>
            </div>
          ) : user ? (
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400 flex items-center gap-1">
                <LayoutDashboard size={16} strokeWidth={2} /> Dashboard
              </Link>
              <Link href="/convert" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400">
                Convert
              </Link>
              <Link href="/templates" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400">
                Templates
              </Link>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-white">{user.name || user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                >
                  Sign out
                </button>
                <button
                  onClick={cycleTheme}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  title="Toggle theme"
                >
                  <Icon size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  aria-label="Open menu"
                >
                  {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-6">
              <Link href="/dashboard" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400 flex items-center gap-1">
                <LayoutDashboard size={16} strokeWidth={2} /> Dashboard
              </Link>
              <Link href="/convert" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400">
                Convert
              </Link>
              <Link href="/templates" className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400">
                Templates
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 px-3 py-1.5 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition font-medium"
                >
                  Sign in
                </Link>
                <Link
                  href="/register"
                  className="text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md transition"
                >
                  Create account
                </Link>
                <button
                  onClick={cycleTheme}
                  className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  title="Toggle theme"
                >
                  <Icon size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setMobileOpen(!mobileOpen)}
                  className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
                  aria-label="Open menu"
                >
                  {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          )}
        </div>

        {mobileOpen && (
          <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <div className="px-4 py-3 space-y-2">
              {!user ? (
                <>
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/register"
                    onClick={() => setMobileOpen(false)}
                    className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
                  >
                    Create account
                  </Link>
                </>
              ) : (
                <>
                  <Link href="/dashboard" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Dashboard
                  </Link>
                  <Link href="/convert" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Convert
                  </Link>
                  <Link href="/templates" onClick={() => setMobileOpen(false)} className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Templates
                  </Link>
                  <button onClick={handleLogout} className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Sign out
                  </button>
                  <button onClick={cycleTheme} className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300">
                    Theme: {theme}
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
