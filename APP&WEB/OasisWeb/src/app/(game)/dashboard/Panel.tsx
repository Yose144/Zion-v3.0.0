'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { User, Sparkles, Pickaxe, Flame, Award, Heart, Globe, Crown } from 'lucide-react';
import { getPlayer, getPrizeTiers } from '@/lib/api';
import { useApi } from '@/lib/useApi';
import GlassPanel from '@/components/GlassPanel';
import Skeleton from '@/components/Skeleton';

export default function DashboardPanel() {
  const [input, setInput] = useState('pilgrim-0001');
  const [address, setAddress] = useState('pilgrim-0001');

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('oasis-address') : null;
    if (saved) {
      setInput(saved);
      setAddress(saved);
    }
  }, []);

  const { data: player, loading: loadingPlayer } = useApi(() => getPlayer(address), [address], { treatNullAsError: false });
  const { data: prizes, loading: loadingPrizes, error: prizesError, retry: retryPrizes } = useApi(getPrizeTiers, []);
  const loading = loadingPlayer || loadingPrizes;

  const saveAddress = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('oasis-address', input);
    }
    setAddress(input);
  };

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-purple"
      >
        Pilgrim Dashboard
      </motion.h1>

      <div className="mb-6 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && saveAddress()}
          placeholder="Enter pilgrim address"
          className="flex-1 rounded-xl bg-black/30 px-4 py-2 text-sm text-white outline-none ring-oasis-cyan/50 placeholder:text-white/60 focus:ring-2"
        />
        <button
          onClick={saveAddress}
          className="rounded-xl bg-oasis-cyan/20 px-4 py-2 text-sm font-medium text-oasis-cyan transition hover:bg-oasis-cyan/30"
        >
          Load
        </button>
      </div>

      {loading && <Skeleton lines={6} className="mb-6" />}

      {prizesError && !loading && (
        <div className="mb-4 rounded-2xl border border-rasta-red/30 bg-rasta-red/10 p-4 text-sm text-rasta-red/80">
          {prizesError} <button onClick={retryPrizes} className="ml-2 underline">Retry</button>
        </div>
      )}

      {!loading && !player && (
        <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-white/70">
          Pilgrim not found. Enter an address to begin.
        </p>
      )}

      {player && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-oasis-cyan/30 to-oasis-purple/30">
                <User className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="font-mono text-sm text-oasis-cyan">{player.address}</p>
                <h2 className="text-2xl font-bold text-white">{player.display_name || 'Unnamed Pilgrim'}</h2>
                <p className="text-sm text-white/70">
                  Consciousness: <span className="font-semibold text-oasis-gold">{player.level}</span>
                </p>
              </div>
            </div>
          </motion.div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard icon={Sparkles} label="Total XP" value={player.total_xp.toLocaleString()} color="text-oasis-gold" />
            <StatCard icon={Flame} label="Daily Streak" value={player.daily_streak} color="text-rasta-gold" />
            <StatCard icon={Pickaxe} label="Blocks Mined" value={player.blocks_mined} color="text-oasis-cyan" />
            <StatCard icon={Heart} label="Tithe Total" value={player.tithe_total} color="text-rasta-red" />
            <StatCard icon={Award} label="Challenges" value={player.challenges_completed} color="text-oasis-purple" />
            <StatCard icon={Crown} label="Best Streak" value={player.best_streak} color="text-oasis-gold" />
            <StatCard icon={Globe} label="Referrals" value={player.referrals} color="text-rasta-green" />
            <StatCard icon={Sparkles} label="Achievements" value={player.achievements.length} color="text-oasis-cyan" />
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-3xl border border-white/10 bg-white/5 p-6"
          >
            <h3 className="mb-4 text-lg font-semibold text-white">Reward Pools</h3>
            {prizes ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {prizes.tiers.slice(0, 6).map((tier) => (
                  <div
                    key={tier.rank}
                    className="rounded-2xl border border-white/10 bg-black/20 p-4 transition hover:border-oasis-cyan/30"
                  >
                    <p className="text-xs text-white/70">{tier.title}</p>
                    <p className="text-xl font-bold text-oasis-gold">{tier.zion.toLocaleString()} ZION</p>
                    <p className="text-xs text-white/60">{tier.unlock_condition}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/70">Pool data unavailable.</p>
            )}
          </motion.div>
        </>
      )}
    </GlassPanel>
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
  value: string | number;
  color: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-2xl border border-white/10 bg-white/5 p-4"
    >
      <Icon className={`mb-2 h-5 w-5 ${color}`} />
      <p className="text-xs text-white/70">{label}</p>
      <p className="text-lg font-bold text-white">{value}</p>
    </motion.div>
  );
}
