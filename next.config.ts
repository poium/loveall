import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Disable TypeScript checking during build for Vercel deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  // Disable ESLint during build
  eslint: {
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
