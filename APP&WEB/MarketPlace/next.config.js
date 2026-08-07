/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['viem', 'wagmi'],
  images: {
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
