import PoolBenchmarksClient from '@/components/pool/PoolBenchmarksClient';
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Hardware Benchmarks · ZION Mining Pool · ${SITE_RELEASE_LABEL}`,
  description: 'GPU and CPU benchmark results for ZION Cosmic Harmony mining. Hashrate, power efficiency, and profitability comparison.',
};

export default function PoolBenchmarksPage() {
  return <PoolBenchmarksClient />;
}
