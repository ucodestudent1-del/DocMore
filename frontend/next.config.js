/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  distDir: "out",
  async rewrites() {
    return [
      { source: "/api/:path*", destination: "/api/:path*" },
    ];
  },
};

module.exports = nextConfig;
