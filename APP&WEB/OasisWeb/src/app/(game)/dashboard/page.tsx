import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Dashboard',
  description: 'Your pilgrim dashboard, stats, and reward pools.',
};

export default function DashboardPage() {
  return <GameView mode="dashboard" />;
}
