import type { LucideIcon } from 'lucide-react';
import { LayoutDashboard, Users, Swords, Trophy, BookOpen } from 'lucide-react';

const RADIUS = 6;

export interface ZoneConfig {
  id: 'dashboard' | 'avatars' | 'quests' | 'leaderboard' | 'onboarding';
  name: string;
  color: string;
  angle: number;
  route: string;
  icon: LucideIcon;
}

export const ZONES: ZoneConfig[] = [
  { id: 'dashboard', name: 'Dashboard', color: '#22d3ee', angle: 0, route: '/dashboard', icon: LayoutDashboard },
  { id: 'avatars', name: 'Avatars', color: '#a855f7', angle: 60, route: '/avatars', icon: Users },
  { id: 'quests', name: 'Quests', color: '#f59e0b', angle: 120, route: '/quests', icon: Swords },
  { id: 'leaderboard', name: 'Leaderboard', color: '#10b981', angle: 180, route: '/leaderboard', icon: Trophy },
  { id: 'onboarding', name: 'Onboarding', color: '#ffffff', angle: 240, route: '/onboarding', icon: BookOpen },
];

export function getZonePosition(id: ZoneConfig['id'], radius = RADIUS): [number, number, number] {
  const zone = ZONES.find((z) => z.id === id);
  const angle = (zone?.angle ?? 0) * (Math.PI / 180);
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}
