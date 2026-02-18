'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, Sparkles, Globe, Radio } from 'lucide-react';
import { useObservatory, type ObservatoryMode } from '@/contexts/ObservatoryContext';

const backgroundConfig = {
  'deep-space': { icon: Sparkles, label: 'Deep Space', description: 'Classic starfield' },
  'planet-orbit': { icon: Globe, label: 'Planet Orbit', description: 'Orbital view' },
  'galactic-core': { icon: Radio, label: 'Galactic Core', description: 'Command nexus' },
};

export default function BackgroundToggle() {
  const { mode, setMode } = useObservatory();
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = backgroundConfig[mode]?.icon || Sparkles;

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border border-white/20 bg-black/60 backdrop-blur flex items-center justify-center hover:border-zion-cyan/60 hover:shadow-[0_0_20px_rgba(0,229,255,0.35)] transition-all"
        aria-label="Toggle background menu"
      >
        <CurrentIcon className="w-6 h-6 text-zion-cyan" />
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              className="fixed bottom-20 right-4 w-72 bg-black/90 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl overflow-hidden z-50"
            >
              <div className="p-2">
                <div className="text-xs text-gray-400 px-3 py-2 font-semibold uppercase tracking-wide flex items-center gap-2">
                  <Palette className="w-4 h-4" />
                  Background Mode
                </div>
                
                {(Object.keys(backgroundConfig) as ObservatoryMode[]).map((bgMode) => {
                  const config = backgroundConfig[bgMode];
                  const Icon = config.icon;
                  
                  return (
                    <button
                      key={bgMode}
                      onClick={() => {
                        setMode(bgMode);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                        mode === bgMode
                          ? 'bg-zion-cyan/20 border border-zion-cyan/30'
                          : 'hover:bg-white/10'
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${mode === bgMode ? 'bg-zion-cyan/20' : 'bg-white/5'}`}>
                        <Icon className={`w-5 h-5 ${mode === bgMode ? 'text-zion-cyan' : 'text-gray-400'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm">{config.label}</div>
                        <div className="text-xs text-gray-400">{config.description}</div>
                      </div>
                      {mode === bgMode && (
                        <Check className="w-5 h-5 text-zion-cyan" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 p-3 bg-black/50">
                <p className="text-xs text-gray-400 text-center">
                  ✨ Background saved automatically
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
