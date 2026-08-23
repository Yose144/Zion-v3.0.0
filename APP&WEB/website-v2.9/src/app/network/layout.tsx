import type { Metadata } from "next";
import { SITE_NETWORK_TOPOLOGY, SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Network Status · ZION TerraNova ${SITE_RELEASE_LABEL}`,
  description:
    `Real-time status of the ZION native Rust blockchain, mining pool, and P2P network health across the live ${SITE_NETWORK_TOPOLOGY} runtime.`,
  keywords:
    "ZION network, nodes, blockchain status, mining pool, native rust, mainnet, One Love",
};

export default function NetworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
