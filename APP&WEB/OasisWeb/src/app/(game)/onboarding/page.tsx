import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Onboarding',
  description: 'Begin your journey through consciousness and mining.',
};

export default function OnboardingPage() {
  return <GameView mode="onboarding" />;
}
