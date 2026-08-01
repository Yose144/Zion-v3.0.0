'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, User, RotateCcw } from 'lucide-react';
import { useGameStore } from '../store/gameStore';
import { useToastStore } from '../store/toastStore';

interface PlayerSettingsProps {
  onClose: () => void;
}

export default function PlayerSettings({ onClose }: PlayerSettingsProps) {
  const { address, setAddress, reset } = useGameStore();
  const addToast = useToastStore((s) => s.add);
  const [input, setInput] = useState(address ?? '');

  const handleSave = () => {
    const trimmed = input.trim();
    setAddress(trimmed || null);
    addToast(`Pilgrim address set: ${trimmed || 'default'}`, 'success', 2500);
    onClose();
  };

  const handleReset = () => {
    if (confirm('Reset all local progress? This cannot be undone.')) {
      reset();
      addToast('Local progress reset', 'info', 2500);
      onClose();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-[#05060f]/95 p-5 shadow-2xl backdrop-blur-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-oasis-cyan" />
            <h2 className="text-lg font-bold text-white">Pilgrim Identity</h2>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-3 text-sm text-gray-400">
          Enter your OASIS pilgrim address to load real profile data from the backend.
        </p>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="pilgrim-0001"
          className="w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:border-oasis-cyan focus:ring-1 focus:ring-oasis-cyan"
        />

        <div className="mt-4 flex items-center gap-2">
          <button
            onClick={handleSave}
            className="flex-1 rounded-xl bg-oasis-cyan/20 py-2.5 text-sm font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
          >
            Save Address
          </button>
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm font-bold text-red-400 transition hover:bg-red-500/20"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>

        <p className="mt-3 text-[10px] text-gray-500">
          Default <code>pilgrim-0001</code> is used if no address is set. Local progress stays in this browser unless reset.
        </p>
      </div>
    </motion.div>
  );
}
