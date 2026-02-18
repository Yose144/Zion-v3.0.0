import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download · ZION v2.9.6 — Miner, Wallet, Node',
  description: 'Download ZION Miner, Wallet & Node CLI for Windows, macOS and Linux. Desktop Agent coming soon. Native Rust binaries with Cosmic Harmony v3.',
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
