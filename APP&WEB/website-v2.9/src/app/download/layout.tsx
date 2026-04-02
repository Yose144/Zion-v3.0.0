import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL, SITE_RUNTIME_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Download · ZION ${SITE_RELEASE_LABEL} — Miner, Wallet, Node`,
  description: `Download ZION Miner, Wallet & Node CLI for Windows, macOS and Linux. Native Rust binaries for the controlled ${SITE_RELEASE_LABEL} public rehearsal line with ${SITE_RUNTIME_LABEL} compatibility.`,
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return children;
}
