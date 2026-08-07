import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  distDir: 'dist',
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
};

export default nextConfig;
