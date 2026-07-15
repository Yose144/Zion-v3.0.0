import type { Metadata } from "next";
import dynamic from 'next/dynamic';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const MissionControlDashboard = dynamic(
  () => import('@/components/MissionControlDashboard'),
  { ssr: false, loading: () => <div className="zion-container py-20 text-center text-gray-400">Loading Mission Control…</div> }
);

export const metadata: Metadata = {
  title: `Mission Control · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Legacy Mission Control: launch status, blockers, pool metrics, roadmap, security gates, and Edge server topology telemetry.',
  keywords: "ZION dashboard, mainnet, blockchain metrics, node status, mining pool, roadmap, security gate",
};

export default function MissionControlPage() {
  return <MissionControlDashboard />;
}
