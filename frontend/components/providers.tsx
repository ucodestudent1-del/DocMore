"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { Toasters } from "@/components/ui/toaster";

export function ThemeProvider({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) {
  return <NextThemesProvider {...props} attribute="class" defaultTheme="system" disableTransitionOnChange>{children}</NextThemesProvider>;
}

export function RootLayoutChildren({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toasters />
    </>
  );
}
