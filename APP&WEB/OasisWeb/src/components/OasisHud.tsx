'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw, Plane, ChevronDown, ChevronUp, X, Radio, Trophy, Map, Feather, Minus } from 'lucide-react';
import { getHealth, getLeaderboard, getPlayer, getAvatars, type Player, type LeaderboardEntry } from '../lib/api';
import { useGameStore } from '../store/gameStore';

interface OasisHudProps {
  onEnterFlight?: () => void;
}

const OASIS_ACCENT = '249, 115, 22'; /* L4 Orange per ZIONTHEME.md */
const MINIMIZED_KEY = 'oasis-hud-minimized';

function StatusDot({ status }: { status: 'loading' | 'ok' | 'error' }) {
  const color = status === 'ok' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24';
  return (
    <span
      className="h-2 w-2 rounded-full"
      style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
    />
  );
}

export default function OasisHud({ onEnterFlight }: OasisHudProps) {
  const { address, realQuests, territories } = useGameStore();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [avatarCount, setAvatarCount] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  /* Restore and persist the collapsed state so users can keep OASIS hidden. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(MINIMIZED_KEY);
      if (saved === 'true') setMinimized(true);
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(MINIMIZED_KEY, String(minimized));
    } catch {}
  }, [minimized]);

  const load = useCallback(async () => {
    try {
      const [health, lb, avatarsData, playerData] = await Promise.all([
        getHealth(),
        getLeaderboard(),
        getAvatars(),
        address ? getPlayer(address) : Promise.resolve(null),
      ]);

      setStatus(health?.status === 'ok' ? 'ok' : 'error');
      setAvatarCount(Array.isArray(avatarsData) ? avatarsData.length : 0);
      setLeaders(Array.isArray(lb) ? lb.slice(0, 3) : []);
      setPlayer(playerData);
    } catch {
      setStatus('error');
    }
  }, [address]);

  const refresh = () => {
    setStatus('loading');
    load();
  };

  useEffect(() => {
    if (!open) return;
    let mounted = true;
    const run = async () => {
      if (!mounted) return;
      await load();
    };
    run();
    const t = setInterval(run, 15000);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, [open, load]);

  /* Close the dropdown when clicking outside. */
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  /* Close the dropdown on Escape. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const expand = () => {
    setMinimized(false);
    setOpen(true);
  };

  const collapse = () => {
    setOpen(false);
    setMinimized(true);
  };

  const statusLabel = status === 'ok' ? 'Connected' : status === 'error' ? 'Disconnected' : 'Connecting';

  if (minimized) {
    return (
      <button
        onClick={expand}
        className="zion-button-ghost !p-2"
        aria-label="Show OASIS panel"
        title="Show OASIS panel"
      >
        <Radio className="h-4 w-4 text-oasis-gold" />
      </button>
    );
  }

  return (
    <div ref={containerRef} className="flex items-center gap-1">
      <div className="relative">
        <button
          onClick={() => setOpen((v) => !v)}
          className="zion-button-ghost"
          aria-label="Toggle OASIS dropdown"
          aria-expanded={open}
        >
          <Radio className="h-3 w-3 text-oasis-gold" />
          OASIS
          {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto absolute right-0 top-9 z-40 w-52 max-w-[calc(100vw-1rem)] p-3 sm:w-60 sm:p-3.5 zion-rainbow-card"
              style={{ '--rc': OASIS_ACCENT } as React.CSSProperties}
            >
              {/* Header */}
              <div className="mb-2.5 flex items-center justify-between">
                <span className="zion-kicker text-[9px] py-1 px-2">OASIS</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={refresh}
                    className="zion-button-ghost !p-1.5"
                    aria-label="Refresh OASIS data"
                    title="Refresh"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                  <button
                    onClick={() => setOpen(false)}
                    className="zion-button-ghost !p-1.5"
                    aria-label="Close OASIS panel"
                    title="Close"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>

              {/* Status + quick stats */}
              <div className="space-y-2 text-[10px] text-gray-300">
                <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={status} />
                    <span>{statusLabel}</span>
                  </div>
                  <span className="font-mono text-oasis-cyan">v3.0.7</span>
                </div>

                {status === 'error' && (
                  <p className="text-[9px] text-red-300">Backend unreachable. Check connection and refresh.</p>
                )}

                {player && (
                  <div className="grid grid-cols-2 gap-2">
                    <div className="zion-rainbow-sub p-2" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                      <p className="text-[9px] text-gray-400">Pilgrim</p>
                      <p className="truncate text-xs font-semibold text-white">
                        {player.display_name || player.address.slice(0, 8)}
                      </p>
                    </div>
                    <div className="zion-rainbow-sub p-2" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
                      <p className="text-[9px] text-gray-400">XP</p>
                      <p className="text-xs font-semibold text-white">{player.total_xp}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
                    <Feather className="h-3.5 w-3.5 text-oasis-purple" />
                    <div>
                      <p className="text-[9px] text-gray-400">Avatars</p>
                      <p className="font-mono text-xs text-white">{avatarCount}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
                    <Trophy className="h-3.5 w-3.5 text-oasis-gold" />
                    <div>
                      <p className="text-[9px] text-gray-400">Quests</p>
                      <p className="font-mono text-xs text-white">{realQuests.length}</p>
                    </div>
                  </div>
                </div>

                {territories.length > 0 && (
                  <div className="zion-rainbow-sub p-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-oasis-purple">
                      <Map className="h-3 w-3" />
                      Hot Territories
                    </div>
                    <div className="space-y-1">
                      {territories
                        .slice()
                        .sort((a: any, b: any) => (b.defense_power ?? 0) - (a.defense_power ?? 0))
                        .slice(0, 3)
                        .map((t: any) => (
                          <div key={t.id} className="flex items-center justify-between text-[10px]">
                            <span className="truncate text-gray-300">{t.name}</span>
                            <span className="zion-badge zion-badge-cyan text-[8px] py-0.5 px-1.5">
                              {t.controller ?? 'Unclaimed'}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {leaders.length > 0 && (
                  <div className="zion-rainbow-sub p-2" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                    <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-oasis-cyan">
                      <Trophy className="h-3 w-3" />
                      Top Pilgrims
                    </div>
                    <div className="space-y-1">
                      {leaders.map((entry, i) => (
                        <div key={entry.address} className="flex items-center justify-between text-[10px]">
                          <span className="truncate text-gray-300">
                            {i + 1}. {entry.display_name || entry.address.slice(0, 8)}
                          </span>
                          <span className="font-mono text-oasis-cyan">{entry.total_xp ?? entry.value ?? 0}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {onEnterFlight && (
                <button
                  onClick={() => {
                    setOpen(false);
                    onEnterFlight();
                  }}
                  className="zion-button-primary mt-2.5 w-full text-[10px]"
                >
                  <Plane className="h-3.5 w-3.5" />
                  Flight Mode
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <button
        onClick={collapse}
        className="zion-button-ghost !p-1.5"
        aria-label="Minimize OASIS panel"
        title="Minimize OASIS panel"
      >
        <Minus className="h-3 w-3" />
      </button>
    </div>
  );
}
