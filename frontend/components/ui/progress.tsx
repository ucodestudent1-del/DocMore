"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value?: number }
>(({ className, value, ...props }, ref) => (
  <div
    ref={ref}
    role="progressbar"
    aria-valuenow={value}
    aria-valuemin={0}
    aria-valuemax={100}
    className={cn(
      "relative w-full h-2 overflow-hidden rounded-full bg-accent",
      className
    )}
    {...props}
  >
    {value !== undefined && (
      <div
        className="flex h-full bg-primary transition-all duration-300"
        style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
      />
    )}
  </div>
));
Progress.displayName = "Progress";

export { Progress };
