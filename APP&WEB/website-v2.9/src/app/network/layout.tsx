import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Network Status · ZION TerraNova v2.9.6",
  description:
    "Real-time status of ZION native Rust blockchain nodes, mining pools, and P2P network health",
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
