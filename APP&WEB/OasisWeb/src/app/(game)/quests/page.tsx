import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Quests',
  description: 'Discover quests, complete them, and earn XP.',
};

export default function QuestsPage() {
  return <GameView mode="quests" />;
}
