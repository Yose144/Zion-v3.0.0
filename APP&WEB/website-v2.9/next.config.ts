import type { NextConfig } from "next";
import { dirname } from "path";
import { fileURLToPath } from "url";

const rootDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // output: "standalone", // Disabled for local build on Windows (Next.js 16 bug with client-only)
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
  transpilePackages: ['zion-wallet-sdk', '@noble/ed25519', '@noble/hashes'],
  turbopack: {
    root: rootDir,
    resolveAlias: {
      net: {
        browser: './src/lib/empty-module.ts',
      },
      fs: {
        browser: './src/lib/empty-module.ts',
      },
      path: {
        browser: './src/lib/empty-module.ts',
      },
      os: {
        browser: './src/lib/empty-module.ts',
      },
      '@ledgerhq/hw-app-ada': './src/lib/empty-module.ts',
      '@ledgerhq/hw-transport-webusb': './src/lib/empty-module.ts',
      '@trezor/connect': './src/lib/empty-module.ts',
      '@trezor/connect-mobile': './src/lib/empty-module.ts',
      '@trezor/connect-web': './src/lib/empty-module.ts',
    },
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
              "connect-src 'self' https://*.zionterranova.com wss://*.zionterranova.com http://77.42.71.94:8443 http://77.42.71.94:8080 http://77.42.71.94:8444 http://100.76.16.108:8443 http://127.0.0.1:8001 http://127.0.0.1:8002 http://100.86.102.5:8001 http://100.86.102.5:8002 https://prod.spline.design https://*.spline.design https://sepolia.base.org https://mainnet.base.org https://base-rpc.publicnode.com",
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
