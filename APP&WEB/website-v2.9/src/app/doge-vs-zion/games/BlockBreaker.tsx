'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, RefreshCw, Trophy } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';

const DogeVsZionGamesBlockBreakerCopy = {
  clickOrPressSpaceToLaunch: { cs: `Klepni nebo stiskni MEZERNÍK pro start`, en: `Click or press Space to launch` },
  back: { cs: `Zpět`, en: `Back` },
  blockBreaker: { cs: `Rozbíječ Bloků`, en: `Block Breaker` },
  breakThroughTheFirewallsFreeTh: { cs: `Proraz si skrz firewally. Osvoboď síť.`, en: `Break through the firewalls. Free the network.` },
  highScore: { cs: `Nejlepší skóre`, en: `High Score` },
  startGame: { cs: `Hrát`, en: `Start Game` },
  howToPlay: { cs: `Jak hrát`, en: `How to Play` },
  moveThe: { cs: `Pohybuj pádlem `, en: `Move the ` },
  firewall: { cs: `Firewall`, en: `Firewall` },
  paddleWithMouseOrArrowKeys: { cs: ` myší nebo šipkami`, en: ` paddle with mouse or arrow keys` },
  launchThe: { cs: `Vystřel `, en: `Launch the ` },
  validatorNode: { cs: `Validator uzel`, en: `Validator node` },
  withClickOrSpace: { cs: ` klikem nebo MEZERNÍKEM`, en: ` with click or Space` },
  breakThrough: { cs: `Proraz `, en: `Break through ` },
  firewallSegments: { cs: `firewallové segmenty`, en: `firewall segments` },
  toScorePoints: { cs: ` pro body`, en: ` to score points` },
  donu2019tLetTheNodeFallYouHave: { cs: `Nenech uzel spadnout — máš `, en: `Donu2019t let the node fall — you have ` },
  k3Lives: { cs: `3 životy`, en: `3 lives` },
  clearAllBlocksToAdvanceToTheNe: { cs: `Vyčisti všechny bloky pro postup na další vrstvu`, en: `Clear all blocks to advance to the next layer` },
  firewallLayers: { cs: `Firewallové vrstvy`, en: `Firewall Layers` },
  pts: { cs: `bodů`, en: `pts` },
  score: { cs: `Skóre`, en: `Score` },
  level: { cs: `Úroveň`, en: `Level` },
  lives: { cs: `Životy`, en: `Lives` },
  high: { cs: `Nejlepší`, en: `High` },
  paused: { cs: `Pauza`, en: `PAUSED` },
  resume: { cs: `Pokračovat`, en: `Resume` },
  pressPToResume: { cs: `Stiskni P pro pokračování`, en: `Press P to resume` },
  nextLayerFasterNodeMoreFirewal: { cs: `Další vrstva: rychlejší uzel, více firewallů`, en: `Next layer: faster node, more firewalls` },
  firewallCompromised: { cs: `Firewall kompromitován`, en: `Firewall Compromised` },
  finalScore: { cs: `Konečné skóre`, en: `Final Score` },
  layersBreached: { cs: `Proražené vrstvy`, en: `Layers Breached` },
  newHighScore: { cs: `Nové nejlepší skóre!`, en: `New High Score!` },
  retry: { cs: `Zkusit znovu`, en: `Retry` },
};

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 480;
const CANVAS_H = 560;
const PADDLE_W = 80;
const PADDLE_H = 12;
const BALL_R = 7;
const BLOCK_W = 48;
const BLOCK_H = 20;
const BLOCK_GAP = 0;
const BLOCK_TOP = 50;
const BLOCK_LEFT = 0;
const ROWS_BASE = 5;
const COLS = 10;
const LIVES = 3;

interface RowDef {
  label: string;
  color: string;
  borderColor: string;
  points: number;
}

const ROW_DEFS: RowDef[] = [
  { label: 'L6 Issobella', color: '#a855f7', borderColor: '#c084fc', points: 50 },
  { label: 'L5 Free World', color: '#3b82f6', borderColor: '#0a1a2a', points: 40 },
  { label: 'L4 Oasis', color: '#f59e0b', borderColor: '#fbbf24', points: 30 },
  { label: 'L3 Hiran', color: '#078930', borderColor: '#22d3ee', points: 20 },
  { label: 'L1 Earth', color: '#10b981', borderColor: '#34d399', points: 10 },
];

const HS_KEY = 'block-breaker-hs';

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

  beep(freq: number, dur: number, type: OscillatorType = 'square', vol = 0.05) {
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

  paddleHit() { this.beep(440, 0.05, 'square', 0.04); }
  wallHit() { this.beep(300, 0.03, 'square', 0.03); }
  blockBreak(row: number) { this.beep(600 + row * 120, 0.06, 'square', 0.04); }
  lifeLost() {
    this.beep(200, 0.15, 'sawtooth', 0.06);
    setTimeout(() => this.beep(120, 0.2, 'sawtooth', 0.06), 80);
  }
  levelClear() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.beep(f, 0.12, 'sine', 0.05), i * 80)); }
  gameOver() { [400, 300, 200, 150].forEach((f, i) => setTimeout(() => this.beep(f, 0.25, 'sawtooth', 0.06), i * 120)); }
}

const sfx = new SoundManager();

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  borderColor: string;
  points: number;
  alive: boolean;
  row: number;
}

interface Ball {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  trail: { x: number; y: number }[];
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

type GameStatus = 'start' | 'playing' | 'paused' | 'level-complete' | 'game-over';

interface GameState {
  status: GameStatus;
  score: number;
  lives: number;
  level: number;
  paddleX: number;
  ball: Ball;
  blocks: Block[];
  particles: Particle[];
  speedMul: number;
  totalBlocks: number;
  remainingBlocks: number;
  keyLeft: boolean;
  keyRight: boolean;
  ballLaunched: boolean;
}

// ─── Game Logic Functions (module-level to avoid purity lint) ─────────────────

function createBlocks(level: number): Block[] {
  const rows = Math.min(ROWS_BASE + Math.floor((level - 1) / 2), 8);
  const blocks: Block[] = [];
  const totalW = COLS * (BLOCK_W + BLOCK_GAP);
  const leftOffset = (CANVAS_W - totalW) / 2;

  for (let r = 0; r < rows; r++) {
    const rowDef = ROW_DEFS[r % ROW_DEFS.length];
    for (let c = 0; c < COLS; c++) {
      blocks.push({
        x: leftOffset + c * (BLOCK_W + BLOCK_GAP),
        y: BLOCK_TOP + r * (BLOCK_H + BLOCK_GAP),
        w: BLOCK_W,
        h: BLOCK_H,
        color: rowDef.color,
        borderColor: rowDef.borderColor,
        points: rowDef.points,
        alive: true,
        row: r,
      });
    }
  }
  return blocks;
}

function createBall(paddleX: number): Ball {
  return {
    x: paddleX + PADDLE_W / 2,
    y: CANVAS_H - PADDLE_H - BALL_R - 2,
    vx: 0,
    vy: 0,
    r: BALL_R,
    trail: [],
  };
}

function launchBall(ball: Ball, level: number): void {
  const baseSpeed = 3.2 + (level - 1) * 0.4;
  const angle = -Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  ball.vx = Math.cos(angle) * baseSpeed;
  ball.vy = Math.sin(angle) * baseSpeed;
}

function createInitialState(level: number, score: number, lives: number): GameState {
  const paddleX = (CANVAS_W - PADDLE_W) / 2;
  const blocks = createBlocks(level);
  return {
    status: 'playing',
    score,
    lives,
    level,
    paddleX,
    ball: createBall(paddleX),
    blocks,
    particles: [],
    speedMul: 1,
    totalBlocks: blocks.length,
    remainingBlocks: blocks.length,
    keyLeft: false,
    keyRight: false,
    ballLaunched: false,
  };
}

function spawnParticles(particles: Particle[], x: number, y: number, color: string, count: number): void {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 3;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      maxLife: 0.4 + Math.random() * 0.3,
      color,
      size: 2 + Math.random() * 2,
    });
  }
}

function updateParticles(particles: Particle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1;
    p.life -= dt / p.maxLife;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function updateGame(s: GameState, dt: number): void {
  if (s.status !== 'playing') return;

  // Paddle movement via keyboard
  const paddleSpeed = 8;
  if (s.keyLeft) s.paddleX -= paddleSpeed;
  if (s.keyRight) s.paddleX += paddleSpeed;
  s.paddleX = Math.max(0, Math.min(CANVAS_W - PADDLE_W, s.paddleX));

  // Ball not launched yet — follows paddle
  if (!s.ballLaunched) {
    s.ball.x = s.paddleX + PADDLE_W / 2;
    s.ball.y = CANVAS_H - PADDLE_H - BALL_R - 2;
    return;
  }

  const ball = s.ball;
  const steps = Math.ceil(Math.max(Math.abs(ball.vx), Math.abs(ball.vy)) / 4);
  const stepDt = 1 / steps;

  for (let step = 0; step < steps; step++) {
    ball.x += ball.vx * stepDt;
    ball.y += ball.vy * stepDt;

    // Wall collisions
    if (ball.x - ball.r < 0) {
      ball.x = ball.r;
      ball.vx = Math.abs(ball.vx);
      sfx.wallHit();
    }
    if (ball.x + ball.r > CANVAS_W) {
      ball.x = CANVAS_W - ball.r;
      ball.vx = -Math.abs(ball.vx);
      sfx.wallHit();
    }
    if (ball.y - ball.r < 0) {
      ball.y = ball.r;
      ball.vy = Math.abs(ball.vy);
      sfx.wallHit();
    }

    // Paddle collision
    const paddleY = CANVAS_H - PADDLE_H - 4;
    if (
      ball.vy > 0 &&
      ball.y + ball.r >= paddleY &&
      ball.y + ball.r <= paddleY + PADDLE_H + 4 &&
      ball.x >= s.paddleX - ball.r &&
      ball.x <= s.paddleX + PADDLE_W + ball.r
    ) {
      ball.y = paddleY - ball.r;
      const hitPos = (ball.x - s.paddleX) / PADDLE_W; // 0..1
      const angle = -Math.PI / 2 + (hitPos - 0.5) * Math.PI * 0.7;
      const speed = Math.hypot(ball.vx, ball.vy);
      ball.vx = Math.cos(angle) * speed;
      ball.vy = Math.sin(angle) * speed;
      sfx.paddleHit();
    }

    // Block collisions
    for (const block of s.blocks) {
      if (!block.alive) continue;
      if (
        ball.x + ball.r > block.x &&
        ball.x - ball.r < block.x + block.w &&
        ball.y + ball.r > block.y &&
        ball.y - ball.r < block.y + block.h
      ) {
        block.alive = false;
        s.remainingBlocks--;
        s.score += block.points;

        // Determine collision side
        const overlapL = (ball.x + ball.r) - block.x;
        const overlapR = (block.x + block.w) - (ball.x - ball.r);
        const overlapT = (ball.y + ball.r) - block.y;
        const overlapB = (block.y + block.h) - (ball.y - ball.r);
        const minOverlap = Math.min(overlapL, overlapR, overlapT, overlapB);

        if (minOverlap === overlapT || minOverlap === overlapB) {
          ball.vy = -ball.vy;
        } else {
          ball.vx = -ball.vx;
        }

        // Speed up slightly
        const speedUp = 1.012;
        ball.vx *= speedUp;
        ball.vy *= speedUp;

        spawnParticles(s.particles, block.x + block.w / 2, block.y + block.h / 2, block.color, 6);
        sfx.blockBreak(block.row);
        break; // only one block per sub-step
      }
    }

    // Ball falls below paddle
    if (ball.y - ball.r > CANVAS_H) {
      s.lives--;
      sfx.lifeLost();
      if (s.lives <= 0) {
        s.status = 'game-over';
        sfx.gameOver();
      } else {
        s.ballLaunched = false;
        s.ball = createBall(s.paddleX);
      }
      return;
    }

    // Level complete
    if (s.remainingBlocks <= 0) {
      s.status = 'level-complete';
      sfx.levelClear();
      return;
    }
  }

  // Trail
  ball.trail.push({ x: ball.x, y: ball.y });
  if (ball.trail.length > 8) ball.trail.shift();

  updateParticles(s.particles, dt);
}

// ─── Render ───────────────────────────────────────────────────────────────────

function renderCanvas(s: GameState, canvasRef: React.RefObject<HTMLCanvasElement | null>, cs: boolean): void {
  const canvas = canvasRef.current;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (canvas.width !== CANVAS_W) canvas.width = CANVAS_W;
  if (canvas.height !== CANVAS_H) canvas.height = CANVAS_H;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#0d0d28');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Subtle grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= CANVAS_W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, CANVAS_H);
    ctx.stroke();
  }

  // Blocks
  for (const block of s.blocks) {
    if (!block.alive) continue;
    // Fill
    ctx.fillStyle = block.color;
    ctx.fillRect(block.x, block.y, block.w, block.h);
    // Border
    ctx.strokeStyle = block.borderColor;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(block.x + 0.5, block.y + 0.5, block.w - 1, block.h - 1);
    // Inner highlight
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(block.x + 2, block.y + 2, block.w - 4, 3);
  }

  // Particles
  for (const p of s.particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // Ball trail
  const ball = s.ball;
  for (let i = 0; i < ball.trail.length; i++) {
    const t = ball.trail[i];
    const alpha = (i / ball.trail.length) * 0.4;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#3b82f6';
    ctx.beginPath();
    ctx.arc(t.x, t.y, ball.r * (i / ball.trail.length), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Ball — Validator node (blue glowing circle)
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#60a5fa';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#dbeafe';
  ctx.beginPath();
  ctx.arc(ball.x - 1.5, ball.y - 1.5, ball.r * 0.4, 0, Math.PI * 2);
  ctx.fill();

  // Paddle — Firewall (red/orange glowing bar)
  const paddleY = CANVAS_H - PADDLE_H - 4;
  ctx.shadowColor = '#f97316';
  ctx.shadowBlur = 14;
  const pGrad = ctx.createLinearGradient(s.paddleX, paddleY, s.paddleX, paddleY + PADDLE_H);
  pGrad.addColorStop(0, '#fb923c');
  pGrad.addColorStop(0.5, '#f97316');
  pGrad.addColorStop(1, '#dc2626');
  ctx.fillStyle = pGrad;
  ctx.fillRect(s.paddleX, paddleY, PADDLE_W, PADDLE_H);
  ctx.shadowBlur = 0;
  // Paddle highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillRect(s.paddleX + 2, paddleY + 1, PADDLE_W - 4, 2);

  // Launch hint
  if (!s.ballLaunched && s.status === 'playing') {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(DogeVsZionGamesBlockBreakerCopy.clickOrPressSpaceToLaunch[cs ? 'cs' : 'en'], CANVAS_W / 2, CANVAS_H - 50);
  }
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function BlockBreaker({ onBack }: { onBack: () => void }) {
  const { lang } = useLang();
  const cs = lang === 'cs';
  const [muted, setMuted] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [highScore, setHighScore] = useState(() => {
    try {
      const hs = localStorage.getItem(HS_KEY);
      return hs ? parseInt(hs, 10) || 0 : 0;
    } catch { return 0; }
  });
  const [uiTick, setUiTick] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameState | null>(null);
  const animRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const mouseActiveRef = useRef(false);

  // Sync mute
  useEffect(() => { sfx.enabled = !muted; }, [muted]);

  // Sync gameState from gameRef for UI, and update high score on game over
  const syncState = useCallback(() => {
    const s = gameRef.current;
    if (!s) return;
    setGameState({ ...s });
    if (s.status === 'game-over') {
      setHighScore((prev) => {
        if (s.score > prev) {
          try { localStorage.setItem(HS_KEY, String(s.score)); } catch { /* noop */ }
          return s.score;
        }
        return prev;
      });
    }
  }, []);

  // ─── Start / Restart ────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    sfx.init();
    const state = createInitialState(1, 0, LIVES);
    gameRef.current = state;
    setGameState(state);
  }, []);

  const restartGame = useCallback(() => {
    sfx.init();
    const state = createInitialState(1, 0, LIVES);
    gameRef.current = state;
    setGameState(state);
  }, []);

  const nextLevel = useCallback(() => {
    const s = gameRef.current;
    if (!s) return;
    const state = createInitialState(s.level + 1, s.score, s.lives);
    gameRef.current = state;
    setGameState(state);
  }, []);

  const togglePause = useCallback(() => {
    const s = gameRef.current;
    if (!s) return;
    if (s.status === 'playing') {
      s.status = 'paused';
    } else if (s.status === 'paused') {
      s.status = 'playing';
    }
    syncState();
  }, [syncState]);

  // ─── Game Loop ──────────────────────────────────────────────────────────────

  const hasGame = gameState !== null;

  useEffect(() => {
    if (!hasGame) return;

    const loop = (time: number) => {
      const s = gameRef.current;
      if (!s) return;

      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = time;

      if (s.status === 'playing') {
        updateGame(s, dt);
      }
      updateParticles(s.particles, dt);

      renderCanvas(s, canvasRef, cs);

      // Sync UI when status changes
      if (s.status !== 'playing') {
        syncState();
      }

      animRef.current = requestAnimationFrame(loop);
    };

    lastTimeRef.current = performance.now();
    animRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animRef.current);
  }, [hasGame, syncState, cs]);

  // Periodic UI sync for score/lives
  useEffect(() => {
    if (!hasGame) return;
    const interval = setInterval(() => setUiTick((t) => t + 1), 100);
    return () => clearInterval(interval);
  }, [hasGame]);

  // ─── Keyboard ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!hasGame) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const s = gameRef.current;
      if (!s) return;
      if (e.key === 'p' || e.key === 'P') {
        if (s.status === 'playing' || s.status === 'paused') {
          togglePause();
        }
        e.preventDefault();
        return;
      }
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        s.keyLeft = true;
        mouseActiveRef.current = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        s.keyRight = true;
        mouseActiveRef.current = false;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        if (s.status === 'playing' && !s.ballLaunched) {
          s.ballLaunched = true;
          launchBall(s.ball, s.level);
        }
        e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const s = gameRef.current;
      if (!s) return;
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') s.keyLeft = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') s.keyRight = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [hasGame, togglePause]);

  // ─── Mouse / Touch ──────────────────────────────────────────────────────────

  const handleCanvasMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const s = gameRef.current;
    if (!s || s.status !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    s.paddleX = Math.max(0, Math.min(CANVAS_W - PADDLE_W, x - PADDLE_W / 2));
    mouseActiveRef.current = true;
    s.keyLeft = false;
    s.keyRight = false;
  };

  const handleCanvasClick = () => {
    const s = gameRef.current;
    if (!s) return;
    if (s.status === 'playing' && !s.ballLaunched) {
      s.ballLaunched = true;
      launchBall(s.ball, s.level);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const s = gameRef.current;
    if (!s || s.status !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const touch = e.touches[0];
    if (!touch) return;
    const x = (touch.clientX - rect.left) * scaleX;
    s.paddleX = Math.max(0, Math.min(CANVAS_W - PADDLE_W, x - PADDLE_W / 2));
    e.preventDefault();
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    handleTouchMove(e);
    handleCanvasClick();
  };

  // ─── Start Screen ───────────────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div className="relative min-h-screen overflow-hidden bg-black pt-20 md:pt-24">
        {/* Starfield */}
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="absolute rounded-full bg-white opacity-20" style={{
              width: `${1 + (i % 3)}px`, height: `${1 + (i % 3)}px`,
              top: `${(i * 17.3) % 100}%`, left: `${(i * 29.7) % 100}%`,
            }} />
          ))}
        </div>

        <div className="relative z-10 zion-container flex flex-col items-center space-y-6">
          {/* Header */}
          <div className="flex w-full items-center justify-between">
            <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="h-4 w-4" /> {DogeVsZionGamesBlockBreakerCopy.back[cs ? 'cs' : 'en']}
            </button>
            <button onClick={() => { sfx.init(); setMuted((m) => !m); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>

          {/* Title */}
          <div className="text-center">
            <h1 className="text-3xl md:text-5xl font-bold text-gradient">{DogeVsZionGamesBlockBreakerCopy.blockBreaker[cs ? 'cs' : 'en']}</h1>
            <p className="mt-2 text-sm text-gray-500">{DogeVsZionGamesBlockBreakerCopy.breakThroughTheFirewallsFreeTh[cs ? 'cs' : 'en']}</p>
          </div>

          {/* High score */}
          {highScore > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-zion-gold/20 bg-zion-gold/5 px-4 py-2">
              <Trophy className="h-4 w-4 text-zion-gold" />
              <span className="text-sm font-bold text-zion-gold">{DogeVsZionGamesBlockBreakerCopy.highScore[cs ? 'cs' : 'en']}: {highScore}</span>
            </div>
          )}

          {/* Start button */}
          <button onClick={startGame} className="rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-8 py-3 text-lg font-bold text-zion-gold hover:bg-zion-gold/30 transition-colors">
            {DogeVsZionGamesBlockBreakerCopy.startGame[cs ? 'cs' : 'en']}
          </button>

          {/* Instructions */}
          <div className="max-w-md zion-rainbow-card p-5 text-center" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <h3 className="mb-3 text-sm font-bold text-white">{DogeVsZionGamesBlockBreakerCopy.howToPlay[cs ? 'cs' : 'en']}</h3>
            <div className="space-y-2 text-xs text-gray-400">
              <p>{DogeVsZionGamesBlockBreakerCopy.moveThe[cs ? 'cs' : 'en']}<span className="text-zion-gold-400 font-bold">{DogeVsZionGamesBlockBreakerCopy.firewall[cs ? 'cs' : 'en']}</span>{DogeVsZionGamesBlockBreakerCopy.paddleWithMouseOrArrowKeys[cs ? 'cs' : 'en']}</p>
              <p>{DogeVsZionGamesBlockBreakerCopy.launchThe[cs ? 'cs' : 'en']}<span className="text-zion-purple-400 font-bold">{DogeVsZionGamesBlockBreakerCopy.validatorNode[cs ? 'cs' : 'en']}</span>{DogeVsZionGamesBlockBreakerCopy.withClickOrSpace[cs ? 'cs' : 'en']}</p>
              <p>{DogeVsZionGamesBlockBreakerCopy.breakThrough[cs ? 'cs' : 'en']}<span className="text-zion-purple-400 font-bold">{DogeVsZionGamesBlockBreakerCopy.firewallSegments[cs ? 'cs' : 'en']}</span>{DogeVsZionGamesBlockBreakerCopy.toScorePoints[cs ? 'cs' : 'en']}</p>
              <p>{DogeVsZionGamesBlockBreakerCopy.donu2019tLetTheNodeFallYouHave[cs ? 'cs' : 'en']}<span className="text-zion-purple-400 font-bold">{DogeVsZionGamesBlockBreakerCopy.k3Lives[cs ? 'cs' : 'en']}</span></p>
              <p>{DogeVsZionGamesBlockBreakerCopy.clearAllBlocksToAdvanceToTheNe[cs ? 'cs' : 'en']}</p>
            </div>
          </div>

          {/* Layer legend */}
          <div className="max-w-md zion-rainbow-card p-5" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <h3 className="mb-3 text-sm font-bold text-white">{DogeVsZionGamesBlockBreakerCopy.firewallLayers[cs ? 'cs' : 'en']}</h3>
            <div className="space-y-2">
              {ROW_DEFS.map((row, i) => (
                <div key={i} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-8 rounded" style={{ backgroundColor: row.color, border: `1px solid ${row.borderColor}` }} />
                    <span className="text-gray-300">{row.label}</span>
                  </div>
                  <span className="text-gray-500">{row.points} {DogeVsZionGamesBlockBreakerCopy.pts[cs ? 'cs' : 'en']}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ─── Game Screen ─────────────────────────────────────────────────────────────

  const s = gameState;
  void uiTick; // force re-render

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-black pt-20 md:pt-24">
      <div className="relative z-10 zion-container space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" /> {DogeVsZionGamesBlockBreakerCopy.back[cs ? 'cs' : 'en']}
          </button>
          <div className="flex items-center gap-2">
            <button onClick={togglePause} disabled={s.status !== 'playing' && s.status !== 'paused'} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-30">
              {s.status === 'paused' ? '▶' : '⏸'}
            </button>
            <button onClick={restartGame} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              <RefreshCw className="h-4 w-4" />
            </button>
            <button onClick={() => { sfx.init(); setMuted((m) => !m); }} className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs text-gray-400 hover:text-white transition-colors">
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gradient">{DogeVsZionGamesBlockBreakerCopy.blockBreaker[cs ? 'cs' : 'en']}</h1>
          <p className="text-[10px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.breakThroughTheFirewallsFreeTh[cs ? 'cs' : 'en']}</p>
        </div>

        {/* Info bar */}
        <div style={{ '--rc': '252, 209, 22' } as React.CSSProperties} className="zion-rainbow-card p-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.score[cs ? 'cs' : 'en']}</p>
              <p className="text-sm font-bold tabular-nums text-white">{s.score}</p>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.level[cs ? 'cs' : 'en']}</p>
              <p className="text-sm font-bold tabular-nums text-zion-gold">{s.level}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.lives[cs ? 'cs' : 'en']}</p>
              <div className="flex gap-1">
                {Array.from({ length: LIVES }).map((_, i) => (
                  <span key={i} className={i < s.lives ? 'text-zion-purple-400' : 'text-gray-700'}>❤</span>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.high[cs ? 'cs' : 'en']}</p>
              <p className="text-sm font-bold tabular-nums text-zion-gold">{Math.max(highScore, s.score)}</p>
            </div>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex justify-center">
          <div className="zion-rainbow-card overflow-hidden" style={{ '--rc': '252, 209, 22' } as React.CSSProperties}>
            <canvas
              ref={canvasRef}
              onMouseMove={handleCanvasMove}
              onClick={handleCanvasClick}
              onTouchMove={handleTouchMove}
              onTouchStart={handleTouchStart}
              className="block cursor-pointer"
              style={{ width: CANVAS_W, height: CANVAS_H, maxWidth: '100%', touchAction: 'none' }}
            />
          </div>
        </div>

        {/* Pause overlay */}
        {s.status === 'paused' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="rounded-2xl border border-zion-gold/30 bg-gradient-to-br from-black/90 to-zion-gold/10 p-6 text-center max-w-sm">
              <p className="text-3xl mb-2">⏸</p>
              <p className="text-lg font-bold text-zion-gold mb-4">{DogeVsZionGamesBlockBreakerCopy.paused[cs ? 'cs' : 'en']}</p>
              <button onClick={togglePause} className="w-full rounded-xl bg-zion-gold/20 border border-zion-gold/30 px-4 py-2.5 text-sm font-bold text-zion-gold hover:bg-zion-gold/30 transition-colors">
                {DogeVsZionGamesBlockBreakerCopy.resume[cs ? 'cs' : 'en']}
              </button>
              <p className="mt-3 text-[11px] text-gray-500">{DogeVsZionGamesBlockBreakerCopy.pressPToResume[cs ? 'cs' : 'en']}</p>
            </div>
          </div>
        )}

        {/* Level complete overlay */}
        {s.status === 'level-complete' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div className="rounded-2xl border border-zion-cyan-500/30 bg-gradient-to-br from-black/90 to-zion-cyan-500/10 p-6 text-center max-w-sm">
              <p className="text-3xl mb-2">🔓</p>
              <p className="text-lg font-bold text-zion-cyan-300 mb-2">{cs ? `Vrstva ${s.level} proražena!` : `Layer ${s.level} Breached!`}</p>
              <p className="text-xs text-gray-400 mb-1">{DogeVsZionGamesBlockBreakerCopy.score[cs ? 'cs' : 'en']}: {s.score}</p>
              <p className="text-xs text-gray-500 mb-4">{DogeVsZionGamesBlockBreakerCopy.nextLayerFasterNodeMoreFirewal[cs ? 'cs' : 'en']}</p>
              <button onClick={nextLevel} className="w-full rounded-xl bg-zion-cyan-500/20 border border-zion-cyan-500/30 px-4 py-2.5 text-sm font-bold text-zion-cyan-300 hover:bg-zion-cyan-500/30 transition-colors">
                {cs ? `Postup na vrstvu ${s.level + 1} →` : `Advance to Layer ${s.level + 1} →`}
              </button>
            </div>
          </div>
        )}

        {/* Game over overlay */}
        {s.status === 'game-over' && (
          <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
            <div className="rounded-2xl border border-zion-purple-500/30 bg-gradient-to-br from-black/90 to-zion-purple-500/10 p-6 text-center max-w-sm">
              <p className="text-3xl mb-2">🔥</p>
              <p className="text-lg font-bold text-zion-purple-300 mb-2">{DogeVsZionGamesBlockBreakerCopy.firewallCompromised[cs ? 'cs' : 'en']}</p>
              <p className="text-xs text-gray-400 mb-1">{DogeVsZionGamesBlockBreakerCopy.finalScore[cs ? 'cs' : 'en']}: {s.score}</p>
              <p className="text-xs text-gray-400 mb-1">{DogeVsZionGamesBlockBreakerCopy.layersBreached[cs ? 'cs' : 'en']}: {s.level - 1}</p>
              {s.score >= highScore && s.score > 0 && (
                <p className="text-xs font-bold text-zion-gold mb-4 flex items-center justify-center gap-1">
                  <Trophy className="h-3 w-3" /> {DogeVsZionGamesBlockBreakerCopy.newHighScore[cs ? 'cs' : 'en']}
                </p>
              )}
              {s.score < highScore && (
                <p className="text-xs text-gray-500 mb-4">{DogeVsZionGamesBlockBreakerCopy.highScore[cs ? 'cs' : 'en']}: {highScore}</p>
              )}
              <div className="flex gap-2">
                <button onClick={onBack} className="flex-1 rounded-xl bg-white/10 border border-white/20 px-4 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-colors">
                  {DogeVsZionGamesBlockBreakerCopy.back[cs ? 'cs' : 'en']}
                </button>
                <button onClick={restartGame} className="flex-1 rounded-xl bg-zion-purple-500/20 border border-zion-purple-500/30 px-4 py-2.5 text-sm font-bold text-zion-purple-300 hover:bg-zion-purple-500/30 transition-colors">
                  {DogeVsZionGamesBlockBreakerCopy.retry[cs ? 'cs' : 'en']}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
