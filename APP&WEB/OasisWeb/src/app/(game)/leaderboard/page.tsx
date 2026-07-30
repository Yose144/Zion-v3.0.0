import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Leaderboard',
  description: 'Top pilgrims ranked by XP and devotion.',
};

export default function LeaderboardPage() {
  return <GameView mode="leaderboard" />;
}
