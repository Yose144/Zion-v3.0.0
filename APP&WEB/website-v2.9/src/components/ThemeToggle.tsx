'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Palette, Check, Sparkles, Binary, Zap, Star } from 'lucide-react';
import { useTheme, type ThemeName } from '@/contexts/ThemeContext';

const themeConfig = {
  cosmic: { icon: Sparkles, emoji: '🌌', label: 'Cosmic' },
  matrix: { icon: Binary, emoji: '💚', label: 'Matrix' },
  cyberpunk: { icon: Zap, emoji: '🌃', label: 'Cyberpunk' },
  sacred: { icon: Star, emoji: '🕉️', label: 'Sacred' },
};

export default function ThemeToggle() {
  const { currentTheme, setTheme, availableThemes } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  const CurrentIcon = themeConfig[currentTheme.name as ThemeName]?.icon || Sparkles;

  return (
    <div className="relative">
      <motion.button
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full border border-white/20 bg-black/60 backdrop-blur flex items-center justify-center hover:border-zion-gold/60 hover:shadow-[0_0_20px_rgba(252,209,22,0.35)] transition-all"
        aria-label="Toggle theme menu"
      >
        <CurrentIcon className="w-6 h-6 text-zion-gold" />
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
                <div className="text-xs text-gray-400 px-3 py-2 font-semibold uppercase tracking-wide">
                  Choose Theme
                </div>
                
                {availableThemes.map((theme) => {
                  const config = themeConfig[theme.name as ThemeName];
                  const Icon = config?.icon || Sparkles;
                  
                  return (
                    <button
                      key={theme.name}
                      onClick={() => {
                        setTheme(theme.name);
                        setIsOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all ${
                        currentTheme.name === theme.name
                          ? 'bg-white/20'
                          : 'hover:bg-white/10'
                      }`}
                    >
                      <span className="text-2xl">{config?.emoji}</span>
                      <div className="flex-1 text-left">
                        <div className="font-semibold text-sm">{theme.displayName}</div>
                        <div className="flex items-center gap-1 mt-1">
                          <div
                            className="w-3 h-3 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: theme.colors.primary }}
                          />
                          <div
                            className="w-3 h-3 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: theme.colors.secondary }}
                          />
                          <div
                            className="w-3 h-3 rounded-full ring-1 ring-white/20"
                            style={{ backgroundColor: theme.colors.accent }}
                          />
                        </div>
                      </div>
                      {currentTheme.name === theme.name && (
                        <Check className="w-5 h-5 text-green-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-white/10 p-3 bg-black/50">
                <p className="text-xs text-gray-400 text-center">
                  ✨ Theme saved automatically
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
