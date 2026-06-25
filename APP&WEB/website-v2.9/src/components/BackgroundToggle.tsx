'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, Sparkles, Globe, Radio, Cloud } from 'lucide-react';
import { useObservatory, type ObservatoryMode } from '@/contexts/ObservatoryContext';

const backgroundConfig: Record<ObservatoryMode, { icon: typeof Sparkles; label: string; description: string; color: string }> = {
  'deep-space': { icon: Sparkles, label: 'Deep Space', description: 'Classic starfield', color: '251, 191, 36' },
  'planet-orbit': { icon: Globe, label: 'Planet Orbit', description: 'Orbital view', color: '6, 182, 212' },
  'galactic-core': { icon: Radio, label: 'Galactic Core', description: 'Command nexus', color: '147, 51, 234' },
  'nebula-drift': { icon: Cloud, label: 'Nebula Drift', description: 'Desktop agent vibe', color: '180, 140, 255' },
};

export default function BackgroundToggle() {
  const { mode, setMode } = useObservatory();
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = backgroundConfig[mode]?.icon || Sparkles;
  const currentColor = backgroundConfig[mode]?.color || '6, 182, 212';

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border bg-black/60 backdrop-blur flex items-center justify-center transition-all"
        style={{
          borderColor: `rgba(${currentColor}, 0.5)`,
          boxShadow: `0 0 20px rgba(${currentColor}, 0.3)`,
        }}
        aria-label="Toggle background menu"
      >
        <CurrentIcon className="w-6 h-6" style={{ color: `rgb(${currentColor})` }} />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 w-72 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl overflow-hidden z-50"
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
