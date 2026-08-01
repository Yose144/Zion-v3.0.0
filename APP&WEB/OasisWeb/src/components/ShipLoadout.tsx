'use client';

import { motion } from 'framer-motion';
import { X, Rocket, Zap, Package, Scan, Palette } from 'lucide-react';
import { useGameStore, type ShipLoadout } from '../store/gameStore';

interface ShipLoadoutProps {
  onClose: () => void;
}

const PRESETS: { name: string; hex: string }[] = [
  { name: 'Cyan', hex: '#22d3ee' },
  { name: 'Gold', hex: '#f59e0b' },
  { name: 'Purple', hex: '#a855f7' },
  { name: 'Green', hex: '#10b981' },
  { name: 'Rose', hex: '#f43f5e' },
  { name: 'White', hex: '#e2e8f0' },
];

const DESCRIPTIONS: Record<keyof ShipLoadout, string> = {
  boost: 'Higher boost multiplier and faster travel.',
  cargo: 'More credits per completed quest.',
  scanner: 'More XP when scanning a world.',
  color: 'Pilgrim ship hull color.',
};

const ICONS: Record<keyof ShipLoadout, typeof Zap> = {
  boost: Zap,
  cargo: Package,
  scanner: Scan,
  color: Palette,
};

export default function ShipLoadout({ onClose }: ShipLoadoutProps) {
  const { credits, shipLoadout, upgradeShip, setShipColor } = useGameStore();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-[#05060f]/95 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-oasis-cyan" />
            <h2 className="text-lg font-bold text-white">Ship Loadout</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-gray-400">
          Credits: <span className="font-mono font-bold text-oasis-gold">{credits} Z</span>
        </p>

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
                <div key={key} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="rounded bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
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
                        onClick={() => canAfford && !maxed && upgradeShip(key)}
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
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full bg-oasis-cyan transition-all"
                      style={{ width: `${(level / 5) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}

          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex items-center gap-2">
              <Palette className="h-4 w-4 text-oasis-cyan" />
              <p className="text-sm font-semibold text-white">Hull Color</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.hex}
                  onClick={() => setShipColor(p.hex)}
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
