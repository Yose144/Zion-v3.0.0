'use client';

import GameWorld from '@/components/GameWorld';
import QuestsPanel from './Panel';
import QuestsScene from './Scene';

export default function QuestsPage() {
  return (
    <GameWorld mode="quests" panel={<QuestsPanel />}>
      <QuestsScene />
    </GameWorld>
  );
}
