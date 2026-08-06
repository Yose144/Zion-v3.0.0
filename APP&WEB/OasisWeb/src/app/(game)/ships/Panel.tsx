'use client';

import { useMemo, useState, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, Lock, Check, Coins, Zap, Package, ScanLine, Heart, X } from 'lucide-react';
import { SHIP_MODELS, useGameStore, getLevel, type ShipModelId } from '@/store/gameStore';
import { useToastStore } from '@/store/toastStore';
import GlassPanel from '@/components/GlassPanel';

export default function ShipsPanel() {
  const unlockedShips = useGameStore(s => s.unlockedShips);
  const credits = useGameStore(s => s.credits);
  const xp = useGameStore(s => s.xp);
  const activeModel = useGameStore(s => s.shipLoadout.model);
  const unlockShip = useGameStore(s => s.unlockShip);
  const setShipModel = useGameStore(s => s.setShipModel);
  const addToast = useToastStore(s => s.add);
  const level = getLevel(xp);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const filtered = useMemo(() => {
    return SHIP_MODELS.filter((s) => {
      if (filter === 'unlocked') return unlockedShips.includes(s.id);
      if (filter === 'locked') return !unlockedShips.includes(s.id);
      return true;
    });
  }, [filter, unlockedShips]);

  return (
    <GlassPanel className="max-h-[80vh] overflow-y-auto">
      <motion.h1
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-2 text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-oasis-cyan to-oasis-gold"
      >
        Starfighter Hangar
      </motion.h1>
      <p className="mb-6 text-sm text-white/70">
        Browse, unlock, and pilot legendary starfighters. Inspired by wooden laser-cut models from{' '}
        <a href="https://eigenbloom.com/woodenstarfighter/" target="_blank" rel="noopener" className="text-oasis-cyan underline">
          eigenbloom.com
        </a>.
      </p>

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {(['all', 'unlocked', 'locked'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${
              filter === f ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'bg-white/5 text-white/70 hover:text-white'
            }`}
          >
            {f === 'all' ? `All (${SHIP_MODELS.length})` : f === 'unlocked' ? `Owned (${unlockedShips.length})` : `Locked (${SHIP_MODELS.length - unlockedShips.length})`}
          </button>
        ))}
      </div>

      {/* Credits + Level */}
      <div className="mb-6 flex gap-4 rounded-2xl border border-white/10 bg-black/30 p-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-oasis-gold" />
          <span className="text-sm font-bold text-oasis-gold">{credits} Z</span>
        </div>
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-oasis-cyan" />
          <span className="text-sm font-bold text-oasis-cyan">Level {level}</span>
        </div>
      </div>

      {/* Ship grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((ship) => (
          <ShipCard
            key={ship.id}
            ship={ship}
            isUnlocked={unlockedShips.includes(ship.id)}
            isActive={activeModel === ship.id}
            canUnlock={level >= ship.unlockLevel && credits >= ship.unlockCost}
            onSelect={() => {
              if (unlockedShips.includes(ship.id)) {
                setShipModel(ship.id);
                addToast(`${ship.label} selected as active ship`, 'success', 2500);
              } else if (level >= ship.unlockLevel && credits >= ship.unlockCost) {
                if (unlockShip(ship.id)) {
                  addToast(`${ship.label} unlocked!`, 'success', 3000);
                }
              } else {
                addToast(
                  level < ship.unlockLevel ? `Requires Level ${ship.unlockLevel}` : `Need ${ship.unlockCost} Z`,
                  'error',
                  2000
                );
              }
            }}
          />
        ))}
      </div>
    </GlassPanel>
  );
}

const ShipCard = memo(function ShipCard({
  ship,
  isUnlocked,
  isActive,
  canUnlock,
  onSelect,
}: {
  ship: typeof SHIP_MODELS[number];
  isUnlocked: boolean;
  isActive: boolean;
  canUnlock: boolean;
  onSelect: () => void;
}) {
  return (
    <motion.button
      onClick={onSelect}
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      className={`relative overflow-hidden rounded-2xl border p-5 text-left transition-colors ${
        isActive
          ? 'border-oasis-emerald/50 bg-oasis-emerald/5'
          : isUnlocked
          ? 'border-white/10 bg-white/5 hover:border-oasis-cyan/40'
          : canUnlock
          ? 'border-oasis-gold/30 bg-oasis-gold/5 hover:border-oasis-gold/50'
          : 'border-white/5 bg-black/20 opacity-60'
      }`}
    >
      {/* Ship icon / preview */}
      <div className="mb-3 flex items-center justify-between">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{ background: `${ship.color}20`, border: `1px solid ${ship.color}40` }}
        >
          <Rocket className="h-6 w-6" style={{ color: ship.color }} />
        </div>
        <div className="flex flex-col items-end gap-1">
          {isActive && (
            <span className="rounded-full bg-oasis-emerald/20 px-2 py-0.5 text-[10px] font-bold text-oasis-emerald">
              <Check className="mr-1 inline h-3 w-3" />Active
            </span>
          )}
          {!isUnlocked && (
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/70">
              <Lock className="mr-1 inline h-3 w-3" />Locked
            </span>
          )}
        </div>
      </div>

      <h3 className="mb-1 text-lg font-bold" style={{ color: isUnlocked ? ship.color : '#a3a3a3' }}>
        {ship.label}
      </h3>
      <p className="mb-3 text-xs text-white/70">{ship.description}</p>

      {/* Class + cost */}
      <div className="mb-3 flex flex-wrap gap-2 text-[10px]">
        <span className="rounded-full bg-white/5 px-2 py-0.5 text-oasis-cyan">{ship.class}</span>
        {!isUnlocked && (
          <span className={`rounded-full px-2 py-0.5 ${canUnlock ? 'text-oasis-gold' : 'text-white/60'}`}>
            {ship.unlockCost} Z · Lv {ship.unlockLevel}+
          </span>
        )}
      </div>

      {/* Stats bars */}
      <div className="grid grid-cols-4 gap-1.5">
        <Stat icon={Zap} label="Boost" value={ship.stats.boost} max={5} color="#e41e2b" />
        <Stat icon={Package} label="Cargo" value={ship.stats.cargo} max={5} color="#fcd116" />
        <Stat icon={ScanLine} label="Scan" value={ship.stats.scanner} max={5} color="#078930" />
        <Stat icon={Heart} label="Hull" value={ship.stats.hp} max={500} color="#078930" />
      </div>
    </motion.button>
  );
});

function Stat({ icon: Icon, label, value, max, color }: { icon: typeof Zap; label: string; value: number; max: number; color: string }) {
  const pct = Math.min(1, value / max);
  return (
    <div className="flex flex-col items-center gap-0.5">
      <Icon className="h-3 w-3" style={{ color }} />
      <div className="h-8 w-1 overflow-hidden rounded-full bg-white/10">
        <div className="w-full rounded-full" style={{ height: `${pct * 100}%`, backgroundColor: color, marginTop: `${(1 - pct) * 100}%` }} />
      </div>
      <span className="text-[7px] text-white/60">{label}</span>
    </div>
  );
}
