'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ExternalLink, Volume2 } from 'lucide-react';

interface SpotifyBannerProps {
  /** Spotify playlist ID */
  playlistId?: string;
  /** Zobrazený název */
  title?: { cs: string; en: string };
  cs: boolean;
}

function SpotifyIcon({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.021-.12-1.141-.6-.12-.48.12-1.021.6-1.141 4.32-1.32 9.72-.659 13.44 1.62.421.18.579.721.302 1.201zm.121-3.441C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.721 1.02.42 1.56-.301.42-1.021.6-1.561.3z"/>
    </svg>
  );
}

/**
 * SpotifyBanner — collapsible banner s Spotify embedem pro přehrávání hudby.
 * Defaultně collapsed (jen barek), po kliknutí se rozbalí iframe embed.
 */
export default function SpotifyBanner({
  playlistId = '4HvwefPlEhGlLM1LOpKlnV',
  title,
  cs,
}: SpotifyBannerProps) {
  const [open, setOpen] = useState(false);
  const t = title ?? { cs: 'ZION Arcade Radio', en: 'ZION Arcade Radio' };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border border-[#1DB954]/30 bg-gradient-to-r from-[#1DB954]/10 via-black/50 to-black/40"
    >
      {/* Ambient glow */}
      <div className="absolute -left-10 -top-10 h-32 w-32 rounded-full bg-[#1DB954]/10 blur-3xl" />

      {/* Header bar — vždy viditelný */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative flex w-full items-center justify-between px-5 py-4 transition-colors hover:bg-[#1DB954]/5"
      >
        <div className="flex items-center gap-3">
          {/* Spotify icon with pulse */}
          <div className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#1DB954]/20 border border-[#1DB954]/30">
            <motion.div
              className="absolute inset-0 rounded-full bg-[#1DB954]/40"
              animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <SpotifyIcon className="h-5 w-5 text-[#1DB954] relative z-10" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white flex items-center gap-2">
              {t[cs ? 'cs' : 'en']}
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1DB954]/15 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#1DB954]">
                <Volume2 className="h-2.5 w-2.5" /> Live
              </span>
            </p>
            <p className="text-[10px] text-gray-500">
              {cs ? 'Pusť si hudbu při hraní' : 'Play music while you play'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] text-[#1DB954]/70 uppercase tracking-wider">
            {open ? (cs ? 'Skrýt' : 'Hide') : (cs ? 'Otevřít' : 'Open')}
          </span>
          <motion.div
            animate={{ rotate: open ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronDown className="h-4 w-4 text-gray-400" />
          </motion.div>
        </div>
      </button>

      {/* Expandable Spotify embed */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#1DB954]/20 p-4">
              <iframe
                src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                width="100%"
                height="352"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-xl border border-[#1DB954]/10"
                title="Spotify Player"
              />
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-[10px] text-gray-600">
                  {cs ? 'Vyžaduje Spotify účet pro plné přehrávání' : 'Requires Spotify account for full playback'}
                </p>
                <a
                  href={`https://open.spotify.com/playlist/${playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#1DB954]/20 px-2.5 py-1 text-[10px] text-[#1DB954] hover:bg-[#1DB954]/10 transition-colors"
                >
                  {cs ? 'Otevřít v Spotify' : 'Open in Spotify'}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
