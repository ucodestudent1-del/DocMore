/** @type {import('next').NextConfig} */
// cache-bust: remove output: export for server-side rendering
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${process.env.NEXT_PUBLIC_API_BASE || "http://127.0.0.1:8000"}/api/:path*` },
    ];
  },
};

module.exports = nextConfig;
