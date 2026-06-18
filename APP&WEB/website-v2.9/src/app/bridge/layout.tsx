import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Bridge · ZION ${SITE_RELEASE_LABEL}`,
  description:
    'ZION ↔ wZION cross-chain bridge — lock native ZION on L1, receive wrapped wZION on Base EVM. Trustless relay with Guardian multi-sig.',
};

export default function BridgeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
