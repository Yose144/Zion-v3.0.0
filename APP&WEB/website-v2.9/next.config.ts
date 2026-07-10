import type { NextConfig } from "next";
import { dirname, resolve } from "path";
import { fileURLToPath } from "url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const emptyModule = resolve(rootDir, 'src/lib/empty-module.ts');

const nextConfig: NextConfig = {
  output: "standalone", // Enabled — Docker build uses standalone (image 2.5GB→~200MB). Local dev unaffected (next dev ignores this).
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
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
    ];
  },
  // P1-33: Security headers — CSP, X-Frame-Options, HSTS, etc.
  async headers() {
    return [
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
              "connect-src 'self' https://*.zionterranova.com wss://*.zionterranova.com http://127.0.0.1:8001 http://127.0.0.1:8002 https://prod.spline.design https://*.spline.design https://sepolia.base.org https://mainnet.base.org https://base-rpc.publicnode.com https://open.spotify.com https://api.spotify.com https://*.li.fi https://li.fi",
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

export default nextConfig;
