import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Bridge · ZION v2.9.7',
  description:
    'ZION ↔ wZION cross-chain bridge — lock native ZION on L1, receive wrapped wZION on Base EVM. Trustless relay with Guardian multi-sig.',
};

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
