'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Pickaxe,
  Cpu,
  Zap,
  Star,
  Rocket,
  Trophy,
  RotateCcw,
  Sparkles,
  Server,
  Shield,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const DogeVsZionGamesStarMinerCopy = {
  back: { cs: `Zpět`, en: `Back` },
  mineOnTheStarReachIssobella: { cs: `Těž na hvězdě · Dosáhni Issobelly`, en: `Mine on the star · Reach Issobella` },
  zionBalance: { cs: `ZION zůstatek`, en: `ZION balance` },
  zionSec: { cs: `ZION/sek`, en: `ZION/sec` },
  clickPower: { cs: `Síla kliku`, en: `Click power` },
  layer: { cs: `Vrstva`, en: `Layer` },
  totalMined: { cs: `Celkem vytěženo`, en: `Total mined` },
  miningRigs: { cs: `Těžební Rigy`, en: `Mining Rigs` },
  zS: { cs: `Z/s`, en: `Z/s` },
  mineZion: { cs: `Těžit ZION`, en: `Mine ZION` },
  clickTheStarToMine: { cs: `Klikni na hvězdu pro těžbu`, en: `Click the star to mine` },
  perClick: { cs: `za klik`, en: `per click` },
  upgrades: { cs: `Vylepšení`, en: `Upgrades` },
  reset: { cs: `Reset`, en: `Reset` },
  newLayer: { cs: `Nová vrstva!`, en: `New Layer!` },
  keepMiningDeeperIntoZion: { cs: `Pokračuj v těžbě hlouběji do ZION.`, en: `Keep mining deeper into ZION.` },
  continue: { cs: `Pokračovat`, en: `Continue` },
  youReachedIssobella: { cs: `Dosáhl jsi Issobelly!`, en: `You reached Issobella!` },
  youMinedYourWayToL6ZionIsYours: { cs: `Vytesal jsi si cestu na L6. ZION je tvůj.`, en: `You mined your way to L6. ZION is yours.` },
  keepPlaying: { cs: `Hraju dál`, en: `Keep Playing` },
  newGame: { cs: `Nová hra`, en: `New Game` },
  resetGame: { cs: `Resetovat hru?`, en: `Reset game?` },
  allProgressWillBeLost: { cs: `Veškerý postup bude ztracen.`, en: `All progress will be lost.` },
  cancel: { cs: `Zrušit`, en: `Cancel` },
  reset_2: { cs: `Resetovat`, en: `Reset` },
  welcomeBack: { cs: `Vítej zpět!`, en: `Welcome back!` },
  yourRigsMinedWhileYouWereAway: { cs: `Tvá rigy těžily while jsi byl pryč.`, en: `Your rigs mined while you were away.` },
  awesome: { cs: `Skvělé`, en: `Awesome` },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SAVE_KEY = 'star-miner-save';
const TICK_MS = 100; // production tick
const SAVE_MS = 5000; // autosave interval
const OFFLINE_CAP_SEC = 28800; // 8 hours

interface HelperDef {
  id: string;
  name: string;
  nameCs: string;
  icon: typeof Cpu;
  baseCost: number;
  baseRate: number; // ZION per second per unit
  desc: string;
  descCs: string;
}

const HELPERS: HelperDef[] = [
  {
    id: 'cpu',
    name: 'CPU Miner',
    nameCs: 'CPU Těžič',
    icon: Cpu,
    baseCost: 50,
    baseRate: 1,
    desc: 'A humble CPU crunching hashes.',
    descCs: 'Skromné CPU počítající hashe.',
  },
  {
    id: 'gpu',
    name: 'GPU Rig (RX 5700 XT)',
    nameCs: 'GPU Rig (RX 5700 XT)',
    icon: Zap,
    baseCost: 500,
    baseRate: 8,
    desc: 'Overclocked RDNA1 GPUs. Serious hashrate.',
    descCs: 'Overclockované RDNA1 GPU. Solidní hashrate.',
  },
  {
    id: 'pool',
    name: 'Mining Pool',
    nameCs: 'Těžební Pool',
    icon: Server,
    baseCost: 5_000,
    baseRate: 50,
    desc: 'Many rigs, one reward. Pooled power.',
    descCs: 'Mnoho rigů, jedna odměna. Společná síla.',
  },
  {
    id: 'validator',
    name: 'Validator Node',
    nameCs: 'Validátor Uzel',
    icon: Server,
    baseCost: 50_000,
    baseRate: 300,
    desc: 'Secures consensus while it mines.',
    descCs: 'Zabezpečuje konsenzus a zároveň těží.',
  },
  {
    id: 'stargate',
    name: 'Stargate Harvester',
    nameCs: 'Hvězdná Brána Harvester',
    icon: Rocket,
    baseCost: 500_000,
    baseRate: 2_000,
    desc: 'Harvests ZION straight from the stargate.',
    descCs: 'Sklízí ZION přímo z hvězdné brány.',
  },
  {
    id: 'harmony',
    name: 'Cosmic Harmony Engine',
    nameCs: 'Kosmický Harmony Engine',
    icon: Sparkles,
    baseCost: 5_000_000,
    baseRate: 15_000,
    desc: 'The engine that tunes the cosmos to mine.',
    descCs: 'Engine, který ladí vesmír k těžbě.',
  },
];

interface UpgradeDef {
  id: string;
  name: string;
  nameCs: string;
  icon: typeof Pickaxe;
  cost: number;
  desc: string;
  descCs: string;
  // effect: applies to click power, a specific helper, or all
  kind: 'click' | 'helper' | 'all';
  target?: string; // helper id when kind === 'helper'
  mult?: number; // multiplier for helper/all
  flat?: number; // flat add for click
}

const UPGRADES: UpgradeDef[] = [
  {
    id: 'pickaxe',
    name: 'Better Pickaxe',
    nameCs: 'Lepší Krumpáč',
    icon: Pickaxe,
    cost: 100,
    desc: '+2 click power.',
    descCs: '+2 síla kliku.',
    kind: 'click',
    flat: 2,
  },
  {
    id: 'ocgpu',
    name: 'Overclocked GPUs',
    nameCs: 'Overclockované GPU',
    icon: Zap,
    cost: 1_000,
    desc: '2x GPU Rig production.',
    descCs: '2x produkce GPU Rig.',
    kind: 'helper',
    target: 'gpu',
    mult: 2,
  },
  {
    id: 'poolopt',
    name: 'Pool Optimization',
    nameCs: 'Optimalizace Poolu',
    icon: Server,
    cost: 10_000,
    desc: '2x Mining Pool production.',
    descCs: '2x produkce Mining Pool.',
    kind: 'helper',
    target: 'pool',
    mult: 2,
  },
  {
    id: 'deeksha',
    name: 'Deeksha Lite v1',
    nameCs: 'Deeksha Lite v1',
    icon: Sparkles,
    cost: 100_000,
    desc: '2x all production.',
    descCs: '2x veškerá produkce.',
    kind: 'all',
    mult: 2,
  },
  {
    id: 'quantum',
    name: 'Quantum Resistance',
    nameCs: 'Kvantová Odolnost',
    icon: Shield,
    cost: 1_000_000,
    desc: '3x all production.',
    descCs: '3x veškerá produkce.',
    kind: 'all',
    mult: 3,
  },
];

// Shield imported above with other lucide-react icons

interface LayerDef {
  id: string;
  name: string;
  nameCs: string;
  threshold: number; // totalMined required
  emoji: string;
}

const LAYERS: LayerDef[] = [
  { id: 'l1', name: 'L1 Earth', nameCs: 'L1 Země', threshold: 0, emoji: '🌍' },
  { id: 'l2', name: 'L2 Hiran', nameCs: 'L2 Hiran', threshold: 10_000, emoji: '🟣' },
  { id: 'l3', name: 'L3 L3-Hiran', nameCs: 'L3 L3-Hiran', threshold: 100_000, emoji: '🔮' },
  { id: 'l4', name: 'L4 Oasis', nameCs: 'L4 Oasis', threshold: 1_000_000, emoji: '🌴' },
  { id: 'l5', name: 'L5 Free World', nameCs: 'L5 Svobodný Svět', threshold: 10_000_000, emoji: '🕊️' },
  { id: 'l6', name: 'L6 Issobella', nameCs: 'L6 Issobella', threshold: 100_000_000, emoji: '👑' },
];

// ─── Save format ──────────────────────────────────────────────────────────────

interface StarMinerSave {
  zion: number;
  totalMined: number;
  clickPower: number;
  helpers: Record<string, number>;
  upgrades: string[];
  muted: boolean;
  lastSeen: number;
}

function defaultSave(): StarMinerSave {
  return {
    zion: 0,
    totalMined: 0,
    clickPower: 1,
    helpers: {},
    upgrades: [],
    muted: false,
    lastSeen: Date.now(),
  };
}

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, rampTo?: number) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  click() { this.tone(660, 0.06, 'square', 0.04, 990); }
  buy() { this.tone(523, 0.08, 'sine', 0.05); setTimeout(() => this.tone(784, 0.1, 'sine', 0.05), 60); }
  layer() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'sine', 0.06), i * 90)); }
  win() { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => this.tone(f, 0.25, 'sine', 0.07), i * 120)); }
}

const sfx = new SoundManager();

// ─── Helper functions ─────────────────────────────────────────────────────────

function formatNumber(n: number): string {
  if (n < 1000) return n.toFixed(n < 10 && n % 1 !== 0 ? 1 : 0);
  if (n < 1e6) return `${(n / 1e3).toFixed(2)}K`;
  if (n < 1e9) return `${(n / 1e6).toFixed(2)}M`;
  if (n < 1e12) return `${(n / 1e9).toFixed(2)}B`;
  return `${(n / 1e12).toFixed(2)}T`;
}

function getHelperCost(def: HelperDef, owned: number): number {
  return Math.ceil(def.baseCost * Math.pow(1.15, owned));
}

function getUpgradeCost(def: UpgradeDef): number {
  return def.cost;
}

function getHelperMult(def: HelperDef, upgrades: string[]): number {
  let mult = 1;
  for (const upId of upgrades) {
    const up = UPGRADES.find((u) => u.id === upId);
    if (!up) continue;
    if (up.kind === 'helper' && up.target === def.id && up.mult) {
      mult *= up.mult;
    }
    if (up.kind === 'all' && up.mult) {
      mult *= up.mult;
    }
  }
  return mult;
}

function getZionPerSec(helpers: Record<string, number>, upgrades: string[]): number {
  let total = 0;
  for (const def of HELPERS) {
    const count = helpers[def.id] ?? 0;
    if (count <= 0) continue;
    total += count * def.baseRate * getHelperMult(def, upgrades);
  }
  return total;
}

function getClickPower(baseClick: number, upgrades: string[]): number {
  let power = baseClick;
  for (const upId of upgrades) {
    const up = UPGRADES.find((u) => u.id === upId);
    if (!up) continue;
    if (up.kind === 'click' && up.flat) power += up.flat;
    if (up.kind === 'all' && up.mult) power *= up.mult;
  }
  return power;
}

function getLayerIndex(totalMined: number): number {
  let idx = 0;
  for (let i = 0; i < LAYERS.length; i++) {
    if (totalMined >= LAYERS[i].threshold) idx = i;
  }
  return idx;
}

// ─── Particle ─────────────────────────────────────────────────────────────────

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  amount: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function StarMiner({ onBack }: { onBack: () => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [zion, setZion] = useState(0);
  const [totalMined, setTotalMined] = useState(0);
  const [helpers, setHelpers] = useState<Record<string, number>>({});
  const [upgrades, setUpgrades] = useState<string[]>([]);
  const [muted, setMuted] = useState(false);
  const [particles, setParticles] = useState<Particle[]>([]);
  const [burstKey, setBurstKey] = useState(0);
  const [layerOverlay, setLayerOverlay] = useState<LayerDef | null>(null);
  const [showVictory, setShowVictory] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [offlineEarnings, setOfflineEarnings] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Refs to avoid stale closures in the tick loop
  const zionRef = useRef(0);
  const totalRef = useRef(0);
  const helpersRef = useRef<Record<string, number>>({});
  const upgradesRef = useRef<string[]>([]);
  const mutedRef = useRef(false);
  const layerIdxRef = useRef(0);
  const particleIdRef = useRef(0);
  const saveRef = useRef<StarMinerSave>(defaultSave());

  // Keep refs in sync with state
  useEffect(() => { zionRef.current = zion; }, [zion]);
  useEffect(() => { totalRef.current = totalMined; }, [totalMined]);
  useEffect(() => { helpersRef.current = helpers; }, [helpers]);
  useEffect(() => { upgradesRef.current = upgrades; }, [upgrades]);
  useEffect(() => { mutedRef.current = muted; sfx.enabled = !muted; }, [muted]);

  const rate = getZionPerSec(helpers, upgrades);
  const clickPower = getClickPower(1, upgrades);
  const layerIdx = getLayerIndex(totalMined);
  const currentLayer = LAYERS[layerIdx];
  const nextLayer = LAYERS[layerIdx + 1] ?? null;
  const isWin = layerIdx >= LAYERS.length - 1;

  // ─── Load save on mount ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const data = JSON.parse(raw) as Partial<StarMinerSave>;
        const save: StarMinerSave = {
          ...defaultSave(),
          ...data,
          helpers: data.helpers ?? {},
          upgrades: data.upgrades ?? [],
        };
        saveRef.current = save;
        setZion(save.zion);
        setTotalMined(save.totalMined);
        setHelpers(save.helpers);
        setUpgrades(save.upgrades);
        setMuted(save.muted);
        mutedRef.current = save.muted;
        sfx.enabled = !save.muted;
        layerIdxRef.current = getLayerIndex(save.totalMined);

        // Offline progress
        const now = Date.now();
        const elapsedSec = Math.min(OFFLINE_CAP_SEC, Math.max(0, (now - (save.lastSeen ?? now)) / 1000));
        if (elapsedSec > 5) {
          const r = getZionPerSec(save.helpers, save.upgrades);
          if (r > 0) {
            const earned = r * elapsedSec;
            const newZion = save.zion + earned;
            const newTotal = save.totalMined + earned;
            setZion(newZion);
            setTotalMined(newTotal);
            zionRef.current = newZion;
            totalRef.current = newTotal;
            setOfflineEarnings(earned);
          }
        }
      }
    } catch { /* noop */ }
    setLoaded(true);
  }, []);

  // ─── Production tick ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const r = getZionPerSec(helpersRef.current, upgradesRef.current);
      if (r <= 0) return;
      const delta = (r * TICK_MS) / 1000;
      const newZion = zionRef.current + delta;
      const newTotal = totalRef.current + delta;
      zionRef.current = newZion;
      totalRef.current = newTotal;
      setZion(newZion);
      setTotalMined(newTotal);

      // Layer progression check
      const newIdx = getLayerIndex(newTotal);
      if (newIdx > layerIdxRef.current) {
        layerIdxRef.current = newIdx;
        const newLayer = LAYERS[newIdx];
        setLayerOverlay(newLayer);
        sfx.init();
        if (newIdx >= LAYERS.length - 1) {
          setShowVictory(true);
          sfx.win();
        } else {
          sfx.layer();
        }
      }
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [loaded]);

  // ─── Auto-save ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!loaded) return;
    const interval = setInterval(() => {
      const save: StarMinerSave = {
        zion: zionRef.current,
        totalMined: totalRef.current,
        clickPower: 1,
        helpers: helpersRef.current,
        upgrades: upgradesRef.current,
        muted: mutedRef.current,
        lastSeen: Date.now(),
      };
      saveRef.current = save;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      } catch { /* noop */ }
    }, SAVE_MS);
    return () => clearInterval(interval);
  }, [loaded]);

  // Save on unmount / visibility hide
  useEffect(() => {
    if (!loaded) return;
    const save = () => {
      const s: StarMinerSave = {
        zion: zionRef.current,
        totalMined: totalRef.current,
        clickPower: 1,
        helpers: helpersRef.current,
        upgrades: upgradesRef.current,
        muted: mutedRef.current,
        lastSeen: Date.now(),
      };
      try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* noop */ }
    };
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('beforeunload', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('beforeunload', save);
      save();
    };
  }, [loaded]);

  // ─── Particle cleanup ──────────────────────────────────────────────────────
  useEffect(() => {
    if (particles.length === 0) return;
    const t = setTimeout(() => setParticles([]), 900);
    return () => clearTimeout(t);
  }, [particles]);

  // ─── Actions ───────────────────────────────────────────────────────────────
  const handleStarClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    sfx.init();
    sfx.click();
    const power = getClickPower(1, upgradesRef.current);
    const newZion = zionRef.current + power;
    const newTotal = totalRef.current + power;
    zionRef.current = newZion;
    totalRef.current = newTotal;
    setZion(newZion);
    setTotalMined(newTotal);
    setBurstKey((k) => k + 1);

    // Particles from click position
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const newParts: Particle[] = [];
    const count = Math.min(8, 3 + Math.floor(power / 5));
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
      const speed = 40 + Math.random() * 60;
      newParts.push({
        id: particleIdRef.current++,
        x: cx,
        y: cy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 30,
        amount: power,
      });
    }
    setParticles((prev) => [...prev, ...newParts].slice(-40));

    // Layer progression check
    const newIdx = getLayerIndex(newTotal);
    if (newIdx > layerIdxRef.current) {
      layerIdxRef.current = newIdx;
      const newLayer = LAYERS[newIdx];
      setLayerOverlay(newLayer);
      if (newIdx >= LAYERS.length - 1) {
        setShowVictory(true);
        sfx.win();
      } else {
        sfx.layer();
      }
    }
  }, []);

  const buyHelper = useCallback((def: HelperDef) => {
    const owned = helpersRef.current[def.id] ?? 0;
    const cost = getHelperCost(def, owned);
    if (zionRef.current < cost) return;
    sfx.init();
    sfx.buy();
    const newZion = zionRef.current - cost;
    zionRef.current = newZion;
    setZion(newZion);
    const newHelpers = { ...helpersRef.current, [def.id]: owned + 1 };
    helpersRef.current = newHelpers;
    setHelpers(newHelpers);
  }, []);

  const buyUpgrade = useCallback((def: UpgradeDef) => {
    if (upgradesRef.current.includes(def.id)) return;
    if (zionRef.current < def.cost) return;
    sfx.init();
    sfx.buy();
    const newZion = zionRef.current - def.cost;
    zionRef.current = newZion;
    setZion(newZion);
    const newUpgrades = [...upgradesRef.current, def.id];
    upgradesRef.current = newUpgrades;
    setUpgrades(newUpgrades);
  }, []);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    sfx.enabled = !next;
    setMuted(next);
  }, []);

  const doReset = useCallback(() => {
    const fresh = defaultSave();
    saveRef.current = fresh;
    zionRef.current = 0;
    totalRef.current = 0;
    helpersRef.current = {};
    upgradesRef.current = [];
    layerIdxRef.current = 0;
    setZion(0);
    setTotalMined(0);
    setHelpers({});
    setUpgrades([]);
    setShowVictory(false);
    setLayerOverlay(null);
    setShowReset(false);
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(fresh)); } catch { /* noop */ }
  }, []);

  // Progress to next layer (0..1)
  const layerProgress = nextLayer
    ? Math.min(1, (totalMined - currentLayer.threshold) / (nextLayer.threshold - currentLayer.threshold))
    : 1;

  return (
    <div className="relative flex flex-col items-center w-full max-w-5xl mx-auto select-none px-2">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> {DogeVsZionGamesStarMinerCopy.back[cs ? 'cs' : 'en']}
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white leading-tight flex items-center gap-1.5 justify-center">
            <Star size={18} className="text-zion-purple" /> Star Miner
          </h2>
          <p className="text-[11px] text-slate-400">{DogeVsZionGamesStarMinerCopy.mineOnTheStarReachIssobella[cs ? 'cs' : 'en']}</p>
        </div>
        <button
          onClick={toggleMute}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Top stats bar */}
      <div className="w-full zion-rainbow-card zion-rainbow-sub p-3 mb-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🪙</span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.zionBalance[cs ? 'cs' : 'en']}</div>
              <div className="text-2xl font-black text-zion-purple leading-none">{formatNumber(zion)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Zap size={18} className="text-zion-cyan" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.zionSec[cs ? 'cs' : 'en']}</div>
              <div className="text-xl font-bold text-zion-cyan leading-none">{formatNumber(rate)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pickaxe size={18} className="text-zion-gold" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.clickPower[cs ? 'cs' : 'en']}</div>
              <div className="text-xl font-bold text-zion-gold leading-none">{formatNumber(clickPower)}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xl">{currentLayer.emoji}</span>
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.layer[cs ? 'cs' : 'en']}</div>
              <div className="text-sm font-bold text-white leading-none">{cs ? currentLayer.nameCs : currentLayer.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy size={18} className="text-zion-purple" />
            <div>
              <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.totalMined[cs ? 'cs' : 'en']}</div>
              <div className="text-xl font-bold text-white leading-none">{formatNumber(totalMined)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main play area: left helpers, center star, right upgrades */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-3 items-start">
        {/* Left: Helpers */}
        <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
            <Cpu size={15} className="text-zion-cyan" /> {DogeVsZionGamesStarMinerCopy.miningRigs[cs ? 'cs' : 'en']}
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {HELPERS.map((def) => {
              const owned = helpers[def.id] ?? 0;
              const cost = getHelperCost(def, owned);
              const mult = getHelperMult(def, upgrades);
              const perSec = def.baseRate * mult;
              const affordable = zion >= cost;
              const Icon = def.icon;
              return (
                <button
                  key={def.id}
                  onClick={() => buyHelper(def)}
                  disabled={!affordable}
                  className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                    affordable
                      ? 'border-zion-cyan/30 bg-zion-cyan/5 hover:bg-zion-cyan/10 hover:border-zion-cyan/50 cursor-pointer'
                      : 'border-white/10 bg-black/30 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zion-purple/15 border border-zion-purple/30">
                      <Icon size={16} className="text-zion-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{cs ? def.nameCs : def.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">×{owned}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[10px] text-zion-cyan">{formatNumber(perSec)} {DogeVsZionGamesStarMinerCopy.zS[cs ? 'cs' : 'en']}</span>
                        <span className={`text-[11px] font-bold ${affordable ? 'text-zion-gold' : 'text-slate-500'}`}>
                          🪙 {formatNumber(cost)}
                        </span>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: The Star */}
        <div className="flex flex-col items-center justify-center w-full lg:w-[340px]">
          <div className="relative zion-rainbow-card zion-rainbow-sub p-6 flex flex-col items-center" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
            {/* Clickable star */}
            <button
              onClick={handleStarClick}
              className="relative group focus:outline-none"
              aria-label={DogeVsZionGamesStarMinerCopy.mineZion[cs ? 'cs' : 'en']}
            >
              {/* Glow rings */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 60px 20px rgba(228,30,43,0.45)' }}
                animate={{ scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
                transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ boxShadow: '0 0 30px 10px rgba(6, 105, 40,0.35)' }}
                animate={{ scale: [1.1, 1, 1.1], opacity: [0.4, 0.7, 0.4] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              />
              {/* Star body */}
              <motion.div
                key={burstKey}
                initial={{ scale: 1 }}
                animate={{ scale: [1, 0.92, 1.04, 1] }}
                transition={{ duration: 0.25 }}
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: 180,
                  height: 180,
                  background: 'radial-gradient(circle at 35% 30%, #c084fc, #7e22ce 55%, #2e1065 100%)',
                  border: '2px solid rgba(216,180,254,0.6)',
                  boxShadow: 'inset 0 0 40px rgba(255,255,255,0.15), 0 0 80px rgba(228,30,43,0.5)',
                }}
              >
                <span className="text-7xl drop-shadow-[0_0_12px_rgba(255,255,255,0.6)] select-none" style={{ pointerEvents: 'none' }}>⭐</span>
              </motion.div>

              {/* Particles */}
              <AnimatePresence>
                {particles.map((p) => (
                  <motion.div
                    key={p.id}
                    initial={{ x: p.x, y: p.y, opacity: 1, scale: 1 }}
                    animate={{ x: p.x + p.vx, y: p.y + p.vy + 40, opacity: 0, scale: 0.5 }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="absolute pointer-events-none text-lg"
                    style={{ left: 0, top: 0 }}
                  >
                    🪙
                  </motion.div>
                ))}
              </AnimatePresence>
            </button>

            <p className="mt-4 text-xs text-slate-300 text-center">
              {DogeVsZionGamesStarMinerCopy.clickTheStarToMine[cs ? 'cs' : 'en']}
            </p>
            <p className="mt-1 text-[10px] text-slate-500 text-center">
              +{formatNumber(clickPower)} ZION {DogeVsZionGamesStarMinerCopy.perClick[cs ? 'cs' : 'en']}
            </p>
          </div>
        </div>

        {/* Right: Upgrades */}
        <div className="zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
          <h3 className="text-sm font-bold text-white mb-2 flex items-center gap-1.5">
            <Sparkles size={15} className="text-zion-purple" /> {DogeVsZionGamesStarMinerCopy.upgrades[cs ? 'cs' : 'en']}
          </h3>
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {UPGRADES.map((def) => {
              const owned = upgrades.includes(def.id);
              const affordable = !owned && zion >= def.cost;
              const Icon = def.icon;
              return (
                <button
                  key={def.id}
                  onClick={() => buyUpgrade(def)}
                  disabled={owned || !affordable}
                  className={`w-full text-left rounded-lg border p-2.5 transition-all ${
                    owned
                      ? 'border-zion-cyan/40 bg-zion-cyan/10 opacity-70'
                      : affordable
                        ? 'border-zion-purple/30 bg-zion-purple/5 hover:bg-zion-purple/10 hover:border-zion-purple/50 cursor-pointer'
                        : 'border-white/10 bg-black/30 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zion-purple/15 border border-zion-purple/30">
                      <Icon size={16} className="text-zion-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-bold text-white truncate">{cs ? def.nameCs : def.name}</span>
                        {owned && <span className="text-[10px] text-zion-cyan font-bold shrink-0">✓</span>}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span className="text-[10px] text-slate-400 truncate">{cs ? def.descCs : def.desc}</span>
                        {!owned && (
                          <span className={`text-[11px] font-bold shrink-0 ${affordable ? 'text-zion-gold' : 'text-slate-500'}`}>
                            🪙 {formatNumber(def.cost)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom: Layer progress + reset */}
      <div className="w-full mt-3 zion-rainbow-sub p-3" style={{ '--rc': '228, 30, 43' } as React.CSSProperties}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">{currentLayer.emoji}</span>
            <span className="text-xs font-bold text-white">{cs ? currentLayer.nameCs : currentLayer.name}</span>
            {nextLayer && (
              <span className="text-[10px] text-slate-400">
                → {nextLayer.emoji} {cs ? nextLayer.nameCs : nextLayer.name}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowReset(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-zion-purple/10 hover:bg-zion-purple/20 text-zion-purple border border-zion-purple/30 transition-colors text-[11px]"
          >
            <RotateCcw size={12} /> {DogeVsZionGamesStarMinerCopy.reset[cs ? 'cs' : 'en']}
          </button>
        </div>
        <div className="relative h-3 rounded-full bg-black/50 border border-white/10 overflow-hidden">
          <motion.div
            className="absolute left-0 top-0 bottom-0 rounded-full"
            style={{ background: 'linear-gradient(to right, #7e22ce, #a855f7, #10b981)' }}
            animate={{ width: `${layerProgress * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-slate-400">
          <span>{formatNumber(totalMined)} / {nextLayer ? formatNumber(nextLayer.threshold) : '∞'}</span>
          <span>{(layerProgress * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Layer transition overlay */}
      <AnimatePresence>
        {layerOverlay && !showVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setLayerOverlay(null)}
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              exit={{ scale: 0.6, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200 }}
              className="zion-rainbow-card p-8 text-center max-w-sm mx-4"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="text-6xl mb-3"
              >
                {layerOverlay.emoji}
              </motion.div>
              <h3 className="text-2xl font-black text-white mb-1">{DogeVsZionGamesStarMinerCopy.newLayer[cs ? 'cs' : 'en']}</h3>
              <p className="text-lg font-bold text-zion-purple">{cs ? layerOverlay.nameCs : layerOverlay.name}</p>
              <p className="text-xs text-slate-400 mt-3 mb-4">
                {DogeVsZionGamesStarMinerCopy.keepMiningDeeperIntoZion[cs ? 'cs' : 'en']}
              </p>
              <button
                onClick={() => setLayerOverlay(null)}
                className="px-6 py-2 rounded-lg bg-zion-purple hover:bg-zion-purple text-white font-semibold transition-colors"
              >
                {DogeVsZionGamesStarMinerCopy.continue[cs ? 'cs' : 'en']}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Victory overlay */}
      <AnimatePresence>
        {showVictory && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.5, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 180 }}
              className="zion-rainbow-card p-8 text-center max-w-md mx-4"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <motion.div
                animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.15, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="text-7xl mb-3"
              >
                👑
              </motion.div>
              <h3 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-zion-purple to-zion-cyan mb-2">
                {DogeVsZionGamesStarMinerCopy.youReachedIssobella[cs ? 'cs' : 'en']}
              </h3>
              <p className="text-sm text-slate-300 mb-4">
                {DogeVsZionGamesStarMinerCopy.youMinedYourWayToL6ZionIsYours[cs ? 'cs' : 'en']}
              </p>
              <div className="grid grid-cols-2 gap-3 mb-4 text-left">
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.totalMined[cs ? 'cs' : 'en']}</div>
                  <div className="text-lg font-bold text-zion-purple">{formatNumber(totalMined)}</div>
                </div>
                <div className="rounded-lg border border-white/10 bg-black/40 p-3">
                  <div className="text-[10px] uppercase tracking-widest text-slate-400">{DogeVsZionGamesStarMinerCopy.zionSec[cs ? 'cs' : 'en']}</div>
                  <div className="text-lg font-bold text-zion-cyan">{formatNumber(rate)}</div>
                </div>
              </div>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowVictory(false)}
                  className="px-5 py-2 rounded-lg bg-zion-purple hover:bg-zion-purple text-white font-semibold transition-colors"
                >
                  {DogeVsZionGamesStarMinerCopy.keepPlaying[cs ? 'cs' : 'en']}
                </button>
                <button
                  onClick={doReset}
                  className="flex items-center gap-1.5 px-5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-semibold transition-colors"
                >
                  <RotateCcw size={14} /> {DogeVsZionGamesStarMinerCopy.newGame[cs ? 'cs' : 'en']}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset confirmation */}
      <AnimatePresence>
        {showReset && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setShowReset(false)}
          >
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.8 }}
              onClick={(e) => e.stopPropagation()}
              className="zion-rainbow-card p-6 text-center max-w-xs mx-4"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <RotateCcw size={32} className="text-zion-purple mx-auto mb-3" />
              <h3 className="text-lg font-bold text-white mb-1">{DogeVsZionGamesStarMinerCopy.resetGame[cs ? 'cs' : 'en']}</h3>
              <p className="text-xs text-slate-400 mb-4">
                {DogeVsZionGamesStarMinerCopy.allProgressWillBeLost[cs ? 'cs' : 'en']}
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowReset(false)}
                  className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-semibold transition-colors"
                >
                  {DogeVsZionGamesStarMinerCopy.cancel[cs ? 'cs' : 'en']}
                </button>
                <button
                  onClick={doReset}
                  className="px-4 py-2 rounded-lg bg-zion-purple hover:bg-zion-purple text-white text-sm font-semibold transition-colors"
                >
                  {DogeVsZionGamesStarMinerCopy.reset_2[cs ? 'cs' : 'en']}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline earnings modal */}
      <AnimatePresence>
        {offlineEarnings !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
            onClick={() => setOfflineEarnings(null)}
          >
            <motion.div
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="zion-rainbow-card p-6 text-center max-w-xs mx-4"
              style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
            >
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="text-5xl mb-2"
              >
                🪙
              </motion.div>
              <h3 className="text-lg font-bold text-white mb-1">{DogeVsZionGamesStarMinerCopy.welcomeBack[cs ? 'cs' : 'en']}</h3>
              <p className="text-xs text-slate-400 mb-3">
                {DogeVsZionGamesStarMinerCopy.yourRigsMinedWhileYouWereAway[cs ? 'cs' : 'en']}
              </p>
              <p className="text-2xl font-black text-zion-cyan mb-4">
                +{formatNumber(offlineEarnings)} ZION
              </p>
              <button
                onClick={() => setOfflineEarnings(null)}
                className="px-5 py-2 rounded-lg bg-zion-purple hover:bg-zion-purple text-white font-semibold transition-colors"
              >
                {DogeVsZionGamesStarMinerCopy.awesome[cs ? 'cs' : 'en']}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default StarMiner;
