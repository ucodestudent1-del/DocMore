import Navbar from "../components/Navbar";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/Toast";
import { Inter } from "next/font/google";
import { Metadata } from "next";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "EveryDoc",
  description: "Generate, convert, and manage your documents — all in one place.",
  openGraph: {
    title: "EveryDoc",
    description: "Generate, convert, and manage your documents — all in one place.",
    type: "website",
  },
  icons: [{ url: "/favicon.svg" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} antialiased`}>
      <body className="min-h-screen transition-colors duration-300">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-brand-600 focus:text-white focus:rounded-md"
        >
          Skip to content
        </a>
        <ToastProvider>
          <ThemeProvider>
            <Navbar />
            <main id="main-content">{children}</main>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
