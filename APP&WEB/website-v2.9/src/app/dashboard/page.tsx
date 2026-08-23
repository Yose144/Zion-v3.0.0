import type { Metadata } from "next";
import MissionControlLoader from '@/app/dashboard/mission-control/MissionControlLoader';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `ZION Dashboard · ${SITE_RELEASE_LABEL}`,
  description: 'ZION Mission Control — live mainnet telemetry, pool metrics, security gates, and 30-day continuous run status.',
  keywords: "ZION dashboard, mainnet, blockchain metrics, node status, mining pool, security gate",
};

export default function DashboardPage() {
  return <MissionControlLoader />;
}
