import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Configure image optimization
  images: {
    unoptimized: true,
  },
  
  // Configure trailing slash for consistent routing
  trailingSlash: true,
  
  // Set custom dist directory
  distDir: '.next',
  
  // Disable x-powered-by header
  poweredByHeader: false,
  
  // Configure for Electron environment
  assetPrefix: process.env.NODE_ENV === 'production' && process.env.ELECTRON_APP ? '' : undefined,
  
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
