'use client';

import GameWorld from '@/components/GameWorld';
import OnboardingPanel from './Panel';
import OnboardingScene from './Scene';

export default function OnboardingPage() {
  return (
    <GameWorld mode="onboarding" panel={<OnboardingPanel />}>
      <OnboardingScene />
    </GameWorld>
  );
}
