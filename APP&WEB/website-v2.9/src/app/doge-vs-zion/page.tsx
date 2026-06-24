'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, Volume2, VolumeX, Trophy, Play, Gamepad2, Sparkles } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { ZionDefense } from './games/ZionDefense';
import { MiningSnake } from './games/MiningSnake';
import { BlockBreaker } from './games/BlockBreaker';
import { FlappyNode } from './games/FlappyNode';
import OasisAmbientScene from '@/components/OasisAmbientScene';
import SpotifyBanner from '@/components/SpotifyBanner';
import StargatePortal from '@/components/StargatePortal';

// ─── Game Catalog ─────────────────────────────────────────────────────────────

interface GameEntry {
  id: string;
  title: string;
  emoji: string;
  genre: string;
  description: string;
  descriptionCs: string;
  color: string;
  glowColor: string;
  hsKey: string;
  badge?: string;
}

const GAMES: GameEntry[] = [
  {
    id: 'zion-defense',
    title: 'ZION Defense',
    emoji: '🛡️',
    genre: 'Tower Defense',
    description: 'Defend the ZION node across L1→L6. Build towers, survive waves, save the network.',
    descriptionCs: 'Bránit ZION node přes L1→L6. Postav věže, přežij vlny, zachraň síť.',
    color: '#10b981',
    glowColor: '#34d399',
    hsKey: 'zion-defense-save',
    badge: 'NEW',
  },
  {
    id: 'mining-snake',
    title: 'Mining Snake',
    emoji: '⛏️',
    genre: 'Arcade',
    description: 'Pilot your mining rig. Collect ZION coins. Don\'t crash into yourself.',
    descriptionCs: 'Riď svůj mining rig. Sbírej ZION coiny. Nenaraz do sebe.',
    color: '#f59e0b',
    glowColor: '#fbbf24',
    hsKey: 'mining-snake-hs',
    badge: 'RETRO',
  },
  {
    id: 'block-breaker',
    title: 'Block Breaker',
    emoji: '🔥',
    genre: 'Arcade',
    description: 'Break through the firewalls. Free the network layer by layer.',
    descriptionCs: 'Proraz skrz firewally. Osvoboď síť vrstvu po vrstvě.',
    color: '#ef4444',
    glowColor: '#f87171',
    hsKey: 'block-breaker-hs',
    badge: 'RETRO',
  },
  {
    id: 'flappy-node',
    title: 'Flappy Node',
    emoji: '🛡️',
    genre: 'Arcade',
    description: 'Keep the node alive. Dodge the firewalls. One tap at a time.',
    descriptionCs: 'Udrž node při životě. Vyhýbej se firewallům. Jedno klepnutí.',
    color: '#06b6d4',
    glowColor: '#22d3ee',
    hsKey: 'flappy-node-hs',
    badge: 'RETRO',
  },
];

// ─── Score loading ────────────────────────────────────────────────────────────

function loadAllScores(): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const game of GAMES) {
    if (game.id === 'zion-defense') {
      try {
        const raw = localStorage.getItem(game.hsKey);
        if (raw) {
          const data = JSON.parse(raw);
          const stars = Object.values(data.levelStars ?? {}) as number[];
          scores[game.id] = stars.reduce((a, b) => a + b, 0);
        }
      } catch { /* noop */ }
    } else {
      try {
        const raw = localStorage.getItem(game.hsKey);
        if (raw) scores[game.id] = parseInt(raw, 10) || 0;
      } catch { /* noop */ }
    }
  }
  return scores;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [highScores, setHighScores] = useState<Record<string, number>>(() => loadAllScores());

  // Refresh scores when returning to hub
  const backToHub = () => {
    setActiveGame(null);
    setHighScores(loadAllScores());
  };

  // ─── Render active game ─────────────────────────────────────────────────────

  if (activeGame === 'zion-defense') return <ZionDefenseWrapper onBack={backToHub} muted={muted} setMuted={setMuted} />;
  if (activeGame === 'mining-snake') return <MiningSnake onBack={backToHub} />;
  if (activeGame === 'block-breaker') return <BlockBreaker onBack={backToHub} />;
  if (activeGame === 'flappy-node') return <FlappyNode onBack={backToHub} />;

  // ─── Hub page ───────────────────────────────────────────────────────────────

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-12 pt-20 md:pt-24">
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white opacity-20" style={{
            width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
            top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%`,
          }} />
        ))}
      </div>

      <div className="relative z-10 zion-container space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> {cs ? 'Zpět' : 'Back'}
          </Link>
          <button
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>

        {/* ─── Hero s Oasis ambient scene ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl border border-white/10"
        >
          {/* Oasis ambient scene jako background */}
          <OasisAmbientScene className="absolute inset-0 h-full w-full" />

          {/* Overlay obsah */}
          <div className="relative z-10 flex flex-col items-center px-6 py-12 md:py-16 text-center">
            {/* Stargate portal nad titulkem */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="mb-4"
            >
              <StargatePortal size={72} active />
            </motion.div>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 rounded-full border border-zion-gold/30 bg-zion-gold/10 px-4 py-1 text-xs font-semibold tracking-widest text-zion-gold uppercase mb-4"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {cs ? 'Meme Lab & Arcade' : 'Meme Lab & Arcade'}
            </motion.div>

            {/* Titulek s gradient + animace */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="text-4xl md:text-6xl font-bold text-gradient leading-tight"
            >
              ZION Arcade
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-3 text-sm md:text-base text-gray-300 max-w-xl"
            >
              {cs
                ? 'ZION-themed hry. Od tower defense přes retro klasiky po interaktivní oázu. Hraj a sbírej ZION!'
                : 'ZION-themed games. From tower defense to retro classics to the interactive oasis. Play and earn ZION!'}
            </motion.p>

            {/* Statistiky */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-5 flex flex-wrap justify-center gap-4 text-xs"
            >
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                <Gamepad2 className="h-3.5 w-3.5 text-zion-cyan" />
                <span className="text-gray-300">{GAMES.length} {cs ? 'her' : 'games'}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                <Trophy className="h-3.5 w-3.5 text-zion-gold" />
                <span className="text-gray-300">
                  {Object.values(highScores).reduce((a, b) => a + b, 0)} {cs ? 'celkem bodů' : 'total points'}
                </span>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── Spotify music banner ─── */}
        <SpotifyBanner cs={cs} />

        {/* Game cards grid */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zion-purple/40 to-transparent" />
            <div className="flex items-center gap-2">
              <Gamepad2 className="h-5 w-5 text-zion-purple" />
              <h2 className="text-lg font-bold text-white tracking-wide">
                {cs ? 'Vyber si hru' : 'Pick a game'}
              </h2>
            </div>
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zion-purple/40 to-transparent" />
          </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {GAMES.map((game, idx) => {
            const score = highScores[game.id] ?? 0;
            return (
              <motion.button
                key={game.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.1, duration: 0.4 }}
                onClick={() => setActiveGame(game.id)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-black/80 to-black/40 p-6 text-left transition-all hover:border-white/20 hover:scale-[1.02]"
                style={{ boxShadow: `0 0 0 0 ${game.color}00` }}
                whileHover={{ boxShadow: `0 8px 40px ${game.glowColor}20` }}
              >
                {/* Animated gradient border glow */}
                <div
                  className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  style={{
                    background: `radial-gradient(circle at 50% 0%, ${game.color}15, transparent 70%)`,
                  }}
                />

                {/* Corner glow */}
                <div
                  className="absolute -right-12 -top-12 h-40 w-40 rounded-full opacity-10 blur-3xl transition-all duration-500 group-hover:opacity-30 group-hover:scale-125"
                  style={{ backgroundColor: game.color }}
                />

                {/* Bottom gradient line */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-0.5 opacity-30 group-hover:opacity-80 transition-opacity"
                  style={{ background: `linear-gradient(to right, transparent, ${game.color}, transparent)` }}
                />

                <div className="relative flex items-start gap-5">
                  {/* Game icon — larger, richer */}
                  <div
                    className="relative flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl text-4xl transition-transform group-hover:scale-110 group-hover:rotate-3"
                    style={{
                      backgroundColor: `${game.color}15`,
                      border: `1px solid ${game.color}50`,
                      boxShadow: `0 0 30px ${game.glowColor}25, inset 0 0 20px ${game.color}10`,
                    }}
                  >
                    {game.emoji}
                    {/* Pulse ring on hover */}
                    <div
                      className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 group-hover:animate-ping"
                      style={{ border: `1px solid ${game.color}40` }}
                    />
                  </div>

                  {/* Game info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xl font-bold text-white tracking-tight">{game.title}</h3>
                      {game.badge && (
                        <span
                          className="rounded-full px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider border"
                          style={{
                            backgroundColor: `${game.color}20`,
                            color: game.color,
                            borderColor: `${game.color}40`,
                          }}
                        >
                          {game.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-gray-500 mt-1">{game.genre}</p>
                    <p className="mt-2.5 text-xs text-gray-400 leading-relaxed">{cs ? game.descriptionCs : game.description}</p>

                    {/* Score + play */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-xs text-gray-500">
                          {score > 0
                            ? <span style={{ color: game.color }}>{score} {cs ? 'bodů' : 'pts'}</span>
                            : (cs ? 'Ještě nehráno' : 'Not played yet')}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all group-hover:gap-3 group-hover:scale-105"
                        style={{
                          backgroundColor: `${game.color}25`,
                          color: game.color,
                          border: `1px solid ${game.color}40`,
                          boxShadow: `0 0 15px ${game.glowColor}20`,
                        }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {cs ? 'Hrát' : 'Play'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Floating particles on hover */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                  {[0, 1, 2, 3].map((i) => (
                    <motion.div
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: 2 + (i % 2),
                        height: 2 + (i % 2),
                        backgroundColor: game.glowColor,
                        left: `${20 + i * 25}%`,
                        bottom: 0,
                        opacity: 0,
                      }}
                      whileHover={{
                        y: -60 - i * 20,
                        opacity: [0, 0.8, 0],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
                    />
                  ))}
                </div>
              </motion.button>
            );
          })}
        </div>
        </div>

        {/* Coming soon teaser */}
        <div className="relative overflow-hidden rounded-2xl border border-dashed border-zion-purple/20 bg-gradient-to-r from-zion-purple/5 via-black/40 to-zion-cyan/5 p-6 text-center">
          <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, #8b5cf6, transparent 50%), radial-gradient(circle at 70% 50%, #06b6d4, transparent 50%)' }} />
          <p className="relative text-sm text-gray-400">
            {cs ? 'Další hry brzy... 🎮' : 'More games coming soon... 🎮'}
          </p>
          <p className="relative mt-1 text-[10px] text-gray-600">
            {cs ? 'Cosmic Tetris · Space Invaders · 2048 · a více' : 'Cosmic Tetris · Space Invaders · 2048 · and more'}
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── ZION Defense Wrapper (adds back button + mute) ───────────────────────────

function ZionDefenseWrapper({ onBack, muted, setMuted }: {
  onBack: () => void;
  muted: boolean;
  setMuted: (f: (m: boolean) => boolean) => void;
}) {
  return (
    <div className="relative min-h-screen bg-black">
      {/* Back bar */}
      <div className="absolute top-20 left-0 right-0 z-20 px-4">
        <div className="zion-container flex items-center justify-between">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Arcade
          </button>
          <button
            onClick={() => setMuted((m) => !m)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <ZionDefense />
    </div>
  );
}
