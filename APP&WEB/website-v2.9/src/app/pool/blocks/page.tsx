import PoolBlocksClient from '@/components/pool/PoolBlocksClient';
import type { Metadata } from 'next';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Pool Blocks · ZION Mining Pool · ${SITE_RELEASE_LABEL}`,
  description: 'Historical block discovery chart, luck trend, reward history, and pool vs network hashrate timeline.',
};

export default function PoolBlocksPage() {
  return <PoolBlocksClient />;
}
