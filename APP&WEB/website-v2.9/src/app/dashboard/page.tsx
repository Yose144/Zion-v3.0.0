import type { Metadata } from "next";
import MissionControlDashboard from '@/components/MissionControlDashboard';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mission Control Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Live Mission Control: current primary host status, pool metrics, roadmap, economy, security, and single-host telemetry with internal seed containers.',
  keywords: "ZION dashboard, mission control, blockchain metrics, node status, native rust, mining pool, roadmap, economy",
};

export default function DashboardPage() {
  return <MissionControlDashboard />;
}
