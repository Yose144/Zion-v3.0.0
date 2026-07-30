'use client';

import GameWorld from '@/components/GameWorld';
import AvatarsPanel from './Panel';
import AvatarsScene from './Scene';

export default function AvatarsPage() {
  return (
    <GameWorld mode="avatars" panel={<AvatarsPanel />}>
      <AvatarsScene />
    </GameWorld>
  );
}
