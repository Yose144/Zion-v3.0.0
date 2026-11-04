'use client';

/**
 * OLDSCHOOL TANKY 2D — artilerie na canvasu.
 *
 * Renderer jen čte `TanksState`; nic nepočítá (pravidla jsou v `tanks.ts`).
 * Vzhled schválně „z roku 1994": ploché barvy, dvoubodové písmo, dithering,
 * rastrové linky přes obraz a žádné vyhlazování textu.
 *
 * Kreslí se do pevného rozlišení (`VIEW_W × VIEW_H`), CSS ho roztáhne.
 * Tak zůstane „pixelový" vzhled i na velkém displeji.
 */

import { useEffect, useRef } from 'react';
import {
  BLAST_R,
  SPEED_MAX,
  SPEED_MIN,
  TANK_H,
  TANK_W,
  TERRAIN_COLS,
  WORLD_H,
  WORLD_W,
  tankCenter,
  terrainAt,
  type TanksState,
} from './tanks';

const VIEW_W = 960;
const VIEW_H = 540;

const C = {
  sky0: '#0a0713',
  sky1: '#1b1224',
  sky2: '#37241f',
  terrain: '#8a5a2b',
  terrainDeep: '#5a3a1c',
  terrainTop: '#e8b163',
  player: '#4fd6c4',
  playerDark: '#1f7a70',
  bot: '#e0603d',
  botDark: '#8a2f1c',
  ink: '#ffe9b8',
  dim: 'rgba(255, 233, 184, 0.55)',
  shot: '#ffd166',
  blast: '#fff2c4',
};

/** Vykreslí jeden snímek. `t` = čas v sekundách (pro blikání kurzoru). */
export function drawTanks2D(
  context: CanvasRenderingContext2D,
  state: TanksState,
  t: number,
  /** Na telefonu je plátno malé — HUD jde do DOM a v obraze zůstane jen tah. */
  compact = false,
) {
  const { terrain, player, bot } = state;

  // ── obloha ──────────────────────────────────────────────────────────
  const sky = context.createLinearGradient(0, 0, 0, VIEW_H);
  sky.addColorStop(0, C.sky0);
  sky.addColorStop(0.55, C.sky1);
  sky.addColorStop(1, C.sky2);
  context.fillStyle = sky;
  context.fillRect(0, 0, VIEW_W, VIEW_H);

  const scale = VIEW_W / WORLD_W;
  const toX = (x: number) => x * scale;
  const toY = (y: number) => VIEW_H - y * scale;

  // hvězdy (deterministické, jen jako dekorace)
  context.fillStyle = 'rgba(255, 233, 184, 0.5)';
  for (let i = 0; i < 90; i += 1) {
    const sx = ((i * 137.5) % VIEW_W) | 0;
    const sy = ((i * 71.3) % (VIEW_H * 0.5)) | 0;
    context.fillRect(sx, sy, 1, 1);
  }

  // Saturnův prstenec na obloze — připomínka, kde hrajeme
  context.save();
  context.translate(VIEW_W * 0.78, VIEW_H * 0.18);
  context.rotate(-0.32);
  context.strokeStyle = 'rgba(232, 177, 99, 0.35)';
  context.lineWidth = 10;
  context.beginPath();
  context.ellipse(0, 0, 150, 26, 0, 0, Math.PI * 2);
  context.stroke();
  context.strokeStyle = 'rgba(232, 177, 99, 0.18)';
  context.lineWidth = 4;
  context.beginPath();
  context.ellipse(0, 0, 190, 34, 0, 0, Math.PI * 2);
  context.stroke();
  context.restore();

  // ── terén ───────────────────────────────────────────────────────────
  context.beginPath();
  context.moveTo(0, VIEW_H);
  for (let i = 0; i < TERRAIN_COLS; i += 1) {
    context.lineTo(toX(i * (WORLD_W / (TERRAIN_COLS - 1))), toY(terrain.heights[i]!));
  }
  context.lineTo(VIEW_W, VIEW_H);
  context.closePath();
  const ground = context.createLinearGradient(0, VIEW_H * 0.35, 0, VIEW_H);
  ground.addColorStop(0, C.terrain);
  ground.addColorStop(1, C.terrainDeep);
  context.fillStyle = ground;
  context.fill();

  // světlá hrana povrchu (oldschool obrys)
  context.beginPath();
  for (let i = 0; i < TERRAIN_COLS; i += 1) {
    const x = toX(i * (WORLD_W / (TERRAIN_COLS - 1)));
    const y = toY(terrain.heights[i]!);
    if (i === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }
  context.strokeStyle = C.terrainTop;
  context.lineWidth = 2;
  context.stroke();

  // dithering pruhy v zemi (jen náznak, žádná textura)
  context.fillStyle = 'rgba(0,0,0,0.14)';
  for (let y = VIEW_H - 24; y > VIEW_H * 0.45; y -= 12) {
    context.fillRect(0, y, VIEW_W, 3);
  }

  // ── tanky ───────────────────────────────────────────────────────────
  const drawTank = (tank: typeof player, live: boolean) => {
    const center = tankCenter(terrain, tank);
    const cx = toX(center.x);
    const cy = toY(center.y);
    const w = TANK_W * scale;
    const h = TANK_H * scale;
    const body = tank.side === 'player' ? C.player : C.bot;
    const dark = tank.side === 'player' ? C.playerDark : C.botDark;

    context.save();
    context.translate(cx, cy);

    // pásy
    context.fillStyle = dark;
    context.fillRect(-w / 2, h / 2 - 5, w, 5);
    for (let i = -2; i <= 2; i += 1) {
      context.fillStyle = 'rgba(0,0,0,0.35)';
      context.fillRect(i * (w / 5), h / 2 - 5, 3, 5);
    }

    // korba
    context.fillStyle = body;
    context.fillRect(-w / 2 + 3, -h / 2 + 2, w - 6, h - 4);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(-w / 2 + 3, -h / 2 + 2, w - 6, 3);

    // věž (kruh) + hlaveň
    context.fillStyle = body;
    context.beginPath();
    context.arc(0, -2, h * 0.42, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = 'rgba(0,0,0,0.4)';
    context.lineWidth = 1;
    context.stroke();

    const rad = (tank.angle * Math.PI) / 180;
    const dir = tank.side === 'player' ? 1 : -1;
    context.strokeStyle = C.ink;
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, -2);
    context.lineTo(Math.cos(rad) * 26 * dir, -2 - Math.sin(rad) * 26);
    context.stroke();

    // HP proužek nad tankem
    if (live) {
      const hpW = 46;
      const hp = Math.max(0, tank.hp) / 100;
      context.fillStyle = 'rgba(0,0,0,0.55)';
      context.fillRect(-hpW / 2, -h / 2 - 18, hpW, 6);
      context.fillStyle = hp > 0.5 ? '#7fe3a0' : hp > 0.25 ? '#ffd166' : '#ff7a6b';
      context.fillRect(-hpW / 2 + 1, -h / 2 - 17, (hpW - 2) * hp, 4);
    }
    context.restore();
  };

  if (player.alive) drawTank(player, true);
  if (bot.alive) drawTank(bot, true);

  // ── stopa střely ────────────────────────────────────────────────────
  if (state.shot) {
    const { trail } = state.shot;
    context.fillStyle = C.dim;
    for (let i = 0; i < trail.length - 2; i += 2) {
      context.fillRect(toX(trail[i]!), toY(trail[i + 1]!), 2, 2);
    }
    context.fillStyle = C.shot;
    context.beginPath();
    context.arc(toX(state.shot.x), toY(state.shot.y), 4, 0, Math.PI * 2);
    context.fill();
  }

  // ── výbuchy ─────────────────────────────────────────────────────────
  for (const blast of state.explosions) {
    const p = Math.min(1, blast.age / 0.7);
    const r = (BLAST_R * scale) * (0.35 + p * 0.9);
    context.strokeStyle = `rgba(255, 242, 196, ${1 - p})`;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(toX(blast.x), toY(blast.y), r, 0, Math.PI * 2);
    context.stroke();
    context.fillStyle = `rgba(255, 209, 102, ${0.5 * (1 - p)})`;
    context.beginPath();
    context.arc(toX(blast.x), toY(blast.y), r * 0.5, 0, Math.PI * 2);
    context.fill();
  }

  // ── rámeček a rastr (oldschool) ─────────────────────────────────────
  context.strokeStyle = 'rgba(255, 209, 102, 0.35)';
  context.lineWidth = 2;
  context.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);
  context.fillStyle = 'rgba(0, 0, 0, 0.16)';
  for (let y = 0; y < VIEW_H; y += 3) context.fillRect(0, y, VIEW_W, 1);

  // ── HUD v obraze ────────────────────────────────────────────────────
  const font = (size: number) => `800 ${size}px "Courier New", ui-monospace, monospace`;
  context.textBaseline = 'top';

  if (compact) {
    // Malý displej: v plátně je jen to, co musí být vidět vždy (tah).
    const who2 = state.over
      ? state.over === 'player'
        ? 'VYHRÁL JSI'
        : 'BOT VYHRÁL'
      : state.turn === 'player'
        ? 'TVŮJ TAH'
        : 'BOT MÍŘÍ';
    context.font = font(34);
    context.fillStyle = state.turn === 'player' ? C.player : C.bot;
    if (Math.floor(t * 2) % 2 === 0 || state.phase !== 'aim') {
      context.fillText(who2, 22, 18);
    }
    if (state.phase === 'over') {
      context.fillStyle = 'rgba(5, 4, 10, 0.6)';
      context.fillRect(0, VIEW_H / 2 - 60, VIEW_W, 120);
      context.textAlign = 'center';
      context.font = font(52);
      context.fillStyle = state.over === 'player' ? C.player : C.bot;
      context.fillText(state.over === 'player' ? 'VÍTĚZSTVÍ' : 'PORÁŽKA', VIEW_W / 2, VIEW_H / 2 - 30);
      context.textAlign = 'left';
    }
    return;
  }

  context.font = font(20);
  context.fillStyle = C.ink;

  const shooter = state.turn === 'player' ? player : bot;
  const who = state.over
    ? state.over === 'player'
      ? 'VYHRÁL JSI'
      : 'BOT VYHRÁL'
    : state.turn === 'player'
      ? 'TVŮJ TAH'
      : 'BOT MÍŘÍ';
  context.fillStyle = state.turn === 'player' ? C.player : C.bot;
  if (Math.floor(t * 2) % 2 === 0 || state.phase !== 'aim') {
    context.fillText(who, 18, 12);
  }

  context.font = font(16);
  context.fillStyle = C.ink;
  context.fillText(`ÚHEL ${Math.round(shooter.angle).toString().padStart(2, '0')}°`, 18, 40);
  context.fillText(`SÍLA ${Math.round(shooter.power).toString().padStart(3, '0')}`, 18, 60);

  // proužek síly
  context.fillStyle = 'rgba(0,0,0,0.45)';
  context.fillRect(140, 62, 150, 10);
  context.fillStyle = C.shot;
  context.fillRect(141, 63, 148 * (shooter.power / 100), 8);

  // vítr
  const windLabel =
    state.wind === 0
      ? 'BEZ VĚTRU'
      : state.wind > 0
        ? `VÍTR DOPRAVA ${state.wind}`
        : `VÍTR DOLEVA ${-state.wind}`;
  context.fillStyle = C.dim;
  context.font = font(14);
  context.textAlign = 'center';
  context.fillText(windLabel, VIEW_W / 2, 16);
  context.textAlign = 'left';

  // skóre a dostřel
  context.textAlign = 'right';
  context.fillStyle = C.ink;
  context.font = font(16);
  context.fillText(`TY ${state.wins.player} : ${state.wins.bot} BOT`, VIEW_W - 18, 14);
  context.fillStyle = C.dim;
  context.font = font(13);
  context.fillText(`RÁNY ${state.shotsFired}`, VIEW_W - 18, 38);
  context.textAlign = 'left';

  if (state.phase === 'over') {
    context.fillStyle = 'rgba(5, 4, 10, 0.55)';
    context.fillRect(0, VIEW_H * 0.36, VIEW_W, 96);
    context.textAlign = 'center';
    context.font = font(34);
    context.fillStyle = state.over === 'player' ? C.player : C.bot;
    context.fillText(state.over === 'player' ? 'VÍTĚZSTVÍ' : 'PORÁŽKA', VIEW_W / 2, VIEW_H * 0.4);
    context.font = font(14);
    context.fillStyle = C.ink;
    context.fillText('NOVÁ HRA — mezerník', VIEW_W / 2, VIEW_H * 0.4 + 48);
    context.textAlign = 'left';
  }

  // nápověda ovládání
  context.font = font(12);
  context.fillStyle = 'rgba(255, 233, 184, 0.4)';
  context.fillText('← → ÚHEL   ↑ ↓ SÍLA   MEZERNÍK PALBA', 18, VIEW_H - 26);
}

export function TanksCanvas({
  state,
  compact = false,
}: {
  state: React.MutableRefObject<TanksState>;
  compact?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const context = canvas.getContext('2d');
    if (!context) return;
    let alive = true;
    let frame = 0;
    let started = performance.now();

    // Kreslí se z vlastní smyčky — sim se posouvá ve `TanksGame`, aby 2D
    // i 3D běžely stejně rychle.
    const loop = () => {
      if (!alive) return;
      const t = (performance.now() - started) / 1000;
      drawTanks2D(context, state.current, t, compact);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    void started;
    return () => {
      alive = false;
      cancelAnimationFrame(frame);
    };
  }, [state, compact]);

  return (
    <canvas
      ref={canvasRef}
      className="tanks-screen"
      aria-label="Oldschool tanky — 2D artilerie"
    />
  );
}

/** Pomocné exporty pro testy a HUD (rozlišení obrazovky). */
export const TANK_VIEW = { width: VIEW_W, height: VIEW_H, maxSpeed: SPEED_MAX, minSpeed: SPEED_MIN, world: { w: WORLD_W, h: WORLD_H } };
export { terrainAt };
