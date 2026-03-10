import type { Metadata } from "next";
import MinerStatsClient from '@/components/MinerStatsClient';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Miner Statistics · ZION ${SITE_RELEASE_LABEL}`,
  description: "Track your mining performance: hashrate, shares, efficiency, and payment history on ZION blockchain",
  keywords: "ZION mining stats, hashrate tracker, mining performance, share statistics",
};

export default function MinerStatsPage() {
  return <MinerStatsClient />;
}
