import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* Malý deploy: jen server.js + statika. */
  output: 'standalone',
  poweredByHeader: false,
  reactStrictMode: true,

  /* Workspace balíčky se dodávají jako TS zdroj — Next je musí transpilovat. */
  transpilePackages: [
    '@zion/api',
    '@zion/contract',
    '@zion/i18n',
    '@zion/scenes',
    '@zion/session',
    '@zion/world',
    '@zion/ui',
  ],

  /* Do prohlížeče nepropadne interní URL služby. */
  env: {},
};

export default nextConfig;
