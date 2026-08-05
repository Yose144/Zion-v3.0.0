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
  Rocket,
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
  | 'golden-egg'
  | 'ships';

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
  { id: 'avatars', name: 'Avatars', color: '#a855f7', angle: 40, route: '/avatars', icon: Users },
  { id: 'quests', name: 'Quests', color: '#f59e0b', angle: 80, route: '/quests', icon: Swords },
  { id: 'leaderboard', name: 'Leaderboard', color: '#10b981', angle: 120, route: '/leaderboard', icon: Trophy },
  { id: 'territories', name: 'Territories', color: '#14b8a6', angle: 160, route: '/territories', icon: Globe },
  { id: 'guilds', name: 'Guilds', color: '#ec4899', angle: 200, route: '/guilds', icon: Shield },
  { id: 'golden-egg', name: 'Golden Egg', color: '#facc15', angle: 240, route: '/golden-egg', icon: Egg },
  { id: 'ships', name: 'Hangar', color: '#06b6d4', angle: 280, route: '/ships', icon: Rocket },
  { id: 'onboarding', name: 'Onboarding', color: '#ffffff', angle: 320, route: '/onboarding', icon: BookOpen },
];

export function getZonePosition(id: ZoneId, radius = RADIUS): [number, number, number] {
  const zone = ZONES.find((z) => z.id === id);
  const angle = (zone?.angle ?? 0) * (Math.PI / 180);
  return [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
}
