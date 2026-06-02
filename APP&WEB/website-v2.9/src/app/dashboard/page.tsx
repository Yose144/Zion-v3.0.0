import type { Metadata } from "next";
import dynamic from 'next/dynamic';
import { SITE_RELEASE_LABEL } from '@/lib/site';

const DashboardMain = dynamic(() => import('@/components/DashboardMain'));

export const metadata: Metadata = {
  title: `ZION Dashboard · ${SITE_RELEASE_LABEL}`,
  description: 'ZION Dashboard — chain telemetry, pool stats, treasury overview, and DAO governance. Read-only Guardian view.',
  keywords: "ZION dashboard, mainnet, blockchain metrics, node status, mining pool, treasury, dao",
};

export default function DashboardPage() {
  return <DashboardMain />;
}
