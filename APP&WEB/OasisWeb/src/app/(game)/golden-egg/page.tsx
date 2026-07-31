import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Golden Egg',
  description: 'Hunt 108 sacred clues and unlock the three Master Keys.',
};

export default function GoldenEggPage() {
  return <GameView mode="golden-egg" />;
}
