import type { NextConfig } from "next";

// API_URL is a server-side runtime env var (not baked at build time).
// Set API_URL=https://<backend-domain> in Railway frontend service vars.
const nextConfig: NextConfig = {
  async rewrites() {
    const backend = (
      process.env.API_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");
    return [
      {
        source: "/api/:path*",
        destination: `${backend}/:path*`,
      },
    ];
  },
};

export default nextConfig;
