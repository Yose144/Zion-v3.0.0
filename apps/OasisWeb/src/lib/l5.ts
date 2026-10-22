/**
 * L5 Free World API client — reads the live registry served by
 * zion-v31-free-world (Edge :8095), proxied same-origin at
 * `/api/free-world/*` (see deploy/nginx-oasis.conf).
 *
 * Unit convention (canon): every `*_zion` field is FLOWERS (1e-6 ZION).
 * `zion()` converts to whole-ZION for display.
 *
 * All fetchers fail soft (return null) — the panel renders canon
 * static data when the registry is unreachable.
 */

const L5_BASE =
  typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname)
    ? '/api/free-world'
    : // Dev: no local free-world backend — same-origin path still works when
      // the app is served behind the oasis nginx; otherwise unreachable and
      // callers just get null (static canon fallback).
      '/api/free-world';

interface Envelope<T> {
  success?: boolean;
  data?: T;
  error?: string | null;
}

async function l5Fetch<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${L5_BASE}${path}`, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const body = (await res.json()) as Envelope<T>;
    if (body.success === false || body.data == null) return null;
    return body.data;
  } catch {
    return null;
  }
}

/** flowers → whole ZION */
export const zion = (flowers: number | null | undefined) =>
  flowers == null ? null : flowers / 1e6;

export const formatZion = (flowers: number | null | undefined) => {
  const z = zion(flowers);
  if (z == null) return null;
  if (z >= 1e6) return `${(z / 1e6).toFixed(2)}M ZION`;
  if (z >= 1e3) return `${(z / 1e3).toFixed(1)}k ZION`;
  return `${z.toFixed(2)} ZION`;
};

export interface L5Project {
  id: string;
  name: string;
  location?: string | null;
  description?: string | null;
  category?: string | null;
  status?: string | null;
  budget_zion?: number | null;
  spent_zion?: number | null;
  started_at?: string | null;
  completed_at?: string | null;
  impact_metrics?: unknown;
}

export interface L5Grant {
  id: string;
  title?: string | null;
  applicant_name?: string | null;
  description?: string | null;
  status?: string | null;
  amount_zion?: number | null;
  created_at?: string | null;
  reviewed_at?: string | null;
}

export interface L5Round {
  id: string;
  title?: string | null;
  status?: string | null;
  credits_per_voter?: number | null;
  matching_pool_zion?: number | null;
  ballot_count?: number | null;
  opened_at?: string | null;
  closed_at?: string | null;
}

export interface L5Fund {
  total_accumulated?: number | null;
  total_disbursed?: number | null;
  last_block_height?: number | null;
  updated_at?: string | null;
}

export const fetchL5Projects = () => l5Fetch<L5Project[]>('/projects');
export const fetchL5Grants = () => l5Fetch<L5Grant[]>('/grants');
export const fetchL5Rounds = () => l5Fetch<L5Round[]>('/rounds');
export const fetchL5Fund = () => l5Fetch<L5Fund>('/fund/balance');

export interface L5Live {
  projects: L5Project[] | null;
  grants: L5Grant[] | null;
  rounds: L5Round[] | null;
  fund: L5Fund | null;
}

export async function fetchL5Live(): Promise<L5Live> {
  const [projects, grants, rounds, fund] = await Promise.all([
    fetchL5Projects(),
    fetchL5Grants(),
    fetchL5Rounds(),
    fetchL5Fund(),
  ]);
  return { projects, grants, rounds, fund };
}

/** Loose name → canon project-id matching. The registry uses display names
 * ("Genesis Garden", "Te Piko Ora") while OASIS canon ids differ
 * ('genesis', 'piko-ora', 'maria-del-camino'…). */
const NAME_TO_CANON: Array<[RegExp, string]> = [
  [/genesis/i, 'genesis'],
  [/dharma/i, 'dharma'],
  [/piko/i, 'piko-ora'],
  [/golden|bohemia/i, 'bohemia'],
  [/bodhi|lanka/i, 'bodhi-lanka'],
  [/lumi|amerika|america/i, 'lumi'],
  [/uluru/i, 'uluru'],
  [/maria|camino/i, 'maria-del-camino'],
];

export function canonProjectId(name?: string | null): string | null {
  if (!name) return null;
  for (const [re, id] of NAME_TO_CANON) {
    if (re.test(name)) return id;
  }
  return null;
}

/** World-id → canon project-id (for matching live registry rows to
 * OASIS galaxy worlds). */
export const WORLD_TO_PROJECT: Record<string, string> = {
  GENESIS_GARDEN: 'genesis',
  DHARMA_TEMPLE_LA_PALMA: 'dharma',
  TE_PIKO_ORA: 'piko-ora',
  GOLDEN_REPUBLIC_BOHEMIA: 'bohemia',
  BODHI_LANKA: 'bodhi-lanka',
  LUMI: 'lumi',
  ULURU: 'uluru',
  MARIA_DEL_CAMINO: 'maria-del-camino',
};

/** Find the live registry row matching a canon project id. */
export function liveProjectFor(canonId: string, projects: L5Project[] | null): L5Project | null {
  if (!projects) return null;
  return projects.find((p) => canonProjectId(p.name) === canonId) ?? null;
}

/** Approved founding tranche grant for a canon project id, if any. */
export function liveGrantFor(canonId: string, grants: L5Grant[] | null): L5Grant | null {
  if (!grants) return null;
  return (
    grants.find(
      (g) =>
        g.status === 'approved' &&
        (canonProjectId(g.applicant_name) === canonId || canonProjectId(g.title) === canonId),
    ) ?? null
  );
}
