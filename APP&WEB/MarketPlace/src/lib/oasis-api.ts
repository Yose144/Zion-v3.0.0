/**
 * OASIS Game API client — fetch avatars, quests, prize tiers, territories
 * from the live OASIS game service.
 *
 * The OASIS API runs on 127.0.0.1:8094 on the Edge server.
 * For browser requests, use the public proxy: https://oasis.zionterranova.com/api/...
 */

const OASIS_API =
  process.env.OASIS_API_URL ??
  (typeof window !== 'undefined'
    ? 'https://oasis.zionterranova.com'  // browser → public proxy
    : 'http://127.0.0.1:8094');          // server → direct

// ── Types (mirrors OasisWeb/src/lib/api.ts) ────────────────────────

export interface AvatarDef {
  id: number;
  name: string;
  subtitle: string;
  ray: string;
  role: string;
  location: string;
  quest_line: string;
  teaching: string;
  ability: string;
  consciousness_level_required: number;
  consciousness_level_name: string;
  key: string;
  rarity: string;
  image_url?: string;
  market_url?: string;
}

export interface QuestDef {
  quest_id: string;
  avatar_id: number;
  avatar_name: string;
  title: string;
  description: string;
  xp_reward: number;
  min_consciousness_level: number;
  image_url?: string;
  market_url?: string;
}

export interface QuestProgress {
  player_address: string;
  quest_id: string;
  completed: boolean;
  completed_at?: number | null;
}

export interface PrizeTier {
  rank: number;
  title: string;
  zion: number;
  flowers: number;
  percentage: number;
  nft_reward: string;
  unlock_condition: string;
  image_url?: string;
  market_url?: string;
}

export interface PrizeConfig {
  total_pool_zion: number;
  total_pool_flowers: number;
  tiers: PrizeTier[];
  dao_approval_required: boolean;
  donation_requirement: string;
}

export interface Territory {
  id: string;
  name: string;
  description: string;
  region: string;
  controller?: string | null;
  mining_bonus: number;
  xp_bonus: number;
  claimed_at?: number | null;
  defense_power: number;
  adjacent: string[];
  capacity: number;
  active_miners: string[];
  last_contested: number;
  image_url?: string;
  market_url?: string;
}

export interface TerritoryMap {
  territories: Record<string, Territory>;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${OASIS_API}${path}`, {
      headers: { Accept: 'application/json' },
      // Server-side: short timeout to avoid blocking on dead API
      signal: typeof AbortController !== 'undefined' ? AbortSignal.timeout(5000) : undefined,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

// ── API methods ────────────────────────────────────────────────────

export const getAvatars = (params?: {
  ray?: string;
  rarity?: string;
  min_cl?: number;
  name?: string;
}) => {
  const q = new URLSearchParams();
  if (params?.ray) q.set('ray', params.ray);
  if (params?.rarity) q.set('rarity', params.rarity);
  if (params?.min_cl) q.set('min_cl', String(params.min_cl));
  const qs = q.toString();
  return fetchJson<AvatarDef[]>(`/api/v1/oasis/avatars${qs ? `?${qs}` : ''}`);
};

export const getQuests = () => fetchJson<QuestDef[]>('/api/v1/oasis/quests');

export const getPlayerQuests = (address: string) =>
  fetchJson<QuestProgress[]>(
    `/api/v1/oasis/player/${encodeURIComponent(address)}/quests`
  );

export const getPrizeTiers = () =>
  fetchJson<PrizeConfig>('/api/v1/oasis/prize-tiers');

export const getTerritories = () =>
  fetchJson<TerritoryMap>('/api/v1/oasis/map');

// ── Mapping helpers: OASIS → Marketplace artifact ──────────────────

/**
 * Map OASIS rarity string to Marketplace Rarity enum.
 * OASIS uses: "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Unique"
 */
export function mapRarity(oasisRarity: string): string {
  const r = oasisRarity.toLowerCase().trim();
  const valid = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic', 'unique'];
  return valid.includes(r) ? r : 'common';
}

/**
 * Convert an OASIS AvatarDef to marketplace artifact metadata.
 * Used when minting an avatar NFT from the OASIS game.
 */
export function avatarToArtifactMetadata(avatar: AvatarDef) {
  return {
    name: avatar.name,
    description: `${avatar.subtitle} — ${avatar.role}. ${avatar.teaching}. Ability: ${avatar.ability}. Location: ${avatar.location}.`,
    image: avatar.image_url ?? '',
    external_url: avatar.market_url ?? `https://oasis.zionterranova.com/avatars`,
    attributes: [
      { trait_type: 'Ray', value: avatar.ray },
      { trait_type: 'Role', value: avatar.role },
      { trait_type: 'Location', value: avatar.location },
      { trait_type: 'Quest Line', value: avatar.quest_line },
      { trait_type: 'Ability', value: avatar.ability },
      { trait_type: 'Consciousness Level', value: avatar.consciousness_level_name },
      { trait_type: 'Key', value: avatar.key },
      { trait_type: 'Rarity', value: avatar.rarity },
    ],
    properties: {
      category: 'avatar',
      rarity: mapRarity(avatar.rarity),
      collection: 'OASIS Avatars',
      source: 'oasis',
      gameId: String(avatar.id),
    },
  };
}

/**
 * Convert an OASIS QuestDef to marketplace artifact metadata.
 * Used when minting a quest completion reward NFT.
 */
export function questToArtifactMetadata(quest: QuestDef, xpReward: number) {
  return {
    name: `Quest: ${quest.title}`,
    description: `${quest.description}. Avatar: ${quest.avatar_name}. XP reward: ${xpReward}. Min consciousness level: ${quest.min_consciousness_level}.`,
    image: quest.image_url ?? '',
    external_url: quest.market_url ?? `https://oasis.zionterranova.com/quests`,
    attributes: [
      { trait_type: 'Quest ID', value: quest.quest_id },
      { trait_type: 'Avatar', value: quest.avatar_name },
      { trait_type: 'XP Reward', value: xpReward },
      { trait_type: 'Min CL', value: quest.min_consciousness_level },
      { trait_type: 'Type', value: 'Quest Completion' },
    ],
    properties: {
      category: 'quest_item',
      rarity: 'rare',
      collection: 'OASIS Quest',
      source: 'oasis',
      gameId: quest.quest_id,
    },
  };
}

/**
 * Convert a PrizeTier to marketplace artifact metadata (Golden Egg / prize NFT).
 */
export function prizeTierToArtifactMetadata(tier: PrizeTier) {
  return {
    name: `${tier.title} — Golden Egg Prize`,
    description: `Rank ${tier.rank} prize: ${tier.zion} ZION + ${tier.flowers} FLOWERS. NFT reward: ${tier.nft_reward}. Unlock: ${tier.unlock_condition}.`,
    image: tier.image_url ?? '',
    external_url: tier.market_url ?? `https://oasis.zionterranova.com/golden-egg`,
    attributes: [
      { trait_type: 'Rank', value: tier.rank },
      { trait_type: 'ZION Reward', value: tier.zion },
      { trait_type: 'Flowers Reward', value: tier.flowers },
      { trait_type: 'NFT Reward', value: tier.nft_reward },
      { trait_type: 'Unlock Condition', value: tier.unlock_condition },
      { trait_type: 'Percentage', value: tier.percentage },
    ],
    properties: {
      category: 'golden_egg',
      rarity: tier.rank <= 3 ? 'mythic' : tier.rank <= 10 ? 'legendary' : 'epic',
      collection: 'Golden Eggs',
      source: 'oasis',
    },
  };
}

/**
 * Convert a Territory to marketplace artifact metadata (land deed NFT).
 */
export function territoryToArtifactMetadata(territory: Territory) {
  return {
    name: `Territory: ${territory.name}`,
    description: `${territory.description}. Region: ${territory.region}. Mining bonus: +${territory.mining_bonus}%. XP bonus: +${territory.xp_bonus}%. Defense power: ${territory.defense_power}. Capacity: ${territory.capacity}.`,
    image: territory.image_url ?? '',
    external_url: territory.market_url ?? `https://oasis.zionterranova.com/territories`,
    attributes: [
      { trait_type: 'Region', value: territory.region },
      { trait_type: 'Mining Bonus', value: `+${territory.mining_bonus}%` },
      { trait_type: 'XP Bonus', value: `+${territory.xp_bonus}%` },
      { trait_type: 'Defense Power', value: territory.defense_power },
      { trait_type: 'Capacity', value: territory.capacity },
      { trait_type: 'Controller', value: territory.controller ?? 'Unclaimed' },
    ],
    properties: {
      category: 'territory',
      rarity: territory.defense_power > 500 ? 'legendary' : territory.defense_power > 100 ? 'rare' : 'uncommon',
      collection: 'OASIS Territory',
      source: 'oasis',
      gameId: territory.id,
    },
  };
}
