'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Pickaxe,
  User,
  Globe,
  Server,
  Users,
  Activity,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { getHealth, getPlayer, getTerritories } from '@/lib/api';
import type { Player, Territory } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import Skeleton from '@/components/Skeleton';

const DEFAULT_ADDRESS = 'pilgrim-0001';

const mockPlayer: Player = {
  address: 'ZION_SAMPLE_MINER',
  display_name: 'Sample Miner',
  total_xp: 12400,
  level: 'Mental',
  guild_id: null,
  blocks_mined: 144,
  zion_earned: 2300,
  achievements: [],
  tithe_total: 12,
  challenges_completed: 0,
  daily_streak: 0,
  best_streak: 0,
  referrals: 0,
  daily_xp: 0,
  last_active: Date.now(),
  created_at: Date.now() - 86_400_000,
  stats: {},
};

const mockTerritories: Territory[] = [
  {
    id: 'crystal-badlands',
    name: 'Crystal Badlands',
    description: 'A sample territory used when the OASIS API is offline.',
    region: 'Sirius',
    controller: null,
    mining_bonus: 5,
    xp_bonus: 2,
    claimed_at: null,
    defense_power: 0,
    adjacent: [],
    capacity: 8,
    active_miners: ['rig-alpha', 'rig-beta'],
    last_contested: 0,
  },
  {
    id: 'aurora-ridge',
    name: 'Aurora Ridge',
    description: 'A sample territory used when the OASIS API is offline.',
    region: 'Lyra',
    controller: null,
    mining_bonus: 3,
    xp_bonus: 1,
    claimed_at: null,
    defense_power: 0,
    adjacent: [],
    capacity: 6,
    active_miners: ['worker-one'],
    last_contested: 0,
  },
  {
    id: 'nebula-gardens',
    name: 'Nebula Gardens',
    description: 'A sample territory used when the OASIS API is offline.',
    region: 'Orion',
    controller: null,
    mining_bonus: 4,
    xp_bonus: 3,
    claimed_at: null,
    defense_power: 0,
    adjacent: [],
    capacity: 10,
    active_miners: ['zion-pool-01', 'zion-pool-02', 'zion-pool-03'],
    last_contested: 0,
  },
];

function useSavedAddress() {
  const [address, setAddress] = useState(DEFAULT_ADDRESS);
  const [input, setInput] = useState(DEFAULT_ADDRESS);

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('oasis-address') : null;
    if (saved) {
      setAddress(saved);
      setInput(saved);
    }
  }, []);

  const save = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-address', input);
    }
    setAddress(input);
  };

  return { address, input, setInput, save };
}

export default function MiningDashboard() {
  const { address, input, setInput, save } = useSavedAddress();

  const { data: health, loading: loadingHealth } = useApi(getHealth, [], {
    treatNullAsError: false,
    enableRefetch: false,
  });

  const {
    data: player,
    loading: loadingPlayer,
    refetch: refetchPlayer,
  } = useApi(() => getPlayer(address), [address], {
    treatNullAsError: false,
    enableRefetch: true,
    refetchMs: 30000,
  });

  const {
    data: territoryMap,
    loading: loadingTerritories,
    refetch: refetchTerritories,
  } = useApi(getTerritories, [], {
    treatNullAsError: false,
    enableRefetch: true,
    refetchMs: 30000,
  });

  const territories = useMemo(
    () => (territoryMap ? Object.values(territoryMap.territories) : null),
    [territoryMap]
  );

  const apiAvailable = !loadingHealth && health !== null;
  const apiDown = !loadingHealth && health === null;

  const activeTerritories = useMemo(() => {
    const source = territories ?? (apiDown ? mockTerritories : []);
    return source
      .filter((t) => t.active_miners.length > 0)
      .sort((a, b) => b.active_miners.length - a.active_miners.length);
  }, [territories, apiDown]);

  const totalMiners = useMemo(
    () => activeTerritories.reduce((sum, t) => sum + t.active_miners.length, 0),
    [activeTerritories]
  );

  const uniqueWorkers = useMemo(() => {
    const set = new Set<string>();
    activeTerritories.forEach((t) => t.active_miners.forEach((w) => set.add(w)));
    return set.size;
  }, [activeTerritories]);

  const displayedPlayer = apiDown ? mockPlayer : player;
  const showPlayerMock = apiDown || (!loadingPlayer && !player);

  const loading = loadingPlayer || loadingTerritories || loadingHealth;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-oasis-cyan/10">
            <User className="h-4 w-4 text-oasis-cyan" />
          </div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && save()}
            placeholder="Enter pilgrim address"
            className="flex-1 rounded-xl bg-black/30 px-3 py-2 text-sm text-white outline-none ring-oasis-cyan/50 placeholder:text-white/60 focus:ring-2"
          />
          <button
            onClick={save}
            className="rounded-xl bg-oasis-cyan/20 px-4 py-2 text-sm font-medium text-oasis-cyan transition hover:bg-oasis-cyan/30"
          >
            Load
          </button>
        </div>

        <button
          onClick={() => {
            refetchPlayer();
            refetchTerritories();
          }}
          className="inline-flex items-center justify-center gap-1.5 self-start rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <RefreshCw className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {apiDown && (
        <div className="rounded-2xl border border-oasis-gold/30 bg-oasis-gold/10 p-4 text-sm text-oasis-gold">
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              The OASIS API is not reachable. Displaying placeholder data so the
              dashboard still works offline.
            </p>
          </div>
        </div>
      )}

      {loading && <Skeleton lines={6} />}

      {!loading && (
        <>
          {displayedPlayer ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/10 bg-white/5 p-5"
            >
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-oasis-cyan/30 to-oasis-purple/30">
                  <User className="h-6 w-6 text-white" />
                </div>
                <div>
                  <p className="font-mono text-sm text-oasis-cyan">
                    {displayedPlayer.address}
                  </p>
                  <h3 className="text-xl font-bold text-white">
                    {displayedPlayer.display_name || 'Unnamed Pilgrim'}
                  </h3>
                  <p className="text-xs text-white/70">
                    Consciousness:{' '}
                    <span className="font-semibold text-oasis-gold">
                      {displayedPlayer.level}
                    </span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <StatCard
                  icon={Pickaxe}
                  label="Blocks Mined"
                  value={displayedPlayer.blocks_mined}
                  color="text-oasis-cyan"
                />
                <StatCard
                  icon={Activity}
                  label="ZION Earned"
                  value={displayedPlayer.zion_earned}
                  color="text-oasis-gold"
                />
                <StatCard
                  icon={Server}
                  label="Total XP"
                  value={displayedPlayer.total_xp}
                  color="text-oasis-purple"
                />
                <StatCard
                  icon={Globe}
                  label="Tithe Total"
                  value={displayedPlayer.tithe_total}
                  color="text-rasta-red"
                />
              </div>

              {showPlayerMock && !apiDown && (
                <p className="mt-3 text-xs text-white/70">
                  Player not found. Enter a valid pilgrim address to load live stats.
                </p>
              )}
            </motion.div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
              Enter a pilgrim address and click <strong className="text-white">Load</strong>{' '}
              to see live mining stats.
            </div>
          )}

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/5 p-5"
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                <Users className="h-5 w-5 text-oasis-cyan" />
                Active Miners Across Territories
              </h3>
              <div className="flex gap-3 text-xs">
                <span className="rounded-full bg-oasis-cyan/10 px-2 py-1 text-oasis-cyan">
                  Total: {totalMiners}
                </span>
                <span className="rounded-full bg-oasis-gold/10 px-2 py-1 text-oasis-gold">
                  Unique workers: {uniqueWorkers}
                </span>
              </div>
            </div>

            {activeTerritories.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {activeTerritories.slice(0, 9).map((territory) => (
                  <div
                    key={territory.id}
                    className="rounded-xl border border-white/10 bg-black/20 p-4 transition hover:border-oasis-cyan/30"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="font-semibold text-white">{territory.name}</p>
                      <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-white/70">
                        {territory.region}
                      </span>
                    </div>
                    <p className="mb-3 text-xs text-white/60">
                      {territory.active_miners.length} active miner
                      {territory.active_miners.length !== 1 ? 's' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {territory.active_miners.slice(0, 6).map((worker) => (
                        <span
                          key={worker}
                          className="rounded-lg bg-oasis-cyan/10 px-2 py-1 text-[10px] font-mono text-oasis-cyan"
                        >
                          {worker}
                        </span>
                      ))}
                      {territory.active_miners.length > 6 && (
                        <span className="rounded-lg bg-white/5 px-2 py-1 text-[10px] text-white/70">
                          +{territory.active_miners.length - 6}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/70">No active miners reported by OASIS.</p>
            )}
          </motion.div>
        </>
      )}

      <p className="text-xs text-white/60">
        Pool hashrate is not currently exposed by the public OASIS API. Watch this
        dashboard for on-chain player and territory activity.
      </p>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <Icon className={`mb-1.5 h-5 w-5 ${color}`} />
      <p className="text-xs text-white/70">{label}</p>
      <p className="text-lg font-bold text-white">{value.toLocaleString()}</p>
    </div>
  );
}
