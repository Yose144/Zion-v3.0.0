import type { Metadata } from 'next';
import MiningUnifiedClient from '@/components/MiningUnifiedClient';

export const metadata: Metadata = {
  title: 'Mining & Node Guide · ZION v2.9.6',
  description: 'Complete mining guide — CPU, GPU, Pool, Solo mining + full node setup. Cosmic Harmony v3, RandomX, Yescrypt, Autolykos v2. Download native Rust binaries.',
};

export default function MiningPage() {
  return <MiningUnifiedClient />;
}
