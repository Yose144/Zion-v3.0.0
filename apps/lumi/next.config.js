/** @type {import('next').NextConfig} */
const { resolve } = require('node:path');

const nextConfig = {
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,
  // Next 16 staví Turbopackem. `turbopack.root` musí být kořen workspace,
  // protože lockfile i sdílené node_modules leží v rootu repa (K1.2).
  turbopack: { root: resolve(__dirname, '../..') },
  images: {
    // V aplikaci není next/image; optimizer endpoint je vypnutý záměrně.
    unoptimized: true,
  },
  // Prisma používá dynamické fs volání, takže Turbopack táhne „celý projekt“.
  // Bez exclusion by se do artefaktu dostala lokální SQLite a `.env` (secrets).
  outputFileTracingExcludes: {
    '*': [
      './.env',
      './.env.*',
      './prisma/*.db',
      './prisma/*.db-*',
      './tsconfig.tsbuildinfo',
    ],
  },
  async headers() {
    return [
      {
        source: '/models/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=604800' }],
      },
    ];
  },
};

module.exports = nextConfig;
