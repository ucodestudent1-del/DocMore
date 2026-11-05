"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

const variantStyles = {
  default: "bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-500/20",
  destructive: "bg-red-600 text-white hover:bg-red-700",
  outline: "border border-input bg-background hover:bg-accent dark:hover:bg-slate-800",
  secondary: "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white hover:bg-slate-200 dark:hover:bg-slate-700",
  ghost: "hover:bg-accent dark:hover:bg-slate-800",
  link: "text-brand-600 underline-offset-4 hover:underline",
};

const sizeStyles = {
  default: "h-10 px-4 py-2",
  sm: "h-9 rounded-md px-3",
  lg: "h-11 rounded-lg px-8",
  icon: "h-10 w-10",
};

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
          variantStyles[variant],
          sizeStyles[size],
          className,
        )}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button };
