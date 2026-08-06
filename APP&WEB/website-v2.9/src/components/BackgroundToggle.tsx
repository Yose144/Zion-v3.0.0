'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Check, Globe, Orbit, Radio, Sparkles, Palette } from 'lucide-react';
import { useObservatory, type ObservatoryMode } from '@/contexts/ObservatoryContext';

const backgroundConfig: Record<ObservatoryMode, { icon: typeof Sparkles; label: string; description: string; color: string }> = {
  'maintenance': { icon: Sparkles, label: 'Maintenance Starfield', description: 'Gold starfield — clean and fast', color: '252, 209, 22' },
  'planet-orbit': { icon: Globe, label: 'Turquoise Core', description: 'Default turquoise atmosphere', color: '45, 212, 191' },
  'galaxy-core': { icon: Sparkles, label: 'Galaxy Core', description: 'Contact approach — inward starflow', color: '180, 220, 255' },
  'desktop-agent': { icon: Radio, label: 'Desktop Agent', description: 'Purple starfield — desktop agent match', color: '200, 118, 255' },
  'warp-speed': { icon: Orbit, label: 'Warp', description: 'Warp tunnel effect', color: '111, 255, 240' },
};

export default function BackgroundToggle() {
  const { mode, setMode } = useObservatory();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const CurrentIcon = backgroundConfig[mode]?.icon || Sparkles;
  const currentColor = backgroundConfig[mode]?.color || '7, 137, 48';
  const currentLabel = backgroundConfig[mode]?.label || mode;

  /* Close on click outside */
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  /* Close on Escape */
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  return (
    <div ref={containerRef} className="fixed bottom-4 right-4 z-[70]">
      {/* Trigger button — circular, glass, matches nav aesthetic */}
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="relative h-12 w-12 rounded-full border bg-black/60 backdrop-blur-xl flex items-center justify-center transition-all overflow-visible"
        style={{
          borderColor: `rgba(${currentColor}, 0.5)`,
          boxShadow: `0 0 20px rgba(${currentColor}, 0.3), 0 8px 24px rgba(0,0,0,0.4)`,
        }}
        aria-label="Toggle background menu"
      >
        {/* Rotating aura */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, rgba(${currentColor}, 0), rgba(${currentColor}, 0.7), rgba(${currentColor}, 0), rgba(${currentColor}, 0.55), rgba(${currentColor}, 0))`,
            filter: 'blur(5px)',
          }}
          animate={{ rotate: 360, opacity: isOpen ? 0.95 : 0.6, scale: isOpen ? 1.18 : 1.02 }}
          transition={{ rotate: { duration: isOpen ? 1.6 : 4.2, repeat: Infinity, ease: 'linear' }, opacity: { duration: 0.24 }, scale: { duration: 0.24 } }}
        />
        <CurrentIcon className="w-6 h-6 relative z-10" style={{ color: `rgb(${currentColor})` }} />
      </motion.button>

      {/* Label chip — visible next to button when closed */}
      <AnimatePresence>
        {!isOpen && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.2 }}
            className="absolute right-14 top-1/2 -translate-y-1/2 hidden sm:block whitespace-nowrap text-[10px] uppercase tracking-wider text-white/60 font-medium bg-black/60 backdrop-blur-md border border-white/10 rounded-full px-2.5 py-1 pointer-events-none"
          >
            {currentLabel}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Dropdown panel — matches nav glass style with rounded corners + gradient top line */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="absolute bottom-16 right-0 w-72 rounded-2xl border border-white/10 bg-black/80 backdrop-blur-2xl shadow-[0_18px_60px_rgba(0,0,0,0.55)] overflow-hidden"
          >
            {/* Rasta gradient top accent — same as nav */}
            <div className="h-1 w-full bg-linear-to-r from-emerald-400/60 via-zion-gold/70 to-red-400/60" />

            {/* Header */}
            <div className="flex items-center gap-2 px-4 pt-3 pb-2">
              <Palette className="w-4 h-4 text-zion-gold/70" />
              <span className="text-[10px] uppercase tracking-[0.35em] text-zion-gold/70 font-semibold">Background Mode</span>
            </div>

            {/* Options */}
            <div className="px-2 pb-2 flex flex-col gap-0.5">
              {(Object.keys(backgroundConfig) as ObservatoryMode[]).map((bgMode) => {
                const config = backgroundConfig[bgMode];
                const Icon = config.icon;
                const isActive = mode === bgMode;
                return (
                  <button
                    key={bgMode}
                    onClick={() => { setMode(bgMode); setIsOpen(false); }}
                    className={`w-full flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all ${isActive ? 'border' : 'hover:bg-white/8 border border-transparent'}`}
                    style={isActive ? { backgroundColor: `rgba(${config.color}, 0.12)`, borderColor: `rgba(${config.color}, 0.4)` } : undefined}
                  >
                    <div className="p-1.5 rounded-lg" style={{ backgroundColor: isActive ? `rgba(${config.color}, 0.2)` : 'rgba(255,255,255,0.05)' }}>
                      <Icon className="w-4 h-4" style={{ color: isActive ? `rgb(${config.color})` : 'rgba(255,255,255,0.5)' }} />
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="font-semibold text-sm text-white truncate">{config.label}</div>
                      <div className="text-xs text-gray-400 truncate">{config.description}</div>
                    </div>
                    {isActive && <Check className="w-4 h-4 shrink-0" style={{ color: `rgb(${config.color})` }} />}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="border-t border-white/8 px-4 py-2.5 bg-black/40">
              <p className="text-[10px] text-gray-500 text-center uppercase tracking-wider">Switches instantly</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
