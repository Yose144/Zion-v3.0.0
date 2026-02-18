import type { Metadata } from "next";
import MissionControlDashboard from '@/components/MissionControlDashboard';

export const metadata: Metadata = {
  title: "Mission Control Dashboard · ZION v2.9.6 On the Star",
  description: "Live Mission Control: 72h stability run, node status, pool metrics, roadmap, economy, security — ZION TerraNova v2.9.6 TestNet",
  keywords: "ZION dashboard, mission control, blockchain metrics, node status, native rust, mining pool, roadmap, economy",
};

export default function DashboardPage() {
  return <MissionControlDashboard />;
}
