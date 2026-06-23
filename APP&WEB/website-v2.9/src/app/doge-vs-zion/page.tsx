'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeft,
  Trophy,
  Zap,
  Shield,
  Coins,
  Rocket,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';
import { useLang } from '@/contexts/LanguageContext';

const ZION_POWER = 5; // each ZION click = 5 points (5/5 multisig)
const DOGE_POWER = 1; // each Doge click = 1 point (1 sig)
const WIN_SCORE = 100_000_000; // 100M ZION locked

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [dogeScore, setDogeScore] = useState(0);
  const [zionScore, setZionScore] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [combo, setCombo] = useState(0);
  const [floatingTexts, setFloatingTexts] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [nextId, setNextId] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!startTime) return;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [startTime]);

  const addFloating = (x: number, y: number, text: string, color: string) => {
    const id = nextId;
    setNextId((n) => n + 1);
    setFloatingTexts((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => {
      setFloatingTexts((prev) => prev.filter((f) => f.id !== id));
    }, 900);
  };

  const handleDogeClick = (e: React.MouseEvent) => {
    if (!startTime) setStartTime(Date.now());
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    addFloating(rect.left + rect.width / 2, rect.top, '+1 DOGE', 'text-amber-300');
    setDogeScore((s) => s + DOGE_POWER);
    setClicks((c) => c + 1);
  };

  const handleZionClick = (e: React.MouseEvent) => {
    if (!startTime) setStartTime(Date.now());
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const phrases = cs
      ? ['+5 ZION', 'Much sig', 'Very 5/5', 'WOW', 'To Base!', '+5/5']
      : ['+5 ZION', 'Much sig', 'Very 5/5', 'WOW', 'To Base!', '+5/5'];
    addFloating(rect.left + rect.width / 2, rect.top, phrases[Math.floor(Math.random() * phrases.length)], 'text-emerald-300');
    setZionScore((s) => s + ZION_POWER);
    setClicks((c) => c + 1);
    setCombo((c) => c + 1);
  };

  const reset = () => {
    setDogeScore(0);
    setZionScore(0);
    setClicks(0);
    setCombo(0);
    setStartTime(null);
    setElapsed(0);
  };

  const zionWon = zionScore >= WIN_SCORE;

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-24 pt-28 md:pt-32">
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: `${1 + (i % 2)}px`,
              height: `${1 + (i % 2)}px`,
              top: `${(i * 17.3) % 100}%`,
              left: `${(i * 29.7) % 100}%`,
            }}
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.3, 1] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-8">
        {/* Header */}
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět na homepage' : 'Back to homepage'}
        </Link>

        <section className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10"
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1 text-xs font-semibold tracking-widest text-amber-300 uppercase mb-4">
              <Sparkles className="h-4 w-4" />
              {cs ? 'Prdelka & Meme Lab' : 'Fun & Meme Lab'}
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-gradient leading-tight">
              {cs ? 'Doge vs ZION Click Battle' : 'Doge vs ZION Click Battle'}
            </h1>
            <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
              {cs
                ? 'Kdo zamkne 100M ZION na Base první? Doge má 1 podpis, ZION má 5/5 multisig. Klikej a pomoz ZIONu vyhrát!'
                : 'Who locks 100M ZION on Base first? Doge has 1 signature, ZION has 5/5 multisig. Click to help ZION win!'}
            </p>
          </motion.div>
        </section>

        {/* Scoreboard */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <ScoreCard
            icon={Coins}
            label={cs ? 'Doge score' : 'Doge score'}
            value={dogeScore.toLocaleString()}
            color="text-amber-300"
            border="border-amber-400/20"
          />
          <ScoreCard
            icon={Rocket}
            label={cs ? 'ZION score' : 'ZION score'}
            value={zionScore.toLocaleString()}
            color="text-emerald-300"
            border="border-emerald-400/20"
          />
          <ScoreCard
            icon={Zap}
            label={cs ? 'Kliky' : 'Clicks'}
            value={clicks.toLocaleString()}
            color="text-zion-gold"
            border="border-zion-gold/20"
          />
          <ScoreCard
            icon={Shield}
            label={cs ? 'ZION combo' : 'ZION combo'}
            value={combo.toLocaleString()}
            color="text-cyan-300"
            border="border-cyan-400/20"
          />
        </section>

        {/* Progress to 100M */}
        <section className="rounded-3xl border border-white/10 bg-black/60 p-6">
          <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
            <span>{cs ? 'Cíl: 100M ZION zamčeno' : 'Goal: 100M ZION locked'}</span>
            <span>{Math.min(100, Math.round((zionScore / WIN_SCORE) * 100))}%</span>
          </div>
          <div className="h-4 rounded-full bg-white/5 overflow-hidden border border-white/10">
            <motion.div
              className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (zionScore / WIN_SCORE) * 100)}%` }}
              transition={{ type: 'spring', stiffness: 80 }}
            />
          </div>
          <p className="mt-2 text-[10px] text-gray-500">
            {cs ? 'Každý klik na ZION = 5 bodů (5/5 sigs). Každý klik na Doge = 1 bod (1 sig).' : 'Each ZION click = 5 points (5/5 sigs). Each Doge click = 1 point (1 sig).'}
          </p>
        </section>

        {/* Battle arena */}
        <section className="relative rounded-3xl border border-white/10 bg-black/60 p-6 md:p-10">
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-12">
            {/* Doge clicker */}
            <motion.button
              onClick={handleDogeClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92, rotate: -5 }}
              className="relative flex h-44 w-44 md:h-56 md:w-56 items-center justify-center rounded-full border-4 border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-amber-700/20 shadow-[0_20px_80px_rgba(245,158,11,0.3)] transition-shadow hover:shadow-[0_30px_100px_rgba(245,158,11,0.45)] active:shadow-[0_10px_40px_rgba(245,158,11,0.2)]"
            >
              <Image
                src="/dogecoin-logo.png"
                alt="Dogecoin"
                width={160}
                height={160}
                className="h-28 w-28 md:h-36 md:w-36 object-contain drop-shadow-2xl"
              />
              <span className="absolute -bottom-3 rounded-full border border-white/10 bg-black/80 px-3 py-1 text-xs font-bold text-amber-300">
                Doge
              </span>
            </motion.button>

            {/* VS center */}
            <div className="flex flex-col items-center gap-2">
              <div className="rounded-full border border-white/10 bg-black/70 px-4 py-1 text-sm font-bold text-white/80 backdrop-blur-sm">
                VS
              </div>
              <div className="h-16 w-px bg-gradient-to-b from-amber-400/40 via-white/20 to-emerald-400/40 md:h-24" />
              <p className="text-[10px] text-gray-500 text-center max-w-[140px]">
                {cs ? 'Klikni na svého šampióna' : 'Click your champion'}
              </p>
            </div>

            {/* ZION clicker */}
            <motion.button
              onClick={handleZionClick}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92, rotate: 5 }}
              className="relative flex h-44 w-44 md:h-56 md:w-56 items-center justify-center rounded-full border-4 border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20 shadow-[0_20px_80px_rgba(16,185,129,0.3)] transition-shadow hover:shadow-[0_30px_100px_rgba(16,185,129,0.45)] active:shadow-[0_10px_40px_rgba(16,185,129,0.2)]"
            >
              <span className="text-7xl md:text-8xl drop-shadow-2xl">🚀</span>
              <span className="absolute -bottom-3 rounded-full border border-white/10 bg-black/80 px-3 py-1 text-xs font-bold text-emerald-300">
                ZION
              </span>
            </motion.button>
          </div>

          {/* Floating texts */}
          <AnimatePresence>
            {floatingTexts.map((ft) => (
              <motion.div
                key={ft.id}
                initial={{ opacity: 1, x: ft.x, y: ft.y, scale: 0.8 }}
                animate={{ opacity: 0, y: ft.y - 80, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`pointer-events-none fixed z-50 text-lg font-bold ${ft.color} drop-shadow-lg`}
              >
                {ft.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        {/* Win overlay */}
        <AnimatePresence>
          {zionWon && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <div className="max-w-md rounded-3xl border border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20 p-8 text-center shadow-[0_30px_100px_rgba(16,185,129,0.4)]">
                <Trophy className="mx-auto h-12 w-12 text-emerald-300 mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  {cs ? '100M ZION zamčeno! 🎉' : '100M ZION locked! 🎉'}
                </h2>
                <p className="text-sm text-gray-300 mb-4">
                  {cs
                    ? `ZION vyhrál za ${elapsed}s a ${clicks} kliky. 5/5 multisig > 1 sig. Much wow!`
                    : `ZION won in ${elapsed}s with ${clicks} clicks. 5/5 multisig > 1 sig. Much wow!`}
                </p>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={reset}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
                  >
                    <RefreshCw className="h-4 w-4" />
                    {cs ? 'Znovu' : 'Play again'}
                  </button>
                  <Link
                    href="/defi"
                    className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors"
                  >
                    {cs ? 'Jdi do DeFi' : 'Go to DeFi'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Rules / meme box */}
        <section className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <h2 className="text-lg font-semibold text-white mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-zion-gold" />
            {cs ? 'Pravidla prdelky' : 'Fun rules'}
          </h2>
          <ul className="space-y-2 text-sm text-gray-400">
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
              {cs ? 'Doge = 1 bod = legacy single-sig energy' : 'Doge = 1 point = legacy single-sig energy'}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              {cs ? 'ZION = 5 bodů = 5/5 multisig power' : 'ZION = 5 points = 5/5 multisig power'}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-zion-gold" />
              {cs ? 'Cíl: 100 000 000 ZION zamčeno na Base' : 'Goal: 100,000,000 ZION locked on Base'}
            </li>
            <li className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
              {cs ? 'Tip: ZION má 5x sílu, protože 5 validátorů > 1 Doge' : 'Tip: ZION is 5x stronger because 5 validators > 1 Doge'}
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}

function ScoreCard({
  icon: Icon,
  label,
  value,
  color,
  border,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  color: string;
  border: string;
}) {
  return (
    <div className={`rounded-2xl border ${border} bg-black/60 p-4 backdrop-blur-xl`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className={`text-xl font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
