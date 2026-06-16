import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    reactCompiler: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;