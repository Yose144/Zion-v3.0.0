import type { Metadata } from "next";
import dynamic from 'next/dynamic';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const MissionControlDashboard = dynamic(() => import('@/components/MissionControlDashboard'));

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Test-mainnet Mission Control: 48-72h rehearsal status, launch blockers, pool metrics, roadmap, security gates, and controlled 3-node telemetry.',
  keywords: "ZION dashboard, test mainnet, launch rehearsal, blockchain metrics, node status, mining pool, roadmap, security gate",
};

export default function DashboardPage() {
  return <MissionControlDashboard />;
}
