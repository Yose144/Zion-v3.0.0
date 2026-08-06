'use client';

import { User, ScrollText, Map, Egg, Rocket, Box, type LucideIcon } from 'lucide-react';

const RASTA_GOLD = '252, 209, 22';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic' | 'unique';

export const rarityOrder: Record<Rarity, number> = {
  common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5, unique: 6,
};

export const rarityColor: Record<Rarity, string> = {
  common: '163, 163, 177',
  uncommon: '7, 137, 48',
  rare: '252, 209, 22',
  epic: '228, 30, 43',
  legendary: '252, 209, 22',
  mythic: '228, 30, 43',
  unique: '7, 137, 48',
};

const categoryIconMap: Record<string, LucideIcon> = {
  avatar: User,
  avatars: User,
  quest_item: ScrollText,
  quest: ScrollText,
  quests: ScrollText,
  territory: Map,
  territories: Map,
  golden_egg: Egg,
  golden_eggs: Egg,
  ship: Rocket,
  ships: Rocket,
  starfighters: Rocket,
  cosmetic: Box,
  cosmetics: Box,
  product: Box,
  default: Box,
};

export function getArtifactIcon(category?: string): LucideIcon {
  const key = category?.toLowerCase() ?? '';
  return categoryIconMap[key] ?? categoryIconMap.default;
}

interface ArtifactPlaceholderProps {
  category?: string;
  rarity?: Rarity;
  size?: number;
  className?: string;
}

export function ArtifactPlaceholder({
  category,
  rarity,
  size = 48,
  className = '',
}: ArtifactPlaceholderProps) {
  const Icon = getArtifactIcon(category);
  const color = rarity ? `rgb(${rarityColor[rarity]})` : `rgb(${RASTA_GOLD})`;
  return <Icon size={size} color={color} className={className} />;
}
