import type { NextConfig } from "next";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";
import withBundleAnalyzer from "@next/bundle-analyzer";

const rootDir = dirname(fileURLToPath(import.meta.url));
const emptyModule = resolve(rootDir, 'src/lib/empty-module.ts');

const nextConfig: NextConfig = {
  output: "standalone", // Enabled — Docker build uses standalone (image 2.5GB→~200MB). Local dev unaffected (next dev ignores this).
  poweredByHeader: false,
  compress: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  images: {
    unoptimized: false,
    formats: ['image/avif', 'image/webp'],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: 'https', hostname: 'newearth.cz' },
      { protocol: 'https', hostname: '*.newearth.cz' },
      { protocol: 'https', hostname: '*.zionterranova.com' },
      { protocol: 'https', hostname: 'prod.spline.design' },
      { protocol: 'https', hostname: '*.spline.design' },
    ],
  },
  // React Compiler disabled — codebase has too many manual effects/patterns that trigger its strict rules.
  reactCompiler: false,
  experimental: {
    optimizeServerReact: true,
    serverMinification: true,
    webpackBuildWorker: true,
    parallelServerBuildTraces: true,
    memoryBasedWorkersCount: true,
    optimizePackageImports: [
      'lucide-react',
      'framer-motion',
      '@lifi/sdk',
      '@lifi/widget',
      '@lifi/widget-light',
      'ethers',
      'viem',
      '@splinetool/react-spline',
      '@react-three/drei',
      '@react-three/fiber',
    ],
  },
  typescript: {
    ignoreBuildErrors: true, // TS check v IDE, ne v Docker buildu — ušetří ~70s
  },
  transpilePackages: ['zion-wallet-sdk', '@noble/ed25519', '@noble/hashes'],
  turbopack: {
    root: rootDir,
    resolveAlias: {
      net: {
        browser: emptyModule,
      },
      fs: {
        browser: emptyModule,
      },
      path: {
        browser: emptyModule,
      },
      os: {
        browser: emptyModule,
      },
      '@trezor/connect-web': {
        browser: emptyModule,
      },
      '@trezor/connect': {
        browser: emptyModule,
      },
      '@trezor/connect-mobile': {
        browser: emptyModule,
      },
      '@ledgerhq/hw-transport-webusb': {
        browser: emptyModule,
      },
      '@ledgerhq/hw-transport-webhid': {
        browser: emptyModule,
      },
      '@ledgerhq/hw-app-ada': {
        browser: emptyModule,
      },
    },
  },
  webpack: (config) => {
    const path = require('path');
    const emptyModule = path.resolve(__dirname, 'src/lib/empty-module.ts');
    config.resolve.alias = {
      ...config.resolve.alias,
      '@trezor/connect-web': emptyModule,
      '@trezor/connect': emptyModule,
      '@trezor/connect-mobile': emptyModule,
      '@ledgerhq/hw-transport-webusb': emptyModule,
      '@ledgerhq/hw-transport-webhid': emptyModule,
      '@ledgerhq/hw-app-ada': emptyModule,
    };
    config.resolve.fallback = {
      ...config.resolve.fallback,
      net: false,
      fs: false,
      path: false,
      os: false,
      tls: false,
      child_process: false,
      http: false,
      https: false,
      crypto: false,
      stream: false,
      zlib: false,
    };
    return config;
  },
  // Redirect legacy pool subpages to unified /pool tabs
  async redirects() {
    return [
      { source: '/pool/blocks', destination: '/pool', permanent: true },
      { source: '/pool/miners', destination: '/pool', permanent: true },
      { source: '/pool/calculator', destination: '/pool', permanent: true },
      { source: '/pool/benchmarks', destination: '/pool', permanent: true },
      { source: '/zohar', destination: '/tree-of-life', permanent: true },
      { source: '/zohar/:path*', destination: '/tree-of-life/:path*', permanent: true },
      // Explorer canonical slugs -> query-param pages
      { source: '/explorer/tx/:hash', destination: '/explorer/tx?hash=:hash', permanent: true },
      { source: '/explorer/address/:addr', destination: '/explorer/address?addr=:addr', permanent: true },
      { source: '/explorer/block/:id', destination: '/explorer/block?id=:id', permanent: true },
    ];
  },
  // P1-33: Security headers — CSP, X-Frame-Options, HSTS, etc.
  async headers() {
    return [
      {
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // sw.js is served by src/app/sw.js/route.ts with no-store headers.
      // Read-only API responses can be cached briefly at the edge/CDN
      {
        source: "/api/blockchain/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=10, stale-while-revalidate=60",
          },
        ],
      },
      {
        source: "/api/metrics",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=5, stale-while-revalidate=30",
          },
        ],
      },
      {
        source: "/api/dashboard-metrics",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=5, stale-while-revalidate=30",
          },
        ],
      },
      {
        source: "/api/health",
        headers: [
          {
            key: "Cache-Control",
            value: "public, s-maxage=30, stale-while-revalidate=300",
          },
        ],
      },
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://*.zionterranova.com wss://*.zionterranova.com https://prod.spline.design https://*.spline.design https://sepolia.base.org https://mainnet.base.org https://base-rpc.publicnode.com https://open.spotify.com https://api.spotify.com https://*.li.fi https://li.fi",
              "frame-src 'self' https://widget.li.fi https://li.fi https://*.li.fi https://open.spotify.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "X-DNS-Prefetch-Control",
            value: "on",
          },
        ],
      },
    ];
  },
};

export default withBundleAnalyzer({ enabled: process.env.ANALYZE === "true" })(nextConfig);
