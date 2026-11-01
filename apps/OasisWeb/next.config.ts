import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Render audits run against http://127.0.0.1; dev resource requests are blocked
  // cross-origin by default, which stalls hydration.
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
  distDir: 'dist',
  trailingSlash: false,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
