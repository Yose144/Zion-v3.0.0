import type { Metadata } from 'next';
import MiningUnifiedClient from '@/components/MiningUnifiedClient';
import { SITE_RELEASE_LABEL } from '@/lib/site';

export const metadata: Metadata = {
  title: `Mining & Node Guide | Pruvodce tezbou a nodem · ZION ${SITE_RELEASE_LABEL}`,
  description: 'Complete mining guide / Kompletní průvodce těžbou — CPU, GPU, pool, solo mining a full node setup. Cosmic Harmony v3, RandomX, Yescrypt, Autolykos v2. Download native Rust binaries.',
};

export default function MiningPage() {
  return <MiningUnifiedClient />;
}
