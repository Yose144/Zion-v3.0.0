'use client';

import { motion } from 'framer-motion';
import { X, Rocket, Zap, Package, Scan, Palette, Plane } from 'lucide-react';
import { useGameStore, type ShipLoadout, SHIP_MODELS, getLevel } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';

interface ShipLoadoutProps {
  onClose: () => void;
}

const PRESETS: { name: string; hex: string }[] = [
  { name: 'Zion Cyan', hex: '#06b6d4' },
  { name: 'Zion Gold', hex: '#ffd700' },
  { name: 'Zion Purple', hex: '#9333ea' },
  { name: 'Zion Emerald', hex: '#10b981' },
  { name: 'Zion Rose', hex: '#f43f5e' },
  { name: 'White', hex: '#e2e8f0' },
];

const DESCRIPTIONS: Record<keyof ShipLoadout, string> = {
  boost: 'Higher boost multiplier and faster travel.',
  cargo: 'More credits per completed quest.',
  scanner: 'More XP when scanning a world.',
  color: 'Pilgrim ship hull color.',
  model: 'Select your vessel chassis.',
};

const ICONS: Record<keyof ShipLoadout, typeof Zap> = {
  boost: Zap,
  cargo: Package,
  scanner: Scan,
  color: Palette,
  model: Plane,
};

export default function ShipLoadout({ onClose }: ShipLoadoutProps) {
  const { credits, xp, shipLoadout, upgradeShip, setShipColor, setShipModel, unlockShip, unlockedShips } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const playerLevel = getLevel(xp);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden p-5 zion-rainbow-card" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-lg bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
              <Rocket className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Ship Loadout</h2>
              <p className="text-[10px] text-gray-400">Configure your multilayer transport</p>
            </div>
          </div>
          <button onClick={onClose} className="zion-button-ghost !p-1.5 text-gray-400">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-4 flex items-center justify-between rounded-lg border border-white/5 bg-white/[0.03] px-3 py-2">
          <span className="text-sm text-gray-300">Available credits</span>
          <span className="font-mono text-base font-bold text-oasis-gold">{credits} Z</span>
        </div>

        <div className="space-y-3">
          {( ['boost', 'cargo', 'scanner'] as (keyof ShipLoadout)[] )
            .filter((k) => k !== 'color')
            .map((key) => {
              const level = shipLoadout[key] as number;
              const cost = level * 500;
              const maxed = level >= 5;
              const canAfford = credits >= cost;
              const Icon = ICONS[key];

              return (
                <div key={key} className="zion-rainbow-sub p-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded-lg bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold capitalize text-white">{key}</p>
                        <p className="text-[10px] text-gray-400">{DESCRIPTIONS[key]}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">Lv {level}</p>
                      <button
                        onClick={() => {
                          if (!canAfford || maxed) return;
                          const ok = upgradeShip(key);
                          if (ok) addToast(`${key} upgraded to Lv ${level + 1}`, 'success', 2500);
                          else addToast('Not enough credits', 'warning', 2500);
                        }}
                        disabled={!canAfford || maxed}
                        className={`mt-1 rounded px-2 py-0.5 text-[10px] font-bold transition ${
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
                  <div className="zion-progress mt-2">
                    <div style={{ width: `${(level / 5) * 100}%`, backgroundColor: '#06b6d4' }} />
                  </div>
                </div>
              );
            })}

          <div className="zion-rainbow-sub p-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
                <Plane className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">Vessel Chassis</p>
                <p className="text-[10px] text-gray-500">Lv {playerLevel} · {unlockedShips.length}/{SHIP_MODELS.length} unlocked</p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
                    className={`flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition ${
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
                      <span className={`text-xs font-bold ${
                        selected ? 'text-oasis-cyan' : unlocked ? 'text-gray-300' : canUnlock ? 'text-oasis-gold' : 'text-gray-600'
                      }`}>
                        {ship.label}
                      </span>
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: unlocked ? ship.color : '#333', boxShadow: selected ? `0 0 8px ${ship.color}` : 'none' }}
                      />
                    </div>
                    <span className="mt-1 text-[10px] leading-tight text-gray-500">{ship.description}</span>
                    <div className="mt-1.5 flex w-full items-center justify-between">
                      <span className="text-[8px] font-bold uppercase tracking-wider text-gray-600">{ship.class}</span>
                      {unlocked ? (
                        selected && <span className="text-[8px] font-bold text-oasis-cyan">ACTIVE</span>
                      ) : (
                        <span className={`text-[8px] font-bold ${canUnlock ? 'text-oasis-gold' : 'text-gray-600'}`}>
                          {ship.unlockCost > 0 ? `${ship.unlockCost} Z` : 'Free'} · Lv{ship.unlockLevel}
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="zion-rainbow-sub p-3" style={{ '--rc': '6, 182, 212' } as React.CSSProperties}>
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
                <Palette className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-white">Hull Color</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.hex}
                  onClick={() => {
                    setShipColor(p.hex);
                    addToast(`Hull color changed to ${p.name}`, 'info', 2000);
                  }}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition ${
                    shipLoadout.color === p.hex ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: p.hex }}
                  title={p.name}
                >
                  {shipLoadout.color === p.hex && <div className="h-2 w-2 rounded-full bg-white" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-[10px] text-gray-500">
          Upgrades are stored locally. Max level is 5 for each module.
        </p>
      </div>
    </motion.div>
  );
}
