'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getHealth, getLeaderboard, getPlayer, getAvatars, type Player, type LeaderboardEntry } from '../lib/api';
import { useGameStore } from '../store/gameStore';

export default function OasisHud() {
  const { address, realQuests } = useGameStore();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [avatarCount, setAvatarCount] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [health, lb, avatarsData, playerData] = await Promise.all([
          getHealth(),
          getLeaderboard(),
          getAvatars(),
          address ? getPlayer(address) : Promise.resolve(null),
        ]);

        if (!mounted) return;

        setStatus(health?.status === 'ok' ? 'ok' : 'error');
        setAvatarCount(Array.isArray(avatarsData) ? avatarsData.length : 0);
        setLeaders(Array.isArray(lb) ? lb.slice(0, 3) : []);
        setPlayer(playerData);
      } catch {
        if (mounted) setStatus('error');
      }
    }

    load();
    const t = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [address]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 0.5 }}
      className="pointer-events-auto absolute right-4 top-4 z-20 w-64 rounded-xl border border-oasis-cyan/30 bg-oasis-black/80 p-3 backdrop-blur-md sm:right-6 sm:top-6 sm:w-72 sm:p-4"
    >
      <h2 className="mb-2 text-lg font-bold text-oasis-cyan">OASIS Link</h2>
      <div className="space-y-2 text-sm text-gray-300">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              status === 'ok' ? 'bg-green-400' : status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
            }`}
          />
          <span>{status === 'ok' ? 'Connected' : status === 'error' ? 'Disconnected' : 'Connecting'}</span>
        </div>

        {player && (
          <>
            <p>Pilgrim: <span className="font-mono text-oasis-cyan">{player.display_name || player.address}</span></p>
            <p>XP: <span className="font-mono text-oasis-cyan">{player.total_xp}</span></p>
            <p>Consciousness: <span className="font-mono text-oasis-cyan">{player.level}</span></p>
          </>
        )}

        <p>Avatars in Codex: <span className="font-mono text-oasis-purple">{avatarCount}</span></p>
        <p>Live Quests: <span className="font-mono text-oasis-gold">{realQuests.length}</span></p>

        {leaders.length > 0 && (
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">Top Pilgrims</p>
            <div className="space-y-1">
              {leaders.map((entry, i) => (
                <div key={entry.address} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300">{i + 1}. {entry.display_name || entry.address.slice(0, 8)}</span>
                  <span className="font-mono text-oasis-cyan">{entry.total_xp ?? entry.value ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
