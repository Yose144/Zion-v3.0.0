'use client';

import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useRef, useCallback } from 'react';
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
  Gamepad2,
  Gamepad,
  Flame,
  Moon,
  Mountain,
  Gem,
  Star,
  CircleDot,
  Square,
} from 'lucide-react';
import Image from 'next/image';
import { useLang } from '@/contexts/LanguageContext';

const ZION_BASE = 5;
const DOGE_BASE = 1;
const GOAL = 100_000_000;

export default function DogeVsZionPage() {
  const { lang } = useLang();
  const cs = lang === 'cs';

  const [dogePos, setDogePos] = useState(0);
  const [zionPos, setZionPos] = useState(0);
  const [clicks, setClicks] = useState(0);
  const [combo, setCombo] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [gameOver, setGameOver] = useState<'zion' | 'doge' | null>(null);
  const [floating, setFloating] = useState<{ id: number; x: number; y: number; text: string; color: string }[]>([]);
  const [nextId, setNextId] = useState(0);
  const [powerUps, setPowerUps] = useState<{ id: number; x: number; type: 'oasis' | 'gem' | 'flame' | 'star' }[]>([]);
  const [activeMiniGame, setActiveMiniGame] = useState<'pong' | 'breakout' | 'snake' | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const comboRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!startTime) return;
    const t = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startTime]);

  useEffect(() => {
    if (combo <= 0) return;
    const t = setInterval(() => setComboTimer((v) => (v > 0 ? v - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, [combo]);

  useEffect(() => {
    if (comboTimer <= 0 && combo > 0) {
      setCombo(0);
    }
  }, [comboTimer, combo]);

  useEffect(() => {
    const spawn = setInterval(() => {
      if (gameOver) return;
      setPowerUps((prev) => {
        if (prev.length > 4) return prev;
        const types: ('oasis' | 'gem' | 'flame' | 'star')[] = ['oasis', 'gem', 'flame', 'star'];
        const type = types[Math.floor(Math.random() * types.length)];
        return [...prev, { id: Date.now() + Math.random(), x: 10 + Math.random() * 80, type }];
      });
    }, 2500);
    return () => clearInterval(spawn);
  }, [gameOver]);

  const addFloat = (x: number, y: number, text: string, color: string) => {
    const id = nextId;
    setNextId((n) => n + 1);
    setFloating((prev) => [...prev, { id, x, y, text, color }]);
    setTimeout(() => setFloating((prev) => prev.filter((f) => f.id !== id)), 900);
  };

  const reset = () => {
    setDogePos(0);
    setZionPos(0);
    setClicks(0);
    setCombo(0);
    setComboTimer(0);
    setStartTime(null);
    setElapsed(0);
    setGameOver(null);
    setPowerUps([]);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (comboRef.current) clearTimeout(comboRef.current);
  };

  const handleZionClick = (e: React.MouseEvent) => {
    if (gameOver) return;
    if (!startTime) setStartTime(Date.now());
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    addFloat(rect.left + rect.width / 2, rect.top, '+5 ZION', 'text-emerald-300');

    const multiplier = 1 + Math.floor(combo / 5) * 0.2;
    const gain = Math.round(ZION_BASE * multiplier);
    setZionPos((p) => {
      const np = p + gain;
      if (np >= GOAL) {
        setGameOver('zion');
        return GOAL;
      }
      return np;
    });
    setClicks((c) => c + 1);
    setCombo((c) => c + 1);
    setComboTimer(3);
  };

  const handleDogeClick = (e: React.MouseEvent) => {
    if (gameOver) return;
    if (!startTime) setStartTime(Date.now());
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    addFloat(rect.left + rect.width / 2, rect.top, '+1 DOGE', 'text-amber-300');
    setDogePos((p) => {
      const np = p + DOGE_BASE + Math.floor(zionPos / 20_000_000) * 2;
      if (np >= GOAL) {
        setGameOver('doge');
        return GOAL;
      }
      return np;
    });
    setClicks((c) => c + 1);
  };

  const handlePowerUp = (id: number, type: string, x: number, y: number) => {
    setPowerUps((prev) => prev.filter((p) => p.id !== id));
    let bonus = 0;
    let text = '';
    let color = 'text-zion-gold';
    if (type === 'oasis') { bonus = 250_000; text = '+250K Oasis!'; color = 'text-purple-300'; }
    if (type === 'gem') { bonus = 100_000; text = '+100K Gem'; color = 'text-cyan-300'; }
    if (type === 'flame') { bonus = 50_000; text = '+50K Fire!'; color = 'text-orange-300'; }
    if (type === 'star') { bonus = 500_000; text = '+500K Star!'; color = 'text-yellow-300'; }
    addFloat(x, y, text, color);
    setZionPos((p) => Math.min(GOAL, p + bonus));
  };

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pb-24 pt-28 md:pt-32">
      {/* Starfield */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        {Array.from({ length: 40 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-white"
            style={{ width: `${1 + (i % 2)}px`, height: `${1 + (i % 2)}px`, top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%` }}
            animate={{ opacity: [0.1, 0.5, 0.1], scale: [1, 1.3, 1] }}
            transition={{ duration: 2 + (i % 4), repeat: Infinity, delay: i * 0.1 }}
          />
        ))}
      </div>

      <div className="relative z-10 zion-container max-w-6xl space-y-8">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="h-4 w-4" />
          {cs ? 'Zpět na homepage' : 'Back to homepage'}
        </Link>

        <HeroSection cs={cs} />
        <ScoreBoard cs={cs} dogePos={dogePos} zionPos={zionPos} clicks={clicks} combo={combo} comboTimer={comboTimer} elapsed={elapsed} />

        {/* Race track */}
        <section className="relative rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Rocket className="h-5 w-5 text-emerald-400" />
              {cs ? 'Závod na 100M' : 'Race to 100M'}
            </h2>
            <span className="text-xs text-gray-500">
              {cs ? `Combo x${(1 + Math.floor(combo / 5) * 0.2).toFixed(1)}` : `Combo x${(1 + Math.floor(combo / 5) * 0.2).toFixed(1)}`}
            </span>
          </div>

          {/* Progress bar track */}
          <div className="relative mb-8">
            <div className="h-3 rounded-full bg-white/5 overflow-hidden border border-white/10">
              <div className="relative h-full w-full">
                <motion.div className="absolute left-0 top-0 h-full bg-gradient-to-r from-amber-400 to-amber-600" style={{ width: `${(dogePos / GOAL) * 100}%` }} />
                <motion.div className="absolute left-0 top-0 h-full bg-gradient-to-r from-emerald-400 to-cyan-400" style={{ width: `${(zionPos / GOAL) * 100}%` }} />
              </div>
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-gray-500">
              <span>0</span>
              <span>25M</span>
              <span>50M</span>
              <span>75M</span>
              <span>100M</span>
            </div>
          </div>

          {/* Power-ups on track */}
          <div className="relative h-16 mb-6 rounded-2xl border border-white/10 bg-white/3 overflow-hidden">
            {powerUps.map((p) => (
              <PowerUpOrb key={p.id} data={p} onClick={handlePowerUp} />
            ))}
            <div className="absolute inset-0 flex items-center justify-center text-[10px] text-white/20">
              {cs ? 'Klikej na power-upy nad tratí' : 'Click power-ups above the track'}
            </div>
          </div>

          {/* Click arena */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-6 md:gap-10">
            <ClickAvatar
              src="/dogecoin-logo.png"
              alt="Dogecoin"
              label="Doge"
              sublabel={cs ? '1 sig / klik' : '1 sig / click'}
              color="amber"
              onClick={handleDogeClick}
            />

            <div className="text-center">
              <div className="rounded-full border border-white/10 bg-black/70 px-4 py-1 text-sm font-bold text-white/80">VS</div>
              <p className="mt-2 text-[10px] text-gray-500">{cs ? 'Klikej pro turbo' : 'Click for turbo'}</p>
            </div>

            <ClickAvatar
              emoji="🚀"
              label="ZION"
              sublabel={cs ? `5 sigs / klik (combo ${combo})` : `5 sigs / click (combo ${combo})`}
              color="emerald"
              onClick={handleZionClick}
            />
          </div>

          {/* Floating texts */}
          <AnimatePresence>
            {floating.map((f) => (
              <motion.div
                key={f.id}
                initial={{ opacity: 1, x: f.x, y: f.y, scale: 0.8 }}
                animate={{ opacity: 0, y: f.y - 80, scale: 1.2 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`pointer-events-none fixed z-50 text-lg font-bold ${f.color} drop-shadow-lg`}
              >
                {f.text}
              </motion.div>
            ))}
          </AnimatePresence>
        </section>

        {/* Win overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            >
              <div className={`max-w-md rounded-3xl border p-8 text-center shadow-[0_30px_100px_rgba(0,0,0,0.5)] ${gameOver === 'zion' ? 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/20 to-zion-cyan/20' : 'border-amber-400/30 bg-gradient-to-br from-amber-500/20 to-orange-700/20'}`}>
                <Trophy className={`mx-auto h-12 w-12 mb-4 ${gameOver === 'zion' ? 'text-emerald-300' : 'text-amber-300'}`} />
                <h2 className="text-2xl font-bold text-white mb-2">
                  {gameOver === 'zion' ? (cs ? 'ZION vyhrál! 🚀' : 'ZION wins! 🚀') : (cs ? 'Doge vyhrál! 🐕' : 'Doge wins! 🐕')}
                </h2>
                <p className="text-sm text-gray-300 mb-4">
                  {gameOver === 'zion'
                    ? (cs ? `100M ZION zamčeno za ${elapsed}s přes ${clicks} kliků. Much wow!` : `100M ZION locked in ${elapsed}s with ${clicks} clicks. Much wow!`)
                    : (cs ? `Doge předběhl ZION. Zkus boostovat Oasis!` : `Doge overtook ZION. Try boosting with Oasis!`)}
                </p>
                <div className="flex gap-3 justify-center">
                  <button onClick={reset} className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-white/10 transition-colors">
                    <RefreshCw className="h-4 w-4" /> {cs ? 'Znovu' : 'Play again'}
                  </button>
                  <Link href="/defi" className="inline-flex items-center gap-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 px-5 py-2.5 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 transition-colors">
                    {cs ? 'DeFi Hub' : 'DeFi Hub'}
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Arcade hall */}
        <section className="rounded-3xl border border-white/10 bg-black/60 p-6 md:p-8">
          <div className="mb-6 flex items-center gap-3">
            <Gamepad2 className="h-6 w-6 text-zion-purple" />
            <h2 className="text-xl font-bold text-white">{cs ? 'Retro Arcade Hala' : 'Retro Arcade Hall'}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <ArcadeCard title={cs ? 'Pong' : 'Pong'} icon={CircleDot} color="text-zion-cyan" onClick={() => setActiveMiniGame('pong')} />
            <ArcadeCard title={cs ? 'Breakout' : 'Breakout'} icon={Square} color="text-zion-gold" onClick={() => setActiveMiniGame('breakout')} />
            <ArcadeCard title={cs ? 'Snake' : 'Snake'} icon={Gamepad} color="text-emerald-400" onClick={() => setActiveMiniGame('snake')} />
          </div>

          {activeMiniGame && (
            <div className="rounded-2xl border border-white/10 bg-black/80 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold text-white uppercase tracking-wider">
                  {activeMiniGame === 'pong' && 'Pong'}
                  {activeMiniGame === 'breakout' && 'Breakout'}
                  {activeMiniGame === 'snake' && 'Snake'}
                </h3>
                <button onClick={() => setActiveMiniGame(null)} className="text-xs text-gray-400 hover:text-white">
                  {cs ? 'Zavřít' : 'Close'}
                </button>
              </div>
              {activeMiniGame === 'pong' && <PongGame />}
              {activeMiniGame === 'breakout' && <BreakoutGame />}
              {activeMiniGame === 'snake' && <SnakeGame />}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function HeroSection({ cs }: { cs: boolean }) {
  return (
    <motion.section initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="zion-panel rounded-3xl md:rounded-4xl bg-black/60 p-6 md:p-10 text-center">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-4 py-1 text-xs font-semibold tracking-widest text-amber-300 uppercase mb-4">
        <Sparkles className="h-4 w-4" /> {cs ? 'Meme Lab & Arcade' : 'Meme Lab & Arcade'}
      </div>
      <h1 className="text-3xl sm:text-5xl font-bold text-gradient leading-tight">{cs ? 'Doge vs ZION Race' : 'Doge vs ZION Race'}</h1>
      <p className="mt-4 text-lg text-gray-300 max-w-2xl mx-auto">
        {cs
          ? 'Klikací závod na 100M. ZION má 5/5 multisig turbo, Doge jede na jeden podpis. Chytej power-upy (Oasis, Gem, Star, Fire) a rozjeď komba!'
          : 'Click race to 100M. ZION has 5/5 multisig turbo, Doge runs on one signature. Catch power-ups (Oasis, Gem, Star, Fire) and build combos!'}
      </p>
    </motion.section>
  );
}

function ScoreBoard({ cs, dogePos, zionPos, clicks, combo, comboTimer, elapsed }: any) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <StatCard icon={Coins} label={cs ? 'Doge' : 'Doge'} value={dogePos.toLocaleString()} color="text-amber-300" border="border-amber-400/20" />
      <StatCard icon={Rocket} label={cs ? 'ZION' : 'ZION'} value={zionPos.toLocaleString()} color="text-emerald-300" border="border-emerald-400/20" />
      <StatCard icon={Zap} label={cs ? 'Kliky' : 'Clicks'} value={clicks.toLocaleString()} color="text-zion-gold" border="border-zion-gold/20" />
      <StatCard icon={Flame} label={cs ? `Combo ${combo}` : `Combo ${combo}`} value={comboTimer > 0 ? `${comboTimer}s` : '—'} color="text-orange-300" border="border-orange-400/20" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, border }: { icon: LucideIcon; label: string; value: string; color: string; border: string }) {
  return (
    <div className={`rounded-2xl border ${border} bg-black/60 p-4 backdrop-blur-xl`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${color}`} />
        <span className="text-[10px] uppercase tracking-wider text-gray-500">{label}</span>
      </div>
      <p className={`text-lg font-bold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}

function PowerUpOrb({ data, onClick }: { data: { id: number; x: number; type: string }; onClick: (id: number, type: string, x: number, y: number) => void }) {
  const icons: Record<string, string> = { oasis: '🏜️', gem: '💎', flame: '🔥', star: '⭐' };
  const labels: Record<string, string> = { oasis: 'Oasis', gem: 'Gem', flame: 'Fire', star: 'Star' };
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <motion.button
      ref={ref}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.9 }}
      onClick={(e) => {
        const rect = ref.current?.getBoundingClientRect();
        onClick(data.id, data.type, rect?.left ?? e.clientX, rect?.top ?? e.clientY);
      }}
      className="absolute top-2 h-10 w-10 rounded-full border border-white/20 bg-black/60 text-lg shadow-lg hover:bg-white/10 transition-colors"
      style={{ left: `${data.x}%` }}
      title={labels[data.type]}
    >
      {icons[data.type]}
    </motion.button>
  );
}

function ClickAvatar({ src, emoji, alt, label, sublabel, color, onClick }: { src?: string; emoji?: string; alt?: string; label: string; sublabel: string; color: 'amber' | 'emerald'; onClick: (e: React.MouseEvent) => void }) {
  const glow = color === 'amber' ? 'shadow-amber-500/30 hover:shadow-amber-500/50' : 'shadow-emerald-500/30 hover:shadow-emerald-500/50';
  const border = color === 'amber' ? 'border-amber-400/30' : 'border-emerald-400/30';
  const bg = color === 'amber' ? 'from-amber-500/20 to-amber-700/20' : 'from-emerald-500/20 to-zion-cyan/20';
  const text = color === 'amber' ? 'text-amber-300' : 'text-emerald-300';

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.92, rotate: color === 'amber' ? -5 : 5 }}
      className={`relative flex h-36 w-36 md:h-44 md:w-44 flex-col items-center justify-center rounded-full border-4 ${border} bg-gradient-to-br ${bg} shadow-[0_20px_80px_rgba(0,0,0,0.3)] ${glow} transition-all active:scale-95`}
    >
      {src ? <Image src={src} alt={alt ?? label} width={100} height={100} className="h-20 w-20 md:h-24 md:w-24 object-contain drop-shadow-2xl" /> : <span className="text-6xl md:text-7xl drop-shadow-2xl">{emoji}</span>}
      <span className={`absolute -bottom-2 rounded-full border border-white/10 bg-black/80 px-3 py-0.5 text-xs font-bold ${text}`}>{label}</span>
      <span className="absolute -bottom-7 text-[10px] text-white/40">{sublabel}</span>
    </motion.button>
  );
}

function ArcadeCard({ title, icon: Icon, color, onClick }: { title: string; icon: LucideIcon; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group rounded-2xl border border-white/10 bg-white/3 p-5 text-center transition-all hover:bg-white/6 hover:border-white/20">
      <Icon className={`mx-auto h-10 w-10 ${color} mb-3 group-hover:scale-110 transition-transform`} />
      <h3 className="font-bold text-white">{title}</h3>
      <p className="mt-1 text-[10px] text-gray-500">{title === 'Pong' ? '1P vs AI' : title === 'Breakout' ? 'Break bricks' : 'Eat & grow'}</p>
    </button>
  );
}

// ─── Mini games ───────────────────────────────────────────────────────────────

function PongGame() {
  const [score, setScore] = useState({ p: 0, ai: 0 });
  const ballRef = useRef({ x: 200, y: 125, vx: 4, vy: 3 });
  const pRef = useRef(100);
  const aiRef = useRef(100);
  const reqRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const w = 400, h = 250;
    const pW = 10, pH = 50;
    let running = true;

    const loop = () => {
      if (!running) return;
      const b = ballRef.current;
      b.x += b.vx;
      b.y += b.vy;

      if (b.y <= 0 || b.y >= h) b.vy *= -1;
      if (b.x <= 20 && b.y > pRef.current && b.y < pRef.current + pH) b.vx = Math.abs(b.vx) * 1.05;
      if (b.x >= w - 20 && b.y > aiRef.current && b.y < aiRef.current + pH) b.vx = -Math.abs(b.vx) * 1.05;

      if (b.x < 0) { setScore((s) => ({ ...s, ai: s.ai + 1 })); b.x = w / 2; b.y = h / 2; b.vx = 4; }
      if (b.x > w) { setScore((s) => ({ ...s, p: s.p + 1 })); b.x = w / 2; b.y = h / 2; b.vx = -4; }

      aiRef.current += (b.y - aiRef.current - pH / 2) * 0.08;
      reqRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, []);

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pRef.current = Math.max(0, Math.min(200, e.clientY - rect.top - 25));
  };

  return (
    <div ref={containerRef} onMouseMove={handleMove} className="relative mx-auto h-[250px] w-full max-w-[400px] cursor-none rounded border border-zion-cyan/30 bg-black/80 overflow-hidden">
      <div className="absolute top-2 left-2 text-xs text-zion-cyan">Player: {score.p}</div>
      <div className="absolute top-2 right-2 text-xs text-amber-300">AI: {score.ai}</div>
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/10" />
      <div className="absolute h-[50px] w-[10px] rounded bg-zion-cyan" style={{ left: 10, top: pRef.current }} />
      <div className="absolute h-[50px] w-[10px] rounded bg-amber-400" style={{ right: 10, top: aiRef.current }} />
      <div className="absolute h-3 w-3 rounded-full bg-white" style={{ left: ballRef.current.x - 6, top: ballRef.current.y - 6 }} />
    </div>
  );
}

function BreakoutGame() {
  const [bricks, setBricks] = useState(() => Array.from({ length: 30 }, (_, i) => ({ id: i, x: (i % 6) * 60 + 15, y: Math.floor(i / 6) * 25 + 10, alive: true })));
  const [paddle, setPaddle] = useState(150);
  const ballRef = useRef({ x: 200, y: 200, vx: 3, vy: -3 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const reqRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  const reset = () => {
    setBricks(Array.from({ length: 30 }, (_, i) => ({ id: i, x: (i % 6) * 60 + 15, y: Math.floor(i / 6) * 25 + 10, alive: true })));
    ballRef.current = { x: 200, y: 200, vx: 3, vy: -3 };
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running || gameOver) return;
      const b = ballRef.current;
      b.x += b.vx;
      b.y += b.vy;
      if (b.x <= 0 || b.x >= 370) b.vx *= -1;
      if (b.y <= 0) b.vy *= -1;
      if (b.y >= 230 && b.x > paddle && b.x < paddle + 60) b.vy = -Math.abs(b.vy) * 1.02;
      if (b.y > 250) { setGameOver(true); return; }

      setBricks((prev) => {
        let hit = false;
        const next = prev.map((br) => {
          if (!br.alive || hit) return br;
          if (b.x > br.x && b.x < br.x + 50 && b.y > br.y && b.y < br.y + 20) {
            hit = true;
            setScore((s) => s + 10);
            return { ...br, alive: false };
          }
          return br;
        });
        if (hit) b.vy *= -1;
        return next;
      });

      reqRef.current = requestAnimationFrame(loop);
    };
    loop();
    return () => { running = false; if (reqRef.current) cancelAnimationFrame(reqRef.current); };
  }, [gameOver, paddle]);

  const handleMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPaddle(Math.max(0, Math.min(310, e.clientX - rect.left - 30)));
  };

  return (
    <div ref={containerRef} onMouseMove={handleMove} className="relative mx-auto h-[250px] w-full max-w-[400px] cursor-none rounded border border-zion-gold/30 bg-black/80 overflow-hidden">
      <div className="absolute top-2 left-2 text-xs text-zion-gold">Score: {score}</div>
      {gameOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
          <p className="text-white font-bold mb-2">Game Over</p>
          <button onClick={reset} className="rounded bg-zion-gold px-3 py-1 text-xs text-black font-bold">Restart</button>
        </div>
      )}
      {bricks.map((br) => br.alive && <div key={br.id} className="absolute h-4 w-12 rounded bg-zion-gold/80" style={{ left: br.x, top: br.y }} />)}
      <div className="absolute h-2 w-[60px] rounded bg-white" style={{ left: paddle, bottom: 10 }} />
      <div className="absolute h-3 w-3 rounded-full bg-white" style={{ left: ballRef.current.x - 6, top: ballRef.current.y - 6 }} />
    </div>
  );
}

function SnakeGame() {
  const [snake, setSnake] = useState([{ x: 10, y: 10 }]);
  const [food, setFood] = useState({ x: 15, y: 15 });
  const [dir, setDir] = useState({ x: 1, y: 0 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const dirRef = useRef(dir);
  const reqRef = useRef<number>();

  useEffect(() => { dirRef.current = dir; }, [dir]);

  const reset = () => {
    setSnake([{ x: 10, y: 10 }]);
    setFood({ x: 15, y: 15 });
    setDir({ x: 1, y: 0 });
    setScore(0);
    setGameOver(false);
  };

  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running || gameOver) return;
      setSnake((prev) => {
        const head = { x: prev[0].x + dirRef.current.x, y: prev[0].y + dirRef.current.y };
        if (head.x < 0 || head.x >= 20 || head.y < 0 || head.y >= 15 || prev.some((s) => s.x === head.x && s.y === head.y)) {
          setGameOver(true);
          return prev;
        }
        const newSnake = [head, ...prev];
        if (head.x === food.x && head.y === food.y) {
          setScore((s) => s + 10);
          setFood({ x: Math.floor(Math.random() * 20), y: Math.floor(Math.random() * 15) });
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
      reqRef.current = requestAnimationFrame(() => setTimeout(() => {}, 100));
    };
    const interval = setInterval(loop, 120);
    return () => { running = false; clearInterval(interval); };
  }, [food, gameOver]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') setDir({ x: 0, y: -1 });
      if (e.key === 'ArrowDown') setDir({ x: 0, y: 1 });
      if (e.key === 'ArrowLeft') setDir({ x: -1, y: 0 });
      if (e.key === 'ArrowRight') setDir({ x: 1, y: 0 });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cellSize = 20;

  return (
    <div className="relative mx-auto h-[300px] w-full max-w-[400px] rounded border border-emerald-400/30 bg-black/80 overflow-hidden" tabIndex={0}>
      <div className="absolute top-2 left-2 text-xs text-emerald-400">Score: {score}</div>
      {gameOver && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/80">
          <p className="text-white font-bold mb-2">Game Over</p>
          <p className="text-[10px] text-gray-400 mb-2">Use arrow keys</p>
          <button onClick={reset} className="rounded bg-emerald-400 px-3 py-1 text-xs text-black font-bold">Restart</button>
        </div>
      )}
      {snake.map((s, i) => (
        <div key={i} className="absolute rounded-sm bg-emerald-400" style={{ left: s.x * cellSize, top: s.y * cellSize, width: cellSize - 1, height: cellSize - 1 }} />
      ))}
      <div className="absolute rounded-full bg-red-400" style={{ left: food.x * cellSize, top: food.y * cellSize, width: cellSize - 1, height: cellSize - 1 }} />
    </div>
  );
}
