'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Trophy,
  Zap,
  Coins,
  Rocket,
  Sparkles,
  RefreshCw,
  Gamepad2,
  Gamepad,
  Flame,
  CircleDot,
  Square,
  Volume2,
  VolumeX,
  Crown,
  Timer,
  Target,
} from 'lucide-react';
import Image from 'next/image';
import { useLang } from '@/contexts/LanguageContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOAL = 100_000_000;
const ZION_BASE = 100_000;
const DOGE_BASE_RATE = 800_000;
const DOGE_RALLY_RATE = 2_000_000;
const DOGE_RALLY_INTERVAL = 15_000;
const DOGE_RALLY_DURATION = 5_000;
const COMBO_WINDOW = 2;
const CRIT_CHANCE = 0.05;
const CRIT_MULT = 3;
const AUTO_FIRE_RATE = 100; // ms between auto-fire clicks

const POWER_UPS = {
  star: { bonus: 10_000_000, text: '+10M Star!', color: 'text-yellow-300', emoji: '⭐' },
  oasis: { bonus: 5_000_000, text: '+5M Oasis!', color: 'text-purple-300', emoji: '🏜️' },
  gem: { bonus: 2_000_000, text: '+2M Gem!', color: 'text-cyan-300', emoji: '💎' },
  flame: { bonus: 1_000_000, text: '+1M Fire!', color: 'text-orange-300', emoji: '🔥' },
} as const;

type PowerUpType = keyof typeof POWER_UPS;
type GameOver = 'zion' | 'doge' | null;

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try {
        this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.08) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  click() { this.beep(800 + Math.random() * 100, 0.04, 'square', 0.04); }
  crit() { this.beep(1400, 0.12, 'sawtooth', 0.1); }
  powerup() {
    this.beep(600, 0.08, 'sine', 0.12);
    setTimeout(() => this.beep(900, 0.08, 'sine', 0.12), 60);
    setTimeout(() => this.beep(1200, 0.1, 'sine', 0.12), 120);
  }
  rally() {
    this.beep(150, 0.4, 'sawtooth', 0.08);
    setTimeout(() => this.beep(100, 0.3, 'sawtooth', 0.06), 200);
  }
  win() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.18, 'sine', 0.12), i * 90));
  }
  lose() {
    [400, 300, 200].forEach((f, i) => setTimeout(() => this.beep(f, 0.25, 'sawtooth', 0.08), i * 130));
  }
}

const sfx = new SoundManager();

// ─── useLocalStorage ──────────────────────────────────────────────────────────

function useLocalStorage<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : initial;
    } catch {
      return initial;
    }
  });
  const set = useCallback((v: T | ((p: T) => T)) => {
    setVal((prev) => {
      const next = typeof v === 'function' ? (v as (p: T) => T)(prev) : v;
      try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* noop */ }
      return next;
    });
  }, [key]);
  return [val, set];
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [dogePos, setDogePos] = useState(0);
  const [zionPos, setZionPos] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [gameOver, setGameOver] = useState<GameOver>(null);
  const [floating, setFloating] = useState<{ id: number; x: number; y: number; text: string; color: string; size?: string }[]>([]);
  const [powerUps, setPowerUps] = useState<{ id: number; x: number; type: PowerUpType }[]>([]);
  const [activeMiniGame, setActiveMiniGame] = useState<'pong' | 'breakout' | 'snake' | null>(null);
  const [muted, setMuted] = useState(false);
  const [rallyActive, setRallyActive] = useState(false);
  const [rallyCountdown, setRallyCountdown] = useState(15);
  const [shake, setShake] = useState(0);
  const [autoFiring, setAutoFiring] = useState(false);

  const [stats, setStats] = useLocalStorage('doge-vs-zion-stats', {
    bestTime: null as number | null,
    bestCombo: 0,
    gamesPlayed: 0,
    totalClicks: 0,
    zionWins: 0,
    dogeWins: 0,
  });

  const autoFireRef = useRef<NodeJS.Timeout | null>(null);
  const nextIdRef = useRef(0);

  // Sync mute to sound manager
  useEffect(() => { sfx.enabled = !muted; }, [muted]);

  // Timer
  useEffect(() => {
    if (!startTime || gameOver) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 250);
    return () => clearInterval(t);
  }, [startTime, gameOver]);

  // Combo decay
  useEffect(() => {
    if (comboTimer <= 0) return;
    const t = setTimeout(() => {
      setComboTimer((v) => {
        const next = v - 1;
        if (next <= 0) setCombo(0);
        return next;
      });
    }, 1000);
    return () => clearTimeout(t);
  }, [comboTimer]);

  // Doge auto-mine loop
  useEffect(() => {
    if (gameOver) return;
    const tick = 100; // ms
    const interval = setInterval(() => {
      if (!startTime) return;
      const rate = rallyActive ? DOGE_RALLY_RATE : DOGE_BASE_RATE;
      setDogePos((p) => {
        const np = p + (rate * tick) / 1000;
        if (np >= GOAL) {
          setGameOver('doge');
          sfx.lose();
          setStats((s) => ({ ...s, gamesPlayed: s.gamesPlayed + 1, dogeWins: s.dogeWins + 1 }));
          return GOAL;
        }
        return np;
      });
    }, tick);
    return () => clearInterval(interval);
  }, [startTime, gameOver, rallyActive, setStats]);

  // Doge rally scheduler
  useEffect(() => {
    if (gameOver || !startTime) return;
    const interval = setInterval(() => {
      setRallyCountdown((c) => {
        if (c <= 1) {
          setRallyActive(true);
          sfx.rally();
          setTimeout(() => setRallyActive(false), DOGE_RALLY_DURATION);
          return Math.ceil(DOGE_RALLY_INTERVAL / 1000);
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [startTime, gameOver]);

  // Power-up spawner
  useEffect(() => {
    if (gameOver) return;
    const spawn = setInterval(() => {
      if (!startTime) return;
      setPowerUps((prev) => {
        if (prev.length >= 4) return prev;
        const types: PowerUpType[] = ['oasis', 'gem', 'flame', 'star'];
        const type = types[Math.floor(Math.random() * types.length)];
        return [...prev, { id: Date.now() + Math.random(), x: 8 + Math.random() * 84, type }];
      });
    }, 2500);
    return () => clearInterval(spawn);
  }, [startTime, gameOver]);

  // Screen shake decay
  useEffect(() => {
    if (shake <= 0) return;
    const t = setTimeout(() => setShake(0), 300);
    return () => clearTimeout(t);
  }, [shake]);

  const addFloat = useCallback((x: number, y: number, text: string, color: string, size = 'text-lg') => {
    const id = nextIdRef.current++;
    setFloating((prev) => [...prev, { id, x, y, text, color, size }]);
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 900);
  }, []);

  const doZionClick = useCallback(() => {
    if (gameOver) return;
    if (!startTime) setStartTime(Date.now());
    sfx.init();

    const isCrit = Math.random() < CRIT_CHANCE;
    const multiplier = 1 + Math.floor(combo / 5) * 0.3;
    const gain = Math.round(ZION_BASE * multiplier * (isCrit ? CRIT_MULT : 1));

    if (isCrit) {
      sfx.crit();
      setShake(8);
    } else {
      sfx.click();
    }

    setZionPos((p) => {
      const np = p + gain;
      if (np >= GOAL) {
        setGameOver('zion');
        sfx.win();
        const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
        setStats((s) => ({
          ...s,
          gamesPlayed: s.gamesPlayed + 1,
          zionWins: s.zionWins + 1,
          bestTime: s.bestTime === null ? time : Math.min(s.bestTime, time),
          bestCombo: Math.max(s.bestCombo, combo),
          totalClicks: s.totalClicks + 1,
        }));
        return GOAL;
      }
      return np;
    });
    setClicks((c) => c + 1);
    setCombo((c) => {
      const nc = c + 1;
      setStats((s) => ({ ...s, bestCombo: Math.max(s.bestCombo, nc), totalClicks: s.totalClicks + 1 }));
      return nc;
    });
    setComboTimer(COMBO_WINDOW);
  }, [gameOver, startTime, combo, setStats]);

  const handleZionClick = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isCrit = Math.random() < CRIT_CHANCE;
    const mult = 1 + Math.floor(combo / 5) * 0.3;
    const gain = Math.round(ZION_BASE * mult * (isCrit ? CRIT_MULT : 1));
    addFloat(rect.left + rect.width / 2, rect.top, isCrit ? `CRIT! +${(gain / 1e6).toFixed(1)}M` : `+${(gain / 1e6).toFixed(1)}M`, isCrit ? 'text-yellow-300' : 'text-emerald-300', isCrit ? 'text-2xl' : 'text-lg');
    doZionClick();
  };

  // Auto-fire (hold to fire)
  const startAutoFire = () => {
    if (autoFiring || gameOver) return;
    setAutoFiring(true);
    sfx.init();
    doZionClick();
    autoFireRef.current = setInterval(doZionClick, AUTO_FIRE_RATE);
  };
  const stopAutoFire = () => {
    setAutoFiring(false);
    if (autoFireRef.current) { clearInterval(autoFireRef.current); autoFireRef.current = null; }
  };
  useEffect(() => () => stopAutoFire(), []);

  const handlePowerUp = (id: number, type: PowerUpType, x: number, y: number) => {
    setPowerUps((prev) => prev.filter((p) => p.id !== id));
    const pu = POWER_UPS[type];
    addFloat(x, y, pu.text, pu.color, 'text-2xl');
    sfx.powerup();
    setShake(12);
    setZionPos((p) => {
      const np = Math.min(GOAL, p + pu.bonus);
      if (np >= GOAL) {
        setGameOver('zion');
        sfx.win();
        const time = Math.floor((Date.now() - (startTime ?? Date.now())) / 1000);
        setStats((s) => ({
          ...s,
          gamesPlayed: s.gamesPlayed + 1,
          zionWins: s.zionWins + 1,
          bestTime: s.bestTime === null ? time : Math.min(s.bestTime, time),
        }));
        return GOAL;
      }
      return np;
    });
  };

  const reset = () => {
    stopAutoFire();
    setDogePos(0);
    setZionPos(0);
    setClicks(0);
    setCombo(0);
    setComboTimer(0);
    setStartTime(null);
    setElapsed(0);
    setGameOver(null);
    setPowerUps([]);
    setRallyActive(false);
    setRallyCountdown(15);
    setShake(0);
  };

  const comboMult = 1 + Math.floor(combo / 5) * 0.3;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-black pb-24 pt-28 md:pt-32"
      style={shake > 0 ? { animation: `shake ${shake > 8 ? '0.4s' : '0.2s'} ease-in-out` } : undefined}
    >
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-${shake}px)}75%{transform:translateX(${shake}px)}}`}</style>

      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 50 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`, top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%` }}
            animate={{ opacity: [0.1, 0.6, 0.1], scale: [1, 1.4, 1] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.08 }}
          />
        ))}
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {cs ? 'Zpět na homepage' : 'Back to homepage'}
          </Link>
          <button
            onClick={() => { sfx.init(); setMuted((m) => !m); }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {muted ? (cs ? 'Ztlumeno' : 'Muted') : (cs ? 'Zvuk' : 'Sound')}
          </button>
        </div>

        <HeroSection cs={cs} />

        {/* Rally warning */}
        <AnimatePresence>
          {rallyActive && !gameOver && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-amber-500/20 to-red-500/20 px-4 py-2 text-center"
            >
              <span className="text-sm font-bold text-amber-300 animate-pulse">
                🐕 DOGE RALLY! Much speed! Very wow! 🐕
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <ScoreBoard cs={cs} dogePos={dogePos} zionPos={zionPos} clicks={clicks} combo={combo} comboTimer={comboTimer} elapsed={elapsed} rallyCountdown={rallyCountdown} />

        {/* Combo meter */}
        {combo > 0 && (
          <div className="flex items-center gap-3">
            <Flame className="h-5 w-5 text-orange-400 shrink-0" />
            <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden border border-white/10">
              <motion.div
                className="h-full bg-gradient-to-r from-orange-400 to-red-500"
                animate={{ width: `${(comboTimer / COMBO_WINDOW) * 100}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
            <span className="text-sm font-bold text-orange-300 tabular-nums shrink-0">
              x{comboMult.toFixed(1)} ({combo})
            </span>
          </div>
        )}

        {/* Race track */}
        <section className="relative rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Rocket className="h-5 w-5 text-emerald-400" />
              {cs ? 'Závod na 100M' : 'Race to 100M'}
            </h2>
            <span className="text-xs text-gray-500">
              {cs ? `Doge rally za ${rallyCountdown}s` : `Doge rally in ${rallyCountdown}s`}
            </span>
          </div>

          {/* Progress bar track with milestones */}
          <div className="relative mb-8">
            <div className="h-4 rounded-full bg-white/5 overflow-hidden border border-white/10 relative">
              {/* Milestone markers */}
              {[25, 50, 75].map((m) => (
                <div key={m} className="absolute top-0 h-full w-px bg-white/20 z-10" style={{ left: `${m}%` }} />
              ))}
              <div className="relative h-full w-full">
                <motion.div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-400 to-amber-600"
                  animate={{ width: `${(dogePos / GOAL) * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
                <motion.div
                  className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
                  animate={{ width: `${(zionPos / GOAL) * 100}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-500">
              <span>0</span>
              <span>25M</span>
              <span>50M</span>
              <span>75M</span>
              <span>100M</span>
            </div>
          </div>

          {/* Power-ups on track */}
          <div className="relative h-16 mb-6 rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
            {powerUps.map((p) => (
              <PowerUpOrb key={p.id} data={p} onClick={handlePowerUp} />
            ))}
            {powerUps.length === 0 && !gameOver && (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20">
                {cs ? 'Power-upy se spawnou tady — chytej je!' : 'Power-ups spawn here — catch them!'}
              </div>
            )}
          </div>

          {/* Click arena */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            {/* Doge (auto-mining, not clickable) */}
            <div className="relative flex h-36 w-36 md:h-44 md:w-44 flex-col items-center justify-center rounded-full border-4 border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-700/20 shadow-[0_20px_80px_rgba(0,0,0,0.3)]">
              <motion.div
                animate={rallyActive ? { scale: [1, 1.15, 1], rotate: [0, -5, 5, 0] } : { scale: 1 }}
                transition={{ duration: 0.5, repeat: rallyActive ? Infinity : 0 }}
              >
                <Image src="/dogecoin-logo.png" alt="Dogecoin" width={100} height={100} className="h-20 w-20 md:h-24 md:w-24 object-contain drop-shadow-2xl" />
              </motion.div>
              <span className="absolute -bottom-2 rounded-full border border-white/10 bg-black/80 px-3 py-0.5 text-xs font-bold text-amber-300">Doge</span>
              <span className="absolute -bottom-7 text-[10px] text-white/40">
                {rallyActive ? '🔥 RALLY!' : cs ? 'auto-mining' : 'auto-mining'}
              </span>
            </div>

            <div className="text-center">
              <div className="rounded-full border border-white/10 bg-black/70 px-4 py-1 text-sm font-bold text-white/80">VS</div>
              <p className="mt-2 text-[10px] text-gray-500">{cs ? 'Drž pro auto-fire' : 'Hold for auto-fire'}</p>
            </div>

            {/* ZION (clickable + holdable) */}
            <motion.button
              onClick={handleZionClick}
              onMouseDown={startAutoFire}
              onMouseUp={stopAutoFire}
              onMouseLeave={stopAutoFire}
              onTouchStart={(e) => { e.preventDefault(); startAutoFire(); }}
              onTouchEnd={stopAutoFire}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92, rotate: 5 }}
              className={`relative flex h-36 w-36 md:h-44 md:w-44 flex-col items-center justify-center rounded-full border-4 border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20 shadow-[0_20px_80px_rgba(0,0,0,0.3)] shadow-emerald-500/30 hover:shadow-emerald-500/50 transition-all active:scale-95 ${autoFiring ? 'ring-4 ring-emerald-400/40' : ''}`}
            >
              <span className="text-6xl md:text-7xl drop-shadow-2xl">🚀</span>
              <span className="absolute -bottom-2 rounded-full border border-white/10 bg-black/80 px-3 py-0.5 text-xs font-bold text-emerald-300">ZION</span>
              <span className="absolute -bottom-7 text-[10px] text-white/40">
                {cs ? `${(ZION_BASE * comboMult / 1000).toFixed(0)}K/klik` : `${(ZION_BASE * comboMult / 1000).toFixed(0)}K/click`}
              </span>
            </motion.button>
          </div>

          {/* Floating texts */}
          <AnimatePresence>
            {floating.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, x: f.x, y: f.y, scale: 0.8 }}
                animate={{ opacity: 0, y: f.y - 80, scale: 1.3 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`pointer-events-none fixed z-50 ${f.size ?? 'text-lg'} font-bold ${f.color} drop-shadow-lg`}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        {/* Win overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <div className={`max-w-md rounded-3xl border p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${gameOver === 'zion' ? 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20' : 'border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-orange-700/20'}`}>
                <Trophy className={`mx-auto h-12 w-12 mb-4 ${gameOver === 'zion' ? 'text-emerald-300' : 'text-amber-300'}`} />
                <h2 className="text-2xl font-bold text-white mb-2">
                  {gameOver === 'zion' ? (cs ? 'ZION vyhrál! 🚀' : 'ZION wins! 🚀') : (cs ? 'Doge vyhrál! 🐕' : 'Doge wins! 🐕')}
                </h2>
                <p className="text-sm text-gray-300 mb-4">
                  {gameOver === 'zion'
                    ? (cs ? `100M ZION zamčeno za ${elapsed}s přes ${clicks} kliků. Much wow!` : `100M ZION locked in ${elapsed}s with ${clicks} clicks. Much wow!`)
                    : (cs ? `Doge tě předběhl. Zkus power-upy a komba!` : `Doge overtook you. Try power-ups and combos!`)}
                </p>
                {gameOver === 'zion' && stats.bestTime !== null && (
                  <p className="text-xs text-emerald-300 mb-3">
                    {cs ? `Nejlepší čas: ${stats.bestTime}s` : `Best time: ${stats.bestTime}s`}
                    {elapsed === stats.bestTime ? (cs ? ' — NOVÝ REKORD!' : ' — NEW RECORD!') : ''}
                  </p>
                )}
                <div className="flex gap-3 justify-center">
                  <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                    <RefreshCw className="h-4 w-4" /> {cs ? 'Znovu' : 'Play again'}
                  </button>
                  <Link href="/defi" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                    {cs ? 'DeFi Hub' : 'DeFi Hub'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Stats panel */}
        <StatsPanel cs={cs} stats={stats} />

        {/* Arcade hall */}
        <section className="rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Gamepad2 className="h-6 w-6 text-zion-purple" />
            <h2 className="text-xl font-bold text-white">{cs ? 'Retro Arcade Hala' : 'Retro Arcade Hall'}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ArcadeCard title="Pong" icon={CircleDot} color="text-zion-cyan" desc="1P vs AI" onClick={() => setActiveMiniGame('pong')} />
            <ArcadeCard title="Breakout" icon={Square} color="text-zion-gold" desc={cs ? 'Rozbij cihly' : 'Break bricks'} onClick={() => setActiveMiniGame('breakout')} />
            <ArcadeCard title="Snake" icon={Gamepad} color="text-emerald-400" desc={cs ? 'Jez & rostni' : 'Eat & grow'} onClick={() => setActiveMiniGame('snake')} />
          </div>

          {activeMiniGame && (
            <div className="rounded-2xl border border-white/10 bg-black/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white uppercase tracking-wider">
                  {activeMiniGame === 'pong' && 'Pong'}
                  {activeMiniGame === 'breakout' && 'Breakout'}
                  {activeMiniGame === 'snake' && 'Snake'}
                </h3>
                <button onClick={() => setActiveMiniGame(null)} className="text-xs text-gray-400 hover:text-white">
                  {cs ? 'Zavřít' : 'Close'}
                </button>
              </div>
              {activeMiniGame === 'pong' && <PongGame />}
              {activeMiniGame === 'breakout' && <BreakoutGame />}
              {activeMiniGame === 'snake' && <SnakeGame />}
            </div>
          )}
        </section>

        {/* How to play */}
        <section className="rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <h2 className="mb-4 text-xl font-bold text-white flex items-center gap-2">
            <Target className="h-5 w-5 text-zion-gold" />
            {cs ? 'Jak hrát' : 'How to play'}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div className="space-y-2">
              <p>🚀 <strong className="text-emerald-300">{cs ? 'Klikej ZION' : 'Click ZION'}</strong> — {cs ? 'nebo drž tlačítko pro auto-fire. Každý klik = 100K ZION.' : 'or hold the button for auto-fire. Each click = 100K ZION.'}</p>
              <p>🔥 <strong className="text-orange-300">{cs ? 'Combo' : 'Combo'}</strong> — {cs ? 'Klikej rychle po sobě. Po 5 kliks se násobitel zvyšuje o 0.3x.' : 'Click rapidly. After 5 clicks, multiplier increases by 0.3x.'}</p>
              <p>⚡ <strong className="text-yellow-300">{cs ? 'Crit' : 'Crit'}</strong> — {cs ? '5% šance na 3x poškození. Zlaté částice + screen shake.' : '5% chance for 3x damage. Golden particles + screen shake.'}</p>
            </div>
            <div className="space-y-2">
              <p>🐕 <strong className="text-amber-300">{cs ? 'Doge auto-mining' : 'Doge auto-mining'}</strong> — {cs ? 'Doge se sám posouvá (800K/s). Každých 15s dostane rally (2M/s na 5s).' : 'Doge auto-progresses (800K/s). Every 15s gets a rally (2M/s for 5s).'}</p>
              <p>⭐ <strong className="text-yellow-300">{cs ? 'Power-upy' : 'Power-ups'}</strong> — {cs ? 'Chytej na trati: Star +10M, Oasis +5M, Gem +2M, Flame +1M.' : 'Catch on track: Star +10M, Oasis +5M, Gem +2M, Flame +1M.'}</p>
              <p>🏆 <strong className="text-emerald-300">{cs ? 'Cíl' : 'Goal'}</strong> — {cs ? 'Dostaň ZION na 100M dřív než Doge.' : 'Get ZION to 100M before Doge.'}</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroSection({ cs }: { cs: boolean }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1 text-xs font-semibold tracking-widest text-amber-300 uppercase mb-4">
        <Sparkles className="h-4 w-4" /> {cs ? 'Meme Lab & Arcade' : 'Meme Lab & Arcade'}
      </div>
      <h1 className="text-3xl sm:text-5xl font-bold text-gradient leading-tight">{cs ? 'Doge vs ZION Race' : 'Doge vs ZION Race'}</h1>
      <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
        {cs
          ? 'Klikací závod na 100M. Doge auto-mining jede na 1 podpis, ZION má 5/5 multisig turbo. Chytej power-upy, stavěj komba, přežij Doge rally!'
          : 'Click race to 100M. Doge auto-mining runs on 1 signature, ZION has 5/5 multisig turbo. Catch power-ups, build combos, survive Doge rallies!'}
      </p>
    </motion.section>
  );
}

function ScoreBoard({ cs, dogePos, zionPos, clicks, combo, comboTimer, elapsed, rallyCountdown }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
      <StatCard icon={Coins} label="Doge" value={`${(dogePos / 1e6).toFixed(1)}M`} color="text-amber-300" border="border-amber-400/20" />
      <StatCard icon={Rocket} label="ZION" value={`${(zionPos / 1e6).toFixed(1)}M`} color="text-emerald-300" border="border-emerald-400/20" />
      <StatCard icon={Zap} label={cs ? 'Kliky' : 'Clicks'} value={clicks.toLocaleString()} color="text-zion-gold" border="border-zion-gold/20" />
      <StatCard icon={Timer} label={cs ? 'Čas' : 'Time'} value={`${elapsed}s`} color="text-cyan-300" border="border-cyan-400/20" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, border }: { icon: LucideIcon; label: string; value: string; color: string; border: string }) {
  return (
    <div className={`rounded-2xl border ${border} bg-black/60 p-3 md:p-4 backdrop-blur-xl`}>
      <div className="flex items-center gap-2 mb-1.5">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className={`text-base md:text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function StatsPanel({ cs, stats }: { cs: boolean; stats: any }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-black/60 p-6">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white/80">
        <Crown className="h-4 w-4 text-zion-gold" />
        {cs ? 'Statistiky' : 'Stats'}
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label={cs ? 'Nejlepší čas' : 'Best time'} value={stats.bestTime !== null ? `${stats.bestTime}s` : '—'} color="text-emerald-300" />
        <MiniStat label={cs ? 'Největší combo' : 'Best combo'} value={stats.bestCombo.toString()} color="text-orange-300" />
        <MiniStat label={cs ? 'Her' : 'Games'} value={stats.gamesPlayed.toString()} color="text-cyan-300" />
        <MiniStat label={cs ? 'ZION výhry' : 'ZION wins'} value={stats.zionWins.toString()} color="text-emerald-300" />
        <MiniStat label={cs ? 'Doge výhry' : 'Doge wins'} value={stats.dogeWins.toString()} color="text-amber-300" />
      </div>
    </section>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-3 text-center">
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-1 text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

function PowerUpOrb({ data, onClick }: { data: { id: number; x: number; type: PowerUpType }; onClick: (id: number, type: PowerUpType, x: number, y: number) => void }) {
  const pu = POWER_UPS[data.type];
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 10, scale: 0.5 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      whileHover={{ scale: 1.2 }}
      whileTap={{ scale: 0.85 }}
      onClick={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        onClick(data.id, data.type, rect?.left ?? e.clientX, rect?.top ?? e.clientY);
      }}
      className="absolute top-2 flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/60 text-xl shadow-lg hover:bg-white/10 transition-colors"
      style={{ left: `${data.x}%` }}
      title={pu.text}
    >
      {pu.emoji}
    </motion.button>
  );
}

function ArcadeCard({ title, icon: Icon, color, desc, onClick }: { title: string; icon: LucideIcon; color: string; desc: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group rounded-2xl border border-white/10 bg-white/3 p-5 text-center transition-all hover:bg-white/6 hover:border-white/20">
      <Icon className={`mx-auto h-10 w-10 ${color} mb-3 group-hover:scale-110 transition-transform`} />
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-1 text-[10px] text-gray-500">{desc}</p>
    </button>
  );
}

// ─── Mini games (fixed + touch support) ───────────────────────────────────────

function PongGame() {
  const [score, setScore] = useState({ p: 0, ai: 0 });
  const [ball, setBall] = useState({ x: 200, y: 125, vx: 4, vy: 3 });
  const [paddle, setPaddle] = useState(100);
  const [aiPaddle, setAiPaddle] = useState(100);
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef(ball);
  const pRef = useRef(paddle);
  const aiRef = useRef(aiPaddle);

  useEffect(() => { ballRef.current = ball; }, [ball]);
  useEffect(() => { pRef.current = paddle; }, [paddle]);
  useEffect(() => { aiRef.current = aiPaddle; }, [aiPaddle]);

  useEffect(() => {
    let running = true;
    const w = 400, h = 250, pH = 50;
    const loop = () => {
      if (!running) return;
      const b = ballRef.current;
      let nx = b.x + b.vx;
      let ny = b.y + b.vy;
      let nvx = b.vx;
      let nvy = b.vy;
      if (ny <= 0 || ny >= h) nvy *= -1;
      if (nx <= 20 && ny > pRef.current && ny < pRef.current + pH) nvx = Math.abs(nvx) * 1.05;
      if (nx >= w - 20 && ny > aiRef.current && ny < aiRef.current + pH) nvx = -Math.abs(nvx) * 1.05;
      if (nx < 0) { setScore((s) => ({ ...s, ai: s.ai + 1 })); nx = w / 2; ny = h / 2; nvx = 4; nvy = 3; }
      if (nx > w) { setScore((s) => ({ ...s, p: s.p + 1 })); nx = w / 2; ny = h / 2; nvx = -4; nvy = 3; }
      setAiPaddle((ai) => Math.max(0, Math.min(200, ai + (ny - ai - pH / 2) * 0.08)));
      setBall({ x: nx, y: ny, vx: nvx, vy: nvy });
      requestAnimationFrame(loop);
    };
    const raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, []);

  const handleMove = (clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPaddle(Math.max(0, Math.min(200, clientY - rect.top - 25)));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => handleMove(e.clientY)}
      onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientY); }}
      className="relative mx-auto h-[250px] w-full max-w-[400px] cursor-none touch-none rounded border border-zion-cyan/30 bg-black/80 overflow-hidden"
    >
      <div className="absolute top-2 left-2 text-xs text-zion-cyan">P: {score.p}</div>
      <div className="absolute top-2 right-2 text-xs text-amber-300">AI: {score.ai}</div>
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
      <div className="absolute h-[50px] w-[10px] rounded bg-zion-cyan" style={{ left: 10, top: paddle }} />
      <div className="absolute h-[50px] w-[10px] rounded bg-amber-400" style={{ right: 10, top: aiPaddle }} />
      <div className="absolute h-3 w-3 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)]" style={{ left: ball.x - 6, top: ball.y - 6 }} />
    </div>
  );
}

function BreakoutGame() {
  const [bricks, setBricks] = useState(() => Array.from({ length: 30 }, (_, i) => ({ id: i, x: (i % 6) * 60 + 15, y: Math.floor(i / 6) * 25 + 10, alive: true })));
  const [paddle, setPaddle] = useState(150);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [ball, setBall] = useState({ x: 200, y: 200, vx: 3, vy: -3 });
  const containerRef = useRef<HTMLDivElement>(null);
  const ballRef = useRef(ball);
  const paddleRef = useRef(paddle);

  useEffect(() => { ballRef.current = ball; }, [ball]);
  useEffect(() => { paddleRef.current = paddle; }, [paddle]);

  const reset = () => {
    setBricks(Array.from({ length: 30 }, (_, i) => ({ id: i, x: (i % 6) * 60 + 15, y: Math.floor(i / 6) * 25 + 10, alive: true })));
    setBall({ x: 200, y: 200, vx: 3, vy: -3 });
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    if (gameOver) return;
    let running = true;
    const loop = () => {
      if (!running || gameOver) return;
      const b = ballRef.current;
      let nx = b.x + b.vx;
      let ny = b.y + b.vy;
      let nvx = b.vx;
      let nvy = b.vy;
      if (nx <= 0 || nx >= 370) nvx *= -1;
      if (ny <= 0) nvy *= -1;
      if (ny >= 230 && nx > paddleRef.current && nx < paddleRef.current + 60) nvy = -Math.abs(nvy) * 1.02;
      if (ny > 250) { setGameOver(true); return; }
      setBricks((prev) => {
        let hit = false;
        const next = prev.map((br) => {
          if (!br.alive || hit) return br;
          if (nx > br.x && nx < br.x + 50 && ny > br.y && ny < br.y + 20) {
            hit = true;
            setScore((s) => s + 10);
            return { ...br, alive: false };
          }
          return br;
        });
        if (hit) nvy *= -1;
        return next;
      });
      setBall({ x: nx, y: ny, vx: nvx, vy: nvy });
      requestAnimationFrame(loop);
    };
    const raf = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf); };
  }, [gameOver]);

  const handleMove = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPaddle(Math.max(0, Math.min(310, clientX - rect.left - 30)));
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={(e) => handleMove(e.clientX)}
      onTouchMove={(e) => { e.preventDefault(); handleMove(e.touches[0].clientX); }}
      className="relative mx-auto h-[250px] w-full max-w-[400px] cursor-none touch-none rounded border border-zion-gold/30 bg-black/80 overflow-hidden"
    >
      <div className="absolute top-2 left-2 text-xs text-zion-gold">Score: {score}</div>
      {gameOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
          <p className="text-white font-bold mb-2">Game Over</p>
          <button onClick={reset} className="rounded bg-zion-gold px-3 py-1 text-xs text-black font-bold">Restart</button>
        </div>
      )}
      {bricks.map((br) => br.alive && <div key={br.id} className="absolute h-4 w-12 rounded bg-zion-gold/80" style={{ left: br.x, top: br.y }} />)}
      <div className="absolute h-2 w-[60px] rounded bg-white" style={{ left: paddle, bottom: 10 }} />
      <div className="absolute h-3 w-3 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.4)]" style={{ left: ball.x - 6, top: ball.y - 6 }} />
    </div>
  );
}

function SnakeGame() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const dirRef = useRef(dir);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { dirRef.current = dir; }, [dir]);

  const reset = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    setDir({ x: 1, y: 0 });
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setSnake((prev) => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 15 || prev.some((s) => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          return prev;
        }
        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore((s) => s + 10);
          setFood({ x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 15) });
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [food, gameOver]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') setDir({ x: 0, y: -1 });
      if (e.key === 'ArrowDown') setDir({ x: 0, y: 1 });
      if (e.key === 'ArrowLeft') setDir({ x: -1, y: 0 });
      if (e.key === 'ArrowRight') setDir({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;
    if (Math.abs(dx) > Math.abs(dy)) {
      setDir(dx > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
    } else {
      setDir(dy > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
    }
    touchStart.current = null;
  };

  const cellSize = 20;

  return (
    <div
      className="relative mx-auto h-[300px] w-full max-w-[400px] touch-none rounded border border-emerald-400/30 bg-black/80 overflow-hidden"
      tabIndex={0}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="absolute top-2 left-2 text-xs text-emerald-400">Score: {score}</div>
      <div className="absolute top-2 right-2 text-[9px] text-gray-500">Swipe / arrows</div>
      {gameOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
          <p className="text-white font-bold mb-2">Game Over</p>
          <p className="text-[10px] text-gray-400 mb-2">Swipe or arrow keys</p>
          <button onClick={reset} className="rounded bg-emerald-400 px-3 py-1 text-xs text-black font-bold">Restart</button>
        </div>
      )}
      {snake.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-sm bg-emerald-400"
          style={{
            left: s.x * cellSize,
            top: s.y * cellSize,
            width: cellSize - 1,
            height: cellSize - 1,
            opacity: 1 - i * 0.03,
          }}
        />
      ))}
      <div className="absolute rounded-full bg-red-400" style={{ left: food.x * cellSize, top: food.y * cellSize, width: cellSize - 1, height: cellSize - 1 }} />
    </div>
  );
}
