import type { Metadata } from "next";
import DashboardMain from '@/components/DashboardMain';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Private Dashboard · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Legacy ZION operator dashboard — wallet, treasury overview, and DAO governance.',
  keywords: "ZION dashboard, wallet, mainnet, blockchain metrics, treasury, dao",
};

export default function DashboardPrivatePage() {
  return <DashboardMain />;
}
