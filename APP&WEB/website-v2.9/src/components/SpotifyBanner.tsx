'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

interface SpotifyBannerProps {
  /** Spotify playlist URI např. "spotify:playlist:37i9dQZF1DX4sWSpwq3LiO" nebo URL */
  playlistId?: string;
  /** Zobrazený název */
  title?: { cs: string; en: string };
  cs: boolean;
}

/**
 * SpotifyBanner — collapsible banner s Spotify embedem pro přehrávání hudby.
 * Defaultně collapsed (jen barek), po kliknutí se rozbalí iframe embed.
 */
export default function SpotifyBanner({
  playlistId = '4HvwefPlEhGlLM1LOpKlnV', // ZION Arcade Radio — uživatelský playlist
  title,
  cs,
}: SpotifyBannerProps) {
  const [open, setOpen] = useState(false);
  const t = title ?? { cs: 'ZION Arcade Radio', en: 'ZION Arcade Radio' };

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-[#1DB954]/30 bg-gradient-to-r from-[#1DB954]/10 to-black/40 overflow-hidden"
    >
      {/* Header bar — vždy viditelný */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-[#1DB954]/5"
      >
        <div className="flex items-center gap-3">
          {/* Spotify-like pulsing icon */}
          <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[#1DB954]/20">
            <motion.div
              className="absolute inset-0 rounded-full bg-[#1DB954]/30"
              animate={{ scale: [1, 1.4, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
            />
            <Music className="h-4 w-4 text-[#1DB954]" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-white">{t[cs ? 'cs' : 'en']}</p>
            <p className="text-[10px] text-gray-500">
              {cs ? 'Pusť si hudbu při hraní' : 'Play music while you play'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-[10px] text-[#1DB954]/70 uppercase tracking-wider">
            {open ? (cs ? 'Skrýt' : 'Hide') : (cs ? 'Otevřít' : 'Open')}
          </span>
          {open ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
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
            <div className="border-t border-[#1DB954]/20 p-3">
              <iframe
                src={`https://open.spotify.com/embed/playlist/${playlistId}?utm_source=generator&theme=0`}
                width="100%"
                height="352"
                frameBorder="0"
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="rounded-xl"
                title="Spotify Player"
              />
              <div className="mt-2 flex items-center justify-between px-1">
                <p className="text-[10px] text-gray-600">
                  {cs ? 'Vyžaduje Spotify účet pro plné přehrávání' : 'Requires Spotify account for full playback'}
                </p>
                <a
                  href={`https://open.spotify.com/playlist/${playlistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] text-[#1DB954] hover:text-[#1ed760] transition-colors"
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
