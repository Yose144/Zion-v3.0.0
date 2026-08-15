const API = process.env.NEXT_PUBLIC_OASIS_API_URL ?? 'http://127.0.0.1:8094';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  timestamp: number;
}

export interface Health {
  status: string;
  service: string;
  version: string;
}

export type ConsciousnessLevel =
  | 'Physical'
  | 'Emotional'
  | 'Mental'
  | 'Intuitional'
  | 'Spiritual'
  | 'Cosmic'
  | 'Divine'
  | 'Unity'
  | 'OnTheStar';

export interface Achievement {
  id: string;
  achievement_type: string;
  milestone: number;
  earned_at: number;
}

export interface Player {
  address: string;
  display_name?: string | null;
  total_xp: number;
  level: ConsciousnessLevel | string;
  guild_id?: string | null;
  blocks_mined: number;
  zion_earned: number;
  achievements: Achievement[];
  tithe_total: number;
  challenges_completed: number;
  daily_streak: number;
  best_streak: number;
  referrals: number;
  daily_xp: number;
  last_active: number;
  created_at: number;
  stats: Record<string, number>;
}

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
}

export interface QuestDef {
  quest_id: string;
  avatar_id: number;
  avatar_name: string;
  title: string;
  description: string;
  xp_reward: number;
  min_consciousness_level: number;
}

export interface QuestProgress {
  player_address: string;
  quest_id: string;
  completed: boolean;
  completed_at?: number | null;
}

export interface XpAwardResponse {
  address: string;
  xp_awarded: number;
  total_xp: number;
  level: string;
  leveled_up: boolean;
}

export interface WorldActionResponse {
  address: string;
  world_id: string;
  action: 'scan' | 'approach';
  first: boolean;
  xp_awarded: number;
  total_xp: number;
  level: string;
  leveled_up: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  address: string;
  display_name?: string | null;
  value?: number;
  total_xp?: number;
  level: string;
  guild_name?: string | null;
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
}

export interface TerritoryMap {
  territories: Record<string, Territory>;
}

export interface RewardPool {
  id: string;
  name: string;
  total: number;
  distributed: number;
  remaining: number;
  slot_type: string;
}

export interface PoolsResponse {
  pools: RewardPool[];
  total_allocated: number;
  total_distributed: number;
}

export interface PrizeTier {
  rank: number;
  title: string;
  zion: number;
  flowers: number;
  percentage: number;
  nft_reward: string;
  unlock_condition: string;
}

export interface PrizeConfig {
  _comment?: string;
  total_pool_zion: number;
  total_pool_flowers: number;
  tiers: PrizeTier[];
  dao_approval_required: boolean;
  donation_requirement: string;
}

export interface Guild {
  id: string;
  name: string;
  description: string;
  founder: string;
  officers: string[];
  members: string[];
  guild_xp: number;
  guild_level: number;
  active_quests: unknown[];
  quests_completed: number;
  territories: string[];
  treasury?: number;
  created_at: number;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      mode: 'cors',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T | null> {
  try {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      mode: 'cors',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ApiResponse<T>;
    return json.success ? (json.data ?? null) : null;
  } catch {
    return null;
  }
}

export const getHealth = () => fetchJson<Health>('/health');

export const getPlayer = (address: string) =>
  fetchJson<Player>(`/api/v1/oasis/player/${encodeURIComponent(address)}`);

export const awardPlayerXp = (
  address: string,
  amount: number,
  source: string,
  details?: unknown,
) =>
  postJson<XpAwardResponse>(
    `/api/v1/oasis/player/${encodeURIComponent(address)}/xp`,
    { source, amount, details },
  );

export const scanWorld = (address: string, worldId: string, xp: number) =>
  postJson<WorldActionResponse>(
    `/api/v1/oasis/player/${encodeURIComponent(address)}/worlds/${encodeURIComponent(worldId)}/scan`,
    { xp },
  );

export const approachWorld = (address: string, worldId: string, xp: number) =>
  postJson<WorldActionResponse>(
    `/api/v1/oasis/player/${encodeURIComponent(address)}/worlds/${encodeURIComponent(worldId)}/approach`,
    { xp },
  );

export const completePlayerQuest = (address: string, questId: string) =>
  postJson<QuestProgress>(
    `/api/v1/oasis/player/${encodeURIComponent(address)}/quests/${encodeURIComponent(questId)}/complete`,
    {},
  );

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

export const getLeaderboard = () =>
  fetchJson<LeaderboardEntry[]>('/api/v1/oasis/leaderboard/top100');

export const getTerritories = () =>
  fetchJson<TerritoryMap>('/api/v1/oasis/map');

export const getPrizeTiers = () =>
  fetchJson<PrizeConfig>('/api/v1/oasis/prize-tiers');

export const getGuilds = () => fetchJson<Guild[]>('/api/v1/oasis/guilds');

export const getGuild = (id: string) =>
  fetchJson<Guild>(`/api/v1/oasis/guild/${encodeURIComponent(id)}`);

export const createGuild = (name: string, founder: string, description?: string) =>
  postJson<Guild>('/api/v1/oasis/guild', { name, founder, description });

export const joinGuild = (id: string, address: string) =>
  postJson<Guild>(
    `/api/v1/oasis/guild/${encodeURIComponent(id)}/join`,
    { address }
  );
