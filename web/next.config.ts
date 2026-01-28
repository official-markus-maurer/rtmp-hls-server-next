import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // output: 'export', // Disable static export for dynamic routes
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['streams.ryuum3gum1n.de', 'localhost:3030'],
  experimental: {
    serverActions: {
      allowedOrigins: ['streams.ryuum3gum1n.de', 'localhost:3030'],
    },
  },
  // Allow cross-origin requests from custom domain
  // Note: This is for Next.js dev server, but we are running custom server.js
  // However, it's good practice to have it here if we switch back.
};

export default nextConfig;
