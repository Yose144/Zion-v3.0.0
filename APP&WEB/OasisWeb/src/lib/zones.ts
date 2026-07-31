import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Swords,
  Trophy,
  BookOpen,
  Globe,
  Shield,
  Egg,
} from 'lucide-react';

const RADIUS = 6;

export type ZoneId =
  | 'dashboard'
  | 'avatars'
  | 'quests'
  | 'leaderboard'
  | 'onboarding'
  | 'territories'
  | 'guilds'
  | 'golden-egg';

export interface ZoneConfig {
  id: ZoneId;
  name: string;
  color: string;
  angle: number;
  route: string;
  icon: LucideIcon;
}

export const ZONES: ZoneConfig[] = [
  { id: 'dashboard', name: 'Dashboard', color: '#22d3ee', angle: 0, route: '/dashboard', icon: LayoutDashboard },
  { id: 'avatars', name: 'Avatars', color: '#a855f7', angle: 45, route: '/avatars', icon: Users },
  { id: 'quests', name: 'Quests', color: '#f59e0b', angle: 90, route: '/quests', icon: Swords },
  { id: 'leaderboard', name: 'Leaderboard', color: '#10b981', angle: 135, route: '/leaderboard', icon: Trophy },
  { id: 'territories', name: 'Territories', color: '#14b8a6', angle: 180, route: '/territories', icon: Globe },
  { id: 'guilds', name: 'Guilds', color: '#ec4899', angle: 225, route: '/guilds', icon: Shield },
  { id: 'golden-egg', name: 'Golden Egg', color: '#facc15', angle: 270, route: '/golden-egg', icon: Egg },
  { id: 'onboarding', name: 'Onboarding', color: '#ffffff', angle: 315, route: '/onboarding', icon: BookOpen },
];

export function getZonePosition(id: ZoneId, radius = RADIUS): [number, number, number] {
  const zone = ZONES.find((z) => z.id === id);
  const angle = (zone?.angle ?? 0) * (Math.PI / 180);
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}
