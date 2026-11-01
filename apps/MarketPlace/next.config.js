/** @type {import('next').NextConfig} */
const { resolve } = require('node:path');

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['viem', 'wagmi', 'three'],
  // Next 16 staví Turbopackem. Prázdná konfigurace vypíná konflikt s legacy
  // `webpack` blokem níže (aliasy pro optional native deps wallet SDK).
  // `turbopack.root` musí být `apps/` — appka importuje `apps/shared/**`, které
  // leží mimo vlastní adresář (stejný pattern jako `apps/website-v2.9`).
  turbopack: { root: resolve(__dirname, '..') },
  images: {
    // No next/image usage in the codebase — disables the /_next/image
    // optimizer endpoint entirely (npm audit GHSA-2xp9/GHSA-2464 class).
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'ipfs.io' },
      { protocol: 'https', hostname: 'gateway.pinata.cloud' },
      { protocol: 'https', hostname: 'oasis.zionterranova.com' },
      { protocol: 'https', hostname: 'app.zionterranova.com' },
    ],
  },
  webpack: (config) => {
    // Optional/native-only deps used by wallet SDKs; silence build warnings
    // in the browser bundle without adding unnecessary packages.
    config.resolve.alias = {
      ...config.resolve.alias,
      '@react-native-async-storage/async-storage': false,
      'pino-pretty': false,
    };
    return config;
  },
};

module.exports = nextConfig;
