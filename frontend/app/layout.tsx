import Navbar from "@/components/Navbar";

export const metadata = { title: "EveryDoc", description: "Document generation and conversion" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen">
        <Navbar />
        <main>{children}</main>
      </body>
    </html>
  );
}
