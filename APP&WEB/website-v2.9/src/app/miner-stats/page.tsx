import type { Metadata } from "next";
import MinerStatsClient from '@/components/MinerStatsClient';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Miner Statistics | Statistiky minera · ZION ${SITE_RELEASE_LABEL}`,
  description: "Track your mining performance / Sledujte výkon své těžby: hashrate, shares, efektivitu a historii plateb na ZION blockchainu",
  keywords: "ZION mining stats, statistiky těžby, hashrate tracker, mining performance, share statistics",
};

export default function MinerStatsPage() {
  return <MinerStatsClient />;
}
