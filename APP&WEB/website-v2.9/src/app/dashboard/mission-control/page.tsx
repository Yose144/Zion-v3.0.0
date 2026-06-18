import type { Metadata } from "next";
import dynamic from 'next/dynamic';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const MissionControlDashboard = dynamic(() => import('@/components/MissionControlDashboard'));

export const metadata: Metadata = {
  title: `Mission Control · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Legacy Mission Control: launch status, blockers, pool metrics, roadmap, security gates, and Core + Edge topology telemetry.',
  keywords: "ZION dashboard, mainnet, blockchain metrics, node status, mining pool, roadmap, security gate",
};

export default function MissionControlPage() {
  return <MissionControlDashboard />;
}
