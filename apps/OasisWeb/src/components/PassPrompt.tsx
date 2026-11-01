'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { setStoredPass, verifyPass } from '../lib/api';
import type { World } from '../domain/types/world';

interface PassPromptProps {
  world: World;
  onCancel: () => void;
  onUnlocked: () => void;
}

const MARKET_BOOK_URL = 'https://market.zionterranova.com/shop?category=books';

/** ZION Archive Pass gate — shown when the player opens a `requiredPass`
 *  world without a stored code. Verifies via the OASIS daemon, then lets
 *  the pending world action resume. */
export default function PassPrompt({ world, onCancel, onUnlocked }: PassPromptProps) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = code.trim();
    if (trimmed.length < 8 || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (await verifyPass(trimmed)) {
        setStoredPass(trimmed);
        onUnlocked();
      } else {
        setError('Neplatný nebo expirovaný pass kód.');
      }
    } catch {
      setError('Ověření selhalo — zkus to znovu.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <motion.div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onCancel}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl border border-amber-400/30 bg-[#0a0a12] p-6 shadow-2xl"
        initial={{ scale: 0.94, y: 12 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.94, y: 12 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center">
          <div className="text-4xl">🔒</div>
          <h2 className="mt-3 text-lg font-bold text-amber-200">
            {world.name}
          </h2>
          <p className="mt-2 text-sm text-white/60">
            Tento svět vyžaduje <span className="text-amber-300">ZION Archive Pass</span> —
            získáš ho ke knize Království srdce v eshopu.
          </p>
        </div>

        <div className="mt-5">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="ZAP-…"
            autoFocus
            className="w-full rounded-lg border border-white/15 bg-black/60 px-4 py-3 text-center font-mono text-lg tracking-widest text-amber-200 placeholder:text-white/25 focus:border-amber-400/60 focus:outline-none"
          />
          {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
        </div>

        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={submit}
            disabled={busy || code.trim().length < 8}
            className="flex-1 rounded-lg bg-amber-500/90 px-4 py-2.5 font-semibold text-black transition hover:bg-amber-400 disabled:opacity-40"
          >
            {busy ? 'Ověřuji…' : 'Odemknout svět'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-white/15 px-4 py-2.5 text-white/70 transition hover:bg-white/10"
          >
            Zrušit
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-white/40">
          Nemáš pass?{' '}
          <a
            href={MARKET_BOOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-300/80 underline hover:text-amber-300"
          >
            Koupit knihu v eshopu ↗
          </a>
        </p>
      </motion.div>
    </motion.div>
  );
}
