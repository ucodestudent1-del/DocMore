"use client";

import { useEffect, useState, useCallback, ReactNode } from "react";

type Theme = "light" | "dark" | "system";

interface ThemeContextType {
  theme: Theme;
  setTheme: (next: Theme) => void;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [theme, setThemeState] = useState<Theme>("light");

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    const root = document.documentElement;
    if (next === "system") {
      const system = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      system === "dark" ? root.classList.add("dark") : root.classList.remove("dark");
      localStorage.setItem("ed_theme", "system");
    } else if (next === "dark") {
      root.classList.add("dark");
      localStorage.setItem("ed_theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("ed_theme", "light");
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("ed_theme") as Theme | null;
    setTheme(stored ?? "light");
  }, [setTheme]);

  if (!mounted) return null;
  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

import { createContext, useContext } from "react";

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
