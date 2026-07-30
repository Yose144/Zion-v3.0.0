'use client';

import dynamic from 'next/dynamic';
import { Suspense, memo } from 'react';
import GameWorld from './GameWorld';
import Skeleton from './Skeleton';
import type { ZoneId } from '@/lib/zones';

const Scenes: Record<ZoneId, ReturnType<typeof dynamic>> = {
  dashboard: dynamic(() => import('@/app/(game)/dashboard/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  avatars: dynamic(() => import('@/app/(game)/avatars/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  quests: dynamic(() => import('@/app/(game)/quests/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  leaderboard: dynamic(() => import('@/app/(game)/leaderboard/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  onboarding: dynamic(() => import('@/app/(game)/onboarding/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  territories: dynamic(() => import('@/app/(game)/territories/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  guilds: dynamic(() => import('@/app/(game)/guilds/Scene'), { ssr: false, loading: () => <Skeleton /> }),
  'golden-egg': dynamic(() => import('@/app/(game)/golden-egg/Scene'), { ssr: false, loading: () => <Skeleton /> }),
};

const Panels: Record<ZoneId, ReturnType<typeof dynamic>> = {
  dashboard: dynamic(() => import('@/app/(game)/dashboard/Panel'), { ssr: false }),
  avatars: dynamic(() => import('@/app/(game)/avatars/Panel'), { ssr: false }),
  quests: dynamic(() => import('@/app/(game)/quests/Panel'), { ssr: false }),
  leaderboard: dynamic(() => import('@/app/(game)/leaderboard/Panel'), { ssr: false }),
  onboarding: dynamic(() => import('@/app/(game)/onboarding/Panel'), { ssr: false }),
  territories: dynamic(() => import('@/app/(game)/territories/Panel'), { ssr: false }),
  guilds: dynamic(() => import('@/app/(game)/guilds/Panel'), { ssr: false }),
  'golden-egg': dynamic(() => import('@/app/(game)/golden-egg/Panel'), { ssr: false }),
};

function GameView({ mode }: { mode: ZoneId }) {
  const Scene = Scenes[mode];
  const Panel = Panels[mode];
  return (
    <Suspense fallback={<Skeleton lines={4} className="m-auto max-w-sm" />}>
      <GameWorld mode={mode} panel={<Panel />}>
        <Scene />
      </GameWorld>
    </Suspense>
  );
}

export default memo(GameView);
