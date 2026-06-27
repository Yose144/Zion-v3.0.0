import PoolCalculatorClient from '@/components/pool/PoolCalculatorClient';
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Reward Calculator · ZION Mining Pool · ${SITE_RELEASE_LABEL}`,
  description: 'Calculate your ZION mining rewards. Hashrate input, electricity cost, ZION price, ROI, daily/monthly/yearly projections.',
};

export default function PoolCalculatorPage() {
  return <PoolCalculatorClient />;
}
