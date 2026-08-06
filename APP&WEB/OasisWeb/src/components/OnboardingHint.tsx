'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mouse, Keyboard, Plane, CircleDot, Egg, Wallet } from 'lucide-react';

const SEEN_KEY = 'oasis-onboarding-seen';

const HINTS = [
  { icon: Mouse, title: 'Explore', text: 'Click a world to open its panel. Enter to scan it and view quests.' },
  { icon: Keyboard, title: 'Flight', text: 'Press F to fly freely. Use WASD, Space/Shift, and mouse. Press ESC or F to exit.' },
  { icon: Plane, title: 'Approach', text: 'While flying near a world, press L when the landing prompt appears.' },
  { icon: CircleDot, title: 'Quests', text: 'Complete quests in the world panel to earn XP and credits.' },
  { icon: Egg, title: 'Golden Eggs', text: 'Collect Golden Eggs from worlds for 100 Z → +500 XP.' },
  { icon: Wallet, title: 'Wallet', text: 'Set your Pilgrim ID or real ZION wallet in the top-left settings icon.' },
];

export default function OnboardingHint({ onClose }: { onClose?: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = typeof window !== 'undefined' ? localStorage.getItem(SEEN_KEY) : null;
    if (!seen) setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    if (typeof window !== 'undefined') localStorage.setItem(SEEN_KEY, 'true');
    setVisible(false);
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [visible, dismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.96 }}
          transition={{ duration: 0.35 }}
          className="pointer-events-auto absolute left-2 top-28 z-30 w-[16rem] max-w-[calc(100vw-1rem)] p-3 sm:left-5 sm:top-40 sm:w-72 sm:p-4 zion-hud-panel"
        >
          <div className="mb-3 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="zion-kicker text-[9px] py-1 px-2">Onboarding</span>
              <h2 className="mt-1.5 text-lg font-bold text-white">Welcome, Pilgrim</h2>
              <p className="mt-0.5 text-[11px] leading-relaxed text-white/80">
                Explore 55 OASIS worlds, complete quests, and collect Golden Eggs.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-full p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
              aria-label="Dismiss onboarding"
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="max-h-[50vh] space-y-2 overflow-y-auto pr-0.5">
            {HINTS.map(({ icon: Icon, title, text }) => (
              <div
                key={title}
                className="zion-rainbow-sub flex items-start gap-2.5 p-2"
                style={{ '--rc': '228, 30, 43' } as React.CSSProperties}
              >
                <div className="mt-0.5 shrink-0 rounded-lg bg-oasis-purple/10 p-1.5 text-oasis-purple">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white">{title}</p>
                  <p className="text-[10px] leading-relaxed text-white/80">{text}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={dismiss}
            className="zion-button-primary mt-3 w-full text-[11px]"
          >
            Start journey
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
