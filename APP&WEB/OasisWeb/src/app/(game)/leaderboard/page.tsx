'use client';

import GameWorld from '@/components/GameWorld';
import LeaderboardPanel from './Panel';
import LeaderboardScene from './Scene';

export default function LeaderboardPage() {
  return (
    <GameWorld mode="leaderboard" panel={<LeaderboardPanel />}>
      <LeaderboardScene />
    </GameWorld>
  );
}
