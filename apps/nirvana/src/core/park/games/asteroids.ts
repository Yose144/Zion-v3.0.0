import {
  GAME_H,
  GAME_W,
  PARK_PALETTE,
  prepareCanvas,
  type ParkGameHandle,
  type ParkGameHooks,
} from './types';

/**
 * ASTEROIDS — pátá skříň na Jupiter Station. Vesmírná střílečka s hybností:
 * loď se otáčí, tlačí vpřed a nechává se unášet; skály se dělí na tři velikosti.
 *
 * Na rozdíl od Pongu/Snake potřebuje pořád jen `frame`/`pointer`/`key`, takže
 * funguje i na obrazovce skříně ve VR. Stejná pravidla jako ostatní canvas hry:
 * ve smyčce se nic nealokuje (částice jsou předalokovaná pole).
 */

const MAX_ROCKS = 28;
const MAX_BULLETS = 14;
const STARS = 70;

const ROTATE = 4.4; // rad/s
const THRUST = 150; // px/s²
const DRAG = 0.55; // 1/s
const BULLET_SPEED = 330; // px/s
const BULLET_LIFE = 1.15; // s
const FIRE_COOLDOWN = 0.32; // s
const START_LIVES = 3;
const RESPAWN_GUARD = 1.6; // s nezranitelnosti po smrti

/** Výška skály (3 = největší) → poloměr a body za zničení. */
const ROCK_RADIUS = [0, 9, 15, 24];
const ROCK_SCORE = [0, 100, 50, 20];

export function createAsteroids(canvas: HTMLCanvasElement, hooks: ParkGameHooks): ParkGameHandle {
  const ctx = prepareCanvas(canvas);

  // ── předalokované pole (žádný `new` ve smyčce) ──────────────────
  const rockX = new Float32Array(MAX_ROCKS);
  const rockY = new Float32Array(MAX_ROCKS);
  const rockVX = new Float32Array(MAX_ROCKS);
  const rockVY = new Float32Array(MAX_ROCKS);
  const rockSize = new Uint8Array(MAX_ROCKS);
  const rockRot = new Float32Array(MAX_ROCKS);
  const rockRotV = new Float32Array(MAX_ROCKS);
  // 8 vrcholů × poměr k poloměru — nepravidelný obrys, počítá se při spawnu
  const rockShape = new Float32Array(MAX_ROCKS * 8);
  const rockAlive = new Uint8Array(MAX_ROCKS);

  const bulletX = new Float32Array(MAX_BULLETS);
  const bulletY = new Float32Array(MAX_BULLETS);
  const bulletVX = new Float32Array(MAX_BULLETS);
  const bulletVY = new Float32Array(MAX_BULLETS);
  const bulletLife = new Float32Array(MAX_BULLETS);
  const bulletAlive = new Uint8Array(MAX_BULLETS);

  const starX = new Float32Array(STARS);
  const starY = new Float32Array(STARS);
  const starR = new Float32Array(STARS);

  for (let i = 0; i < STARS; i++) {
    starX[i] = Math.random() * GAME_W;
    starY[i] = Math.random() * GAME_H;
    starR[i] = Math.random() < 0.15 ? 1.6 : 1;
  }

  const ship = { x: GAME_W / 2, y: GAME_H / 2, vx: 0, vy: 0, angle: -Math.PI / 2, guard: 0 };
  const keys = { thrust: false, left: false, right: false, fire: false };
  const state = {
    score: 0,
    lives: START_LIVES,
    wave: 0,
    fireCooldown: 0,
    running: true,
    started: false,
    /** Odpočet před novou vlnou (0 = vlna běží). */
    respawnTimer: 0,
  };
  /** Ukazatel drží směr — jeho hodnota se mění jen při pohybu myši. */
  let pointerAngle: number | null = null;

  function wrap(value: number, max: number): number {
    if (value < -10) return value + max + 20;
    if (value > max + 10) return value - max - 20;
    return value;
  }

  function shapeRock(index: number) {
    for (let i = 0; i < 8; i++) {
      rockShape[index * 8 + i] = 0.62 + Math.random() * 0.5;
    }
  }

  function spawnRock(x: number, y: number, size: number): boolean {
    for (let i = 0; i < MAX_ROCKS; i++) {
      if (rockAlive[i]) continue;
      const angle = Math.random() * Math.PI * 2;
      const speed = 22 + Math.random() * 34 + state.wave * 3;
      rockX[i] = x;
      rockY[i] = y;
      rockVX[i] = Math.cos(angle) * speed;
      rockVY[i] = Math.sin(angle) * speed;
      rockSize[i] = size;
      rockRot[i] = Math.random() * Math.PI * 2;
      rockRotV[i] = (Math.random() - 0.5) * 1.1;
      rockAlive[i] = 1;
      shapeRock(i);
      return true;
    }
    return false;
  }

  /** Skály startují u okraje — nikdy přímo pod lodí. */
  function spawnWave() {
    state.wave += 1;
    const count = Math.min(8, 3 + state.wave);
    for (let i = 0; i < count; i++) {
      const edge = Math.floor(Math.random() * 4);
      const x = edge === 0 ? -24 : edge === 1 ? GAME_W + 24 : Math.random() * GAME_W;
      const y = edge === 2 ? -24 : edge === 3 ? GAME_H + 24 : Math.random() * GAME_H;
      spawnRock(x, y, 3);
    }
  }

  function aliveRocks(): number {
    let count = 0;
    for (let i = 0; i < MAX_ROCKS; i++) if (rockAlive[i]) count += 1;
    return count;
  }

  function clearBullets() {
    bulletAlive.fill(0);
  }

  function resetShip() {
    ship.x = GAME_W / 2;
    ship.y = GAME_H / 2;
    ship.vx = 0;
    ship.vy = 0;
    ship.angle = -Math.PI / 2;
    ship.guard = RESPAWN_GUARD;
  }

  function reset() {
    rockAlive.fill(0);
    clearBullets();
    state.score = 0;
    state.lives = START_LIVES;
    state.wave = 0;
    state.fireCooldown = 0;
    state.respawnTimer = 0;
    state.running = true;
    state.started = false;
    keys.thrust = false;
    keys.left = false;
    keys.right = false;
    keys.fire = false;
    pointerAngle = null;
    resetShip();
    hooks.onScore(0);
    spawnWave();
  }

  function fire() {
    for (let i = 0; i < MAX_BULLETS; i++) {
      if (bulletAlive[i]) continue;
      bulletX[i] = ship.x + Math.cos(ship.angle) * 14;
      bulletY[i] = ship.y + Math.sin(ship.angle) * 14;
      bulletVX[i] = ship.vx * 0.4 + Math.cos(ship.angle) * BULLET_SPEED;
      bulletVY[i] = ship.vy * 0.4 + Math.sin(ship.angle) * BULLET_SPEED;
      bulletLife[i] = BULLET_LIFE;
      bulletAlive[i] = 1;
      return;
    }
  }

  /** Rozdělení skály: větší kus nechá dva menší. */
  function breakRock(index: number, byBullet: boolean) {
    const size = rockSize[index];
    rockAlive[index] = 0;
    if (!byBullet) return;
    state.score += ROCK_SCORE[size];
    hooks.onScore(state.score);
    if (size <= 1) return;
    for (let i = 0; i < 2; i++) {
      spawnRock(rockX[index], rockY[index], size - 1);
    }
  }

  function destroyShip() {
    if (ship.guard > 0) return;
    state.lives -= 1;
    // nejbližší skálu rozstřelíme i bez střely — jinak by hráč vletěl zpět
    for (let i = 0; i < MAX_ROCKS; i++) {
      if (!rockAlive[i]) continue;
      const dx = rockX[i] - ship.x;
      const dy = rockY[i] - ship.y;
      if (dx * dx + dy * dy < 900) breakRock(i, false);
    }
    if (state.lives <= 0) {
      state.running = false;
      hooks.onEnd(state.score);
      return;
    }
    resetShip();
  }

  function frame(dtRaw: number) {
    if (!ctx) return;
    const dt = Math.min(0.05, dtRaw);

    if (state.running) {
      state.started = true;
      if (state.fireCooldown > 0) state.fireCooldown -= dt;
      if (ship.guard > 0) ship.guard -= dt;

      // ── řízení ────────────────────────────────────────────────
      // ukazatel míří na kurzor; bez něj platí klávesy (ve VR paprsek)
      if (pointerAngle !== null) {
        let diff = pointerAngle - ship.angle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        const maxTurn = ROTATE * dt;
        ship.angle += Math.max(-maxTurn, Math.min(maxTurn, diff));
        // mířit = tlačit — jinak se s ukazatelem nedá ovládat
        if (Math.abs(diff) < 1.1) {
          ship.vx += Math.cos(ship.angle) * THRUST * dt;
          ship.vy += Math.sin(ship.angle) * THRUST * dt;
        }
      } else {
        if (keys.left) ship.angle -= ROTATE * dt;
        if (keys.right) ship.angle += ROTATE * dt;
        if (keys.thrust) {
          ship.vx += Math.cos(ship.angle) * THRUST * dt;
          ship.vy += Math.sin(ship.angle) * THRUST * dt;
        }
      }

      // hybnost se ztrácí pomalu — klasika, bez ní loď neklouže
      const drag = Math.max(0, 1 - DRAG * dt);
      ship.vx *= drag;
      ship.vy *= drag;
      ship.x = wrap(ship.x + ship.vx * dt, GAME_W);
      ship.y = wrap(ship.y + ship.vy * dt, GAME_H);

      if ((keys.fire || pointerAngle !== null) && state.fireCooldown <= 0) {
        fire();
        state.fireCooldown = FIRE_COOLDOWN;
      }

      // ── střely ────────────────────────────────────────────────
      for (let i = 0; i < MAX_BULLETS; i++) {
        if (!bulletAlive[i]) continue;
        bulletLife[i] -= dt;
        if (bulletLife[i] <= 0) {
          bulletAlive[i] = 0;
          continue;
        }
        bulletX[i] = wrap(bulletX[i] + bulletVX[i] * dt, GAME_W);
        bulletY[i] = wrap(bulletY[i] + bulletVY[i] * dt, GAME_H);
        for (let r = 0; r < MAX_ROCKS; r++) {
          if (!rockAlive[r]) continue;
          const radius = ROCK_RADIUS[rockSize[r]];
          const dx = bulletX[i] - rockX[r];
          const dy = bulletY[i] - rockY[r];
          if (dx * dx + dy * dy <= radius * radius) {
            bulletAlive[i] = 0;
            breakRock(r, true);
            break;
          }
        }
      }

      // ── skály ─────────────────────────────────────────────────
      let rocks = 0;
      for (let i = 0; i < MAX_ROCKS; i++) {
        if (!rockAlive[i]) continue;
        rocks += 1;
        rockX[i] = wrap(rockX[i] + rockVX[i] * dt, GAME_W);
        rockY[i] = wrap(rockY[i] + rockVY[i] * dt, GAME_H);
        rockRot[i] += rockRotV[i] * dt;

        const radius = ROCK_RADIUS[rockSize[i]];
        const dx = rockX[i] - ship.x;
        const dy = rockY[i] - ship.y;
        const hit = radius + 10;
        if (dx * dx + dy * dy <= hit * hit) {
          destroyShip();
          if (!state.running) break;
        }
      }

      // vlna vyklizena → další
      if (state.running && rocks === 0) {
        state.respawnTimer += dt;
        if (state.respawnTimer > 1.4) {
          state.respawnTimer = 0;
          clearBullets();
          spawnWave();
        }
      }
    }

    // ── kresba ──────────────────────────────────────────────────
    ctx.fillStyle = PARK_PALETTE.bg;
    ctx.fillRect(0, 0, GAME_W, GAME_H);

    ctx.fillStyle = 'rgba(127, 227, 212, 0.5)';
    for (let i = 0; i < STARS; i++) {
      ctx.fillRect(starX[i], starY[i], starR[i], starR[i]);
    }

    // skály — osmiúhelník s nepravidelným obrysem
    for (let i = 0; i < MAX_ROCKS; i++) {
      if (!rockAlive[i]) continue;
      ctx.save();
      ctx.translate(rockX[i], rockY[i]);
      ctx.rotate(rockRot[i]);
      ctx.beginPath();
      const radius = ROCK_RADIUS[rockSize[i]];
      for (let v = 0; v < 8; v++) {
        const angle = (v / 8) * Math.PI * 2;
        const px = Math.cos(angle) * radius * rockShape[i * 8 + v];
        const py = Math.sin(angle) * radius * rockShape[i * 8 + v];
        if (v === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.strokeStyle = rockSize[i] === 1 ? PARK_PALETTE.amber : 'rgba(244, 234, 210, 0.85)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }

    // střely
    ctx.fillStyle = PARK_PALETTE.gold;
    for (let i = 0; i < MAX_BULLETS; i++) {
      if (!bulletAlive[i]) continue;
      ctx.fillRect(bulletX[i] - 1.5, bulletY[i] - 1.5, 3, 3);
    }

    // loď — trojúhelník s výřezem u trysek
    if (state.running) {
      const flicker = ship.guard > 0 && Math.floor(ship.guard * 12) % 2 === 0;
      ctx.save();
      ctx.translate(ship.x, ship.y);
      ctx.rotate(ship.angle);
      ctx.beginPath();
      ctx.moveTo(14, 0);
      ctx.lineTo(-10, 8);
      ctx.lineTo(-6, 0);
      ctx.lineTo(-10, -8);
      ctx.closePath();
      ctx.strokeStyle = flicker ? 'rgba(244, 234, 210, 0.35)' : PARK_PALETTE.gold;
      ctx.lineWidth = 2;
      ctx.stroke();
      if (keys.thrust || pointerAngle !== null) {
        ctx.beginPath();
        ctx.moveTo(-7, 4);
        ctx.lineTo(-16 - Math.random() * 6, 0);
        ctx.lineTo(-7, -4);
        ctx.closePath();
        ctx.fillStyle = PARK_PALETTE.cyan;
        ctx.fill();
      }
      ctx.restore();
    }

    // HUD
    ctx.font = 'bold 18px ui-monospace, monospace';
    ctx.textAlign = 'left';
    ctx.fillStyle = PARK_PALETTE.ink;
    ctx.fillText(String(state.score).padStart(4, '0'), 16, 26);
    for (let i = 0; i < state.lives; i++) {
      ctx.save();
      ctx.translate(22 + i * 18, GAME_H - 20);
      ctx.rotate(-Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(7, 0);
      ctx.lineTo(-5, 4);
      ctx.lineTo(-3, 0);
      ctx.lineTo(-5, -4);
      ctx.closePath();
      ctx.strokeStyle = PARK_PALETTE.gold;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(127, 227, 212, 0.8)';
    ctx.font = '13px ui-monospace, monospace';
    ctx.fillText(state.wave > 0 ? `vlna ${state.wave}` : '', GAME_W - 16, 24);

    if (!state.running) {
      ctx.fillStyle = 'rgba(5, 4, 10, 0.74)';
      ctx.fillRect(0, GAME_H / 2 - 46, GAME_W, 92);
      ctx.textAlign = 'center';
      ctx.fillStyle = PARK_PALETTE.red;
      ctx.font = 'bold 26px ui-monospace, monospace';
      ctx.fillText('KONEC HRY', GAME_W / 2, GAME_H / 2 + 2);
      ctx.font = '13px ui-monospace, monospace';
      ctx.fillStyle = PARK_PALETTE.ink;
      ctx.fillText(`skóre ${state.score} · vlna ${state.wave} · Hrát znovu`, GAME_W / 2, GAME_H / 2 + 28);
    }
  }

  reset();

  return {
    frame,
    pointer: (x) => {
      if (x === null) {
        pointerAngle = null;
        return;
      }
      // kurzor je v horní polovině → míří směrem nahoru jako loď
      pointerAngle = Math.atan2((GAME_H / 2 - GAME_H / 3) - GAME_H / 2, (x * GAME_W - ship.x) || 0.001);
    },
    key: (code, down) => {
      if (code === 'ArrowLeft' || code === 'KeyA') keys.left = down;
      else if (code === 'ArrowRight' || code === 'KeyD') keys.right = down;
      else if (code === 'ArrowUp' || code === 'KeyW') keys.thrust = down;
      else if (code === 'Space' || code === 'KeyJ' || code === 'KeyF') keys.fire = down;
    },
    stop: () => {
      state.running = false;
      keys.thrust = false;
      keys.left = false;
      keys.right = false;
      keys.fire = false;
      pointerAngle = null;
    },
  };
}
