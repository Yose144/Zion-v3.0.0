import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  turbopack: { root: resolve(process.cwd(), '..') },
};

export default nextConfig;
