// Direct OASIS L4 game server HTTP API client.

import { httpGet } from '../lib/client';
import { OASIS, endpointUrl, type ServiceEndpoint } from '../config/services';

export interface OasisHealth {
  status?: string;
  data?: { version?: string; players?: number; active_quests?: number };
  ok?: boolean;
}

export interface OasisAvatar {
  id: string;
  owner?: string;
  name?: string;
  level?: number;
  xp?: number;
  guild?: string;
}

export interface OasisQuest {
  id: string;
  title?: string;
  description?: string;
  reward_xp?: number;
  active?: boolean;
}

function oasisUrl(path: string, ep: ServiceEndpoint = OASIS): string {
  return endpointUrl(ep, path);
}

export async function checkOasisHealth(ep: ServiceEndpoint = OASIS): Promise<boolean> {
  const h = await httpGet<OasisHealth>(oasisUrl('/health', ep), 2000);
  return !!h && (h.status === 'ok' || h.ok === true);
}

export async function fetchOasisStats(ep: ServiceEndpoint = OASIS): Promise<OasisHealth | null> {
  return httpGet<OasisHealth>(oasisUrl('/stats', ep), 3000);
}

export async function fetchOasisAvatars(ep: ServiceEndpoint = OASIS): Promise<OasisAvatar[] | null> {
  const res = await httpGet<{ ok: boolean; avatars: OasisAvatar[]; error?: string }>(oasisUrl('/avatars', ep), 3000);
  return res?.avatars ?? null;
}

export async function fetchOasisQuests(ep: ServiceEndpoint = OASIS): Promise<OasisQuest[] | null> {
  const res = await httpGet<{ ok: boolean; quests: OasisQuest[]; error?: string }>(oasisUrl('/quests', ep), 3000);
  return res?.quests ?? null;
}
