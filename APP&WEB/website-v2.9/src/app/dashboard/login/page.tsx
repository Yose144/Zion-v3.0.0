import type { Metadata } from "next";
import DashboardMain from '@/components/DashboardMain';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `ZION Dashboard · ${SITE_RELEASE_LABEL}`,
  description: 'ZION wallet dashboard — chain telemetry, pool stats, treasury overview, and DAO governance.',
  keywords: "ZION dashboard, wallet, mainnet, blockchain metrics, treasury, dao",
};

export default function DashboardLoginPage() {
  return <DashboardMain />;
}
