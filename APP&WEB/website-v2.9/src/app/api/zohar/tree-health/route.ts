/**
 * ZOHAR — Tree of Life Health API
 *
 * GET /api/zohar/tree-health
 *
 * Aggregates data from existing ZION APIs (blockchain stats, DeFi status,
 * bridge status, NCL/AI status) and maps them onto the 10 sephirot + Da'at
 * from the Zohar / Tree of Life framework.
 *
 * Each sephira returns:
 *   - status:  'live' | 'partial' | 'horizon'
 *   - health:  0-100 score derived from live metrics
 *   - metrics: concrete values backing the score
 *   - zionLayer: the L1-L6 layer this sephira maps to
 *
 * Read-only — does not touch L1 consensus. Pure aggregation.
 *
 * Source docs:
 *   - docs/Zohar/01-SEFIROT-VRSTVY.md  (sephira → layer mapping)
 *   - docs/Zohar/02-ROADMAP.md         (Fáze 4 = this endpoint)
 */

export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const CACHE_HEADERS = {
  'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=30',
};

type SephiraStatus = 'live' | 'partial' | 'horizon';

interface SephiraHealth {
  id: string;
  name: string;
  hebrew: string;
  zionLayer: string;
  pillar: 'mercy' | 'severity' | 'equilibrium' | 'hidden';
  status: SephiraStatus;
  health: number; // 0-100
  metrics: Record<string, string | number | boolean | null | string[]>;
  lastUpdated: number;
}

interface TreeHealthResponse {
  ok: boolean;
  fetchedAt: number;
  treeHealth: number; // aggregate 0-100
  sephirot: SephiraHealth[];
  daat: SephiraHealth;
  pillars: {
    mercy: number;
    severity: number;
    equilibrium: number;
  };
  sources: string[];
}

/** Fetch JSON from an internal API route with timeout + graceful fallback. */
async function fetchJson<T>(url: string, timeoutMs = 4000): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Clamp 0-100. */
function clamp(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** Normalize a value into a 0-100 score given a "good enough" target. */
function scoreFromValue(value: number, target: number): number {
  if (target <= 0) return value > 0 ? 100 : 0;
  return clamp((value / target) * 100);
}

export async function GET() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  // Fan out to all existing APIs in parallel
  const [chainStats, defiStatus, bridgeStatus, nclStatus] = await Promise.all([
    fetchJson<any>(`${baseUrl}/api/blockchain/stats`),
    fetchJson<any>(`${baseUrl}/api/defi/status`),
    fetchJson<any>(`${baseUrl}/api/bridge/status`),
    fetchJson<any>(`${baseUrl}/api/ncl/status`),
  ]);

  const now = Date.now();
  const sources: string[] = [];
  if (chainStats) sources.push('blockchain/stats');
  if (defiStatus) sources.push('defi/status');
  if (bridgeStatus) sources.push('bridge/status');
  if (nclStatus) sources.push('ncl/status');

  /* ──────────────────────────────────────────────────────────────────
   * 1. KETER — Crown — L1 Consensus / Genesis
   *    Health = emission progress (how much of the tree has bloomed)
   * ────────────────────────────────────────────────────────────────── */
  const emissionPct = chainStats ? parseFloat(chainStats.emission_pct) || 0 : 0;
  const keter: SephiraHealth = {
    id: 'keter',
    name: 'Keter',
    hebrew: 'כֶּתֶר',
    zionLayer: 'L1 Consensus / Genesis',
    pillar: 'equilibrium',
    status: 'live',
    health: clamp(emissionPct),
    metrics: {
      block_height: chainStats?.block_height ?? 0,
      top_block_hash: chainStats?.top_block_hash ?? null,
      emission_pct: emissionPct,
      circulating_supply: chainStats?.circulating_supply ?? 0,
      max_supply: chainStats?.max_supply ?? 144_000_000_000,
      mainnet: chainStats?.mainnet ?? true,
      status: chainStats?.status ?? 'offline',
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 2. CHOCHMAH — Wisdom — L1 Cosmic Harmony PoW
   *    Health = network hashrate relative to a healthy baseline
   * ────────────────────────────────────────────────────────────────── */
  const hashrate = chainStats?.network_hashrate ?? 0;
  const activeMiners = chainStats?.active_miners ?? 0;
  const chochmah: SephiraHealth = {
    id: 'chochmah',
    name: 'Chokmah',
    hebrew: 'חָכְמָה',
    zionLayer: 'L1 Cosmic Harmony PoW',
    pillar: 'mercy',
    status: 'live',
    health: clamp(Math.max(scoreFromValue(hashrate, 1e6), scoreFromValue(activeMiners, 5))),
    metrics: {
      network_hashrate: hashrate,
      network_hashrate_formatted: chainStats?.network_hashrate_formatted ?? '0 H/s',
      difficulty: chainStats?.difficulty ?? 0,
      active_miners: activeMiners,
      pool_hashrate: chainStats?.pool_hashrate ?? 0,
      pool_blocks_found: chainStats?.pool_blocks_found ?? 0,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 3. BINAH — Understanding — L1 Validation / Chain State
   *    Health = peer connectivity + low alt_blocks (few forks = healthy)
   * ────────────────────────────────────────────────────────────────── */
  const totalConnections = chainStats?.total_connections ?? 0;
  const altBlocks = chainStats?.alt_blocks_count ?? 0;
  const txCount = chainStats?.tx_count ?? 0;
  const binah: SephiraHealth = {
    id: 'binah',
    name: 'Binah',
    hebrew: 'בִּינָה',
    zionLayer: 'L1 Validation / Chain State',
    pillar: 'severity',
    status: 'live',
    // Healthy = many peers, few alt blocks. 8+ peers = 100, alt_blocks < 5 = good
    health: clamp(
      Math.min(
        scoreFromValue(totalConnections, 8),
        altBlocks > 10 ? 50 : 100,
      ),
    ),
    metrics: {
      total_connections: totalConnections,
      incoming_connections: chainStats?.incoming_connections ?? 0,
      outgoing_connections: chainStats?.outgoing_connections ?? 0,
      white_peerlist_size: chainStats?.white_peerlist_size ?? 0,
      alt_blocks_count: altBlocks,
      tx_count: txCount,
      tx_pool_size: chainStats?.tx_pool_size ?? 0,
      version: chainStats?.version ?? null,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 4. CHESED — Mercy — L2 DeFi (Staking, Farming, Swap)
   *    Health = pool liquidity + price stability
   * ────────────────────────────────────────────────────────────────── */
  const wzionSupply = defiStatus?.data?.wZION?.totalSupply
    ? parseFloat(defiStatus.data.wZION.totalSupply)
    : 0;
  const usdtPoolActive = defiStatus?.data?.pools?.wzion_usdt?.active ?? false;
  const wethPoolActive = defiStatus?.data?.pools?.wzion_weth?.active ?? false;
  const solPoolActive = defiStatus?.data?.pools?.wzion_sol?.active ?? false;
  const activePools = [usdtPoolActive, wethPoolActive, solPoolActive].filter(Boolean).length;
  const chesed: SephiraHealth = {
    id: 'chesed',
    name: 'Chesed',
    hebrew: 'חֶסֶד',
    zionLayer: 'L2 DeFi (Staking, Farming, Atomic Swap)',
    pillar: 'mercy',
    status: wzionSupply > 0 ? 'live' : 'partial',
    // 3 active pools = 100, supply > 1000 wZION = good
    health: clamp(
      Math.max(
        scoreFromValue(activePools, 3),
        scoreFromValue(wzionSupply, 1000),
      ),
    ),
    metrics: {
      wzion_total_supply: wzionSupply,
      active_pools: activePools,
      wzion_usdt_pool_active: usdtPoolActive,
      wzion_weth_pool_active: wethPoolActive,
      wzion_sol_pool_active: solPoolActive,
      wzion_usdt_price: defiStatus?.data?.pools?.wzion_usdt?.price_usd ?? 0,
      staking_apr: defiStatus?.data?.staking?.apr ?? '—',
      farm_pool_count: defiStatus?.data?.farm?.poolCount ?? 0,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 5. GEVURAH — Severity — L2 DAO / Treasury Lock
   *    Health = treasury lock integrity + multisig threshold
   * ────────────────────────────────────────────────────────────────── */
  const bridgeThreshold = defiStatus?.data?.bridge?.threshold ?? 0;
  const bridgeValidatorCount = defiStatus?.data?.bridge?.validatorCount ?? 0;
  const treasuryLocked = true; // DAO_TREASURY_LOCK_HEIGHT = 525600 (constitutional)
  const gevurah: SephiraHealth = {
    id: 'gevurah',
    name: 'Gevurah',
    hebrew: 'גְּבוּרָה',
    zionLayer: 'L2 DAO / Treasury Lock',
    pillar: 'severity',
    status: 'live',
    // Healthy = treasury locked + bridge threshold ≥ 3
    health: clamp(
      (treasuryLocked ? 60 : 0) + scoreFromValue(bridgeThreshold, 3) * 0.4,
    ),
    metrics: {
      treasury_locked: treasuryLocked,
      bridge_threshold: bridgeThreshold,
      bridge_validator_count: bridgeValidatorCount,
      governance_proposal_count: defiStatus?.data?.governance?.proposalCount ?? 0,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 6. TIFERET — Beauty / Harmony — L3 WARP / Bridge
   *    Health = chains active + bridge E2E confirmed
   * ────────────────────────────────────────────────────────────────── */
  const chainsActive = bridgeStatus?.chains_active ?? 0;
  const bridgeE2E = bridgeStatus?.bridge_e2e_confirmed ?? false;
  const l1Locks = bridgeStatus?.l1_locks_detected ?? 0;
  const evmMints = bridgeStatus?.evm_mints_confirmed ?? 0;
  const tiferet: SephiraHealth = {
    id: 'tiferet',
    name: 'Tiferet',
    hebrew: 'תִּפְאֶרֶת',
    zionLayer: 'L3 WARP / Bridge',
    pillar: 'equilibrium',
    status: 'live',
    // 6 chains = 100, E2E confirmed = +bonus
    health: clamp(
      scoreFromValue(chainsActive, 6) * (bridgeE2E ? 1 : 0.7),
    ),
    metrics: {
      chains_active: chainsActive,
      chains: bridgeStatus?.chains ?? [],
      bridge_e2e_confirmed: bridgeE2E,
      validator_threshold: bridgeStatus?.validator_threshold ?? '0/0',
      l1_locks_detected: l1Locks,
      evm_mints_confirmed: evmMints,
      evm_burns_detected: bridgeStatus?.evm_burns_detected ?? 0,
      l1_unlocks_confirmed: bridgeStatus?.l1_unlocks_confirmed ?? 0,
      relay_metrics_online: bridgeStatus?.relay_metrics_online ?? false,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 7. NETZACH — Eternity — L3 AI Native / Hiran
   *    Health = NCL workers active + jobs processed
   * ────────────────────────────────────────────────────────────────── */
  const nclWorkers = nclStatus?.workers?.active ?? nclStatus?.active_workers ?? 0;
  const nclJobs = nclStatus?.jobs?.total ?? nclStatus?.total_jobs ?? 0;
  const nclOnline = nclStatus?.online ?? nclStatus?.status === 'online';
  const netzach: SephiraHealth = {
    id: 'netzach',
    name: 'Netzach',
    hebrew: 'נֶצַח',
    zionLayer: 'L3 AI Native / Hiran',
    pillar: 'mercy',
    status: nclOnline ? 'live' : 'partial',
    health: clamp(
      Math.max(
        scoreFromValue(nclWorkers, 3),
        nclOnline ? 40 : 0,
      ),
    ),
    metrics: {
      ncl_online: nclOnline,
      active_workers: nclWorkers,
      total_jobs: nclJobs,
      hiran_backend: nclStatus?.hiran_backend ?? nclStatus?.backend ?? null,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 8. HOD — Glory — L4 Oasis / Game
   *    Horizon — no live telemetry yet
   * ────────────────────────────────────────────────────────────────── */
  const hod: SephiraHealth = {
    id: 'hod',
    name: 'Hod',
    hebrew: 'הוֹד',
    zionLayer: 'L4 Oasis / Game',
    pillar: 'severity',
    status: 'horizon',
    health: 0,
    metrics: {
      ue5_build: null,
      consciousness_levels_doc: 'docs/3.0.4/evoluZion.md',
      oasis_status: 'seed',
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 9. YESOD — Foundation — L5 Free World / Communities
   *    Horizon — community telemetry not yet wired
   * ────────────────────────────────────────────────────────────────── */
  const yesod: SephiraHealth = {
    id: 'yesod',
    name: 'Yesod',
    hebrew: 'יְסוֹד',
    zionLayer: 'L5 Free World / Communities',
    pillar: 'equilibrium',
    status: 'horizon',
    health: 0,
    metrics: {
      communities: ['Genesis Garden', 'Dharma Temple', 'Te Pīko Ora'],
      community_count: 3,
      telemetry_online: false,
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * 10. MALKHUT — Kingdom — L6 Issobella / Stars
   *     Horizon — seed stage
   * ────────────────────────────────────────────────────────────────── */
  const malkhut: SephiraHealth = {
    id: 'malkhut',
    name: 'Malkhut',
    hebrew: 'מַלְכוּת',
    zionLayer: 'L6 Issobella / Stars',
    pillar: 'equilibrium',
    status: 'horizon',
    health: 0,
    metrics: {
      issobella_doc: 'docs/TerraNova/07-ISSOBELLA.md',
      seed_status: 'horizon',
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * DA'AT — Knowledge (hidden) — the bridge between myth and code
   * Health = how well the protocol matches the vision (heuristic:
   * number of live sephirot / 10)
   * ────────────────────────────────────────────────────────────────── */
  const sephirotList = [
    keter, chochmah, binah, chesed, gevurah, tiferet, netzach, hod, yesod, malkhut,
  ];
  const liveCount = sephirotList.filter((s) => s.status === 'live').length;
  const daat: SephiraHealth = {
    id: 'daat',
    name: "Da'at",
    hebrew: 'דַּעַת',
    zionLayer: 'Tvůrce / vědomý záměr',
    pillar: 'hidden',
    status: 'partial',
    health: clamp(scoreFromValue(liveCount, 10)),
    metrics: {
      live_sephirot: liveCount,
      total_sephirot: 10,
      zohar_docs: 4,
      zohar_web: '/zohar',
      sefirot_vow: 'V3/L5/docs/GOVERNANCE/sefirot-vow.md',
    },
    lastUpdated: now,
  };

  /* ──────────────────────────────────────────────────────────────────
   * Aggregate scores
   * ────────────────────────────────────────────────────────────────── */
  const liveSephirot = sephirotList.filter((s) => s.status !== 'horizon');
  const treeHealth = liveSephirot.length > 0
    ? Math.round(liveSephirot.reduce((sum, s) => sum + s.health, 0) / liveSephirot.length)
    : 0;

  const pillarScore = (pillar: string) => {
    const list = sephirotList.filter((s) => s.pillar === pillar);
    if (list.length === 0) return 0;
    return Math.round(list.reduce((sum, s) => sum + s.health, 0) / list.length);
  };

  const response: TreeHealthResponse = {
    ok: true,
    fetchedAt: now,
    treeHealth,
    sephirot: sephirotList,
    daat,
    pillars: {
      mercy: pillarScore('mercy'),
      severity: pillarScore('severity'),
      equilibrium: pillarScore('equilibrium'),
    },
    sources,
  };

  return NextResponse.json(response, { headers: CACHE_HEADERS });
}
