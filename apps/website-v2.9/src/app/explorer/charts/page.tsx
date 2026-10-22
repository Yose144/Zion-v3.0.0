import type { Metadata } from 'next';
import ChartsPageClient from "./ChartsPageClient";

export const metadata: Metadata = {
  title: 'Charts & Analytics · ZION Explorer',
  description: 'Historical ZION blockchain charts — hashrate, difficulty, block time, transaction count, and supply emission trends.',
};

export default function ChartsPage() {
  return <ChartsPageClient />;
}
