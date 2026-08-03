'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coins, Star, MapPin, Rocket, Egg, User, Wallet, ScanLine, Zap, Package,
  ChevronRight, Plane, RefreshCw, Palette, Scan, RotateCcw, Eye, EyeOff,
  Volume2, VolumeX, Play, Pause, SkipBack, SkipForward, ListMusic, Music,
  Settings, Radio, Trophy, Map as MapIcon, Sparkles, Copy, Globe,
} from 'lucide-react';
import { useGameStore, getLevel, getLevelProgress, type ShipLoadout, SHIP_MODELS, type ShipModelId } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';
import { getAddressType, isValidZionAddress, generateZionWallet, deriveWalletFromMnemonic, validatePilgrimOrZionAddress } from '../lib/zionWallet';
import { WORLDS } from '../domain/config/worlds';
import { getHealth, getLeaderboard, getPlayer, getAvatars, type Player, type LeaderboardEntry } from '../lib/api';
import type { World, WorldCategory } from '../domain/types/world';
import type { MusicPlayerState } from './AudioEngine';
import MiniMap from './MiniMap';
import SocialPanel from './SocialPanel';

const XP_PER_LEVEL = 1000;

const CONSCIOUSNESS_NAMES = [
  'Physical', 'Emotional', 'Mental', 'Intuitional', 'Spiritual',
  'Cosmic', 'Divine', 'Unity', 'OnTheStar',
];

const CATEGORY_PALETTE: Record<string, string> = {
  gold: '251, 191, 36',
  cyan: '6, 182, 212',
  purple: '147, 51, 234',
  emerald: '16, 185, 129',
};

const SHIP_PRESETS: { name: string; hex: string }[] = [
  { name: 'Zion Cyan', hex: '#06b6d4' },
  { name: 'Zion Gold', hex: '#ffd700' },
  { name: 'Zion Purple', hex: '#9333ea' },
  { name: 'Zion Emerald', hex: '#10b981' },
  { name: 'Zion Rose', hex: '#f43f5e' },
  { name: 'White', hex: '#e2e8f0' },
];

const SHIP_DESCRIPTIONS: Record<keyof ShipLoadout, string> = {
  boost: 'Higher boost multiplier and faster travel.',
  cargo: 'More credits per completed quest.',
  scanner: 'More XP when scanning a world.',
  color: 'Pilgrim ship hull color.',
  model: 'Select your vessel chassis.',
};

const SHIP_ICONS: Record<keyof ShipLoadout, typeof Zap> = {
  boost: Zap,
  cargo: Package,
  scanner: Scan,
  color: Palette,
  model: Plane,
};

type Tab = 'ship' | 'identity' | 'audio' | 'oasis';

interface StatTileProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: number;
  label: string;
  color: keyof typeof CATEGORY_PALETTE;
}

function StatTile({ icon: Icon, value, label, color }: StatTileProps) {
  const rc = CATEGORY_PALETTE[color];
  return (
    <div className="zion-rainbow-sub p-2" style={{ '--rc': rc } as React.CSSProperties}>
      <Icon className="h-3 w-3" style={{ color: `rgb(${rc})` }} />
      <p className="mt-0.5 text-xs font-bold tabular-nums text-white">{value}</p>
      <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

function StatusDot({ status }: { status: 'loading' | 'ok' | 'error' }) {
  const color = status === 'ok' ? '#34d399' : status === 'error' ? '#f87171' : '#fbbf24';
  return <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />;
}

// ── Ship Loadout tab ──
function ShipTab() {
  const { credits, xp, shipLoadout, upgradeShip, setShipColor, setShipModel, unlockShip, unlockedShips } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const playerLevel = getLevel(xp);

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
        <span className="text-[10px] text-gray-300">Credits</span>
        <span className="font-mono text-sm font-bold text-oasis-gold">{credits} Z</span>
      </div>

      {/* Ship Model Selector */}
      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-oasis-cyan/10 p-1 text-oasis-cyan">
            <Plane className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-white">Vessel Chassis</p>
            <p className="text-[8px] text-gray-500">Lv {playerLevel} · {unlockedShips.length}/{SHIP_MODELS.length} unlocked</p>
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {SHIP_MODELS.map((ship) => {
            const selected = shipLoadout.model === ship.id;
            const unlocked = unlockedShips.includes(ship.id);
            const levelOk = playerLevel >= ship.unlockLevel;
            const canAfford = credits >= ship.unlockCost;
            const canUnlock = levelOk && canAfford && !unlocked;

            return (
              <button
                key={ship.id}
                onClick={() => {
                  if (unlocked) {
                    setShipModel(ship.id);
                    addToast(`Vessel: ${ship.label}`, 'info', 2000);
                  } else if (canUnlock) {
                    const ok = unlockShip(ship.id);
                    if (ok) addToast(`Unlocked ${ship.label}! −${ship.unlockCost} Z`, 'success', 3000);
                    else addToast('Cannot unlock', 'warning', 2000);
                  } else {
                    if (!levelOk) addToast(`Requires Lv ${ship.unlockLevel}`, 'warning', 2000);
                    else if (!canAfford) addToast(`Need ${ship.unlockCost} Z`, 'warning', 2000);
                  }
                }}
                className={`flex flex-col items-start rounded-lg border px-2 py-1.5 text-left transition ${
                  selected
                    ? 'border-oasis-cyan bg-oasis-cyan/15'
                    : unlocked
                    ? 'border-white/5 bg-white/[0.02] hover:border-white/10 hover:bg-white/[0.05]'
                    : canUnlock
                    ? 'border-oasis-gold/20 bg-oasis-gold/5 hover:border-oasis-gold/40 hover:bg-oasis-gold/10'
                    : 'border-white/5 bg-white/[0.01] opacity-60'
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <span className={`text-[10px] font-bold ${
                    selected ? 'text-oasis-cyan' : unlocked ? 'text-gray-300' : canUnlock ? 'text-oasis-gold' : 'text-gray-600'
                  }`}>
                    {ship.label}
                  </span>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: unlocked ? ship.color : '#333',
                      boxShadow: selected ? `0 0 6px ${ship.color}` : 'none',
                    }}
                  />
                </div>
                <span className="mt-0.5 text-[8px] leading-tight text-gray-500">{ship.description}</span>
                <div className="mt-1 flex w-full items-center justify-between">
                  <span className="text-[7px] font-bold uppercase tracking-wider text-gray-600">{ship.class}</span>
                  {unlocked ? (
                    selected && <span className="text-[7px] font-bold text-oasis-cyan">ACTIVE</span>
                  ) : (
                    <span className={`text-[7px] font-bold ${canUnlock ? 'text-oasis-gold' : 'text-gray-600'}`}>
                      {ship.unlockCost > 0 ? `${ship.unlockCost} Z` : 'Free'} · Lv{ship.unlockLevel}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {(['boost', 'cargo', 'scanner'] as (keyof ShipLoadout)[])
        .filter((k) => k !== 'color')
        .map((key) => {
          const level = shipLoadout[key] as number;
          const cost = level * 500;
          const maxed = level >= 5;
          const canAfford = credits >= cost;
          const Icon = SHIP_ICONS[key];

          return (
            <div key={key} className="zion-rainbow-sub p-2.5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-oasis-cyan/10 p-1 text-oasis-cyan">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold capitalize text-white">{key}</p>
                    <p className="text-[9px] text-gray-400">{SHIP_DESCRIPTIONS[key]}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">Lv {level}</p>
                  <button
                    onClick={() => {
                      if (!canAfford || maxed) return;
                      const ok = upgradeShip(key);
                      if (ok) addToast(`${key} upgraded to Lv ${level + 1}`, 'success', 2500);
                      else addToast('Not enough credits', 'warning', 2500);
                    }}
                    disabled={!canAfford || maxed}
                    className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold transition ${
                      maxed
                        ? 'bg-green-500/20 text-green-400'
                        : canAfford
                        ? 'bg-oasis-gold/20 text-oasis-gold hover:bg-oasis-gold/30'
                        : 'bg-white/5 text-gray-500'
                    }`}
                  >
                    {maxed ? 'Max' : `${cost} Z`}
                  </button>
                </div>
              </div>
              <div className="zion-progress mt-1.5">
                <div style={{ width: `${(level / 5) * 100}%`, backgroundColor: '#06b6d4' }} />
              </div>
            </div>
          );
        })}

      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-oasis-cyan/10 p-1 text-oasis-cyan">
            <Palette className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-semibold text-white">Hull Color</p>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {SHIP_PRESETS.map((p) => (
            <button
              key={p.hex}
              onClick={() => {
                setShipColor(p.hex);
                addToast(`Hull color: ${p.name}`, 'info', 2000);
              }}
              className={`flex h-6 w-6 items-center justify-center rounded-full border-2 transition ${
                shipLoadout.color === p.hex ? 'border-white' : 'border-transparent'
              }`}
              style={{ backgroundColor: p.hex }}
              title={p.name}
            >
              {shipLoadout.color === p.hex && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Identity tab ──
function IdentityTab() {
  const { address, setAddress, reset, syncPlayer, avatarConfig, archetype } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const [input, setInput] = useState(address ?? '');
  const [showSeed, setShowSeed] = useState(false);
  const [mnemonic, setMnemonic] = useState('');
  const [generated, setGenerated] = useState<{ address: string; mnemonic: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSave = () => {
    const trimmed = input.trim();
    if (trimmed && !validatePilgrimOrZionAddress(trimmed)) {
      addToast('Invalid address format', 'error', 2500);
      return;
    }
    setAddress(trimmed || null);
    addToast(`Address set: ${trimmed || 'default'}`, 'success', 2500);
    syncPlayer();
  };

  const handleImport = () => {
    try {
      const wallet = deriveWalletFromMnemonic(mnemonic.trim());
      setAddress(wallet.address);
      addToast(`Wallet imported: ${wallet.address.slice(0, 12)}...`, 'success', 2500);
      setMnemonic('');
      syncPlayer();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Invalid mnemonic', 'error', 3000);
    }
  };

  const handleGenerate = () => {
    setLoading(true);
    try {
      const wallet = generateZionWallet();
      setGenerated({ address: wallet.address, mnemonic: wallet.mnemonic });
      setAddress(wallet.address);
      syncPlayer();
    } catch {
      addToast('Wallet generation failed', 'error', 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    if (confirm('Reset all local progress? This cannot be undone.')) {
      reset();
      addToast('Local progress reset', 'info', 2500);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    addToast(`${label} copied`, 'info', 2000);
  };

  return (
    <div className="space-y-2.5">
      <div>
        <p className="mb-1 text-[10px] text-gray-400">Pilgrim ID or ZION address</p>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="pilgrim-0001 or zion1..."
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-oasis-purple focus:ring-1 focus:ring-oasis-purple"
        />
        <p className="mt-0.5 text-[9px] text-gray-500">
          Type: <span className="text-oasis-purple">{getAddressType(input) || 'empty'}</span>
        </p>
        <button onClick={handleSave} className="zion-button-primary mt-1.5 w-full text-[10px]">
          Save Address
        </button>
      </div>

      {/* Avatar Configuration */}
      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '217, 70, 239' } as React.CSSProperties}>
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-[#d946ef]/10 p-1 text-[#d946ef]">
            <User className="h-3.5 w-3.5" />
          </div>
          <p className="text-xs font-semibold text-white">Avatar</p>
        </div>
        <div className="mt-2 space-y-1">
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Callsign</span>
            <span className="font-semibold text-white">{avatarConfig.callsign || 'Unnamed'}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Body</span>
            <span className="font-semibold capitalize text-white">{avatarConfig.bodyType}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Augment</span>
            <span className="font-semibold capitalize text-white">{avatarConfig.augmentation}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Archetype</span>
            <span className="font-semibold capitalize text-white">{archetype ?? '—'}</span>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-gray-400">Neon</span>
            <span className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: avatarConfig.neonColor, boxShadow: `0 0 6px ${avatarConfig.neonColor}` }} />
              <span className="font-semibold text-white">Active</span>
            </span>
          </div>
        </div>
      </div>

      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
        <p className="mb-1.5 text-[10px] text-gray-400">Import from 12-word mnemonic:</p>
        <div className="flex gap-1.5">
          <input
            type={showSeed ? 'text' : 'password'}
            value={mnemonic}
            onChange={(e) => setMnemonic(e.target.value)}
            placeholder="abandon ability ..."
            className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-[10px] text-white placeholder-gray-500 outline-none focus:border-oasis-gold"
          />
          <button onClick={() => setShowSeed((s) => !s)} className="zion-button-ghost !p-1.5">
            {showSeed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
        <button
          onClick={handleImport}
          className="zion-button-ghost mt-1.5 w-full border-oasis-gold/30 bg-oasis-gold/10 text-[10px] text-oasis-gold hover:bg-oasis-gold/20"
        >
          Import Mnemonic
        </button>
      </div>

      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
        <p className="mb-1.5 text-[10px] text-gray-400">Generate new ZION wallet:</p>
        {generated ? (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 p-1.5">
              <Wallet className="h-3 w-3 text-oasis-cyan" />
              <code className="flex-1 text-[9px] text-white">{generated.address}</code>
              <button onClick={() => copy(generated.address, 'Address')} className="text-gray-400 hover:text-white">
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <div className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/30 p-1.5">
              <code className="flex-1 text-[8px] text-oasis-gold">{generated.mnemonic}</code>
              <button onClick={() => copy(generated.mnemonic, 'Mnemonic')} className="text-gray-400 hover:text-white">
                <Copy className="h-3 w-3" />
              </button>
            </div>
            <p className="text-[9px] text-red-300">Save this seed. Shown only once.</p>
          </div>
        ) : (
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="zion-button-primary w-full text-[10px] disabled:opacity-40"
          >
            <Sparkles className="h-3 w-3" />
            {loading ? 'Generating...' : 'Generate Wallet'}
          </button>
        )}
      </div>

      <button
        onClick={handleReset}
        className="zion-button-ghost w-full border-red-500/30 bg-red-500/10 text-[10px] text-red-400 hover:bg-red-500/20"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Progress
      </button>
    </div>
  );
}

// ── Audio tab ──
function AudioTab({ music, muted, onToggleMute }: {
  music: MusicPlayerState;
  muted: boolean;
  onToggleMute: () => void;
}) {
  const current = music.tracks[music.trackIndex] ?? music.tracks[0];

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-2">
        <div className="flex items-center gap-2">
          {muted ? <VolumeX className="h-4 w-4 text-gray-400" /> : <Volume2 className="h-4 w-4 text-oasis-cyan" />}
          <span className="text-xs text-gray-300">Master Audio</span>
        </div>
        <button
          onClick={onToggleMute}
          className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${
            muted
              ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
              : 'bg-oasis-cyan/20 text-oasis-cyan hover:bg-oasis-cyan/30'
          }`}
        >
          {muted ? 'Muted' : 'On'}
        </button>
      </div>

      <div className="zion-rainbow-sub p-2.5" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
        <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-oasis-cyan">
          <ListMusic className="h-3 w-3" />
          OASIS Radio
        </div>

        <div className="mb-2 flex items-center justify-center gap-2">
          <button onClick={() => music.prev()} className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white">
            <SkipBack className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => (music.playing ? music.pause() : music.resume())}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            {music.playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button onClick={() => music.next()} className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white">
            <SkipForward className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mb-2 flex items-center gap-1.5 text-[10px] text-gray-400">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: current.color }} />
          <span className="truncate">{current.name}</span>
        </div>

        <div className="space-y-1">
          {music.tracks.map((track, i) => (
            <button
              key={track.id}
              onClick={() => music.setTrack(i)}
              className={`flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[10px] transition ${
                i === music.trackIndex ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: track.color }} />
              <span className="flex-1 truncate">{track.name}</span>
            </button>
          ))}
        </div>

        <div className="mt-2 rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="mb-1 flex items-center justify-between text-[9px] text-gray-400">
            <span>Volume</span>
            <span className="font-mono text-oasis-cyan">{Math.round(music.volume * 100)}%</span>
          </div>
          <input
            type="range" min={0} max={1} step={0.01}
            value={music.volume}
            onChange={(e) => music.setVolume(parseFloat(e.target.value))}
            className="w-full h-1 accent-oasis-cyan"
          />
        </div>
      </div>
    </div>
  );
}

// ── OASIS info tab ──
function OasisTab({ onEnterFlight }: { onEnterFlight?: () => void }) {
  const { address, realQuests, territories } = useGameStore();
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');
  const [avatarCount, setAvatarCount] = useState(0);
  const [player, setPlayer] = useState<Player | null>(null);
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);

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
      setLeaders(Array.isArray(lb) ? lb.slice(0, 5) : []);
      setPlayer(playerData);
    } catch {
      setStatus('error');
    }
  }, [address]);

  useEffect(() => { load(); }, [load]);

  const statusLabel = status === 'ok' ? 'Connected' : status === 'error' ? 'Disconnected' : 'Connecting';

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <StatusDot status={status} />
          <span className="text-[10px] text-gray-300">{statusLabel}</span>
        </div>
        <button onClick={load} className="zion-button-ghost !p-1" title="Refresh">
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {player && (
        <div className="grid grid-cols-2 gap-2">
          <div className="zion-rainbow-sub p-2" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <p className="text-[9px] text-gray-400">Pilgrim</p>
            <p className="truncate text-xs font-semibold text-white">
              {player.display_name || player.address.slice(0, 8)}
            </p>
          </div>
          <div className="zion-rainbow-sub p-2" style={{ '--rc': '251, 191, 36' } as React.CSSProperties}>
            <p className="text-[9px] text-gray-400">Total XP</p>
            <p className="text-xs font-semibold text-white">{player.total_xp}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
          <User className="h-3 w-3 text-oasis-purple" />
          <div>
            <p className="text-[9px] text-gray-400">Avatars</p>
            <p className="font-mono text-xs text-white">{avatarCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1.5">
          <Trophy className="h-3 w-3 text-oasis-gold" />
          <div>
            <p className="text-[9px] text-gray-400">Quests</p>
            <p className="font-mono text-xs text-white">{realQuests.length}</p>
          </div>
        </div>
      </div>

      {territories.length > 0 && (
        <div className="zion-rainbow-sub p-2" style={{ '--rc': '147, 51, 234' } as React.CSSProperties}>
          <div className="mb-1.5 flex items-center gap-1.5 text-[9px] font-semibold uppercase tracking-wider text-oasis-purple">
            <MapIcon className="h-3 w-3" />
            Hot Territories
          </div>
          <div className="space-y-1">
            {territories.slice().sort((a: any, b: any) => (b.defense_power ?? 0) - (a.defense_power ?? 0)).slice(0, 3).map((t: any) => (
              <div key={t.id} className="flex items-center justify-between text-[10px]">
                <span className="truncate text-gray-300">{t.name}</span>
                <span className="zion-badge zion-badge-cyan text-[8px] py-0.5 px-1.5">{t.controller ?? 'Unclaimed'}</span>
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
                <span className="truncate text-gray-300">{i + 1}. {entry.display_name || entry.address.slice(0, 8)}</span>
                <span className="font-mono text-oasis-cyan">{entry.total_xp ?? entry.value ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {onEnterFlight && (
        <button
          onClick={onEnterFlight}
          className="zion-button-primary w-full text-[10px]"
        >
          <Plane className="h-3.5 w-3.5" />
          Flight Mode
        </button>
      )}
    </div>
  );
}

// ── Main GamePanel ──
interface GamePanelProps {
  activeCategories: WorldCategory[];
  selectedWorldId?: string | null;
  onWorldSelect?: (world: World) => void;
  music: MusicPlayerState;
  muted: boolean;
  onToggleMute: () => void;
  onEnterFlight?: () => void;
}

export default function GamePanel({
  activeCategories,
  selectedWorldId,
  onWorldSelect,
  music,
  muted,
  onToggleMute,
  onEnterFlight,
}: GamePanelProps) {
  const { xp, credits, completedQuests, discoveredWorlds, scannedWorlds, collectedEggs, address, shipLoadout } = useGameStore();
  const [expanded, setExpanded] = useState(false);
  const [tab, setTab] = useState<Tab>('ship');
  const [showSocial, setShowSocial] = useState(false);

  const level = getLevel(xp);
  const progress = getLevelProgress(xp);
  const consciousness = CONSCIOUSNESS_NAMES[(level - 1) % CONSCIOUSNESS_NAMES.length] ?? 'Physical';
  const totalWorlds = WORLDS.length;
  const discoveryPct = Math.round((discoveredWorlds.length / totalWorlds) * 100);

  const tabs: { id: Tab; icon: React.ComponentType<{ className?: string }>; label: string; color: string }[] = [
    { id: 'ship', icon: Rocket, label: 'Ship', color: 'oasis-cyan' },
    { id: 'identity', icon: User, label: 'Identity', color: 'oasis-purple' },
    { id: 'audio', icon: Music, label: 'Audio', color: 'oasis-gold' },
    { id: 'oasis', icon: Radio, label: 'OASIS', color: 'oasis-emerald' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="pointer-events-auto absolute left-2 top-2 z-50 sm:left-5 sm:top-5"
    >
      <div className="flex gap-2">
        {/* ── Left column: Map + Stats (always visible) ── */}
        <div className="zion-hud-panel !relative w-[13rem] p-2.5 sm:w-72 sm:p-3.5">
          {/* MiniMap */}
          <MiniMap
            activeCategories={activeCategories}
            selectedWorldId={selectedWorldId}
            onWorldSelect={onWorldSelect}
          />

          {/* Player identity */}
          <div className="mt-3 flex items-start gap-2.5">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-oasis-gold to-oasis-purple text-sm font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.35)]">
              {level}
              <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white/10 bg-oasis-black text-[8px] text-oasis-cyan">
                {Math.round(progress * 100)}%
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1">
                <span className="zion-kicker py-0.5 px-1.5 text-[8px]">Pilgrim</span>
                <span className="zion-badge zion-badge-gold text-[8px]">{consciousness}</span>
              </div>

              <div className="mt-1.5">
                <div className="flex items-center justify-between text-[9px]">
                  <span className="font-mono text-oasis-cyan">{xp} / {level * XP_PER_LEVEL} XP</span>
                  <span className="text-gray-400">Lv {level}</span>
                </div>
                <div className="zion-progress mt-1">
                  <div style={{ width: `${progress * 100}%` }} />
                </div>
              </div>

              {address && (
                <div className="mt-1 flex items-center gap-1 text-[9px] text-gray-300">
                  <Wallet className="h-2.5 w-2.5 text-oasis-cyan" />
                  <span className="font-mono truncate" title={address}>
                    {address.length > 16 ? `${address.slice(0, 10)}...${address.slice(-4)}` : address}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Discovery banner */}
          <div className="mt-2.5 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1">
            <div className="flex items-center gap-1.5 text-[9px] text-gray-300">
              <ScanLine className="h-2.5 w-2.5 text-oasis-emerald" />
              <span>Scanned</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-white">{scannedWorlds.length}/{totalWorlds}</span>
              <div className="h-1 w-12 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-oasis-emerald" style={{ width: `${discoveryPct}%` }} />
              </div>
            </div>
          </div>

          {/* Stat grid */}
          <div className="mt-2.5 grid grid-cols-4 gap-1.5">
            <StatTile icon={Coins} value={credits} label="Z" color="gold" />
            <StatTile icon={Star} value={completedQuests.length} label="Quests" color="cyan" />
            <StatTile icon={MapPin} value={discoveredWorlds.length} label="Worlds" color="purple" />
            <StatTile icon={Egg} value={collectedEggs.length} label="Eggs" color="gold" />
          </div>

          {/* Ship quick stats */}
          <div className="mt-2.5 flex items-center justify-between gap-1.5 border-t border-white/5 pt-2 text-[9px]">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setExpanded(true); setTab('ship'); }}
                className="zion-button-ghost !p-1.5"
                title="Ship loadout"
              >
                <Rocket className="h-3.5 w-3.5 text-oasis-cyan" />
              </button>
              <button
                onClick={() => { setExpanded(true); setTab('identity'); }}
                className="zion-button-ghost !p-1.5"
                title="Identity settings"
              >
                <User className="h-3.5 w-3.5 text-oasis-purple" />
              </button>
              <button
                onClick={() => { setExpanded(true); setTab('audio'); }}
                className="zion-button-ghost !p-1.5"
                title="Audio settings"
              >
                <Music className="h-3.5 w-3.5 text-oasis-gold" />
              </button>
              <button
                onClick={() => { setExpanded(true); setTab('oasis'); }}
                className="zion-button-ghost !p-1.5"
                title="OASIS info"
              >
                <Radio className="h-3.5 w-3.5 text-oasis-emerald" />
              </button>
              <button
                onClick={() => setShowSocial(true)}
                className="zion-button-ghost !p-1.5"
                aria-label="Social — leaderboard, guilds, quests"
                title="Leaderboard · Guilds · Quests"
              >
                <Globe className="h-3.5 w-3.5 text-oasis-emerald" />
              </button>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex items-center gap-0.5 text-oasis-cyan" title="Boost">
                <Zap className="h-2.5 w-2.5" /> {shipLoadout.boost}
              </span>
              <span className="flex items-center gap-0.5 text-oasis-gold" title="Cargo">
                <Package className="h-2.5 w-2.5" /> {shipLoadout.cargo}
              </span>
              <span className="flex items-center gap-0.5 text-oasis-purple" title="Scanner">
                <ScanLine className="h-2.5 w-2.5" /> {shipLoadout.scanner}
              </span>
            </div>
          </div>

          {/* Expand/collapse button */}
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-2.5 flex w-full items-center justify-center gap-1 rounded-lg border border-white/5 bg-white/[0.03] py-1.5 text-[9px] font-semibold text-gray-400 transition hover:bg-white/10 hover:text-white"
          >
            <Settings className="h-3 w-3" />
            {expanded ? 'Collapse' : 'Game Settings'}
            <ChevronRight className={`h-3 w-3 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          </button>
        </div>

        {/* ── Right column: Tabbed settings (expandable) ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, x: -12, width: 0 }}
              animate={{ opacity: 1, x: 0, width: 'auto' }}
              exit={{ opacity: 0, x: -12, width: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="zion-hud-panel !relative w-[13rem] max-w-[calc(100vw-1.5rem)] p-2.5 sm:w-72 sm:p-3">
                {/* Tab bar */}
                <div className="mb-3 flex gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
                  {tabs.map((t) => {
                    const Icon = t.icon;
                    const active = tab === t.id;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTab(t.id)}
                        className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px] font-semibold transition ${
                          active ? `bg-white/10 text-${t.color}` : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                {/* Tab content */}
                <div className="max-h-[28rem] overflow-y-auto pr-1" style={{ scrollbarWidth: 'thin' }}>
                  {tab === 'ship' && <ShipTab />}
                  {tab === 'identity' && <IdentityTab />}
                  {tab === 'audio' && <AudioTab music={music} muted={muted} onToggleMute={onToggleMute} />}
                  {tab === 'oasis' && <OasisTab onEnterFlight={onEnterFlight} />}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showSocial && <SocialPanel onClose={() => setShowSocial(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}
