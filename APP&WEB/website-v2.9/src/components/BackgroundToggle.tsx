'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, Globe, Orbit, Radio, Sparkles } from 'lucide-react';
import { useObservatory, type ObservatoryMode } from '@/contexts/ObservatoryContext';

type BackgroundTogglePlacement = 'fixed' | 'nav';

const backgroundConfig: Record<ObservatoryMode, { icon: typeof Sparkles; label: string; description: string; color: string }> = {
  'planet-orbit': { icon: Globe, label: 'Turquoise Core', description: 'Default turquoise atmosphere', color: '45, 212, 191' },
  'galaxy-core': { icon: Sparkles, label: 'Galaxy Core', description: 'Contact approach — inward starflow', color: '180, 220, 255' },
  'desktop-agent': { icon: Radio, label: 'Desktop Agent', description: 'Purple starfield — desktop agent match', color: '200, 118, 255' },
  'warp-speed': { icon: Orbit, label: 'Warp', description: 'Warp tunnel effect', color: '111, 255, 240' },
};

export default function BackgroundToggle({ placement = 'fixed', showLabel = true }: { placement?: BackgroundTogglePlacement; showLabel?: boolean }) {
  const { mode, setMode } = useObservatory();
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = backgroundConfig[mode]?.icon || Sparkles;
  const currentColor = backgroundConfig[mode]?.color || '6, 182, 212';
  const isNavPlacement = placement === 'nav';

  const buttonClassName = isNavPlacement
    ? 'z-50 h-10 w-10 rounded-full border bg-black/70 backdrop-blur flex items-center justify-center transition-all relative overflow-visible hover:bg-black/85'
    : 'fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border bg-black/60 backdrop-blur flex items-center justify-center transition-all relative overflow-visible';

  const panelClassName = isNavPlacement
    ? 'absolute right-0 top-full mt-2 w-72 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50'
    : 'fixed bottom-20 right-4 w-72 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50';

  const currentLabel = backgroundConfig[mode]?.label || mode;

  return (
    <div className="relative flex items-center gap-2">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className={buttonClassName}
        style={{
          borderColor: `rgba(${currentColor}, 0.5)`,
          boxShadow: `0 0 20px rgba(${currentColor}, 0.3)`,
        }}
        aria-label="Toggle background menu"
      >
        {/* Desktop-agent inspired warp aura */}
        <motion.span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-2 rounded-full"
          style={{
            background: `conic-gradient(from 0deg, rgba(${currentColor}, 0), rgba(${currentColor}, 0.7), rgba(${currentColor}, 0), rgba(${currentColor}, 0.55), rgba(${currentColor}, 0))`,
            filter: 'blur(5px)',
          }}
          animate={{
            rotate: 360,
            opacity: isOpen ? 0.95 : 0.6,
            scale: isOpen ? 1.18 : 1.02,
          }}
          transition={{
            rotate: { duration: isOpen ? 1.6 : 4.2, repeat: Infinity, ease: 'linear' },
            opacity: { duration: 0.24 },
            scale: { duration: 0.24 },
          }}
        />

        {[0, 60, 120, 180, 240, 300].map((deg) => (
          <motion.span
            key={deg}
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 h-[2px] origin-left rounded-full"
            style={{
              width: isOpen ? '18px' : '12px',
              transform: `translateY(-50%) rotate(${deg}deg)`,
              background: `linear-gradient(90deg, rgba(${currentColor}, 0.85), rgba(${currentColor}, 0))`,
              filter: 'blur(0.4px)',
            }}
            animate={{
              opacity: isOpen ? [0.2, 0.95, 0.2] : [0.08, 0.45, 0.08],
              scaleX: isOpen ? [0.75, 1.45, 0.75] : [0.85, 1.1, 0.85],
            }}
            transition={{
              duration: isOpen ? 0.8 : 1.6,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: deg / 720,
            }}
          />
        ))}

        <CurrentIcon className="w-6 h-6" style={{ color: `rgb(${currentColor})` }} />
      </motion.button>

      {showLabel && (
        <span className="text-[10px] uppercase tracking-wider text-white/70 font-medium hidden sm:inline">
          {currentLabel}
        </span>
      )}

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className={panelClassName}
            >
              <div className="p-2">
                <div className="text-xs text-gray-400 px-3 py-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Background Mode
                </div>
                
                {(Object.keys(backgroundConfig) as ObservatoryMode[]).map((bgMode) => {
                  const config = backgroundConfig[bgMode];
                  const Icon = config.icon;
                  const isActive = mode === bgMode;
                  
                  return (
                    <button
                      key={bgMode}
                      onClick={() => {
                        setMode(bgMode);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all ${
                        isActive ? 'border' : 'hover:bg-white/8 border border-transparent'
                      }`}
                      style={isActive ? {
                        backgroundColor: `rgba(${config.color}, 0.15)`,
                        borderColor: `rgba(${config.color}, 0.4)`,
                      } : undefined}
                    >
                      <div
                        className="p-2 rounded-lg"
                        style={{
                          backgroundColor: isActive ? `rgba(${config.color}, 0.2)` : 'rgba(255,255,255,0.05)',
                        }}
                      >
                        <Icon
                          className="w-5 h-5"
                          style={{ color: isActive ? `rgb(${config.color})` : 'rgba(255,255,255,0.5)' }}
                        />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm text-white">{config.label}</div>
                        <div className="text-xs text-gray-400">{config.description}</div>
                      </div>
                      {isActive && (
                        <Check className="w-5 h-5" style={{ color: `rgb(${config.color})` }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 p-3 bg-black/50">
                <p className="text-xs text-gray-500 text-center">
                  Background switches instantly
                </p>
              </div>
            </motion.div>

            {/* Click outside to close */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
