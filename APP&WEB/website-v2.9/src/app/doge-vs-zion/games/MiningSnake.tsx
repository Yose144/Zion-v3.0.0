'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, RefreshCw, Trophy } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const DogeVsZionGamesMiningSnakeCopy = {
  back: { cs: `Zpět`, en: `Back` },
  miningSnake: { cs: `Těžební Had`, en: `Mining Snake` },
  collectZionDonu2019tCrashYourR: { cs: `Sbírej ZION. Nenič svůj rig.`, en: `Collect ZION. Donu2019t crash your rig.` },
  coins: { cs: `mince`, en: `coins` },
  pts: { cs: `bodů`, en: `pts` },
  pilotYourMiningRigAcrossTheGri: { cs: `Riď svůj těžební rig po mřížce. Sbírej ZION mince (⛏️) pro růst a skóre. Chyť vzácné diamanty (💎) za +50 bonusových bodů. Nenarazíš do stěn ani do sebe!`, en: `Pilot your mining rig across the grid. Collect ZION coins (⛏️) to grow and score. Grab rare diamonds (💎) for +50 bonus points. Donu2019t hit the walls or yourself!` },
  arrowKeysWasdToMoveSpaceToPaus: { cs: `Šipky / WASD pro pohyb · Mezerník pro pauzu`, en: `Arrow keys / WASD to move · Space to pause` },
  startMining: { cs: `Začít těžit`, en: `Start Mining` },
  paused: { cs: `Pauza`, en: `Paused` },
  resume: { cs: `Pokračovat`, en: `Resume` },
  pressSpaceToResume: { cs: `Stiskni MEZERNÍK pro pokračování`, en: `Press Space to resume` },
  rigCrashed: { cs: `Rig havaroval`, en: `Rig Crashed` },
  score: { cs: `Skóre`, en: `Score` },
  coins_2: { cs: `Mince`, en: `Coins` },
  best: { cs: `Nejlepší`, en: `Best` },
  newHighScore: { cs: `Nové nejlepší skóre!`, en: `New High Score!` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
  swipeToSteerOnMobileSpaceToPau: { cs: `Posunem prstem riď na mobilu · Mezerník pro pauzu`, en: `Swipe to steer on mobile · Space to pause` },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const GRID = 20;
const CELL = 24;
const CANVAS_SIZE = GRID * CELL; // 480
const HS_KEY = 'mining-snake-hs';
const BASE_TICK = 140; // ms per move
const MIN_TICK = 60;

type Vec = { x: number; y: number };
type FoodKind = 'coin' | 'diamond';

interface Food {
  pos: Vec;
  kind: FoodKind;
}

interface GameState {
  snake: Vec[]; // head at index 0
  dir: Vec;
  nextDir: Vec;
  food: Food;
  score: number;
  coins: number;
  status: 'start' | 'playing' | 'paused' | 'over';
  tick: number;
  accumulator: number;
  lastTime: number;
  diamondTimer: number; // ms remaining for active diamond
  nextDiamondIn: number; // ms until next diamond spawn attempt
}

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  private beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  eat() { this.beep(660, 0.08, 'square', 0.05); setTimeout(() => this.beep(880, 0.08, 'square', 0.05), 60); }
  diamond() { [784, 1047, 1319].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'sine', 0.06), i * 70)); }
  crash() { [300, 200, 120].forEach((f, i) => setTimeout(() => this.beep(f, 0.2, 'sawtooth', 0.07), i * 90)); }
}

const sfx = new SoundManager();

// ─── Module-level helpers (avoid React purity lint) ──────────────────────────

function randCell(): Vec {
  return { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) };
}

function spawnFood(snake: Vec[], forceDiamond: boolean): Food {
  const occupied = new Set(snake.map((s) => `${s.x},${s.y}`));
  let pos = randCell();
  let tries = 0;
  while (occupied.has(`${pos.x},${pos.y}`) && tries < 200) {
    pos = randCell();
    tries++;
  }
  return { pos, kind: forceDiamond ? 'diamond' : 'coin' };
}

function initState(): GameState {
  const start: Vec[] = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  return {
    snake: start,
    dir: { x: 1, y: 0 },
    nextDir: { x: 1, y: 0 },
    food: spawnFood(start, false),
    score: 0,
    coins: 0,
    status: 'start',
    tick: BASE_TICK,
    accumulator: 0,
    lastTime: 0,
    diamondTimer: 0,
    nextDiamondIn: 8000 + Math.random() * 6000,
  };
}

function loadHighScore(): number {
  if (typeof window === 'undefined') return 0;
  const raw = localStorage.getItem(HS_KEY);
  return raw ? parseInt(raw, 10) || 0 : 0;
}

function saveHighScore(score: number) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(HS_KEY, String(score));
}

function stepGame(s: GameState): { ate: boolean; died: boolean; diamond: boolean } {
  // apply queued direction (prevent 180 reversal)
  if (s.nextDir.x !== -s.dir.x || s.nextDir.y !== -s.dir.y) {
    s.dir = s.nextDir;
  }
  const head = s.snake[0];
  const newHead: Vec = { x: head.x + s.dir.x, y: head.y + s.dir.y };

  // wall collision
  if (newHead.x < 0 || newHead.x >= GRID || newHead.y < 0 || newHead.y >= GRID) {
    return { ate: false, died: true, diamond: false };
  }
  // self collision (ignore tail tip which will move, unless growing)
  const willGrow = newHead.x === s.food.pos.x && newHead.y === s.food.pos.y && s.food.kind === 'coin';
  const checkUntil = willGrow ? s.snake.length : s.snake.length - 1;
  for (let i = 0; i < checkUntil; i++) {
    if (s.snake[i].x === newHead.x && s.snake[i].y === newHead.y) {
      return { ate: false, died: true, diamond: false };
    }
  }

  s.snake.unshift(newHead);

  let ate = false;
  let diamond = false;
  if (newHead.x === s.food.pos.x && newHead.y === s.food.pos.y) {
    ate = true;
    if (s.food.kind === 'coin') {
      s.score += 10;
      s.coins += 1;
      // speed up every 5 coins
      if (s.coins % 5 === 0 && s.tick > MIN_TICK) {
        s.tick = Math.max(MIN_TICK, s.tick - 10);
      }
      s.food = spawnFood(s.snake, false);
      s.nextDiamondIn -= 0; // no change; timer handled separately
    } else {
      diamond = true;
      s.score += 50;
      // diamond doesn't grow: remove the head we just added's growth by popping tail
      s.snake.pop();
      s.food = spawnFood(s.snake, false);
      s.diamondTimer = 0;
      s.nextDiamondIn = 10000 + Math.random() * 8000;
    }
  } else {
    s.snake.pop();
  }
  return { ate, died: false, diamond };
}

function renderCanvas(s: GameState, canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  if (canvas.width !== CANVAS_SIZE) canvas.width = CANVAS_SIZE;
  if (canvas.height !== CANVAS_SIZE) canvas.height = CANVAS_SIZE;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_SIZE);
  grad.addColorStop(0, '#0a1a0a');
  grad.addColorStop(1, '#0d2818');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  // Grid lines (subtle green)
  ctx.strokeStyle = 'rgba(7, 137, 48,0.08)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, CANVAS_SIZE);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(CANVAS_SIZE, i * CELL);
    ctx.stroke();
  }

  // Food
  const fx = s.food.pos.x * CELL + CELL / 2;
  const fy = s.food.pos.y * CELL + CELL / 2;
  if (s.food.kind === 'coin') {
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(fx, fy, CELL * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#92400e';
    ctx.font = `${CELL * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⛏️', fx, fy + 1);
  } else {
    // diamond with pulsing glow
    const pulse = 14 + Math.sin(Date.now() / 150) * 6;
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = pulse;
    ctx.fillStyle = '#a5f3fc';
    ctx.beginPath();
    ctx.moveTo(fx, fy - CELL * 0.4);
    ctx.lineTo(fx + CELL * 0.32, fy);
    ctx.lineTo(fx, fy + CELL * 0.4);
    ctx.lineTo(fx - CELL * 0.32, fy);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = `${CELL * 0.5}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('💎', fx, fy + 1);
  }

  // Snake body segments (skip head)
  for (let i = s.snake.length - 1; i >= 1; i--) {
    const seg = s.snake[i];
    const sx = seg.x * CELL + 2;
    const sy = seg.y * CELL + 2;
    const size = CELL - 4;
    ctx.shadowColor = '#22c55e';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#16a34a';
    ctx.fillRect(sx, sy, size, size);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(sx + 3, sy + 3, size - 6, size - 6);
  }

  // Snake head (mining rig emoji)
  const head = s.snake[0];
  const hx = head.x * CELL + CELL / 2;
  const hy = head.y * CELL + CELL / 2;
  ctx.shadowColor = '#22c55e';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#15803d';
  ctx.beginPath();
  ctx.arc(hx, hy, CELL * 0.45, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.font = `${CELL * 0.7}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('⛏️', hx, hy + 1);
}

// ─── Component ────────────────────────────────────────────────────────────────

export function MiningSnake({ onBack }: { onBack: () => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(initState());
  const rafRef = useRef<number>(0);
  const [status, setStatus] = useState<'start' | 'playing' | 'paused' | 'over'>('start');
  const [score, setScore] = useState(0);
  const [coins, setCoins] = useState(0);
  const [highScore, setHighScore] = useState(() => loadHighScore());
  const [muted, setMuted] = useState(false);

  // Sync mute to sound manager
  useEffect(() => {
    sfx.enabled = !muted;
  }, [muted]);

  const syncUI = useCallback(() => {
    const s = stateRef.current;
    setStatus(s.status);
    setScore(s.score);
    setCoins(s.coins);
  }, []);

  const startGame = useCallback(() => {
    sfx.init();
    stateRef.current = initState();
    stateRef.current.status = 'playing';
    stateRef.current.lastTime = performance.now();
    syncUI();
  }, [syncUI]);

  const togglePause = useCallback(() => {
    const s = stateRef.current;
    if (s.status === 'playing') {
      s.status = 'paused';
    } else if (s.status === 'paused') {
      s.status = 'playing';
      s.lastTime = performance.now();
    }
    syncUI();
  }, [syncUI]);

  // Main loop
  useEffect(() => {
    const loop = (now: number) => {
      const s = stateRef.current;
      if (s.status === 'playing') {
        const dt = now - s.lastTime;
        s.lastTime = now;
        s.accumulator += dt;

        // Diamond lifecycle: spawn / expire
        if (s.food.kind === 'diamond') {
          s.diamondTimer -= dt;
          if (s.diamondTimer <= 0) {
            s.food = spawnFood(s.snake, false);
            s.nextDiamondIn = 10000 + Math.random() * 8000;
          }
        } else {
          s.nextDiamondIn -= dt;
          if (s.nextDiamondIn <= 0) {
            s.food = spawnFood(s.snake, true);
            s.diamondTimer = 6000;
          }
        }

        while (s.accumulator >= s.tick) {
          s.accumulator -= s.tick;
          const res = stepGame(s);
          if (res.died) {
            s.status = 'over';
            sfx.crash();
            if (s.score > highScore) {
              setHighScore(s.score);
              saveHighScore(s.score);
            }
            syncUI();
            break;
          }
          if (res.diamond) {
            sfx.diamond();
          } else if (res.ate) {
            sfx.eat();
          }
          syncUI();
        }
      } else {
        s.lastTime = now;
      }

      renderCanvas(s, canvasRef.current);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [highScore, syncUI]);

  // Keyboard input
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      const key = e.key.toLowerCase();
      const dirs: Record<string, Vec> = {
        arrowup: { x: 0, y: -1 }, w: { x: 0, y: -1 },
        arrowdown: { x: 0, y: 1 }, s: { x: 0, y: 1 },
        arrowleft: { x: -1, y: 0 }, a: { x: -1, y: 0 },
        arrowright: { x: 1, y: 0 }, d: { x: 1, y: 0 },
      };
      if (dirs[key]) {
        e.preventDefault();
        const nd = dirs[key];
        if (s.status === 'playing' && (nd.x !== -s.dir.x || nd.y !== -s.dir.y)) {
          s.nextDir = nd;
        }
      } else if (key === ' ' || e.code === 'Space') {
        e.preventDefault();
        if (s.status === 'playing' || s.status === 'paused') togglePause();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePause]);

  // Touch swipe
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let startX = 0, startY = 0;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      startX = t.clientX; startY = t.clientY;
    };
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - startX;
      const dy = t.clientY - startY;
      if (Math.abs(dx) < 24 && Math.abs(dy) < 24) return;
      const s = stateRef.current;
      let nd: Vec;
      if (Math.abs(dx) > Math.abs(dy)) {
        nd = { x: dx > 0 ? 1 : -1, y: 0 };
      } else {
        nd = { x: 0, y: dy > 0 ? 1 : -1 };
      }
      if (s.status === 'playing' && (nd.x !== -s.dir.x || nd.y !== -s.dir.y)) {
        s.nextDir = nd;
      }
      startX = t.clientX; startY = t.clientY;
    };
    canvas.addEventListener('touchstart', onStart, { passive: true });
    canvas.addEventListener('touchmove', onMove, { passive: false });
    return () => {
      canvas.removeEventListener('touchstart', onStart);
      canvas.removeEventListener('touchmove', onMove);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-4 p-4 w-full max-w-md mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between w-full">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-zinc-400 hover:text-white transition-colors"
        >
          <ArrowLeft size={18} /> {DogeVsZionGamesMiningSnakeCopy.back[cs ? 'cs' : 'en']}
        </button>
        <div className="text-center">
          <h1 className="text-xl font-bold text-zion-cyan tracking-wide">{DogeVsZionGamesMiningSnakeCopy.miningSnake[cs ? 'cs' : 'en']}</h1>
          <p className="text-[10px] text-zinc-500">{DogeVsZionGamesMiningSnakeCopy.collectZionDonu2019tCrashYourR[cs ? 'cs' : 'en']}</p>
        </div>
        <button
          onClick={() => setMuted((m) => !m)}
          className="text-zinc-400 hover:text-white transition-colors"
          aria-label="Toggle mute"
        >
          {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>
      </div>

      {/* Score bar */}
      <div className="flex items-center justify-between w-full text-sm">
        <div className="flex items-center gap-1.5 text-zion-gold">
          <span className="text-base">⛏️</span>
          <span className="font-mono font-bold">{coins}</span>
          <span className="text-zinc-500 text-xs">{DogeVsZionGamesMiningSnakeCopy.coins[cs ? 'cs' : 'en']}</span>
        </div>
        <div className="flex items-center gap-1.5 text-white">
          <span className="font-mono font-bold">{score}</span>
          <span className="text-zinc-500 text-xs">{DogeVsZionGamesMiningSnakeCopy.pts[cs ? 'cs' : 'en']}</span>
        </div>
        <div className="flex items-center gap-1.5 text-zion-gold">
          <Trophy size={14} />
          <span className="font-mono font-bold">{highScore}</span>
        </div>
      </div>

      {/* Canvas + overlays */}
      <div className="relative zion-rainbow-card zion-rainbow-sub p-1" style={{ '--rc': '228, 30, 43', width: CANVAS_SIZE + 8, height: CANVAS_SIZE + 8 } as React.CSSProperties}>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          className="rounded-lg touch-none"
          style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
        />

        {/* Start overlay */}
        {status === 'start' && (
          <div className="absolute inset-1 flex flex-col items-center justify-center bg-black/70 rounded-lg backdrop-blur-sm gap-4 p-6 text-center">
            <div className="text-4xl">⛏️</div>
            <h2 className="text-lg font-bold text-zion-cyan">{DogeVsZionGamesMiningSnakeCopy.miningSnake[cs ? 'cs' : 'en']}</h2>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
              {DogeVsZionGamesMiningSnakeCopy.pilotYourMiningRigAcrossTheGri[cs ? 'cs' : 'en']}
            </p>
            <div className="text-[10px] text-zinc-500">
              {DogeVsZionGamesMiningSnakeCopy.arrowKeysWasdToMoveSpaceToPaus[cs ? 'cs' : 'en']}
            </div>
            <button
              onClick={startGame}
              className="px-6 py-2 rounded-lg bg-zion-cyan hover:bg-zion-cyan text-white font-bold text-sm transition-colors"
            >
              {DogeVsZionGamesMiningSnakeCopy.startMining[cs ? 'cs' : 'en']}
            </button>
          </div>
        )}

        {/* Pause overlay */}
        {status === 'paused' && (
          <div className="absolute inset-1 flex flex-col items-center justify-center bg-black/60 rounded-lg backdrop-blur-sm gap-3">
            <h2 className="text-lg font-bold text-white">{DogeVsZionGamesMiningSnakeCopy.paused[cs ? 'cs' : 'en']}</h2>
            <button
              onClick={togglePause}
              className="px-5 py-2 rounded-lg bg-zion-cyan hover:bg-zion-cyan text-white font-bold text-sm transition-colors"
            >
              {DogeVsZionGamesMiningSnakeCopy.resume[cs ? 'cs' : 'en']}
            </button>
            <p className="text-[10px] text-zinc-500">{DogeVsZionGamesMiningSnakeCopy.pressSpaceToResume[cs ? 'cs' : 'en']}</p>
          </div>
        )}

        {/* Game over overlay */}
        {status === 'over' && (
          <div className="absolute inset-1 flex flex-col items-center justify-center bg-black/75 rounded-lg backdrop-blur-sm gap-3 p-6 text-center">
            <div className="text-3xl">💥</div>
            <h2 className="text-lg font-bold text-zion-purple">{DogeVsZionGamesMiningSnakeCopy.rigCrashed[cs ? 'cs' : 'en']}</h2>
            <div className="flex flex-col gap-1">
              <div className="text-sm text-white">
                {DogeVsZionGamesMiningSnakeCopy.score[cs ? 'cs' : 'en']}: <span className="font-mono font-bold text-zion-gold">{score}</span>
              </div>
              <div className="text-xs text-zinc-400">
                {DogeVsZionGamesMiningSnakeCopy.coins_2[cs ? 'cs' : 'en']}: <span className="font-mono">{coins}</span> · {DogeVsZionGamesMiningSnakeCopy.best[cs ? 'cs' : 'en']}: <span className="font-mono text-zion-gold">{highScore}</span>
              </div>
              {score >= highScore && score > 0 && (
                <div className="text-xs text-zion-gold font-bold flex items-center gap-1 justify-center">
                  <Trophy size={12} /> {DogeVsZionGamesMiningSnakeCopy.newHighScore[cs ? 'cs' : 'en']}
                </div>
              )}
            </div>
            <button
              onClick={startGame}
              className="flex items-center gap-2 px-5 py-2 rounded-lg bg-zion-cyan hover:bg-zion-cyan text-white font-bold text-sm transition-colors"
            >
              <RefreshCw size={14} /> {DogeVsZionGamesMiningSnakeCopy.retry[cs ? 'cs' : 'en']}
            </button>
          </div>
        )}
      </div>

      {/* Mobile controls hint */}
      <p className="text-[10px] text-zinc-600 text-center">
        {DogeVsZionGamesMiningSnakeCopy.swipeToSteerOnMobileSpaceToPau[cs ? 'cs' : 'en']}
      </p>
    </div>
  );
}
