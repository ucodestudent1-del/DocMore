/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  async rewrites() {
    // In development, proxy /api requests to the local backend.
    // In production, NEXT_PUBLIC_API_BASE in api.ts handles the base URL.
    if (process.env.NODE_ENV === "development") {
      return [
        { source: "/api/:path*", destination: "http://127.0.0.1:8000/api/:path*" },
      ];
    }
    return [];
  },
};

module.exports = nextConfig;
