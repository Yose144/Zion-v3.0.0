import type { Metadata } from "next";
import MissionControlDashboard from '@/components/MissionControlDashboard';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live Mission Control: Deeksha release gate GO, node status, pool metrics, roadmap, economy, security, and 3-node mesh telemetry.',
  keywords: "ZION dashboard, mission control, blockchain metrics, node status, native rust, mining pool, roadmap, economy",
};

export default function DashboardPage() {
  return <MissionControlDashboard />;
}
