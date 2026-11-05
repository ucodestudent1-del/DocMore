"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface SeparatorProps extends React.HTMLAttributes<HTMLHRElement> {
  orientation?: "horizontal" | "vertical";
  decorative?: boolean;
}

const Separator = React.forwardRef<HTMLHRElement, SeparatorProps>(
  ({ className, orientation = "horizontal", decorative = true, ...props }, ref) => (
    <hr
      ref={ref}
      aria-orientation={orientation}
      className={cn(
        "shrink-0 border-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "h-full w-[1px]",
        className,
      )}
      aria-hidden={decorative}
      {...props}
    />
  ),
);
Separator.displayName = "Separator";

export { Separator };
