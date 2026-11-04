import Navbar from "../components/Navbar";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/Toast";

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
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-indigo-600 focus:text-white focus:rounded"
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
