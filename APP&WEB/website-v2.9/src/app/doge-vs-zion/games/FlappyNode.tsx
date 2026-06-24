'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, Volume2, VolumeX, RefreshCw, Trophy } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 400;
const CANVAS_H = 600;
const GROUND_Y = 560;
const GRAVITY = 1400;       // px/s^2
const FLAP_VY = -420;       // px/s
const OBSTACLE_SPEED = 160; // px/s
const OBSTACLE_GAP = 140;   // px gap between top and bottom pillars
const OBSTACLE_SPACING = 250; // px horizontal spacing
const OBSTACLE_WIDTH = 56;
const NODE_RADIUS = 16;
const NODE_X = 110;
const HS_KEY = 'flappy-node-hs';

// ─── Sound Manager ────────────────────────────────────────────────────────────

class SoundManager {
  ctx: AudioContext | null = null;
  enabled = true;

  init() {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch { /* noop */ }
    }
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, rampTo?: number) {
    if (!this.enabled || !this.ctx) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (rampTo) osc.frequency.exponentialRampToValueAtTime(rampTo, this.ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + dur);
  }

  flap() { this.tone(420, 0.09, 'square', 0.04, 680); }
  score() { this.tone(880, 0.12, 'sine', 0.05, 1320); }
  crash() { this.tone(180, 0.35, 'sawtooth', 0.08, 60); }
}

const sfx = new SoundManager();

// ─── Types ────────────────────────────────────────────────────────────────────

type GameStatus = 'ready' | 'playing' | 'over';

interface Obstacle {
  x: number;
  gapY: number;   // center of gap
  passed: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  tw: number; // twinkle phase
}

interface GameState {
  status: GameStatus;
  nodeY: number;
  vy: number;
  rotation: number;
  obstacles: Obstacle[];
  score: number;
  spawnX: number; // x position where next obstacle should spawn
  flash: number;  // crash flash timer
}

// ─── Stars (module-level, generated once) ─────────────────────────────────────

const STARS: Star[] = Array.from({ length: 60 }, () => ({
  x: Math.random() * CANVAS_W,
  y: Math.random() * (GROUND_Y - 20),
  r: Math.random() * 1.4 + 0.3,
  tw: Math.random() * Math.PI * 2,
}));

// ─── Game Logic (module-level) ────────────────────────────────────────────────

function createInitialState(): GameState {
  return {
    status: 'ready',
    nodeY: CANVAS_H / 2,
    vy: 0,
    rotation: 0,
    obstacles: [],
    score: 0,
    spawnX: CANVAS_W + 60,
    flash: 0,
  };
}

function startGame(s: GameState): GameState {
  const next = createInitialState();
  next.status = 'playing';
  next.spawnX = CANVAS_W + 40;
  return next;
}

function flap(s: GameState) {
  if (s.status === 'ready') {
    s.status = 'playing';
  }
  if (s.status === 'playing') {
    s.vy = FLAP_VY;
    sfx.flap();
  }
}

function spawnObstacle(s: GameState) {
  const minTop = 70;
  const maxTop = GROUND_Y - OBSTACLE_GAP - 70;
  const gapY = minTop + OBSTACLE_GAP / 2 + Math.random() * (maxTop - minTop);
  s.obstacles.push({ x: s.spawnX, gapY, passed: false });
  s.spawnX += OBSTACLE_SPACING;
}

function updateGame(s: GameState, dt: number): { crashed: boolean; scored: boolean } {
  let crashed = false;
  let scored = false;

  if (s.status !== 'playing') {
    if (s.flash > 0) s.flash = Math.max(0, s.flash - dt);
    return { crashed, scored };
  }

  // Physics
  s.vy += GRAVITY * dt;
  s.nodeY += s.vy * dt;
  // Rotation based on velocity
  const targetRot = Math.max(-0.5, Math.min(1.2, s.vy / 600));
  s.rotation += (targetRot - s.rotation) * Math.min(1, dt * 8);

  // Spawn obstacles
  while (s.spawnX < CANVAS_W + OBSTACLE_WIDTH) {
    spawnObstacle(s);
  }

  // Move obstacles
  for (const o of s.obstacles) o.x -= OBSTACLE_SPEED * dt;
  // Cull off-screen
  s.obstacles = s.obstacles.filter((o) => o.x > -OBSTACLE_WIDTH - 10);

  // Score & collision
  for (const o of s.obstacles) {
    if (!o.passed && o.x + OBSTACLE_WIDTH < NODE_X - NODE_RADIUS) {
      o.passed = true;
      s.score++;
      scored = true;
      sfx.score();
    }
    // Collision check (circle vs rect for top & bottom pillars)
    const topRect = { x: o.x, y: 0, w: OBSTACLE_WIDTH, h: o.gapY - OBSTACLE_GAP / 2 };
    const botRect = { x: o.x, y: o.gapY + OBSTACLE_GAP / 2, w: OBSTACLE_WIDTH, h: GROUND_Y - (o.gapY + OBSTACLE_GAP / 2) };
    if (circleRectHit(NODE_X, s.nodeY, NODE_RADIUS, topRect) ||
        circleRectHit(NODE_X, s.nodeY, NODE_RADIUS, botRect)) {
      crashed = true;
    }
  }

  // Ground / ceiling
  if (s.nodeY + NODE_RADIUS >= GROUND_Y) {
    s.nodeY = GROUND_Y - NODE_RADIUS;
    crashed = true;
  }
  if (s.nodeY - NODE_RADIUS <= 0) {
    s.nodeY = NODE_RADIUS;
    s.vy = 0;
  }

  if (crashed) {
    s.status = 'over';
    s.flash = 0.4;
    sfx.crash();
  }

  return { crashed, scored };
}

function circleRectHit(cx: number, cy: number, r: number, rect: { x: number; y: number; w: number; h: number }): boolean {
  const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

// ─── Rendering (module-level) ─────────────────────────────────────────────────

function render(s: GameState, canvas: HTMLCanvasElement, t: number) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  grad.addColorStop(0, '#0a0a1a');
  grad.addColorStop(1, '#1a0a2a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Stars
  for (const star of STARS) {
    const alpha = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 2 + star.tw));
    ctx.fillStyle = `rgba(255,255,255,${alpha.toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Obstacles (firewall pillars)
  for (const o of s.obstacles) {
    const topH = o.gapY - OBSTACLE_GAP / 2;
    const botY = o.gapY + OBSTACLE_GAP / 2;
    const botH = GROUND_Y - botY;
    drawPillar(ctx, o.x, 0, OBSTACLE_WIDTH, topH);
    drawPillar(ctx, o.x, botY, OBSTACLE_WIDTH, botH);
  }

  // Ground line
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, GROUND_Y);
  ctx.lineTo(CANVAS_W, GROUND_Y);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Node (player)
  ctx.save();
  ctx.translate(NODE_X, s.nodeY);
  ctx.rotate(s.rotation);
  // Glow
  ctx.shadowColor = '#3b82f6';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#1e40af';
  ctx.beginPath();
  ctx.arc(0, 0, NODE_RADIUS, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Ring
  ctx.strokeStyle = '#60a5fa';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, NODE_RADIUS - 2, 0, Math.PI * 2);
  ctx.stroke();
  // Emoji
  ctx.font = '18px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛡️', 0, 1);
  ctx.restore();

  // Crash flash
  if (s.flash > 0) {
    ctx.fillStyle = `rgba(239,68,68,${(s.flash * 0.5).toFixed(3)})`;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
}

function drawPillar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  if (h <= 0) return;
  ctx.fillStyle = '#0d2818';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#10b981';
  ctx.lineWidth = 2;
  ctx.shadowColor = '#10b981';
  ctx.shadowBlur = 6;
  ctx.strokeRect(x + 1, y + 1, w - 2, h - 2);
  ctx.shadowBlur = 0;
  // Segment lines
  ctx.strokeStyle = 'rgba(16,185,129,0.25)';
  ctx.lineWidth = 1;
  for (let sy = y + 20; sy < y + h; sy += 24) {
    ctx.beginPath();
    ctx.moveTo(x + 4, sy);
    ctx.lineTo(x + w - 4, sy);
    ctx.stroke();
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FlappyNode({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stateRef = useRef<GameState>(createInitialState());
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const mutedRef = useRef<boolean>(false);

  const [uiStatus, setUiStatus] = useState<GameStatus>('ready');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    try {
      const v = localStorage.getItem(HS_KEY);
      return v ? (parseInt(v, 10) || 0) : 0;
    } catch { return 0; }
  });
  const [muted, setMuted] = useState(false);

  const syncUI = useCallback(() => {
    const s = stateRef.current;
    setUiStatus(s.status);
    setScore(s.score);
  }, []);

  const doFlap = useCallback(() => {
    sfx.init();
    flap(stateRef.current);
    syncUI();
  }, [syncUI]);

  const restart = useCallback(() => {
    stateRef.current = startGame(stateRef.current);
    sfx.init();
    syncUI();
  }, [syncUI]);

  const toggleMute = useCallback(() => {
    const next = !mutedRef.current;
    mutedRef.current = next;
    sfx.enabled = !next;
    setMuted(next);
  }, []);

  // Game loop
  useEffect(() => {
    const loop = (time: number) => {
      const last = lastTimeRef.current || time;
      const dt = Math.min(0.05, (time - last) / 1000);
      lastTimeRef.current = time;

      const s = stateRef.current;
      const prevStatus = s.status;
      updateGame(s, dt);
      render(s, canvasRef.current!, time / 1000);

      if (s.status !== prevStatus || s.score !== score) {
        syncUI();
        if (s.status === 'over' && prevStatus === 'playing') {
          // Persist high score
          try {
            const prev = parseInt(localStorage.getItem(HS_KEY) || '0', 10);
            if (s.score > prev) {
              localStorage.setItem(HS_KEY, String(s.score));
              setHighScore(s.score);
            }
          } catch { /* noop */ }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncUI]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        if (stateRef.current.status === 'over') restart();
        else doFlap();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [doFlap, restart]);

  const handleCanvasInteract = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (stateRef.current.status === 'over') restart();
    else doFlap();
  }, [doFlap, restart]);

  return (
    <div className="relative flex flex-col items-center w-full max-w-md mx-auto select-none">
      {/* Header */}
      <div className="w-full flex items-center justify-between mb-3">
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors text-sm"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="text-center">
          <h2 className="text-lg font-bold text-white leading-tight">Flappy Node</h2>
          <p className="text-[11px] text-slate-400">Keep the node alive. Dodge the firewalls.</p>
        </div>
        <button
          onClick={toggleMute}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-colors"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>

      {/* Game area */}
      <div className="relative" style={{ width: CANVAS_W, height: CANVAS_H }}>
        <canvas
          ref={canvasRef}
          width={CANVAS_W}
          height={CANVAS_H}
          onMouseDown={handleCanvasInteract}
          onTouchStart={handleCanvasInteract}
          className="rounded-xl border border-white/10 cursor-pointer touch-none"
          style={{ display: 'block' }}
        />

        {/* Score overlay during play */}
        {uiStatus === 'playing' && (
          <div className="absolute top-4 left-0 right-0 flex flex-col items-center pointer-events-none">
            <span className="text-5xl font-black text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
              {score}
            </span>
          </div>
        )}

        {/* Ready screen */}
        {uiStatus === 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 rounded-xl backdrop-blur-sm">
            <div className="text-5xl mb-3">🛡️</div>
            <h3 className="text-2xl font-bold text-white mb-1">Flappy Node</h3>
            <p className="text-sm text-slate-300 mb-5 text-center px-6">
              Click / Spacebar to flap
            </p>
            <button
              onClick={doFlap}
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors shadow-lg shadow-emerald-500/30"
            >
              Start
            </button>
            <div className="mt-4 flex items-center gap-1.5 text-xs text-amber-300">
              <Trophy size={13} /> Best: {highScore}
            </div>
          </div>
        )}

        {/* Game over screen */}
        {uiStatus === 'over' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/65 rounded-xl backdrop-blur-sm">
            <h3 className="text-2xl font-bold text-red-400 mb-2">Node Down</h3>
            <div className="flex items-center gap-4 mb-4">
              <div className="text-center">
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">Score</div>
                <div className="text-3xl font-black text-white">{score}</div>
              </div>
              <div className="w-px h-10 bg-white/15" />
              <div className="text-center">
                <div className="text-[11px] text-slate-400 uppercase tracking-wide">Best</div>
                <div className="text-3xl font-black text-amber-300 flex items-center gap-1">
                  <Trophy size={20} /> {highScore}
                </div>
              </div>
            </div>
            {score > 0 && score >= highScore && (
              <div className="mb-3 text-xs text-emerald-400 font-semibold">New High Score!</div>
            )}
            <button
              onClick={restart}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-semibold transition-colors shadow-lg shadow-emerald-500/30"
            >
              <RefreshCw size={16} /> Retry
            </button>
          </div>
        )}
      </div>

      {/* Footer hint */}
      <p className="mt-3 text-[11px] text-slate-500 text-center">
        Tap, click, or press Space to flap. Pass through the firewall gaps to score.
      </p>
    </div>
  );
}

export default FlappyNode;
