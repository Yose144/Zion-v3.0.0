import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Hangar — Starfighter Bay',
  description: 'Browse, unlock, and pilot legendary starfighters in the OASIS galaxy.',
};

export default function ShipsPage() {
  return <GameView mode="ships" />;
}
