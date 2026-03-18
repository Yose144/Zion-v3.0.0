import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download · ZION v2.9.9 — Miner, Wallet, Node',
  description: 'Download ZION Miner, Wallet & Node CLI for Windows, macOS and Linux. Native Rust binaries for the live 2.9.9 testnet.',
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
