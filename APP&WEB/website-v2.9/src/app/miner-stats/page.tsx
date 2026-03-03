import type { Metadata } from "next";
import MinerStatsClient from '@/components/MinerStatsClient';

export const metadata: Metadata = {
  title: "Miner Statistics · ZION v2.9.7 On the Star",
  description: "Track your mining performance: hashrate, shares, efficiency, and payment history on ZION blockchain",
  keywords: "ZION mining stats, hashrate tracker, mining performance, share statistics",
};

export default function MinerStatsPage() {
  return <MinerStatsClient />;
}
