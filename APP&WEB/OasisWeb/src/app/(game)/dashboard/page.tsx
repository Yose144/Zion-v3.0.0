'use client';

import GameWorld from '@/components/GameWorld';
import DashboardPanel from './Panel';
import DashboardScene from './Scene';

export default function DashboardPage() {
  return (
    <GameWorld mode="dashboard" panel={<DashboardPanel />}>
      <DashboardScene />
    </GameWorld>
  );
}
