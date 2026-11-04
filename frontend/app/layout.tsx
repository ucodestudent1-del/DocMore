import Navbar from "@/components/Navbar";
import { ThemeProvider } from "@/components/ThemeProvider";
import { ToastProvider } from "@/components/Toast";

export const metadata = {
  title: "EveryDoc",
  description: "Automated document generation and multi-format file conversion.",
  openGraph: {
    title: "EveryDoc",
    description: "Automated document generation and multi-format file conversion.",
    type: "website",
  },
  icons: [{ url: "/favicon.svg" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="antialiased">
      <body className="min-h-screen transition-colors duration-300">
        <ToastProvider>
          <ThemeProvider>
            <Navbar />
            <main>{children}</main>
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
