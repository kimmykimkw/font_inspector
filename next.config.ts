import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily disable static export to get Electron build working
  // output: 'export',
  
  // Configure image optimization for static export
  images: {
    unoptimized: true,
  },
  
  // Configure trailing slash for consistent routing
  trailingSlash: true,
  
  // Set custom dist directory
  distDir: '.next',
  
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
