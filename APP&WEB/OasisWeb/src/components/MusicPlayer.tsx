'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, Music, ChevronUp, ChevronDown, ExternalLink } from 'lucide-react';
import type { MusicPlayerState } from './AudioEngine';
import { extractSpotifyPlaylistId, spotifyEmbedUrl } from '../lib/spotify';

interface MusicPlayerProps {
  music: MusicPlayerState;
}

const DEFAULT_PLAYLIST = 'https://open.spotify.com/playlist/4HvwefPlEhGlLM1LOpKlnV?si=1c1e7e39ebac43a8';
const TAB_KEY = 'oasis-music-tab';
const PLAYLIST_KEY = 'oasis-spotify-playlist-v2';

type Tab = 'spotify' | 'oasis';

export default function MusicPlayer({ music }: MusicPlayerProps) {
  const [expanded, setExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('spotify');
  const [playlistUrl, setPlaylistUrl] = useState(DEFAULT_PLAYLIST);
  const [playlistInput, setPlaylistInput] = useState(playlistUrl);

  useEffect(() => {
    const savedTab = typeof window !== 'undefined' ? localStorage.getItem(TAB_KEY) : null;
    const savedPlaylist = typeof window !== 'undefined' ? localStorage.getItem(PLAYLIST_KEY) : null;
    if (savedTab === 'oasis' || savedTab === 'spotify') {
      setActiveTab(savedTab);
    }
    if (savedPlaylist) {
      setPlaylistUrl(savedPlaylist);
      setPlaylistInput(savedPlaylist);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(TAB_KEY, activeTab);
    }
  }, [activeTab]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLAYLIST_KEY, playlistUrl);
    }
  }, [playlistUrl]);

  // Pause procedurally-generated OASIS music when Spotify is active.
  useEffect(() => {
    if (activeTab === 'spotify') {
      music.pause();
    }
  }, [activeTab, music]);

  const playlistId = useMemo(() => extractSpotifyPlaylistId(playlistUrl), [playlistUrl]);
  const current = music.tracks[music.trackIndex] ?? music.tracks[0];

  const handlePlaylistApply = () => {
    setPlaylistUrl(playlistInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setPlaylistUrl(playlistInput);
    }
  };

  const pillLabel = activeTab === 'spotify' ? 'Spotify' : current.name;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="pointer-events-auto flex flex-col items-start"
    >
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-72 rounded-xl border border-white/10 bg-black/95 p-2.5 shadow-2xl backdrop-blur-xl sm:w-80"
          >
            <div className="mb-2 flex gap-1 rounded-lg border border-white/10 bg-white/5 p-1">
              <button
                onClick={() => setActiveTab('spotify')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                  activeTab === 'spotify' ? 'bg-oasis-cyan/20 text-oasis-cyan' : 'text-white/70 hover:text-white'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
                Spotify
              </button>
              <button
                onClick={() => setActiveTab('oasis')}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition ${
                  activeTab === 'oasis' ? 'bg-oasis-gold/20 text-oasis-gold' : 'text-white/70 hover:text-white'
                }`}
              >
                <ListMusic className="h-3.5 w-3.5" />
                OASIS Radio
              </button>
            </div>

            {activeTab === 'spotify' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={playlistInput}
                    onChange={(e) => setPlaylistInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="https://open.spotify.com/playlist/..."
                    className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/50 outline-none focus:border-oasis-cyan focus:ring-1 focus:ring-oasis-cyan"
                  />
                  <button
                    onClick={handlePlaylistApply}
                    className="rounded-lg bg-oasis-cyan/20 px-3 py-1.5 text-xs font-bold text-oasis-cyan transition hover:bg-oasis-cyan/30"
                  >
                    Set
                  </button>
                </div>

                {playlistId ? (
                  <div className="overflow-hidden rounded-lg border border-white/10">
                    <iframe
                      src={spotifyEmbedUrl(playlistId)}
                      width="100%"
                      height="152"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      title="Spotify playlist"
                      className="bg-black"
                    />
                  </div>
                ) : (
                  <div className="rounded-lg border border-white/10 bg-white/5 p-3 text-center text-xs text-white/70">
                    <p>Zadej platné Spotify playlist URL.</p>
                    <p className="mt-1 text-[10px] text-white/60">
                      Pro skutečné přehrávání se přihlas na Spotify.
                    </p>
                  </div>
                )}

                <p className="text-[10px] text-white/60">
                  Embed přehrávač. Pro tvoje vlastní playlisty a ovládání z OASIS potřebujeme Spotify Client ID (Web Playback SDK + OAuth).
                </p>
              </div>
            )}

            {activeTab === 'oasis' && (
              <div className="space-y-2">
                <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-white/60">
                  <ListMusic className="h-3 w-3" />
                  <span>Stations</span>
                </div>
                {music.tracks.map((track, i) => (
                  <button
                    key={track.id}
                    onClick={() => music.setTrack(i)}
                    className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                      i === music.trackIndex ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
                    <span className="flex-1 truncate">{track.name}</span>
                  </button>
                ))}

                <div className="rounded-lg border border-white/10 bg-white/5 p-2">
                  <div className="mb-2 flex items-center justify-between text-[10px] text-white/70">
                    <span>Volume</span>
                    <span className="font-mono text-oasis-cyan">{Math.round(music.volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={music.volume}
                    onChange={(e) => music.setVolume(parseFloat(e.target.value))}
                    className="w-full h-1 accent-oasis-cyan"
                  />
                </div>

                <p className="text-[10px] text-white/60">
                  Procedurální hudba — laděná jako fallback. Může být nahrazena plným Spotify propojením.
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/80 px-2 py-1.5 shadow-2xl backdrop-blur-md">
        <span
          className="ml-1 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: activeTab === 'spotify' ? '#078930' : current.color }}
        />

        {activeTab === 'oasis' && (
          <>
            <button
              onClick={() => music.prev()}
              className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Previous station"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>

            <button
              onClick={() => (music.playing ? music.pause() : music.resume())}
              className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
              aria-label={music.playing ? 'Pause music' : 'Play music'}
            >
              {music.playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            </button>

            <button
              onClick={() => music.next()}
              className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
              aria-label="Next station"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </>
        )}

        <button
          onClick={() => {
            setExpanded((s) => !s);
          }}
          className="ml-1 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
        >
          {activeTab === 'spotify' ? (
            <Music className="h-3.5 w-3.5 text-[#078930]" />
          ) : (
            <ListMusic className="h-3.5 w-3.5 text-oasis-cyan" />
          )}
          <span className="max-w-[90px] truncate sm:max-w-[130px]">{pillLabel}</span>
          {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
        </button>

        {activeTab === 'oasis' && (
          <button
            onClick={() => (music.volume > 0 ? music.setVolume(0) : music.setVolume(0.5))}
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Music volume"
          >
            {music.volume > 0 ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
          </button>
        )}

        {activeTab === 'spotify' && playlistId && (
          <a
            href={`https://open.spotify.com/playlist/${playlistId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full p-1.5 text-white/80 transition hover:bg-white/10 hover:text-white"
            aria-label="Open in Spotify"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>
    </motion.div>
  );
}
