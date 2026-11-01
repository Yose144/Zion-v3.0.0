import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  // Next 16.4.3 zapíná `experimental.reactBrowserBailout` (bailout cesta pro
  // `next/dynamic` se `ssr: false`). Bailout objekt, který se předává do
  // `use()`, umí zpracovat jen React canary, který si Next veze interně —
  // s veřejným Reactem 19.2.0 spadne hydratace na React #438
  // ("unsupported type passed to `use`") a ErrorBoundary zobrazí
  // "Something went wrong" (naměřeno: 8 z 11 stránek, live i lokálně).
  // Vypnuto, dokud Next tuhle cestu nesrovná s npm Reactem.
  experimental: { reactBrowserBailout: false },
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
