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
};

module.exports = nextConfig;
