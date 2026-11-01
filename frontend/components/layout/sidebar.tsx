"use client";

import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Upload,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  File,
  Brain,
  History,
  Settings,
  Scissors,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Universal Converter", href: "/convert", icon: Upload },
  { name: "PDF Tools", href: "/pdf-tools", icon: FileText },
  { name: "Document Generator", href: "/generate", icon: FileText },
  { name: "Templates", href: "/templates", icon: FileText },
  { name: "Processing History", href: "/history", icon: History },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="flex h-full w-64 shrink-0 border-r border-border bg-card text-card-foreground flex-col">
      <div className="p-5 flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
          <FileText className="h-5 w-5 text-primary-foreground" />
        </div>
        <span className="font-semibold text-lg tracking-tight">DocStudio</span>
      </div>
      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {NAV.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-border">
        <Button variant="outline" className="w-full" asChild>
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </aside>
  );
}
