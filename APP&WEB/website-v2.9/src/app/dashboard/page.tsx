import type { Metadata } from "next";
import MissionControlDashboard from '@/components/MissionControlDashboard';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard | Dashboard mise · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Test-mainnet Mission Control | Dashboard mise: 48-72h rehearsal status, launch blockers, pool metrics, roadmap, security gates, and controlled 3-node telemetry.',
  keywords: "ZION dashboard, dashboard mise, test mainnet, launch rehearsal, blockchain metrics, node status, mining pool, roadmap, security gate",
};

export default function DashboardPage() {
  return <MissionControlDashboard />;
}
