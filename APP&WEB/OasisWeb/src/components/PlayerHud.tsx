'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Star, MapPin, Rocket, Egg, User, Wallet, ScanLine, Zap, Package } from 'lucide-react';
import { useGameStore, getLevel, getLevelProgress } from '../store/gameStore';
import { getAddressType } from '../lib/zionWallet';
import { WORLDS } from '../domain/config/worlds';
import ShipLoadout from './ShipLoadout';
import PlayerSettings from './PlayerSettings';

const XP_PER_LEVEL = 1000;

const CONSCIOUSNESS_NAMES = [
  'Physical',
  'Emotional',
  'Mental',
  'Intuitional',
  'Spiritual',
  'Cosmic',
  'Divine',
  'Unity',
  'OnTheStar',
];

const CATEGORY_PALETTE: Record<string, string> = {
  gold: '251, 191, 36',
  cyan: '6, 182, 212',
  purple: '147, 51, 234',
  emerald: '16, 185, 129',
};

interface StatTileProps {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  value: number;
  label: string;
  color: keyof typeof CATEGORY_PALETTE;
}

function StatTile({ icon: Icon, value, label, color }: StatTileProps) {
  const rc = CATEGORY_PALETTE[color];
  return (
    <div
      className="zion-rainbow-sub p-2.5"
      style={{ '--rc': rc } as React.CSSProperties}
    >
      <Icon
        className="h-3.5 w-3.5"
        style={{ color: `rgb(${rc})` }}
      />
      <p className="mt-1 text-sm font-bold tabular-nums text-white">{value}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">{label}</p>
    </div>
  );
}

export default function PlayerHud() {
  const { xp, credits, completedQuests, discoveredWorlds, scannedWorlds, collectedEggs, address, shipLoadout } = useGameStore();
  const [showShip, setShowShip] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const level = getLevel(xp);
  const progress = getLevelProgress(xp);
  const consciousness = CONSCIOUSNESS_NAMES[(level - 1) % CONSCIOUSNESS_NAMES.length] ?? 'Physical';

  const totalWorlds = WORLDS.length;
  const discoveryPct = Math.round((discoveredWorlds.length / totalWorlds) * 100);

  return (
    <>
      <AnimatePresence>
        {showShip && <ShipLoadout onClose={() => setShowShip(false)} />}
        {showSettings && <PlayerSettings onClose={() => setShowSettings(false)} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="pointer-events-auto !absolute left-3 top-48 z-50 w-[18.5rem] p-3.5 sm:left-5 sm:top-52 sm:w-80 sm:p-4 zion-hud-panel"
      >
        {/* Header row: avatar, identity, level badge */}
        <div className="flex items-start gap-3">
          <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-oasis-gold to-oasis-purple text-base font-bold text-white shadow-[0_0_20px_rgba(147,51,234,0.35)]">
            {level}
            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white/10 bg-oasis-black text-[9px] text-oasis-cyan">
              {Math.round(progress * 100)}%
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="zion-kicker py-1 px-2 text-[9px]">Pilgrim</span>
              <span className="zion-badge zion-badge-gold text-[9px]">{consciousness}</span>
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="font-mono text-oasis-cyan">{xp} / {level * XP_PER_LEVEL} XP</span>
                <span className="text-gray-400">Lv {level}</span>
              </div>
              <div className="zion-progress mt-1.5">
                <div style={{ width: `${progress * 100}%` }} />
              </div>
            </div>

            {address && (
              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-300">
                <Wallet className="h-3 w-3 text-oasis-cyan" />
                <span className="font-mono truncate" title={address}>
                  {address.length > 18 ? `${address.slice(0, 12)}...${address.slice(-6)}` : address}
                </span>
                <span className="zion-badge zion-badge-cyan text-[8px] py-0.5 px-1.5">
                  {getAddressType(address)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Discovery banner */}
        <div className="mt-3 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
            <ScanLine className="h-3 w-3 text-oasis-emerald" />
            <span>Worlds scanned</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white">{scannedWorlds.length} / {totalWorlds}</span>
            <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-oasis-emerald"
                style={{ width: `${discoveryPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stat grid */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <StatTile icon={Coins} value={credits} label="Z" color="gold" />
          <StatTile icon={Star} value={completedQuests.length} label="Quests" color="cyan" />
          <StatTile icon={MapPin} value={discoveredWorlds.length} label="Worlds" color="purple" />
          <StatTile icon={Egg} value={collectedEggs.length} label="Eggs" color="gold" />
        </div>

        {/* Action / loadout row */}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/5 pt-3">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowShip(true)}
              className="zion-button-ghost !p-2"
              aria-label="Ship loadout"
              title="Ship loadout"
            >
              <Rocket className="h-4 w-4 text-oasis-cyan" />
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="zion-button-ghost !p-2"
              aria-label="Pilgrim settings"
              title="Pilgrim settings"
            >
              <User className="h-4 w-4 text-oasis-purple" />
            </button>
          </div>

          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1 text-oasis-cyan" title="Engine">
              <Zap className="h-3 w-3" /> {shipLoadout.boost}
            </span>
            <span className="flex items-center gap-1 text-oasis-gold" title="Cargo">
              <Package className="h-3 w-3" /> {shipLoadout.cargo}
            </span>
            <span className="flex items-center gap-1 text-oasis-purple" title="Scanner">
              <ScanLine className="h-3 w-3" /> {shipLoadout.scanner}
            </span>
          </div>
        </div>
      </motion.div>
    </>
  );
}
