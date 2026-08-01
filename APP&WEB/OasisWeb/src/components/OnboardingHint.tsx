'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mouse, Keyboard, Plane, CircleDot, Egg, Wallet } from 'lucide-react';

const SEEN_KEY = 'oasis-onboarding-seen';

export default function OnboardingHint({ onClose }: { onClose?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = typeof window !== 'undefined' ? localStorage.getItem(SEEN_KEY) : null;
    if (!seen) setVisible(true);
  }, []);

  const dismiss = () => {
    if (typeof window !== 'undefined') localStorage.setItem(SEEN_KEY, 'true');
    setVisible(false);
    onClose?.();
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="pointer-events-auto fixed inset-0 z-[55] flex items-center justify-center p-4"
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={dismiss} />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#05060f]/95 p-5 shadow-2xl backdrop-blur-2xl"
          >
            <button
              onClick={dismiss}
              className="absolute right-3 top-3 rounded-full p-1.5 text-gray-400 hover:bg-white/10 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="mb-2 text-xl font-bold text-white">Welcome, Pilgrim</h2>
            <p className="mb-4 text-sm text-gray-400">
              Explore 55 OASIS worlds, complete quests, and collect Golden Eggs.
            </p>

            <div className="space-y-3">
              <HintRow icon={Mouse} title="Explore" text="Click a world to open its panel. Enter to scan it and view quests." />
              <HintRow icon={Keyboard} title="Flight" text="Press F to fly freely. Use WASD, Space/Shift, and mouse. Press ESC or F to exit." />
              <HintRow icon={Plane} title="Approach" text="While flying near a world, press L when the landing prompt appears." />
              <HintRow icon={CircleDot} title="Quests" text="Complete quests in the world panel to earn XP and credits." />
              <HintRow icon={Egg} title="Golden Eggs" text="Collect Golden Eggs from worlds for 100 Z → +500 XP." />
              <HintRow icon={Wallet} title="Wallet" text="Set your Pilgrim ID or real ZION wallet in the top-left settings icon." />
            </div>

            <button
              onClick={dismiss}
              className="mt-5 w-full rounded-xl bg-oasis-cyan/20 py-2.5 text-sm font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
            >
              Start journey
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function HintRow({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/5 p-2.5">
      <div className="rounded bg-oasis-cyan/10 p-1.5 text-oasis-cyan">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="text-[11px] text-gray-400">{text}</p>
      </div>
    </div>
  );
}
