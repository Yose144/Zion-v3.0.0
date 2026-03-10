import type { Metadata } from "next";
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Network Status · ZION TerraNova ${SITE_RELEASE_LABEL}`,
  description:
    "Real-time status of ZION native Rust blockchain nodes, mining pools, and P2P network health across the live 3-node Deeksha mesh.",
  keywords:
    "ZION network, nodes, blockchain status, mining pool, native rust, testnet",
};

export default function NetworkLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
