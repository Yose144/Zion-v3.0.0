'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, Trophy, Play } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { ZionDefense } from './games/ZionDefense';
import { MiningSnake } from './games/MiningSnake';
import { BlockBreaker } from './games/BlockBreaker';
import { FlappyNode } from './games/FlappyNode';

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

        {/* Title */}
        <div className="text-center">
          <h1 className="text-3xl md:text-5xl font-bold text-gradient">ZION Arcade</h1>
          <p className="mt-2 text-sm text-gray-500">
            {cs ? 'ZION-themed hry. Od tower defense po retro klasiky.' : 'ZION-themed games. From tower defense to retro classics.'}
          </p>
          <div className="mt-3 flex justify-center gap-6 text-xs text-gray-600">
            <span>{GAMES.length} {cs ? 'her' : 'games'}</span>
            <span className="flex items-center gap-1"><Trophy className="h-3 w-3" /> {Object.values(highScores).reduce((a, b) => a + b, 0)} {cs ? 'celkem bodů' : 'total points'}</span>
          </div>
        </div>

        {/* Game cards grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {GAMES.map((game) => {
            const score = highScores[game.id] ?? 0;
            return (
              <button
                key={game.id}
                onClick={() => setActiveGame(game.id)}
                className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/60 p-6 text-left transition-all hover:border-white/20 hover:bg-white/5"
              >
                {/* Glow effect */}
                <div
                  className="absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-10 blur-2xl transition-opacity group-hover:opacity-20"
                  style={{ backgroundColor: game.color }}
                />

                <div className="relative flex items-start gap-4">
                  {/* Game icon */}
                  <div
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl text-3xl"
                    style={{
                      backgroundColor: `${game.color}20`,
                      border: `1px solid ${game.color}40`,
                      boxShadow: `0 0 20px ${game.glowColor}30`,
                    }}
                  >
                    {game.emoji}
                  </div>

                  {/* Game info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{game.title}</h3>
                      {game.badge && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                          style={{ backgroundColor: `${game.color}30`, color: game.color }}
                        >
                          {game.badge}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] uppercase tracking-wider text-gray-600 mt-0.5">{game.genre}</p>
                    <p className="mt-2 text-xs text-gray-400">{cs ? game.descriptionCs : game.description}</p>

                    {/* Score + play */}
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-gray-600" />
                        <span className="text-xs text-gray-500">
                          {score > 0 ? `${score} ${cs ? 'bodů' : 'pts'}` : (cs ? 'Ještě nehráno' : 'Not played yet')}
                        </span>
                      </div>
                      <div
                        className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all group-hover:gap-2.5"
                        style={{ backgroundColor: `${game.color}20`, color: game.color }}
                      >
                        <Play className="h-3.5 w-3.5" />
                        {cs ? 'Hrát' : 'Play'}
                      </div>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Coming soon teaser */}
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/3 p-6 text-center">
          <p className="text-sm text-gray-600">
            {cs ? 'Další hry brzy... 🎮' : 'More games coming soon... 🎮'}
          </p>
          <p className="mt-1 text-[10px] text-gray-700">
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
