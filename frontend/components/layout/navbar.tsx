"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { Menu, Sun, Moon, LogOut, User, LogIn } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { fetchMe, logout, getToken } from "@/lib/api";

export function Navbar() {
  const { setTheme, theme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState<{ username: string; email: string; tier: string } | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getToken();
      if (token) {
        try {
          const me = await fetchMe();
          setUser(me);
        } catch {
          logout();
          router.push("/login");
        }
      }
      setChecking(false);
    };
    checkAuth();
  }, [router]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (checking) {
    return null;
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-background bg-background/80 backdrop-blur px-6">
      <div className="flex items-center gap-4">
        <button className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground" aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      <div className="flex items-center gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Theme">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setTheme("light")}>Light</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("dark")}>Dark</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("system")}>System</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {user ? (
          <div className="flex items-center gap-2">
            <span className="hidden md:block text-sm text-muted-foreground">{user.username}</span>
            <Button variant="outline" size="icon" onClick={handleLogout} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button variant="outline" asChild>
            <a href="/login" className="text-sm">
              <LogIn className="mr-1 h-4 w-4" /> Sign in
            </a>
          </Button>
        )}
      </div>
    </header>
  );
}
