'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Volume2,
  VolumeX,
  Trophy,
  Play,
  Gamepad2,
  Sparkles,
  Swords,
  Zap,
  Shield,
  Heart,
  Lock,
  ExternalLink,
  Leaf,
  ArrowRight,
} from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { usePolling } from '@/hooks/usePolling';
import { ZionDefense } from './games/ZionDefense';
import { MiningSnake } from './games/MiningSnake';
import { BlockBreaker } from './games/BlockBreaker';
import { FlappyNode } from './games/FlappyNode';
import { StarMiner } from './games/StarMiner';
import ShowdownHero from '@/components/ShowdownHero';
import SpotifyBanner from '@/components/SpotifyBanner';
import StargatePortal from '@/components/StargatePortal';
import StargateLogo from '@/components/StargateLogo';

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
  {
    id: 'star-miner',
    title: 'Star Miner',
    emoji: '⭐',
    genre: 'Idle / Clicker',
    description: 'ZION\'s answer to Doge Miner 2. Mine on the star, build rigs, reach Issobella.',
    descriptionCs: 'ZION odpověď na Doge Miner 2. Těž na hvězdě, stavej rigy, dosáhni Issobelly.',
    color: '#9333ea',
    glowColor: '#a855f7',
    hsKey: 'star-miner-save',
    badge: 'NEW',
  },
];

// ─── Coming Soon games ────────────────────────────────────────────────────────

interface ComingSoonEntry {
  title: string;
  titleCs: string;
  emoji: string;
  description: string;
  descriptionCs: string;
  color: string;
}

const COMING_SOON: ComingSoonEntry[] = [
  {
    title: 'Doge Hunter',
    titleCs: 'Lovec Doge',
    emoji: '🐕',
    description: 'Hunt down rogue Doge transactions before they clog the mempool.',
    descriptionCs: 'Lov rogue Doge transakce než zahltí mempool.',
    color: '#f59e0b',
  },
  {
    title: 'Quantum Chess',
    titleCs: 'Kvantový Šach',
    emoji: '♟️',
    description: 'Chess with quantum moves — pieces can be in two places at once.',
    descriptionCs: 'Šachy s kvantovými tahy — figurky mohou být na dvou místech najednou.',
    color: '#9333ea',
  },
  {
    title: 'Bridge Runner',
    titleCs: 'Běžec přes Most',
    emoji: '🌉',
    description: 'Cross-chain obstacle course. Race assets from Base to ZION L1.',
    descriptionCs: 'Cross-chain překážková dráha. Přenes aktiva z Base na ZION L1.',
    color: '#06b6d4',
  },
];

// ─── Doge (hardcoded approximate values) ──────────────────────────────────────

const DOGE = {
  name: 'Dogecoin',
  ticker: 'DOGE',
  priceUsd: 0.12,
  supply: 10.8e9, // 10.8B DOGE
  blockTime: 60, // seconds
  algorithm: 'Scrypt PoW',
  hashrate: '500 KH/s',
  decimals: 8,
  txPerSec: 30,
};

// Doge at launch (December 2013) — ZION is at the same starting point
const DOGE_LAUNCH = {
  priceUsd: 0.0002, // Doge's actual launch price
  year: 2013,
  yearsAgo: 13,
  priceNow: 0.12, // 600x from launch
  multiplier: 600, // 0.12 / 0.0002
};

// ─── ZION defaults (overwritten by live API data) ─────────────────────────────

interface ZionStats {
  priceUsd: number;
  circulatingSupply: number; // in ZION units
  maxSupply: number;
  blockTime: number; // seconds
  algorithm: string;
  hashrate: string;
  hashrateRaw: number;
  decimals: number;
  txCount: number;
  blockHeight: number;
  connected: boolean;
}

const ZION_DEFAULT: ZionStats = {
  priceUsd: 0.0002,
  circulatingSupply: 16_280_000_000,
  maxSupply: 144_000_000_000,
  blockTime: 60,
  algorithm: 'Deeksha Lite v1',
  hashrate: '—',
  hashrateRaw: 0,
  decimals: 6,
  txCount: 0,
  blockHeight: 0,
  connected: false,
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatSupply(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(0);
}

function formatPrice(usd: number): string {
  if (usd >= 1) return `$${usd.toFixed(2)}`;
  if (usd >= 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(6)}`;
}

function formatMarketCap(price: number, supply: number): string {
  const cap = price * supply;
  if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
  if (cap >= 1e9) return `$${(cap / 1e9).toFixed(2)}B`;
  if (cap >= 1e6) return `$${(cap / 1e6).toFixed(2)}M`;
  if (cap >= 1e3) return `$${(cap / 1e3).toFixed(2)}K`;
  return `$${cap.toFixed(2)}`;
}

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
    } else if (game.id === 'star-miner') {
      try {
        const raw = localStorage.getItem(game.hsKey);
        if (raw) {
          const data = JSON.parse(raw);
          scores[game.id] = Math.floor(data.totalMined ?? 0);
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

// ─── Comparison metric row ────────────────────────────────────────────────────

interface MetricRow {
  label: string;
  labelCs: string;
  doge: string;
  zion: string;
}

function buildMetrics(doge: typeof DOGE, zion: ZionStats): MetricRow[] {
  const zionTxPerSec =
    zion.blockHeight > 0 && zion.blockTime > 0
      ? (zion.txCount / (zion.blockHeight * zion.blockTime)).toFixed(2)
      : '—';
  return [
    { label: 'Price', labelCs: 'Cena', doge: formatPrice(doge.priceUsd), zion: formatPrice(zion.priceUsd) },
    { label: 'Market Cap', labelCs: 'Tržní kap.', doge: formatMarketCap(doge.priceUsd, doge.supply), zion: formatMarketCap(zion.priceUsd, zion.circulatingSupply) },
    { label: 'Supply', labelCs: 'Dodávka', doge: `${formatSupply(doge.supply)} DOGE`, zion: `${formatSupply(zion.circulatingSupply)} / ${formatSupply(zion.maxSupply)} ZION` },
    { label: 'Block Time', labelCs: 'Čas bloku', doge: `${doge.blockTime}s`, zion: `${zion.blockTime}s` },
    { label: 'Algorithm', labelCs: 'Algoritmus', doge: doge.algorithm, zion: zion.algorithm },
    { label: 'Network Hashrate', labelCs: 'Hashrate sítě', doge: doge.hashrate, zion: zion.hashrate },
    { label: 'Decimals', labelCs: 'Desetinná místa', doge: `${doge.decimals}`, zion: `${zion.decimals}` },
    { label: 'TX/sec', labelCs: 'TX/sek', doge: `~${doge.txPerSec}`, zion: zionTxPerSec },
  ];
}

// ─── Battle Stats (fun) ───────────────────────────────────────────────────────

interface BattleStat {
  icon: typeof Trophy;
  claim: string;
  claimCs: string;
  winner: 'zion' | 'doge' | 'tie';
  winnerLabel: string;
  winnerLabelCs: string;
}

const BATTLE_STATS: BattleStat[] = [
  {
    icon: Zap,
    claim: `ZION is at $0.0002 — exactly where Doge was in December 2013. Doge did 600x since. History doesn't repeat, but it rhymes.`,
    claimCs: `ZION je na $0.0002 — přesně kde byl Doge v prosinci 2013. Doge od té doby udělal 600x. Historie se neopakuje, ale rýmuje.`,
    winner: 'zion',
    winnerLabel: 'ZION is at the starting line',
    winnerLabelCs: 'ZION je na startovní čáře',
  },
  {
    icon: Gamepad2,
    claim: 'ZION has Oasis — a UE5 metaverse with on-chain avatars, XP economy, and Golden Egg treasure. Doge has... a meme.',
    claimCs: 'ZION má Oasis — UE5 metaverse s on-chain avatary, XP ekonomií a Golden Egg pokladem. Doge má... mem.',
    winner: 'zion',
    winnerLabel: 'ZION wins on utility',
    winnerLabelCs: 'ZION vyhrává na užitku',
  },
  {
    icon: Heart,
    claim: 'ZION has a 5% humanitarian fund built into consensus. Doge has... a meme of a dog.',
    claimCs: 'ZION má 5% humanitární fond zabudovaný v konsenzu. Doge má... mem psa.',
    winner: 'zion',
    winnerLabel: 'ZION wins on impact',
    winnerLabelCs: 'ZION vyhrává na dopadu',
  },
  {
    icon: Shield,
    claim: 'ZION is quantum-resistant. Doge is Scrypt from 2013. Good luck with that, quantum computers.',
    claimCs: 'ZION je kvantově-odolný. Doge je Scrypt z roku 2013. Hodně štěstí, kvantové počítače.',
    winner: 'zion',
    winnerLabel: 'ZION wins on security',
    winnerLabelCs: 'ZION vyhrává na bezpečnosti',
  },
  {
    icon: Sparkles,
    claim: 'Doge has a Shiba Inu mascot that peaked in 2013. ZION has a stargate to six layers of reality.',
    claimCs: 'Doge má maskota Shiba Inu, který vrcholil v roce 2013. ZION má hvězdnou bránu do šesti vrstev reality.',
    winner: 'tie',
    winnerLabel: 'Tie on style (both iconic)',
    winnerLabelCs: 'Remíza na stylu (oba ikonické)',
  },
  {
    icon: Trophy,
    claim: 'Doge is on every exchange. ZION is building a bridge to Base. One is already there, the other is building the future.',
    claimCs: 'Doge je na každé burze. ZION buduje most na Base. Jeden už tam je, druhý buduje budoucnost.',
    winner: 'doge',
    winnerLabel: 'Doge wins on availability (for now)',
    winnerLabelCs: 'Doge vyhrává na dostupnosti (zatím)',
  },
];

// ─── ZION advantages ──────────────────────────────────────────────────────────

const ZION_ADVANTAGES: { icon: typeof Trophy; title: string; titleCs: string; desc: string; descCs: string }[] = [
  {
    icon: Zap,
    title: '6-Decimal Precision',
    titleCs: '6 desetinných míst',
    desc: 'Cleaner units — 1 ZION = 1,000,000 flowers. No awkward satoshi math.',
    descCs: 'Čistší jednotky — 1 ZION = 1 000 000 květin. Žádná neohrabaná satoshi matematika.',
  },
  {
    icon: Heart,
    title: 'Humanitarian Fund (5%)',
    titleCs: 'Humanitární fond (5%)',
    desc: 'Every block reward funds real-world humanitarian causes. Built into consensus.',
    descCs: 'Každá odměna za blok financuje skutečné humanitární projekty. Zabudováno v konsenzu.',
  },
  {
    icon: Sparkles,
    title: 'AI-Native',
    titleCs: 'AI-nativní',
    desc: 'Designed for AI workloads and inference economics from day one.',
    descCs: 'Navrženo pro AI zátěž a ekonomiku inference od prvního dne.',
  },
  {
    icon: Shield,
    title: 'Quantum-Resistant',
    titleCs: 'Kvantově-odolný',
    desc: 'Deeksha Lite PoW is built to survive the post-quantum era.',
    descCs: 'Deeksha Lite PoW je postaveno aby přežilo post-kvantovou éru.',
  },
  {
    icon: Gamepad2,
    title: 'ZION Oasis — L4 Game Layer',
    titleCs: 'ZION Oasis — L4 herní vrstva',
    desc: 'UE5 metaverse on ZION. On-chain avatars, XP economy, Golden Egg treasure, guild DAO.',
    descCs: 'UE5 metaverse na ZION. On-chain avatary, XP ekonomie, Golden Egg poklad, guild DAO.',
  },
  {
    icon: Trophy,
    title: 'Bridge to Base + DAO',
    titleCs: 'Most na Base + DAO',
    desc: 'wZION on Base L2 for DeFi liquidity. On-chain DAO governance steers the protocol.',
    descCs: 'wZION na Base L2 pro DeFi likviditu. On-chain DAO správa řídí protokol.',
  },
];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [highScores, setHighScores] = useState<Record<string, number>>(() => loadAllScores());
  const [zion, setZion] = useState<ZionStats>(ZION_DEFAULT);

  // Fetch ZION blockchain stats (15s polling)
  usePolling(async () => {
    try {
      const res = await fetch('/api/blockchain/stats', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setZion((prev) => ({
        ...prev,
        circulatingSupply: data.circulating_supply ?? prev.circulatingSupply,
        maxSupply: data.max_supply ?? data.total_supply ?? prev.maxSupply,
        blockTime: data.target_block_time ?? data.avg_block_time ?? prev.blockTime,
        hashrate: data.network_hashrate_formatted ?? prev.hashrate,
        hashrateRaw: data.network_hashrate ?? prev.hashrateRaw,
        txCount: data.tx_count ?? prev.txCount,
        blockHeight: data.block_height ?? data.total_blocks ?? prev.blockHeight,
        connected: data.connected ?? true,
      }));
    } catch { /* noop */ }
  }, 15_000);

  // Fetch ZION price (30s polling)
  usePolling(async () => {
    try {
      const res = await fetch('/api/defi/price', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      const usd = data?.price?.usd_per_wzion;
      if (typeof usd === 'number' && Number.isFinite(usd) && usd > 0) {
        setZion((prev) => ({ ...prev, priceUsd: usd }));
      }
    } catch { /* noop */ }
  }, 30_000);

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
  if (activeGame === 'star-miner') return <StarMiner onBack={backToHub} />;

  const metrics = buildMetrics(DOGE, zion);

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

        {/* ─── Hero — cosmic showdown ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden zion-rainbow-card"
          style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
        >
          {/* Cosmic showdown background */}
          <ShowdownHero className="absolute inset-0 h-full w-full" />

          {/* Overlay obsah */}
          <div className="relative z-10 flex flex-col items-center px-6 py-10 md:py-14 text-center">
            {/* Stargate — plný originál, úplně nahoře */}
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className="mb-4 w-full max-w-[360px]"
            >
              <StargateLogo className="w-full" />
            </motion.div>

            {/* Nápis pod stargatem */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="relative z-20 text-2xl md:text-3xl font-bold tracking-tight"
            >
              <span className="bg-gradient-to-r from-zion-gold via-zion-purple to-zion-cyan bg-clip-text text-transparent">
                {cs ? 'Showdown a Arkáda' : 'Showdown & Arcade'}
              </span>
            </motion.h2>

            {/* Titulek — split gradient: amber Doge vs purple ZION */}
            <motion.h1
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mt-6 text-5xl md:text-7xl font-black leading-tight tracking-tight"
            >
              <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">Doge</span>
              <span className="text-gray-500 mx-3 font-light">vs</span>
              <span className="bg-gradient-to-r from-purple-400 to-fuchsia-500 bg-clip-text text-transparent">ZION</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="mt-3 text-sm md:text-base text-gray-400 max-w-2xl leading-relaxed"
            >
              {cs
                ? 'ZION je na $0.0002 — přesně kde byl Doge v prosinci 2013. Ale ZION má Oasis, kvantovou odolnost a humanitární fond. Hraj a rozhodni kdo vyhraje.'
                : 'ZION is at $0.0002 — exactly where Doge was in December 2013. But ZION has Oasis, quantum resistance, and a humanitarian fund. Play and decide who wins.'}
            </motion.p>

            {/* Statistiky */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 }}
              className="mt-6 flex flex-wrap justify-center gap-3 text-xs"
            >
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                <Gamepad2 className="h-3.5 w-3.5 text-zion-cyan" />
                <span className="text-gray-300">{GAMES.length} {cs ? 'her' : 'games'}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-black/50 px-3 py-1.5 backdrop-blur-sm">
                <Trophy className="h-3.5 w-3.5 text-zion-gold" />
                <span className="text-gray-300">
                  {Object.values(highScores).reduce((a, b) => a + b, 0)} {cs ? 'bodů' : 'pts'}
                </span>
              </div>
              <div className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 backdrop-blur-sm ${zion.connected ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-white/10 bg-black/50'}`}>
                <span className={`h-2 w-2 rounded-full ${zion.connected ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                <span className="text-gray-300">{zion.connected ? (cs ? 'ZION online' : 'ZION live') : (cs ? 'ZION offline' : 'ZION offline')}</span>
              </div>
            </motion.div>
          </div>
        </motion.section>

        {/* ─── Spotify music banner ─── */}
        <SpotifyBanner cs={cs} />

        {/* ─── Doge vs ZION Comparison ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-section"
        >
          <div className="mb-6 flex items-center gap-3">
            <Swords className="h-6 w-6 text-zion-purple" />
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {cs ? 'Doge vs ZION — Srovnání' : 'Doge vs ZION — Comparison'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {cs ? 'Skutečná data ZION z API · Doge aprox. hodnoty' : 'Live ZION data from API · Doge approximate values'}
              </p>
            </div>
          </div>

          {/* Two columns with VS badge */}
          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* VS badge (center, desktop) */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/20 bg-black text-lg font-black text-white shadow-[0_0_30px_rgba(147,51,234,0.5)]"
              >
                VS
              </motion.div>
            </div>

            {/* Doge column (amber/gold) */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="zion-rainbow-card p-5"
              style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl bg-amber-500/15 border border-amber-500/40">
                  🐕
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-400">Dogecoin</h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">DOGE · Scrypt PoW</p>
                </div>
              </div>
              <div className="space-y-2">
                {metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span className="text-xs text-gray-500">{cs ? m.labelCs : m.label}</span>
                    <span className="text-xs font-semibold text-amber-300 text-right">{m.doge}</span>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* ZION column (purple/emerald) */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="zion-rainbow-card p-5"
              style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl bg-purple-500/15 border border-purple-500/40">
                  🌌
                </div>
                <div>
                  <h3 className="text-lg font-bold text-purple-400">ZION</h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">ZION · Deeksha Lite · {zion.connected ? 'LIVE' : 'OFFLINE'}</p>
                </div>
              </div>
              <div className="space-y-2">
                {metrics.map((m) => (
                  <div key={m.label} className="flex items-center justify-between border-b border-white/5 pb-1.5">
                    <span className="text-xs text-gray-500">{cs ? m.labelCs : m.label}</span>
                    <span className="text-xs font-semibold text-emerald-300 text-right">{m.zion}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Doge 2013 → Now callout — ZION is at the same starting point */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.15 }}
            className="mt-4 relative overflow-hidden rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-purple-500/5 to-amber-500/5 p-5"
          >
            <div className="flex flex-col md:flex-row items-center gap-4 md:gap-6">
              {/* Left: Doge 2013 */}
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-lg">
                  🐕
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-400">Doge · Dec 2013</p>
                  <p className="text-lg font-black text-amber-300">$0.0002</p>
                </div>
              </div>

              {/* Center: arrow + multiplier */}
              <div className="flex flex-col items-center">
                <motion.div
                  animate={{ x: [0, 5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                  className="text-2xl text-gray-500"
                >
                  →
                </motion.div>
                <p className="text-xs font-bold text-emerald-400 mt-1">600x</p>
                <p className="text-[10px] text-gray-500">{cs ? 'za 13 let' : 'in 13 years'}</p>
              </div>

              {/* Right: Doge now */}
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/15 border border-amber-500/30 text-lg">
                  🐕
                </div>
                <div>
                  <p className="text-xs font-bold text-amber-400">Doge · 2026</p>
                  <p className="text-lg font-black text-amber-300">$0.12</p>
                </div>
              </div>

              {/* Divider */}
              <div className="hidden md:block h-12 w-px bg-white/10" />

              {/* ZION now = Doge 2013 */}
              <div className="flex items-center gap-3 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/15 border border-purple-500/30 text-lg">
                  🌌
                </div>
                <div>
                  <p className="text-xs font-bold text-purple-400">ZION · dnes</p>
                  <p className="text-lg font-black text-purple-300">$0.0002</p>
                </div>
              </div>
            </div>

            <p className="mt-4 text-center text-xs text-gray-400 leading-relaxed">
              {cs
                ? 'ZION je dnes přesně kde byl Doge v prosinci 2013. Stejná cena, stejný start. Ale ZION má navíc: kvantovou odolnost, humanitární fond, AI-nativní design a Oasis metaverse. Historie se neopakuje — ale rýmuje.'
                : 'ZION today is exactly where Doge was in December 2013. Same price, same starting line. But ZION has more: quantum resistance, humanitarian fund, AI-native design, and the Oasis metaverse. History doesn\'t repeat — but it rhymes.'}
            </p>
          </motion.div>

          {/* ZION advantages callout */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.2 }}
            className="mt-6 zion-rainbow-sub p-5"
            style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
          >
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-400" />
              {cs ? 'Výhody ZION' : 'ZION Advantages'}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {ZION_ADVANTAGES.map((adv) => {
                const Icon = adv.icon;
                return (
                  <div key={adv.title} className="flex items-start gap-2.5 rounded-lg border border-white/5 bg-black/30 p-3">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
                    <div>
                      <p className="text-xs font-semibold text-white">{cs ? adv.titleCs : adv.title}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5 leading-relaxed">{cs ? adv.descCs : adv.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        </motion.section>

        {/* ─── Battle Stats (fun) ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-section"
        >
          <div className="mb-6 flex items-center gap-3">
            <Trophy className="h-6 w-6 text-zion-gold" />
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {cs ? 'Bitvní Statistiky' : 'Battle Stats'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {cs ? 'Hravé srovnání — kdo vyhrává?' : 'A playful showdown — who wins?'}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {BATTLE_STATS.map((stat, idx) => {
              const Icon = stat.icon;
              const isZionWin = stat.winner === 'zion';
              const isDogeWin = stat.winner === 'doge';
              const isTie = stat.winner === 'tie';
              const winnerColor = isZionWin ? 'text-emerald-400' : isDogeWin ? 'text-amber-400' : 'text-gray-400';
              const winnerBg = isZionWin ? 'border-emerald-500/30 bg-emerald-500/5' : isDogeWin ? 'border-amber-500/30 bg-amber-500/5' : 'border-white/10 bg-black/30';
              return (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: idx * 0.08 }}
                  className={`flex items-center gap-4 rounded-xl border p-4 ${winnerBg}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 border border-white/10">
                    <Icon className={`h-5 w-5 ${winnerColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200">{cs ? stat.claimCs : stat.claim}</p>
                    <p className={`text-xs font-bold mt-0.5 ${winnerColor}`}>
                      {isZionWin && '🏆 '}
                      {isDogeWin && '🐶 '}
                      {isTie && '🤝 '}
                      {cs ? stat.winnerLabelCs : stat.winnerLabel}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.section>

        {/* ─── The Original (Doge Miner 2 vs Star Miner) ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-section"
        >
          <div className="mb-6 flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-amber-400" />
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">
                {cs ? 'Originál' : 'The Original'}
              </h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {cs ? 'Kde to všechno začalo — a ZION odpověď' : 'Where it all began — and the ZION answer'}
              </p>
            </div>
          </div>

          <div className="relative grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
            {/* VS badge (center, desktop) */}
            <div className="hidden md:flex absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 items-center justify-center">
              <motion.div
                initial={{ scale: 0, rotate: -90 }}
                whileInView={{ scale: 1, rotate: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
                className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-white/20 bg-black text-sm font-black text-white shadow-[0_0_24px_rgba(245,158,11,0.4)]"
              >
                VS
              </motion.div>
            </div>

            {/* Doge Miner 2 (amber/gold) */}
            <motion.a
              href="https://dogeminer2.com"
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group zion-rainbow-card p-5 transition-all hover:scale-[1.02]"
              style={{ '--rc': '245, 158, 11' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl bg-amber-500/15 border border-amber-500/40">
                  🐕
                </div>
                <div>
                  <h3 className="text-lg font-bold text-amber-400">Doge Miner 2</h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{cs ? 'Legendární klikárna' : 'Legendary clicker'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                {cs
                  ? 'Legendární klikárna, která to všechno začala. Těž Dogecoiny, najmi psy, let na měsíc. 100% time-waster, 0% kvantová odolnost.'
                  : 'The legendary clicker that started it all. Mine Dogecoins, hire dogs, go to the moon. 100% time-waster, 0% quantum resistance.'}
              </p>
              <div
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all group-hover:gap-3"
                style={{
                  backgroundColor: 'rgba(245,158,11,0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245,158,11,0.4)',
                }}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {cs ? 'Hrát externě' : 'Play External'}
              </div>
            </motion.a>

            {/* Star Miner (purple) */}
            <motion.button
              onClick={() => setActiveGame('star-miner')}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="group relative overflow-hidden zion-rainbow-card p-5 text-left transition-all hover:scale-[1.02]"
              style={{ '--rc': '147, 51, 234' } as React.CSSProperties}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl bg-purple-500/15 border border-purple-500/40">
                  ⭐
                </div>
                <div>
                  <h3 className="text-lg font-bold text-purple-400">Star Miner</h3>
                  <p className="text-[10px] uppercase tracking-widest text-gray-500">{cs ? 'ZION odpověď' : 'ZION answer'}</p>
                </div>
              </div>
              <p className="text-xs text-gray-400 leading-relaxed mb-4">
                {cs
                  ? 'ZION odpověď na Doge Miner 2. Těž na hvězdě, stavej rigy od CPU po Cosmic Harmony, dosáhni Issobelly. 100% time-waster, 100% kvantová odolnost.'
                  : "ZION's answer to Doge Miner 2. Mine on the star, build rigs from CPU to Cosmic Harmony, reach Issobella. 100% time-waster, 100% quantum resistance."}
              </p>
              <div
                className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold transition-all group-hover:gap-3"
                style={{
                  backgroundColor: 'rgba(147,51,234,0.2)',
                  color: '#a855f7',
                  border: '1px solid rgba(147,51,234,0.4)',
                }}
              >
                <Play className="h-3.5 w-3.5" />
                {cs ? 'Hrát' : 'Play'}
              </div>
            </motion.button>
          </div>
        </motion.section>

        {/* ─── ZION Arcade (games) ─── */}
        <div>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zion-purple/40 to-transparent" />
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-2">
                <Gamepad2 className="h-5 w-5 text-zion-purple" />
                <h2 className="text-lg font-bold text-white tracking-wide">
                  {cs ? 'ZION Arkáda' : 'ZION Arcade'}
                </h2>
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {cs ? 'Hraj hry, získej slávu, braň síť' : 'Play games, earn glory, defend the network'}
              </p>
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
                className="group relative overflow-hidden zion-rainbow-sub p-6 text-left transition-all hover:scale-[1.02]"
                style={{ '--rc': '245, 158, 11', boxShadow: `0 0 0 0 ${game.color}00` } as React.CSSProperties}
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

        {/* ─── Coming Soon (locked teasers) ─── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="zion-section"
        >
          <div className="mb-4 flex items-center gap-3">
            <Lock className="h-5 w-5 text-gray-500" />
            <div>
              <h2 className="text-lg font-bold text-white tracking-wide">
                {cs ? 'Již brzy' : 'Coming Soon'}
              </h2>
              <p className="text-[11px] text-gray-500 mt-0.5">
                {cs ? 'Další hry na horizontu' : 'More games on the horizon'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COMING_SOON.map((game, idx) => (
              <motion.div
                key={game.title}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: idx * 0.1 }}
                className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-5 opacity-70"
                style={{ '--rc': game.color } as React.CSSProperties}
              >
                {/* Lock overlay */}
                <div className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 border border-white/10">
                  <Lock className="h-4 w-4 text-gray-500" />
                </div>

                {/* Subtle color glow */}
                <div
                  className="absolute -bottom-8 -right-8 h-24 w-24 rounded-full opacity-10 blur-2xl"
                  style={{ backgroundColor: game.color }}
                />

                <div className="relative flex items-center gap-3 mb-3">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl grayscale"
                    style={{
                      backgroundColor: `${game.color}15`,
                      border: `1px solid ${game.color}30`,
                    }}
                  >
                    {game.emoji}
                  </div>
                  <h3 className="text-base font-bold text-gray-400">{cs ? game.titleCs : game.title}</h3>
                </div>
                <p className="relative text-xs text-gray-500 leading-relaxed">{cs ? game.descriptionCs : game.description}</p>
                <p className="relative mt-3 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
                  {cs ? 'Zamčeno · brzy' : 'Locked · soon'}
                </p>
              </motion.div>
            ))}
          </div>
        </motion.section>

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
