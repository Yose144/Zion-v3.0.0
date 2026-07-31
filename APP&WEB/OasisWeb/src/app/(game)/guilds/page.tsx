import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Guilds',
  description: 'Join or create a mining guild in the OASIS.',
};

export default function GuildsPage() {
  return <GameView mode="guilds" />;
}
