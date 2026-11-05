"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline";
}

const variantStyles = {
  default: "bg-brand-600 text-white",
  secondary: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white",
  destructive: "bg-red-600 text-white",
  outline: "border border-input text-slate-900",
};

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  ),
);
Badge.displayName = "Badge";

export { Badge };
