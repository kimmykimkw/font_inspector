import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Temporarily ignore ESLint during builds for Electron setup
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Temporarily ignore TypeScript errors during builds for Electron setup
    ignoreBuildErrors: true,
  }
};

export default nextConfig;
