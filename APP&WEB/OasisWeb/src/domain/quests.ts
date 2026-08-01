import { createRandom } from './ports/random';
import type { World } from './types/world';

export interface Quest {
  id: string;
  title: string;
  type: 'exploration' | 'combat' | 'harvest' | 'puzzle' | 'social';
  difficulty: number;
  reward: number;
  description: string;
  real?: boolean;
  avatarName?: string;
}

const TEMPLATES: Record<string, Record<string, string[]>> = {
  'star-system': {
    exploration: [
      'Chart the outer asteroid belt of {name}',
      'Scan the coronal mass ejection patterns',
      'Map all Lagrange points around {name}',
    ],
    harvest: [
      'Collect solar plasma samples near {name}',
      'Mine rare isotopes from a rogue planetoid',
    ],
    combat: [
      'Defend the inner stations from pirate drones',
      'Disrupt a hidden smuggler outpost',
    ],
  },
  'planet': {
    exploration: [
      'Survey the polar ridges of {name}',
      'Descend into the crystal caverns of {name}',
      'Chart the storm systems of {name}',
    ],
    harvest: [
      'Extract luminous ore from {name}',
      'Gather bio-luminescent fungi samples',
    ],
    puzzle: [
      'Align the ancient observatories of {name}',
      'Decode the weather control signals',
    ],
  },
  'sector': {
    exploration: [
      'Map the trade routes through {name}',
      'Probe the uncharted quadrants of {name}',
    ],
    social: [
      'Negotiate a ceasefire between guilds in {name}',
      'Recruit a legendary navigator',
    ],
    combat: [
      'Hold the frontier checkpoint in {name}',
      'Reclaim a captured relay station',
    ],
  },
  'world': {
    exploration: [
      'Explore the ruins buried beneath {name}',
      'Follow the river of light across {name}',
    ],
    puzzle: [
      'Solve the Golden Egg riddle hidden on {name}',
      'Unlock the sealed temple doors',
    ],
    harvest: [
      'Harvest sacred mana crystals from {name}',
      'Collect echoes of the first song',
    ],
  },
  'dimension': {
    exploration: [
      'Traverse the recursive halls of {name}',
      'Find the mirror exit in {name}',
    ],
    puzzle: [
      'Stabilize the folding geometry of {name}',
      'Align the runes that rewrite reality',
    ],
    combat: [
      'Banish a thought-echo haunting {name}',
      'Close a bleeding rift before it expands',
    ],
  },
};

const QUEST_TYPES: Quest['type'][] = ['exploration', 'combat', 'harvest', 'puzzle', 'social'];

function difficultyFromLayer(layer: number): number {
  return Math.min(10, Math.max(1, Math.round(layer / 1.5 + 1)));
}

export function generateQuests(world: World, count = 3): Quest[] {
  const rng = createRandom(world.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) + 73);
  const base = TEMPLATES[world.category] ?? TEMPLATES['world'];
  const types = QUEST_TYPES.filter((t) => base[t]);
  const quests: Quest[] = [];

  for (let i = 0; i < count; i++) {
    const type = types[i % types.length];
    const pool = base[type] ?? base['exploration'];
    const template = pool[rng.int(0, pool.length)];
    const title = template.replace('{name}', world.name);
    const difficulty = Math.min(10, Math.max(1, difficultyFromLayer(world.layer) + rng.int(-1, 2)));
    const reward = difficulty * 100 + rng.int(0, 50);

    quests.push({
      id: `${world.id}-quest-${i + 1}`,
      title,
      type,
      difficulty,
      reward,
      description: `A ${type} challenge on ${world.name}. ${world.vibe}. Reward: ${reward} XP.`,
    });
  }

  return quests;
}
