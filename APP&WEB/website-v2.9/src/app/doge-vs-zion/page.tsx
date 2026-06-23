'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Pickaxe as PickaxeIcon,
  Sparkles,
  Gem,
  Star,
  Trophy,
  RefreshCw,
  ChevronRight,
  Lock,
  Check,
  Zap,
  Coins,
  Rocket,
  Crown,
  ShoppingBag,
  Backpack,
  MapPin,
} from 'lucide-react';
import Image from 'next/image';
import { useLang } from '@/contexts/LanguageContext';
import {
  LOCATIONS,
  HELPERS,
  PICKAXES,
  FORTUNES,
  RARITY_CONFIG,
  helperCost,
  helperDps,
  generateLoot,
  LOOT_THRESHOLDS,
  fmt,
  fmtTime,
  DOGE_RIVAL_QUOTES,
  type Helper,
  type Pickaxe as PickaxeType,
  type Fortune,
  type Stats,
  type LootDrop,
  type Rarity,
} from './gameData';

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.06) {
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

  click() { this.beep(600 + Math.random() * 80, 0.03, 'square', 0.03); }
  crit() { this.beep(1200, 0.1, 'sawtooth', 0.08); }
  buy() { this.beep(800, 0.06, 'sine', 0.06); setTimeout(() => this.beep(1000, 0.06, 'sine', 0.06), 50); }
  loot() { this.beep(500, 0.08, 'sine', 0.08); setTimeout(() => this.beep(700, 0.08, 'sine', 0.08), 60); setTimeout(() => this.beep(900, 0.1, 'sine', 0.08), 120); }
  rockBreak() { this.beep(200, 0.3, 'sawtooth', 0.1); setTimeout(() => this.beep(150, 0.2, 'sawtooth', 0.08), 100); }
  diamond() { [800, 1000, 1200, 1500].forEach((f, i) => setTimeout(() => this.beep(f, 0.1, 'sine', 0.1), i * 50)); }
  unlock() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.beep(f, 0.15, 'sine', 0.1), i * 80)); }
}

const sfx = new SoundManager();

// ─── Game State Type ──────────────────────────────────────────────────────────

interface GameState {
  zion: number;           // current ZION balance
  totalEarned: number;    // lifetime ZION earned
  diamonds: number;       // premium currency
  clicks: number;
  currentLocation: number;
  rockHp: number;
  rockMaxHp: number;
  rockNumber: number;
  helpers: Record<string, { count: number; upgrades: number[] }>;
  equippedPickaxe: string;
  ownedPickaxes: string[];
  ownedFortunes: string[];
  lootThresholdsHit: boolean[];
  dogeTotal: number;
  startTime: number;
  lastSave: number;
}

const INITIAL_STATE: GameState = {
  zion: 0,
  totalEarned: 0,
  diamonds: 0,
  clicks: 0,
  currentLocation: 0,
  rockHp: 100,
  rockMaxHp: 100,
  rockNumber: 1,
  helpers: {},
  equippedPickaxe: 'wooden',
  ownedPickaxes: ['wooden'],
  ownedFortunes: [],
  lootThresholdsHit: [false, false, false, false, false],
  dogeTotal: 0,
  startTime: Date.now(),
  lastSave: Date.now(),
};

const SAVE_KEY = 'doge-vs-zion-idle-save';

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [state, setState] = useState<GameState>(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) return { ...INITIAL_STATE, ...JSON.parse(raw) };
    } catch { /* noop */ }
    return INITIAL_STATE;
  });

  const [muted, setMuted] = useState(false);
  const [floating, setFloating] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [groundLoot, setGroundLoot] = useState<LootDrop[]>([]);
  const [showLootModal, setShowLootModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'helpers' | 'shop' | 'inventory' | 'map'>('helpers');
  const [dogeQuote, setDogeQuote] = useState(DOGE_RIVAL_QUOTES[0]);
  const [shake, setShake] = useState(0);
  const [rockHit, setRockHit] = useState(false);
  const floatIdRef = useRef(0);
  const stateRef = useRef(state);
  const statsRef = useRef<Stats>({ dpc: 1, dps: 0, critChance: 0, luck: 0, lootFind: 0, wow: 0 });
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => { sfx.enabled = !muted; }, [muted]);

  // ─── Derived stats ──────────────────────────────────────────────────────────

  const stats = useMemo(() => computeStats(state), [state]);
  useEffect(() => { statsRef.current = stats; }, [stats]);

  const totalDps = useMemo(() => {
    let dps = 0;
    for (const helper of HELPERS) {
      const owned = state.helpers[helper.id];
      if (!owned || owned.count === 0) continue;
      dps += helperDps(helper, owned.count, owned.upgrades);
    }
    // Apply fortune DPS multiplier
    let dpsMult = 1;
    for (const fid of state.ownedFortunes) {
      const f = FORTUNES.find((x) => x.id === fid);
      if (f) dpsMult *= f.dpsMult;
    }
    return dps * dpsMult;
  }, [state.helpers, state.ownedFortunes]);

  // ─── Save/load ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      setState((s) => {
        try { localStorage.setItem(SAVE_KEY, JSON.stringify({ ...s, lastSave: Date.now() })); } catch { /* noop */ }
        return s;
      });
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  // ─── Rock break + loot processing ───────────────────────────────────────────

  const breakRock = useCallback(() => {
    const s = stateRef.current;
    const st = statsRef.current;
    const loc = LOCATIONS[s.currentLocation];
    sfx.rockBreak();
    setShake(15);

    const loot = generateLoot(s.rockMaxHp, loc.rockReward, st.luck, st.lootFind, s.currentLocation);

    let zionGain = loc.rockReward;
    let diamondGain = 0;
    const newPickaxes: string[] = [];
    const newFortunes: string[] = [];

    for (const drop of loot) {
      if (drop.type === 'coins' && drop.amount) zionGain += drop.amount;
      if (drop.type === 'diamonds' && drop.amount) diamondGain += drop.amount;
      if (drop.type === 'pickaxe' && drop.pickaxeId) newPickaxes.push(drop.pickaxeId);
      if (drop.type === 'fortune' && drop.fortuneId) newFortunes.push(drop.fortuneId);
    }

    const newRockNumber = s.rockNumber + 1;
    const newRockMaxHp = Math.ceil(loc.rockBaseHp * Math.pow(1.3, newRockNumber - 1));

    setState((prev) => ({
      ...prev,
      zion: prev.zion + zionGain,
      totalEarned: prev.totalEarned + zionGain,
      diamonds: prev.diamonds + diamondGain,
      ownedPickaxes: [...new Set([...prev.ownedPickaxes, ...newPickaxes])],
      ownedFortunes: [...new Set([...prev.ownedFortunes, ...newFortunes])],
      rockNumber: newRockNumber,
      rockMaxHp: newRockMaxHp,
      rockHp: newRockMaxHp,
      lootThresholdsHit: [false, false, false, false, false],
    }));

    const specialLoot = loot.filter((l) => l.type !== 'coins');
    if (specialLoot.length > 0) {
      setGroundLoot(loot);
      setShowLootModal(true);
      if (loot.some((l) => l.type === 'diamonds')) sfx.diamond();
      else sfx.loot();
    }
  }, []);

  const checkLootThresholds = useCallback(() => {
    const s = stateRef.current;
    const st = statsRef.current;
    const hpPercent = s.rockHp / s.rockMaxHp;

    for (let i = 0; i < LOOT_THRESHOLDS.length; i++) {
      const threshold = LOOT_THRESHOLDS[i];
      if (!s.lootThresholdsHit[i] && hpPercent <= threshold) {
        const newThresholds = [...s.lootThresholdsHit];
        newThresholds[i] = true;

        const loc = LOCATIONS[s.currentLocation];
        const loot = generateLoot(s.rockMaxHp, loc.rockReward * 0.2, st.luck, st.lootFind, s.currentLocation);

        let coinGain = 0;
        let diamondGain = 0;
        const newPickaxes: string[] = [];
        const newFortunes: string[] = [];

        for (const drop of loot) {
          if (drop.type === 'coins' && drop.amount) coinGain += drop.amount;
          if (drop.type === 'diamonds' && drop.amount) diamondGain += drop.amount;
          if (drop.type === 'pickaxe' && drop.pickaxeId) newPickaxes.push(drop.pickaxeId);
          if (drop.type === 'fortune' && drop.fortuneId) newFortunes.push(drop.fortuneId);
        }

        setState((prev) => ({
          ...prev,
          zion: prev.zion + coinGain,
          totalEarned: prev.totalEarned + coinGain,
          diamonds: prev.diamonds + diamondGain,
          ownedPickaxes: [...new Set([...prev.ownedPickaxes, ...newPickaxes])],
          ownedFortunes: [...new Set([...prev.ownedFortunes, ...newFortunes])],
          lootThresholdsHit: newThresholds,
        }));

        const specialLoot = loot.filter((l) => l.type !== 'coins');
        if (specialLoot.length > 0) {
          setGroundLoot((prev) => [...prev, ...specialLoot]);
          sfx.loot();
        }
        if (diamondGain > 0) sfx.diamond();
        break; // only process one threshold per tick
      }
    }
  }, []);

  // ─── DPS tick ───────────────────────────────────────────────────────────────

  useEffect(() => {
    const tick = 100; // ms
    const interval = setInterval(() => {
      if (totalDps <= 0) return;
      const s = stateRef.current;
      const gain = (totalDps * tick) / 1000;
      const newRockHp = Math.max(0, s.rockHp - gain);

      setState((prev) => ({
        ...prev,
        zion: prev.zion + gain,
        totalEarned: prev.totalEarned + gain,
        rockHp: newRockHp,
      }));

      if (newRockHp <= 0) {
        breakRock();
      } else {
        checkLootThresholds();
      }
    }, tick);
    return () => clearInterval(interval);
  }, [totalDps, breakRock, checkLootThresholds]);

  // ─── Doge rival idle ────────────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(() => {
      setState((s) => {
        const dogeRate = 1000 + s.totalEarned * 0.01;
        return { ...s, dogeTotal: s.dogeTotal + dogeRate };
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setDogeQuote(DOGE_RIVAL_QUOTES[Math.floor(Math.random() * DOGE_RIVAL_QUOTES.length)]);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  // ─── Screen shake decay ─────────────────────────────────────────────────────

  useEffect(() => {
    if (shake <= 0) return;
    const t = setTimeout(() => setShake(0), 300);
    return () => clearTimeout(t);
  }, [shake]);

  // ─── Location unlock check ──────────────────────────────────────────────────

  const unlockedLocations = useMemo(() => {
    return LOCATIONS.map((loc, i) => state.totalEarned >= loc.unlockAt || i <= state.currentLocation);
  }, [state.totalEarned, state.currentLocation]);

  // ─── Actions ────────────────────────────────────────────────────────────────

  const addFloat = useCallback((x: number, y: number, text: string, color: string) => {
    const id = floatIdRef.current++;
    setFloating((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 800);
  }, []);

  const handleRockClick = (e: React.MouseEvent | React.TouchEvent) => {
    sfx.init();
    const isCrit = Math.random() < stats.critChance;
    const damage = stats.dpc * (isCrit ? 2.5 : 1);

    const s = stateRef.current;
    const newRockHp = Math.max(0, s.rockHp - damage);
    const zionGain = damage;

    setState((prev) => ({
      ...prev,
      zion: prev.zion + zionGain,
      totalEarned: prev.totalEarned + zionGain,
      clicks: prev.clicks + 1,
      rockHp: newRockHp,
    }));

    // Check for rock break or loot thresholds
    if (newRockHp <= 0) {
      breakRock();
    } else {
      checkLootThresholds();
    }

    // Visual feedback
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0]?.clientX ?? rect.left + rect.width / 2 : (e as React.MouseEvent).clientX;
    const y = 'touches' in e ? e.touches[0]?.clientY ?? rect.top : (e as React.MouseEvent).clientY;
    addFloat(x, y, isCrit ? `CRIT! +${fmt(damage)}` : `+${fmt(damage)}`, isCrit ? 'text-yellow-300' : 'text-emerald-300');

    if (isCrit) {
      sfx.crit();
      setShake(8);
    } else {
      sfx.click();
    }
    setRockHit(true);
    setTimeout(() => setRockHit(false), 100);
  };

  const buyHelper = (helper: Helper) => {
    setState((s) => {
      const owned = s.helpers[helper.id] ?? { count: 0, upgrades: [] };
      const cost = helperCost(helper, owned.count);
      if (s.zion < cost) return s;
      sfx.buy();
      return {
        ...s,
        zion: s.zion - cost,
        helpers: {
          ...s.helpers,
          [helper.id]: { count: owned.count + 1, upgrades: owned.upgrades },
        },
      };
    });
  };

  const buyUpgrade = (helper: Helper, upgradeIdx: number) => {
    setState((s) => {
      const owned = s.helpers[helper.id];
      if (!owned || owned.count === 0) return s;
      if (owned.upgrades[upgradeIdx] > 0) return s; // already bought
      const upgrade = helper.upgrades[upgradeIdx];
      if (s.zion < upgrade.cost || s.diamonds < upgrade.diamonds) return s;
      sfx.buy();
      const newUpgrades = [...owned.upgrades];
      newUpgrades[upgradeIdx] = 1;
      return {
        ...s,
        zion: s.zion - upgrade.cost,
        diamonds: s.diamonds - upgrade.diamonds,
        helpers: {
          ...s.helpers,
          [helper.id]: { ...owned, upgrades: newUpgrades },
        },
      };
    });
  };

  const equipPickaxe = (pickaxeId: string) => {
    setState((s) => ({ ...s, equippedPickaxe: pickaxeId }));
    sfx.click();
  };

  const travelTo = (locationIdx: number) => {
    if (!unlockedLocations[locationIdx]) return;
    setState((s) => ({
      ...s,
      currentLocation: locationIdx,
      rockNumber: 1,
      rockMaxHp: LOCATIONS[locationIdx].rockBaseHp,
      rockHp: LOCATIONS[locationIdx].rockBaseHp,
      lootThresholdsHit: [false, false, false, false, false],
    }));
    sfx.unlock();
  };

  const collectLoot = () => {
    setShowLootModal(false);
    setGroundLoot([]);
  };

  const hardReset = () => {
    if (!confirm(cs ? 'Opravdu resetovat celou hru? Všechny progresy budou ztraceny!' : 'Really reset the entire game? All progress will be lost!')) return;
    localStorage.removeItem(SAVE_KEY);
    setState({ ...INITIAL_STATE, startTime: Date.now(), lastSave: Date.now() });
    setGroundLoot([]);
    setShowLootModal(false);
  };

  // ─── Available helpers for current location ─────────────────────────────────

  const availableHelpers = useMemo(() => {
    return HELPERS.filter((h) => h.location <= state.currentLocation);
  }, [state.currentLocation]);

  const currentLoc = LOCATIONS[state.currentLocation];
  const rockHpPercent = (state.rockHp / state.rockMaxHp) * 100;
  const dogeAhead = state.dogeTotal > state.totalEarned;

  return (
    <div
      className="relative min-h-screen overflow-x-hidden bg-black pb-24 pt-24 md:pt-28"
      style={shake > 0 ? { animation: `shake ${shake > 10 ? '0.4s' : '0.2s'} ease-in-out` } : undefined}
    >
      <style>{`@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-${shake * 0.5}px)}75%{transform:translateX(${shake * 0.5}px)}}`}</style>

      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`, top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%` }}
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.3, 1] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.08 }}
          />
        ))}
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
            {cs ? 'Zpět' : 'Back'}
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { sfx.init(); setMuted((m) => !m); }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
            >
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button
              onClick={hardReset}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              {cs ? 'Reset' : 'Reset'}
            </button>
          </div>
        </div>

        {/* Title + resource bar */}
        <div className="zion-panel rounded-3xl bg-black/60 p-4 md:p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gradient flex items-center gap-2">
                {currentLoc.emoji} {currentLoc.name}
              </h1>
              <p className="mt-1 text-xs text-gray-500">{currentLoc.description}</p>
            </div>
            <div className="grid grid-cols-3 gap-3 md:gap-4">
              <ResourceDisplay icon={Coins} label="ZION" value={fmt(state.zion)} color="text-emerald-300" />
              <ResourceDisplay icon={Gem} label={cs ? 'Diamanty' : 'Diamonds'} value={state.diamonds.toString()} color="text-cyan-300" />
              <ResourceDisplay icon={Zap} label="DPS" value={fmt(totalDps)} color="text-orange-300" />
            </div>
          </div>
        </div>

        {/* Doge rival bar */}
        <div className={`rounded-2xl border p-3 ${dogeAhead ? 'border-amber-400/30 bg-amber-500/5' : 'border-emerald-400/20 bg-emerald-500/5'}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Image src="/dogecoin-logo.png" alt="Doge" width={28} height={28} className="h-7 w-7 object-contain" />
              <div>
                <p className="text-xs font-bold text-amber-300">🐕 Doge {dogeAhead ? (cs ? 'vede!' : 'leads!') : (cs ? 'zaostává' : 'trailing')}</p>
                <p className="text-[10px] text-gray-500">{dogeQuote}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold tabular-nums text-amber-300">{fmt(state.dogeTotal)}</p>
              <p className="text-[10px] text-gray-500">vs {fmt(state.totalEarned)} ZION</p>
            </div>
          </div>
        </div>

        {/* Rock mining area */}
        <section className="relative rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <PickaxeIcon className="h-5 w-5 text-zion-gold" />
                {cs ? `Skála #${state.rockNumber}` : `Rock #${state.rockNumber}`}
              </h2>
              <p className="text-xs text-gray-500">
                {cs ? `DPC: ${fmt(stats.dpc)} | Crit: ${(stats.critChance * 100).toFixed(1)}% | Luck: ${(stats.luck * 100).toFixed(0)}%` : `DPC: ${fmt(stats.dpc)} | Crit: ${(stats.critChance * 100).toFixed(1)}% | Luck: ${(stats.luck * 100).toFixed(0)}%`}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">{cs ? 'HP skály' : 'Rock HP'}</p>
              <p className="text-sm font-bold tabular-nums text-white">{fmt(state.rockHp)} / {fmt(state.rockMaxHp)}</p>
            </div>
          </div>

          {/* HP bar */}
          <div className="mb-6 h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-zion-gold to-orange-500"
              animate={{ width: `${rockHpPercent}%` }}
              transition={{ duration: 0.1 }}
            />
          </div>

          {/* Loot threshold indicators */}
          <div className="relative mb-6 h-1">
            {LOOT_THRESHOLDS.map((t, i) => (
              <div
                key={i}
                className={`absolute top-0 h-1 w-1 rounded-full ${state.lootThresholdsHit[i] ? 'bg-emerald-400' : 'bg-white/30'}`}
                style={{ left: `${(1 - t) * 100}%` }}
                title={`Loot at ${(1 - t) * 100}% HP`}
              />
            ))}
          </div>

          {/* Rock (clickable) */}
          <div className="flex justify-center">
            <motion.button
              onClick={handleRockClick}
              onTouchStart={(e) => { e.preventDefault(); handleRockClick(e); }}
              whileTap={{ scale: 0.95 }}
              animate={rockHit ? { scale: 0.97 } : { scale: 1 }}
              className={`relative flex h-48 w-48 md:h-64 md:w-64 items-center justify-center rounded-full border-4 ${currentLoc.theme === 'doge' ? 'border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-orange-700/20' : 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20'} shadow-[0_20px_80px_rgba(0,0,0,0.3)] transition-all active:scale-95`}
            >
              <motion.div
                animate={{ rotate: [0, -2, 2, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="text-7xl md:text-9xl"
              >
                {currentLoc.theme === 'doge' ? '🪨' : '💎'}
              </motion.div>
              {/* Damage cracks overlay based on HP */}
              {rockHpPercent < 50 && <div className="absolute inset-0 flex items-center justify-center text-4xl opacity-30">💢</div>}
              {rockHpPercent < 25 && <div className="absolute inset-0 flex items-center justify-center text-5xl opacity-40">⚡</div>}
            </motion.button>
          </div>

          {/* Floating damage numbers */}
          <AnimatePresence>
            {floating.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, x: f.x, y: f.y, scale: 0.8 }}
                animate={{ opacity: 0, y: f.y - 60, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className={`pointer-events-none fixed z-50 text-lg font-bold ${f.color} drop-shadow-lg`}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Ground loot indicators */}
          {groundLoot.length > 0 && !showLootModal && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={() => setShowLootModal(true)}
                className="inline-flex items-center gap-2 rounded-xl border border-zion-gold/30 bg-zion-gold/10 px-4 py-2 text-sm font-semibold text-zion-gold hover:bg-zion-gold/20 transition-colors"
              >
                <ShoppingBag className="h-4 w-4" />
                {cs ? `Loot na zemi (${groundLoot.length})` : `Loot on ground (${groundLoot.length})`}
              </button>
            </div>
          )}
        </section>

        {/* Tab navigation */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <TabButton active={activeTab === 'helpers'} onClick={() => setActiveTab('helpers')} icon={ShoppingBag} label={cs ? 'Helpers' : 'Helpers'} />
          <TabButton active={activeTab === 'shop'} onClick={() => setActiveTab('shop')} icon={PickaxeIcon} label={cs ? 'Pickaxes' : 'Pickaxes'} />
          <TabButton active={activeTab === 'inventory'} onClick={() => setActiveTab('inventory')} icon={Backpack} label={cs ? 'Inventář' : 'Inventory'} />
          <TabButton active={activeTab === 'map'} onClick={() => setActiveTab('map')} icon={MapPin} label={cs ? 'Mapa' : 'Map'} />
        </div>

        {/* Tab content */}
        {activeTab === 'helpers' && (
          <HelpersTab
            cs={cs}
            helpers={availableHelpers}
            state={state}
            stats={stats}
            onBuy={buyHelper}
            onBuyUpgrade={buyUpgrade}
          />
        )}

        {activeTab === 'shop' && (
          <ShopTab
            cs={cs}
            state={state}
            onEquip={equipPickaxe}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryTab cs={cs} state={state} />
        )}

        {activeTab === 'map' && (
          <MapTab
            cs={cs}
            state={state}
            unlockedLocations={unlockedLocations}
            onTravel={travelTo}
          />
        )}

        {/* Stats footer */}
        <section className="rounded-3xl border border-white/10 bg-black/60 p-6">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-white/80">
            <Trophy className="h-4 w-4 text-zion-gold" />
            {cs ? 'Statistiky' : 'Stats'}
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox label={cs ? 'Celkem vyděláno' : 'Total earned'} value={fmt(state.totalEarned)} color="text-emerald-300" />
            <StatBox label={cs ? 'Kliky' : 'Clicks'} value={state.clicks.toLocaleString()} color="text-zion-gold" />
            <StatBox label={cs ? 'DPC' : 'DPC'} value={fmt(stats.dpc)} color="text-cyan-300" />
            <StatBox label={cs ? 'DPS' : 'DPS'} value={fmt(totalDps)} color="text-orange-300" />
            <StatBox label={cs ? 'Crit šance' : 'Crit chance'} value={`${(stats.critChance * 100).toFixed(1)}%`} color="text-yellow-300" />
            <StatBox label={cs ? 'Luck' : 'Luck'} value={`${(stats.luck * 100).toFixed(0)}%`} color="text-purple-300" />
            <StatBox label={cs ? 'Loot Find' : 'Loot Find'} value={`${(stats.lootFind * 100).toFixed(0)}%`} color="text-blue-300" />
            <StatBox label={cs ? 'Wow' : 'Wow'} value={`${(stats.wow * 100).toFixed(0)}%`} color="text-pink-300" />
          </div>
        </section>
      </div>

      {/* Loot modal */}
      <AnimatePresence>
        {showLootModal && groundLoot.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={collectLoot}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="max-w-md rounded-3xl border border-zion-gold/30 bg-gradient-to-br from-black/80 to-zion-gold/10 p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="mb-4 flex items-center gap-2 text-xl font-bold text-zion-gold">
                <Sparkles className="h-5 w-5" />
                {cs ? 'Loot!' : 'Loot!'}
              </h3>
              <div className="space-y-2">
                {groundLoot.map((drop, i) => (
                  <LootItem key={i} drop={drop} />
                ))}
              </div>
              <button
                onClick={collectLoot}
                className="mt-4 w-full rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-4 py-2.5 text-sm font-semibold text-zion-gold hover:bg-zion-gold/30 transition-colors"
              >
                {cs ? 'Sebrat vše' : 'Collect all'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Compute stats from state ─────────────────────────────────────────────────

function computeStats(state: GameState): Stats {
  // Base DPC
  let dpc = 1;

  // Pickaxe DPC
  const pickaxe = PICKAXES.find((p) => p.id === state.equippedPickaxe);
  if (pickaxe) {
    dpc += pickaxe.dpc;
  }

  // Fortune DPC multiplier
  let dpcMult = 1;
  let dpsMult = 1;
  let critChance = 0;
  let luck = 0;
  let lootFind = 0;
  let wow = 0;

  for (const fid of state.ownedFortunes) {
    const f = FORTUNES.find((x) => x.id === fid);
    if (!f) continue;
    dpcMult *= f.dpcMult;
    dpsMult *= f.dpsMult;
    critChance += f.critChance;
    luck += f.luck;
    lootFind += f.lootFind;
    wow += f.wow;
  }

  // Pickaxe stats
  if (pickaxe) {
    critChance += pickaxe.critChance;
    luck += pickaxe.luck;
    lootFind += pickaxe.lootFind;
    wow += pickaxe.wow;
  }

  dpc *= dpcMult;

  return { dpc, dps: 0, critChance, luck, lootFind, wow };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ResourceDisplay({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/40 p-2.5 text-center">
      <Icon className={`mx-auto h-4 w-4 ${color} mb-1`} />
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
      <p className="text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: any; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition-colors whitespace-nowrap ${
        active ? 'bg-white/10 text-white border border-white/20' : 'text-gray-400 hover:text-white border border-transparent'
      }`}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/3 p-3 text-center">
      <p className={`text-base font-bold tabular-nums ${color}`}>{value}</p>
      <p className="mt-0.5 text-[9px] uppercase tracking-wider text-gray-500">{label}</p>
    </div>
  );
}

function LootItem({ drop }: { drop: LootDrop }) {
  const rarityCfg = RARITY_CONFIG[drop.rarity];
  if (drop.type === 'coins') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-emerald-400/20 bg-emerald-500/5 p-3">
        <span className="text-2xl">🪙</span>
        <div>
          <p className="text-sm font-bold text-emerald-300">+{fmt(drop.amount ?? 0)} ZION</p>
          <p className="text-[10px] text-gray-500">Coins</p>
        </div>
      </div>
    );
  }
  if (drop.type === 'diamonds') {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3">
        <span className="text-2xl">💎</span>
        <div>
          <p className="text-sm font-bold text-cyan-300">+{drop.amount} {drop.amount === 1 ? 'Diamond' : 'Diamonds'}</p>
          <p className="text-[10px] text-gray-500">Premium currency</p>
        </div>
      </div>
    );
  }
  if (drop.type === 'pickaxe' && drop.pickaxeId) {
    const p = PICKAXES.find((x) => x.id === drop.pickaxeId);
    if (!p) return null;
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${rarityColor(drop.rarity)}`}>
        <span className="text-2xl">{p.emoji}</span>
        <div className="flex-1">
          <p className={`text-sm font-bold ${rarityCfg.color}`}>{p.name}</p>
          <p className="text-[10px] text-gray-500">
            +{fmt(p.dpc)} DPC · {(p.critChance * 100).toFixed(0)}% crit · {(p.luck * 100).toFixed(0)}% luck
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase ${rarityCfg.color}`}>{rarityCfg.label}</span>
      </div>
    );
  }
  if (drop.type === 'fortune' && drop.fortuneId) {
    const f = FORTUNES.find((x) => x.id === drop.fortuneId);
    if (!f) return null;
    return (
      <div className={`flex items-center gap-3 rounded-xl border p-3 ${rarityColor(drop.rarity)}`}>
        <span className="text-2xl">{f.emoji}</span>
        <div className="flex-1">
          <p className={`text-sm font-bold ${rarityCfg.color}`}>{f.name}</p>
          <p className="text-[10px] text-gray-500">
            {f.dpcMult > 1 ? `${f.dpcMult}x DPC ` : ''}
            {f.dpsMult > 1 ? `${f.dpsMult}x DPS ` : ''}
            {f.critChance > 0 ? `+${(f.critChance * 100).toFixed(0)}% crit` : ''}
          </p>
        </div>
        <span className={`text-[10px] font-bold uppercase ${rarityCfg.color}`}>{rarityCfg.label}</span>
      </div>
    );
  }
  return null;
}

function rarityColor(rarity: Rarity): string {
  const map: Record<Rarity, string> = {
    common: 'border-gray-500/20 bg-gray-500/5',
    improved: 'border-green-500/20 bg-green-500/5',
    rare: 'border-blue-500/30 bg-blue-500/10',
    epic: 'border-purple-500/30 bg-purple-500/10',
    legendary: 'border-amber-500/40 bg-amber-500/10',
  };
  return map[rarity];
}

// ─── Helpers Tab ──────────────────────────────────────────────────────────────

function HelpersTab({ cs, helpers, state, stats, onBuy, onBuyUpgrade }: {
  cs: boolean;
  helpers: Helper[];
  state: GameState;
  stats: Stats;
  onBuy: (h: Helper) => void;
  onBuyUpgrade: (h: Helper, idx: number) => void;
}) {
  return (
    <div className="space-y-3">
      {helpers.map((helper) => {
        const owned = state.helpers[helper.id] ?? { count: 0, upgrades: [] };
        const cost = helperCost(helper, owned.count);
        const canAfford = state.zion >= cost;
        const dps = helperDps(helper, owned.count, owned.upgrades);
        const loc = LOCATIONS[helper.location];

        return (
          <div key={helper.id} className="rounded-2xl border border-white/10 bg-black/60 p-4">
            <div className="flex items-center gap-4">
              {/* Helper icon */}
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-3xl">
                {helper.emoji}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white truncate">{helper.name}</h3>
                  {owned.count > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/80">x{owned.count}</span>}
                </div>
                <p className="text-[10px] text-gray-500 truncate">{helper.description}</p>
                <div className="mt-1 flex items-center gap-3 text-[10px]">
                  <span className="text-orange-300">{fmt(dps)} DPS</span>
                  {owned.count > 0 && <span className="text-gray-500">{fmt(helper.baseDps)} each</span>}
                </div>
              </div>

              {/* Buy button */}
              <button
                onClick={() => onBuy(helper)}
                disabled={!canAfford}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold transition-colors ${
                  canAfford
                    ? 'bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30'
                    : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                }`}
              >
                <div className="text-center">
                  <div>{fmt(cost)}</div>
                  <div className="text-[8px] opacity-70">ZION</div>
                </div>
              </button>
            </div>

            {/* Upgrades */}
            {owned.count > 0 && (
              <div className="mt-3 space-y-2 border-t border-white/5 pt-3">
                {helper.upgrades.map((upgrade, idx) => {
                  const bought = owned.upgrades[idx] > 0;
                  const canBuy = !bought && state.zion >= upgrade.cost && state.diamonds >= upgrade.diamonds;
                  return (
                    <div key={upgrade.id} className="flex items-center gap-3 rounded-lg border border-white/5 bg-white/3 p-2.5">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{upgrade.name}</span>
                          {bought && <Check className="h-3 w-3 text-emerald-400" />}
                        </div>
                        <p className="text-[9px] text-gray-500 truncate">{upgrade.description}</p>
                      </div>
                      {!bought && (
                        <button
                          onClick={() => onBuyUpgrade(helper, idx)}
                          disabled={!canBuy}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-bold transition-colors ${
                            canBuy
                              ? 'bg-zion-gold/20 border border-zion-gold/30 text-zion-gold hover:bg-zion-gold/30'
                              : 'bg-white/5 border border-white/10 text-gray-600 cursor-not-allowed'
                          }`}
                        >
                          <div className="text-center">
                            <div>{fmt(upgrade.cost)} ZION</div>
                            {upgrade.diamonds > 0 && <div className="text-[8px] opacity-70">+ {upgrade.diamonds} 💎</div>}
                          </div>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Shop Tab (Pickaxes) ──────────────────────────────────────────────────────

function ShopTab({ cs, state, onEquip }: {
  cs: boolean;
  state: GameState;
  onEquip: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {cs ? 'Pickaxe se získávají z lootu při těžbě skály. Equipni nejlepší pro vyšší DPC a stats.' : 'Pickaxes are obtained from loot while mining rocks. Equip the best one for higher DPC and stats.'}
      </p>
      {PICKAXES.map((pickaxe) => {
        const owned = state.ownedPickaxes.includes(pickaxe.id);
        const equipped = state.equippedPickaxe === pickaxe.id;
        const rarityCfg = RARITY_CONFIG[pickaxe.rarity];

        return (
          <div key={pickaxe.id} className={`rounded-2xl border p-4 ${rarityColor(pickaxe.rarity)} ${!owned ? 'opacity-40' : ''}`}>
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-black/40 text-2xl">
                {pickaxe.emoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`font-bold ${rarityCfg.color}`}>{pickaxe.name}</h3>
                  <span className={`text-[9px] font-bold uppercase ${rarityCfg.color}`}>{rarityCfg.label}</span>
                </div>
                <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-gray-400">
                  <span>+{fmt(pickaxe.dpc)} DPC</span>
                  {pickaxe.critChance > 0 && <span>{(pickaxe.critChance * 100).toFixed(0)}% crit</span>}
                  {pickaxe.luck > 0 && <span>{(pickaxe.luck * 100).toFixed(0)}% luck</span>}
                  {pickaxe.lootFind > 0 && <span>{(pickaxe.lootFind * 100).toFixed(0)}% loot find</span>}
                  {pickaxe.wow > 0 && <span>{(pickaxe.wow * 100).toFixed(0)}% wow</span>}
                </div>
              </div>
              <div className="shrink-0">
                {!owned ? (
                  <span className="text-[10px] text-gray-600"><Lock className="h-4 w-4" /></span>
                ) : equipped ? (
                  <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-[10px] font-bold text-emerald-300">
                    <Check className="h-3 w-3" /> {cs ? 'Equipnuto' : 'Equipped'}
                  </span>
                ) : (
                  <button
                    onClick={() => onEquip(pickaxe.id)}
                    className="rounded-lg bg-white/10 border border-white/20 px-3 py-1.5 text-[10px] font-bold text-white hover:bg-white/20 transition-colors"
                  >
                    {cs ? 'Equip' : 'Equip'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Inventory Tab ────────────────────────────────────────────────────────────

function InventoryTab({ cs, state }: { cs: boolean; state: GameState }) {
  const ownedFortuneList = state.ownedFortunes
    .map((id) => FORTUNES.find((f) => f.id === id))
    .filter((f): f is Fortune => f !== undefined);

  return (
    <div className="space-y-4">
      {/* Fortunes */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <Sparkles className="h-4 w-4 text-zion-gold" />
          {cs ? 'Fortunes (pasivní)' : 'Fortunes (passive)'}
        </h3>
        {ownedFortuneList.length === 0 ? (
          <p className="text-xs text-gray-500 rounded-xl border border-white/5 bg-white/3 p-4 text-center">
            {cs ? 'Zatím žádné fortunes. Těž skály pro loot!' : 'No fortunes yet. Mine rocks for loot!'}
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {ownedFortuneList.map((f) => {
              const rarityCfg = RARITY_CONFIG[f.rarity];
              return (
                <div key={f.id} className={`rounded-xl border p-3 ${rarityColor(f.rarity)}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{f.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-bold ${rarityCfg.color}`}>{f.name}</p>
                      <p className="text-[9px] text-gray-500">
                        {f.dpcMult > 1 ? `${f.dpcMult}x DPC ` : ''}
                        {f.dpsMult > 1 ? `${f.dpsMult}x DPS ` : ''}
                        {f.critChance > 0 ? `+${(f.critChance * 100).toFixed(0)}% crit ` : ''}
                        {f.luck > 0 ? `+${(f.luck * 100).toFixed(0)}% luck` : ''}
                      </p>
                    </div>
                    <span className={`text-[8px] font-bold uppercase ${rarityCfg.color}`}>{rarityCfg.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Owned pickaxes summary */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-white">
          <PickaxeIcon className="h-4 w-4 text-zion-gold" />
          {cs ? 'Pickaxes v inventáři' : 'Pickaxes in inventory'}
        </h3>
        <div className="flex flex-wrap gap-2">
          {state.ownedPickaxes.map((id) => {
            const p = PICKAXES.find((x) => x.id === id);
            if (!p) return null;
            const equipped = state.equippedPickaxe === id;
            return (
              <div key={id} className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs ${equipped ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-white/5'}`}>
                <span>{p.emoji}</span>
                <span className={equipped ? 'text-emerald-300' : 'text-gray-400'}>{p.name}</span>
                {equipped && <Check className="h-3 w-3 text-emerald-400" />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Map Tab ──────────────────────────────────────────────────────────────────

function MapTab({ cs, state, unlockedLocations, onTravel }: {
  cs: boolean;
  state: GameState;
  unlockedLocations: boolean[];
  onTravel: (idx: number) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        {cs ? 'Cestuj mezi lokacemi. Každá má tvrdší skály a lepší odměny.' : 'Travel between locations. Each has harder rocks and better rewards.'}
      </p>
      {LOCATIONS.map((loc, i) => {
        const unlocked = unlockedLocations[i];
        const current = state.currentLocation === i;
        const progress = state.totalEarned / loc.unlockAt;

        return (
          <div
            key={loc.id}
            className={`rounded-2xl border p-4 ${
              current
                ? 'border-emerald-500/30 bg-emerald-500/10'
                : unlocked
                ? 'border-white/10 bg-black/60'
                : 'border-white/5 bg-white/3 opacity-60'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-3xl">
                {unlocked ? loc.emoji : <Lock className="h-5 w-5 text-gray-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white">{loc.name}</h3>
                  {current && <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[9px] font-bold text-emerald-300">{cs ? 'ZDE' : 'HERE'}</span>}
                  {loc.theme === 'doge' && <span className="text-xs">🐕</span>}
                  {loc.theme === 'zion' && <span className="text-xs">🛡️</span>}
                </div>
                <p className="text-[10px] text-gray-500">{loc.description}</p>
                {!unlocked && (
                  <div className="mt-1.5">
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div className="h-full bg-zion-gold/50" style={{ width: `${Math.min(100, progress * 100)}%` }} />
                    </div>
                    <p className="mt-0.5 text-[9px] text-gray-600">
                      {cs ? `Odemkni při ${fmt(loc.unlockAt)} ZION` : `Unlocks at ${fmt(loc.unlockAt)} ZION`}
                    </p>
                  </div>
                )}
              </div>
              {unlocked && !current && (
                <button
                  onClick={() => onTravel(i)}
                  className="shrink-0 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-xs font-bold text-white hover:bg-white/20 transition-colors"
                >
                  {cs ? 'Cestovat' : 'Travel'} <ChevronRight className="inline h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
