'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, ListMusic, Music } from 'lucide-react';
import type { MusicPlayerState } from './AudioEngine';

interface MusicPlayerProps {
  music: MusicPlayerState;
}

export default function MusicPlayer({ music }: MusicPlayerProps) {
  const [showList, setShowList] = useState(false);
  const [showVol, setShowVol] = useState(false);
  const current = music.tracks[music.trackIndex] ?? music.tracks[0];

  const handleTrackClick = (index: number) => {
    music.setTrack(index);
    setShowList(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ duration: 0.5, delay: 0.2 }}
      className="pointer-events-auto flex flex-col items-start"
    >
      <AnimatePresence>
        {showList && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-full min-w-[10rem] rounded-xl border border-white/10 bg-black/90 p-2 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-1.5 flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <Music className="h-3 w-3" />
              <span>Stations</span>
            </div>
            {music.tracks.map((track, i) => (
              <button
                key={track.id}
                onClick={() => handleTrackClick(i)}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                  i === music.trackIndex ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: track.color }} />
                <span className="flex-1 truncate">{track.name}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showVol && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="mb-2 w-full rounded-xl border border-white/10 bg-black/90 p-2.5 shadow-2xl backdrop-blur-xl"
          >
            <div className="mb-2 flex items-center justify-between text-[10px] text-gray-400">
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
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/80 px-2 py-1.5 shadow-2xl backdrop-blur-md">
        <span
          className="ml-1 h-2.5 w-2.5 rounded-full"
          style={{ backgroundColor: current.color }}
        />

        <button
          onClick={() => music.prev()}
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
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
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Next station"
        >
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => {
            setShowList((s) => !s);
            setShowVol(false);
          }}
          className="ml-1 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-white transition hover:bg-white/10"
        >
          <ListMusic className="h-3.5 w-3.5 text-oasis-cyan" />
          <span className="max-w-[100px] truncate sm:max-w-[140px]">{current.name}</span>
        </button>

        <button
          onClick={() => {
            setShowVol((s) => !s);
            setShowList(false);
          }}
          className="rounded-full p-1.5 text-gray-300 transition hover:bg-white/10 hover:text-white"
          aria-label="Music volume"
        >
          {music.volume > 0 ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
        </button>
      </div>
    </motion.div>
  );
}
