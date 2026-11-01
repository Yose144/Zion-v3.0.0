import type { NextConfig } from 'next';
import { resolve } from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  allowedDevOrigins: ['127.0.0.1'],
  /* Monorepo (K1.2): lockfile i node_modules jsou v rootu repa, ne v apps/. */
  turbopack: { root: resolve(process.cwd(), '../..') },
};

export default nextConfig;
