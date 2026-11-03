"use client";

import { usePathname } from "next/navigation";
import { ThemeProvider } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { Navbar } from "@/components/layout/navbar";
import { Toasters } from "@/components/ui/toaster";

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLandingPage = pathname === "/";

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex h-screen overflow-hidden">
        {!isLandingPage && <Sidebar />}
        <div className={`flex-1 flex flex-col overflow-hidden ${isLandingPage ? "max-w-none" : ""}`}>
          {!isLandingPage && <Navbar />}
          <main id="main-content" className={`flex-1 overflow-y-auto ${isLandingPage ? "bg-white" : "bg-muted/20"} p-6 ${isLandingPage ? "p-0" : ""}`} role="main" aria-label="Main content">
            {children}
            <Toasters />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
