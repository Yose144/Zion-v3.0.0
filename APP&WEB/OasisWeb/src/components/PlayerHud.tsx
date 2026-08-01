'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Coins, Star, MapPin, Scroll, Rocket, Egg, User, Wallet } from 'lucide-react';
import { useGameStore, getLevel, getLevelProgress } from '../store/gameStore';
import { getAddressType } from '../lib/zionWallet';
import ShipLoadout from './ShipLoadout';
import PlayerSettings from './PlayerSettings';

const XP_PER_LEVEL = 1000;

export default function PlayerHud() {
  const { xp, credits, completedQuests, discoveredWorlds, scannedWorlds, realQuests, collectedEggs, address } = useGameStore();
  const [showShip, setShowShip] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const level = getLevel(xp);
  const progress = getLevelProgress(xp);

  return (
    <>
      <AnimatePresence>
        {showShip && <ShipLoadout onClose={() => setShowShip(false)} />}
        {showSettings && <PlayerSettings onClose={() => setShowSettings(false)} />}
      </AnimatePresence>
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="pointer-events-auto absolute left-4 top-4 z-30 rounded-2xl border border-white/10 bg-[#05060f]/80 p-3 shadow-2xl backdrop-blur-xl sm:left-6 sm:top-6 sm:p-4"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-oasis-gold to-oasis-purple text-sm font-bold text-white shadow-lg">
          {level}
        </div>
        <div className="w-32 sm:w-40">
          <div className="flex items-center justify-between text-[10px] text-gray-400">
            <span className="font-bold uppercase tracking-wider text-white">Pilgrim</span>
            <span>{xp} / {level * XP_PER_LEVEL} XP</span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full bg-gradient-to-r from-oasis-gold via-oasis-purple to-oasis-cyan transition-all"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
          {address && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-gray-300">
              <Wallet className="h-3 w-3 text-oasis-cyan" />
              <span className="font-mono" title={address}>
                {address.length > 18 ? `${address.slice(0, 12)}...${address.slice(-6)}` : address}
              </span>
              <span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase text-oasis-gold">
                {getAddressType(address)}
              </span>
            </div>
          )}
        </div>
        <button
          onClick={() => setShowShip(true)}
          className="ml-2 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-oasis-cyan transition hover:bg-white/10"
          aria-label="Ship loadout"
        >
          <Rocket className="h-4 w-4" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="ml-1.5 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-oasis-cyan transition hover:bg-white/10"
          aria-label="Pilgrim settings"
        >
          <User className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Coins className="h-3.5 w-3.5 text-oasis-gold" />
          <span className="font-semibold">{credits}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Star className="h-3.5 w-3.5 text-oasis-cyan" />
          <span className="font-semibold">{completedQuests.length}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <MapPin className="h-3.5 w-3.5 text-oasis-purple" />
          <span className="font-semibold">{discoveredWorlds.length}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Scroll className="h-3.5 w-3.5 text-oasis-gold" />
          <span className="font-semibold">{realQuests.length}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-gray-300">
          <Egg className="h-3.5 w-3.5 text-oasis-gold" />
          <span className="font-semibold">{collectedEggs.length}</span>
        </div>
      </div>
    </motion.div>
    </>
  );
}
