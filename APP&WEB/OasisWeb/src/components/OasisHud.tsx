'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const API = process.env.NEXT_PUBLIC_OASIS_API_URL || 'http://127.0.0.1:8094';

interface Avatar {
  id: number;
  name: string;
  subtitle: string;
  ray: string;
  consciousness_level_required: number;
  rarity: string;
}

export default function OasisHud() {
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [avatarCount, setAvatarCount] = useState(0);
  const [player, setPlayer] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const [health, avatars, player] = await Promise.all([
          fetch(`${API}/health`).then((r) => r.json()),
          fetch(`${API}/api/v1/oasis/avatars`).then((r) => r.json()),
          fetch(`${API}/api/v1/oasis/player/pilgrim-0001`).then((r) => r.json()),
        ]);
        if (!mounted) return;
        setStatus(health.success ? 'ok' : 'error');
        setAvatarCount(Array.isArray(avatars.data) ? avatars.data.length : 0);
        setPlayer(player.data);
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
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.8, delay: 4 }}
      className="pointer-events-auto absolute top-6 right-6 z-20 w-72 rounded-xl border border-oasis-cyan/30 bg-oasis-black/80 p-4 backdrop-blur-md"
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
        <p>Avatars in Codex: <span className="text-oasis-purple font-mono">{avatarCount}</span></p>
        {player && (
          <>
            <p>Pilgrim XP: <span className="text-oasis-cyan font-mono">{player.total_xp}</span></p>
            <p>Consciousness: <span className="text-oasis-cyan font-mono">{player.level}</span></p>
          </>
        )}
      </div>
    </motion.div>
  );
}
