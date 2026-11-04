"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X, Sun, Moon, Monitor, LayoutDashboard } from "lucide-react";
import { setUserId } from "../lib/api";
import { useTheme } from "./ThemeProvider";

export default function Navbar() {
  const [userId, setUserIdState] = useState("");
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

  return (
    <nav className="sticky top-0 z-40 bg-white border-b border-gray-200 dark:bg-gray-900 dark:border-gray-800 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center gap-2">
            <span className="font-bold text-xl tracking-tight text-indigo-600 dark:text-indigo-400">EveryDoc</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400 flex items-center gap-1"
            >
              <LayoutDashboard size={16} strokeWidth={2} /> Dashboard
            </Link>
            <Link
              href="/convert"
              className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400"
            >
              Convert
            </Link>
            <Link
              href="/templates"
              className="text-gray-600 hover:text-indigo-600 font-medium dark:text-gray-300 dark:hover:text-indigo-400"
            >
              Templates
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={cycleTheme}
              className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              title="Toggle theme"
            >
              <Icon size={18} strokeWidth={2} />
            </button>
            {show ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">User:</span>
                <input
                  value={userId}
                  onChange={(e) => setUserIdState(e.target.value)}
                  className="border border-gray-300 rounded px-2 py-1 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  placeholder="user id"
                />
                <button
                  onClick={() => { setUserId(userId || "demo-user"); setShow(false); }}
                  className="text-xs bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700"
                >
                  Set
                </button>
              </div>
            ) : (
              <button onClick={() => setShow(true)} className="text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400">
                Sign in (dev)
              </button>
            )}
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              aria-label="Open menu"
            >
              {mobileOpen ? <X size={20} strokeWidth={2.5} /> : <Menu size={20} strokeWidth={2.5} />}
            </button>
          </div>
        </div>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
          <div className="px-4 py-3 space-y-2">
            <Link
              href="/dashboard"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Dashboard
            </Link>
            <Link
              href="/convert"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Convert
            </Link>
            <Link
              href="/templates"
              onClick={() => setMobileOpen(false)}
              className="block px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Templates
            </Link>
            <button
              onClick={() => setShow(true)}
              className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Sign in (dev)
            </button>
            <button
              onClick={cycleTheme}
              className="block w-full text-left px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300"
            >
              Theme: {theme}
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
