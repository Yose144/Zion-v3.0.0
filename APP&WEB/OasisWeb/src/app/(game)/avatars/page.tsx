import type { Metadata } from 'next';
import GameView from '@/components/GameView';

export const metadata: Metadata = {
  title: 'ZION OASIS · Avatars',
  description: 'Browse the Avatar Codex and find your guide.',
};

export default function AvatarsPage() {
  return <GameView mode="avatars" />;
}
