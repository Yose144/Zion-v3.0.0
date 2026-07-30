import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Territories',
  description: 'Explore the 8 sacred mining territories of the OASIS world.',
};

export default function TerritoriesPage() {
  return <GameView mode="territories" />;
}
