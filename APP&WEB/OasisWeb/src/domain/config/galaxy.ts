import { GalaxyConfig, World } from '../types/world';
import { WORLDS, STAR_SYSTEM_IDS } from './worlds';

/**
 * High-level galaxy config. No rendering, no React — pure data.
 */
export const GALAXY: GalaxyConfig = {
  name: 'OASIS Milky Way',
  seed: 'oasis-genesis-2026',
  starSystems: [...STAR_SYSTEM_IDS],
};

export function getStarSystems(): World[] {
  return WORLDS.filter((w) => w.category === 'star-system');
}

export function getWorldsByLayer(layer: number): World[] {
  return WORLDS.filter((w) => w.layer === layer);
}
